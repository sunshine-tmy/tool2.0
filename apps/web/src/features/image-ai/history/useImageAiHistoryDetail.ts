import { onBeforeUnmount, ref } from "vue";
import type { ImageAiTask } from "@toolbox/shared";
import { imageAiApi } from "../api";
import { formatApiError, isApiErrorCancelled } from "../../../shared/http/http";
export function useImageAiHistoryDetail() {
  const detailOpen = ref(false);
  const loadingDetail = ref(false);
  const detailError = ref("");
  const selectedTask = ref<ImageAiTask>();
  const viewedTaskId = ref<string>();

  let detailGeneration = 0,
    disposed = false;
  async function viewTask(id: string) {
    const generation = ++detailGeneration;
    viewedTaskId.value = id;
    selectedTask.value = undefined;
    detailError.value = "";
    detailOpen.value = true;
    loadingDetail.value = true;
    try {
      const task = await imageAiApi.getTask(id);
      if (!disposed && generation === detailGeneration) selectedTask.value = task;
    } catch (error) {
      if (!disposed && generation === detailGeneration && !isApiErrorCancelled(error))
        detailError.value = formatApiError(error, "读取处理记录详情失败");
    } finally {
      if (!disposed && generation === detailGeneration) loadingDetail.value = false;
    }
  }

  function closeRemoved(id: string) {
    if (viewedTaskId.value === id) {
      detailOpen.value = false;
      selectedTask.value = undefined;
      detailGeneration += 1;
    }
  }
  onBeforeUnmount(() => {
    disposed = true;
    detailGeneration += 1;
  });
  return { detailOpen, loadingDetail, detailError, selectedTask, viewedTaskId, viewTask, closeRemoved };
}
