import { getCurrentInstance, onActivated, onDeactivated, onScopeDispose } from "vue";
import { useRequestScope } from "./useRequestScope";

/** Serial health checks, paused for hidden windows and inactive KeepAlive panels. */
export function useHealthPolling(
  check: (signal: AbortSignal, automatic: boolean) => Promise<void>,
  interval: () => number
) {
  const scope = useRequestScope();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;
  let active = true;
  const visible = () => typeof document === "undefined" || !document.hidden;
  const clear = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  function schedule() {
    clear();
    if (active && !scope.aborted && visible()) timer = setTimeout(() => void run(true), interval());
  }
  function run(automatic: boolean): Promise<void> {
    if (!active || scope.aborted) return Promise.resolve();
    if (inFlight) return inFlight;
    clear();
    inFlight = Promise.resolve()
      .then(() => {
        if (!scope.aborted) return check(scope.signal, automatic);
      })
      .finally(() => {
        inFlight = undefined;
        schedule();
      });
    return inFlight;
  }
  function onForeground() {
    if (visible()) void run(true);
  }
  function onVisibilityChange() {
    if (visible()) onForeground();
    else clear();
  }
  if (typeof window !== "undefined") window.addEventListener("focus", onForeground);
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibilityChange);
  if (getCurrentInstance()) {
    onDeactivated(() => {
      active = false;
      clear();
    });
    onActivated(() => {
      active = true;
      onForeground();
    });
  }
  onScopeDispose(() => {
    active = false;
    clear();
    if (typeof window !== "undefined") window.removeEventListener("focus", onForeground);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibilityChange);
  });
  return { refresh: () => run(false) };
}
