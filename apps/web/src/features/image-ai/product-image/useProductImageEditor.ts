import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { useMessage } from "naive-ui";
import { defaultProductImageRecipe, type ImageAiTask, type ProductImageSource } from "@toolbox/shared";
import type ProductImageCanvas from "./ProductImageCanvas.vue";
import { imageAiApi } from "../api";
import { absoluteImageAiUrl, triggerImageAiDownload } from "../media-links";
import { useConfirmDialog } from "../../../shared/composables/useConfirmDialog";
import { useRequestScope } from "../../../shared/composables/useRequestScope";
import { formatApiError, isApiErrorCancelled } from "../../../shared/http/http";
import { useProductImageBackground } from "./useProductImageBackground";
import { useProductImageLayout } from "./useProductImageLayout";
export function useProductImageEditor(
  props: { taskId: string; resultId: string },
  emit: { (event: "close"): void; (event: "saved", task: ImageAiTask): void }
) {
  const confirm = useConfirmDialog(),
    message = useMessage();
  const source = ref<ProductImageSource>(),
    recipe = ref(defaultProductImageRecipe());
  const canvas = ref<InstanceType<typeof ProductImageCanvas>>();
  const loading = ref(true),
    ready = ref(false),
    dirty = ref(false),
    submitting = ref(false),
    error = ref("");
  const task = ref<ImageAiTask>(),
    savedTask = ref<ImageAiTask>();
  const taskBusy = computed(() => Boolean(task.value && ["pending", "running"].includes(task.value.status)));
  const busy = computed(() => submitting.value || taskBusy.value || loading.value);
  const cancelRequested = ref(false),
    canUndo = ref(false),
    canRedo = ref(false),
    canvasVersion = ref(0);

  const downloadFormat = ref("png");
  const controller = useRequestScope();
  let disposed = false,
    submissionKey = crypto.randomUUID();
  function changed() {
    dirty.value = true;
    submissionKey = crypto.randomUUID();
  }

  const layout = useProductImageLayout(recipe, changed);
  const { customPreset } = layout;
  const background = useProductImageBackground(busy, changed);
  const { backgroundUrl, backgroundFile } = background;
  function setHistory(undo: boolean, redo: boolean) {
    canUndo.value = undo;
    canRedo.value = redo;
  }

  async function loadSource(taskId: string, resultId: string) {
    loading.value = true;
    ready.value = false;
    error.value = "";
    try {
      const value = await imageAiApi.editSource(taskId, resultId, controller.signal);
      if (disposed) return;
      source.value = value;
      recipe.value = structuredClone(value.recipe);
      customPreset.value = false;
      background.restoreBackground(value.backgroundUrl);
      canvasVersion.value++;
      canUndo.value = canRedo.value = false;
    } catch (value) {
      if (!disposed && !isApiErrorCancelled(value)) error.value = formatApiError(value);
    } finally {
      if (!disposed) loading.value = false;
    }
  }
  async function leave() {
    if (busy.value) return;
    if (
      !dirty.value ||
      (await confirm("当前修改尚未保存，是否放弃？", { positiveText: "放弃修改", negativeText: "继续编辑" }))
    )
      emit("close");
  }
  async function reset() {
    if (!source.value || !(await confirm("放弃当前修改，恢复到本次打开的版本？", { positiveText: "重置编辑" }))) return;
    await loadSource(source.value.taskId, source.value.resultId);
    dirty.value = false;
    submissionKey = crypto.randomUUID();
  }
  async function resetRefinement() {
    if (await confirm("清除所有精修笔触，恢复初始抠图结果？背景和排版保持不变。", { positiveText: "重置精修" }))
      canvas.value?.resetRefinement();
  }
  async function save() {
    if (busy.value || !ready.value || !source.value || !canvas.value) return;
    if (recipe.value.canvas.width * recipe.value.canvas.height > 16000000) {
      message.error("画布总像素不能超过 1600 万");
      return;
    }
    if (recipe.value.background.kind === "image" && !backgroundUrl.value) {
      message.error("请选择背景图片");
      return;
    }
    submitting.value = true;
    error.value = "";
    cancelRequested.value = false;
    try {
      const [erase, restore] = await canvas.value.masks();
      const form = new FormData();
      form.append("taskId", source.value.taskId);
      form.append("resultId", source.value.resultId);
      form.append("recipe", JSON.stringify(recipe.value));
      form.append("submissionKey", submissionKey);
      form.append("erase", erase, "erase.png");
      if (source.value.canRestore) form.append("restore", restore, "restore.png");
      if (backgroundFile.value) form.append("background", backgroundFile.value);
      task.value = await imageAiApi.compose(form);
      while (!disposed && ["pending", "running"].includes(task.value.status)) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        if (disposed) return;
        try {
          task.value = await imageAiApi.getTask(task.value.id, controller.signal);
        } catch (value) {
          if (disposed || isApiErrorCancelled(value)) return;
          error.value = "暂时无法读取保存状态，正在等待连接恢复；不会重复提交任务。";
          await new Promise((resolve) => setTimeout(resolve, 1400));
        }
      }
      if (disposed) return;
      if (task.value.status === "completed") {
        savedTask.value = task.value;
        dirty.value = false;
        emit("saved", task.value);
        message.success("商品图已作为独立版本留档");
        await loadSource(task.value.id, task.value.results[0].id);
        submissionKey = crypto.randomUUID();
      } else {
        submissionKey = crypto.randomUUID();
        if (task.value.status !== "canceled") error.value = task.value.error || "保存失败，请调整后重试";
      }
    } catch (value) {
      if (!disposed && !isApiErrorCancelled(value)) error.value = formatApiError(value, "保存商品图失败");
    } finally {
      if (!disposed) submitting.value = false;
    }
  }
  async function cancel() {
    if (!taskBusy.value || !task.value || cancelRequested.value) return;
    cancelRequested.value = true;
    try {
      task.value = await imageAiApi.cancelTask(task.value.id);
    } catch (value) {
      cancelRequested.value = false;
      message.error(formatApiError(value));
    }
  }
  async function download() {
    const result = savedTask.value?.results[0];
    if (!result) return;
    let suffix = `?download=1&format=${downloadFormat.value}`;
    if (downloadFormat.value === "jpeg" && savedTask.value?.recipe?.background.kind === "transparent") {
      if (
        !(await confirm("JPEG 不支持透明，将使用白色填充透明区域。是否继续？", {
          positiveText: "白底下载",
          danger: false
        }))
      )
        return;
      suffix += "&flatten=white";
    }
    triggerImageAiDownload(absoluteImageAiUrl(result.downloadUrl + suffix));
  }
  function beforeUnload(event: BeforeUnloadEvent) {
    if (dirty.value || busy.value) {
      event.preventDefault();
      event.returnValue = "";
    }
  }
  onMounted(() => {
    window.addEventListener("beforeunload", beforeUnload);
    void loadSource(props.taskId, props.resultId);
  });
  onBeforeRouteLeave(async () => {
    if (taskBusy.value || submitting.value) {
      message.warning("请等待保存完成，或取消后再离开");
      return false;
    }
    return !dirty.value || (await confirm("当前商品图修改尚未保存，是否离开？", { positiveText: "放弃修改" }));
  });
  onBeforeUnmount(() => {
    disposed = true;
    controller.abort();
    window.removeEventListener("beforeunload", beforeUnload);
  });

  return {
    source,
    recipe,
    canvas,
    loading,
    ready,
    dirty,
    submitting,
    error,
    task,
    savedTask,
    taskBusy,
    busy,
    cancelRequested,
    canUndo,
    canRedo,
    canvasVersion,
    downloadFormat,
    ...layout,
    ...background,
    changed,
    setHistory,
    leave,
    reset,
    resetRefinement,
    save,
    cancel,
    download
  };
}
