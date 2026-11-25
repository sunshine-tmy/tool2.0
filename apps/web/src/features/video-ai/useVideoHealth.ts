import { ref } from "vue";
import type { VideoAiHealth } from "@toolbox/shared";
import { useHealthPolling } from "../../shared/composables/useHealthPolling";
import { videoAiApi } from "./api";

/** Continue checking after startup so Worker restarts and capability changes stay visible. */
export function useVideoHealth() {
  const health = ref<VideoAiHealth>();
  const healthLoading = ref(false);
  const healthRecovering = ref(false);
  const capabilityError = ref("");
  let retryable = true;
  const { refresh: refreshHealth } = useHealthPolling(
    async (signal, automatic) => {
      healthLoading.value = !automatic;
      try {
        const result = await videoAiApi.health(signal);
        if (signal.aborted) return;
        health.value = result;
        retryable = true;
        healthRecovering.value = !result.available;
        capabilityError.value = result.available
          ? ""
          : "本机视频处理服务正在准备或连接中，将自动检查，就绪后即可使用，无需手动刷新。";
      } catch (caught) {
        if (signal.aborted) return;
        health.value = undefined;
        const code = caught && typeof caught === "object" && "code" in caught ? caught.code : undefined;
        retryable = code !== "COMPONENT_NOT_INSTALLED" && code !== "WORKER_PROTOCOL_MISMATCH";
        healthRecovering.value = retryable;
        capabilityError.value = retryable
          ? "本机视频处理服务正在准备或连接中，将自动检查，就绪后即可使用，无需手动刷新。"
          : caught instanceof Error
            ? caught.message
            : "无法读取视频处理服务状态";
      } finally {
        if (!signal.aborted) healthLoading.value = false;
      }
    },
    // Installation/protocol errors may recover after an update, so keep checking at a lower frequency.
    () => (!retryable ? 30_000 : health.value?.available ? 15_000 : 5_000)
  );
  return { health, healthLoading, healthRecovering, capabilityError, refreshHealth };
}
