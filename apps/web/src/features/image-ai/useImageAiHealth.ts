import { onMounted, onScopeDispose, ref } from "vue";
import type { ImageAiHealth } from "@toolbox/shared/image";
import { useRequestScope } from "../../shared/composables/useRequestScope";
import { imageAiApi } from "./api";

/** Keep availability in sync with optional Workers that can start or restart after the page. */
export function useImageAiHealth(onRefreshError: (error: unknown) => void) {
  const scope = useRequestScope();
  const health = ref<ImageAiHealth>();
  const loadingHealth = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;
  let disposed = false;

  function clearTimer() {
    clearTimeout(timer);
    timer = undefined;
  }

  function schedule() {
    clearTimer();
    if (disposed || scope.aborted || document.hidden) return;
    const ready = health.value?.available && health.value.models.every((model) => model.available);
    timer = setTimeout(() => void check(), ready ? 15_000 : 5_000);
  }

  function check(showLoading = false, notifyError = false): Promise<void> {
    if (disposed || scope.aborted) return Promise.resolve();
    if (inFlight) return inFlight;
    clearTimer();
    loadingHealth.value = showLoading;
    inFlight = Promise.resolve().then(async () => {
      try {
        const result = await imageAiApi.health(scope.signal);
        if (!disposed && !scope.aborted) health.value = result;
      } catch (error) {
        if (disposed || scope.aborted) return;
        health.value = undefined;
        // Automatic recovery must not repeatedly interrupt the user with toasts.
        if (notifyError) onRefreshError(error);
      } finally {
        inFlight = undefined;
        if (!disposed && !scope.aborted) {
          loadingHealth.value = false;
          schedule();
        }
      }
    });
    return inFlight;
  }

  function onForeground() {
    if (!document.hidden) void check();
  }

  function onVisibilityChange() {
    if (document.hidden) clearTimer();
    else onForeground();
  }

  onMounted(() => {
    window.addEventListener("focus", onForeground);
    document.addEventListener("visibilitychange", onVisibilityChange);
    void check(true);
  });
  onScopeDispose(() => {
    disposed = true;
    clearTimer();
    window.removeEventListener("focus", onForeground);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  });

  return { health, loadingHealth, loadHealth: () => check(true, true) };
}
