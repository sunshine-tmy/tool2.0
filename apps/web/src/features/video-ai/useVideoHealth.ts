import { onScopeDispose, ref } from "vue";
import type { VideoAiHealth } from "@toolbox/shared";
import { useRequestScope } from "../../shared/composables/useRequestScope";
import { videoAiApi } from "./api";

/** Optional workers start after the desktop shell. Retry serially while this
 * page is alive, with a finite budget and no repeated installation advice. */
export function useVideoHealth() {
  const scope = useRequestScope();
  const health = ref<VideoAiHealth>();
  const healthLoading = ref(false);
  const healthRecovering = ref(false);
  const capabilityError = ref("");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let deadline = 0;
  let failures = 0;
  let disposed = false;
  let inFlight: Promise<void> | undefined;
  const clearRetry = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  function scheduleRetry() {
    if (disposed || scope.aborted || Date.now() >= deadline) return false;
    healthRecovering.value = true;
    const delay = Math.min(10_000, 2000 * 2 ** Math.min(failures++, 3), deadline - Date.now());
    timer = setTimeout(() => {
      timer = undefined;
      void check();
    }, delay);
    return true;
  }

  function check(): Promise<void> {
    if (disposed || scope.aborted) return Promise.resolve();
    if (inFlight) return inFlight;
    clearRetry();
    healthLoading.value = true;
    inFlight = Promise.resolve().then(async () => {
      let retry = true;
      try {
        const result = await videoAiApi.health(scope.signal);
        if (disposed || scope.aborted) return;
        health.value = result;
        capabilityError.value = result.available ? "" : "视频处理服务暂未就绪，请查看运行诊断或稍后重试。";
        retry = !result.available;
      } catch (caught) {
        if (disposed || scope.aborted) return;
        health.value = undefined;
        const code = caught && typeof caught === "object" && "code" in caught ? caught.code : undefined;
        retry = code !== "COMPONENT_NOT_INSTALLED" && code !== "WORKER_PROTOCOL_MISMATCH";
        capabilityError.value = caught instanceof Error ? caught.message : "无法读取视频处理服务状态";
      } finally {
        inFlight = undefined;
        if (!disposed && !scope.aborted) {
          healthLoading.value = false;
          healthRecovering.value = false;
          if (retry) {
            if (scheduleRetry())
              capabilityError.value = "本机视频处理服务正在准备或连接中，将自动检查，就绪后即可使用，无需手动刷新。";
            else capabilityError.value = "视频处理服务仍未就绪，自动检查已暂停。请查看运行诊断，或点击刷新重新检查。";
          }
        }
      }
    });
    return inFlight;
  }

  function refreshHealth() {
    if (disposed || scope.aborted) return Promise.resolve();
    deadline = Date.now() + 5 * 60_000;
    failures = 0;
    return check();
  }
  function onFocus() {
    if (!health.value?.available && !inFlight) void refreshHealth();
  }
  if (typeof window !== "undefined") window.addEventListener("focus", onFocus);
  onScopeDispose(() => {
    disposed = true;
    clearRetry();
    if (typeof window !== "undefined") window.removeEventListener("focus", onFocus);
  });
  return { health, healthLoading, healthRecovering, capabilityError, refreshHealth };
}
