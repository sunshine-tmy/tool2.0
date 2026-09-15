import { computed, onMounted, ref, watch, type Ref } from "vue";
import type { ChatterboxBatch, ChatterboxBatchList, ChatterboxTaskList, TaskDto } from "@toolbox/shared";
import { chatterboxApi } from "./chatterbox-api";
import type { ChatterboxEditorState } from "./useChatterboxEditor";
import { ApiRequestError, formatApiError, isApiErrorCancelled } from "../../services/http";

type BatchMessage = {
  success: (message: string) => void;
  warning: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

type ConfirmAction = (
  message: string,
  options: { title: string; positiveText?: string; danger?: boolean }
) => Promise<boolean>;

type TaskEvents = {
  task: Ref<TaskDto | undefined>;
  error: Ref<ApiRequestError | undefined>;
};

export function useChatterboxBatches(options: {
  editor: ChatterboxEditorState;
  taskEvents: TaskEvents;
  message: BatchMessage;
  confirmAction: ConfirmAction;
}) {
  const editor = options.editor;
  const loadingBatches = ref(false);
  const batchHistory = ref<ChatterboxBatchList>({
    batches: [],
    pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 }
  });
  const legacyHistory = ref<ChatterboxTaskList>({
    tasks: [],
    pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 }
  });
  const detailBatch = ref<ChatterboxBatch>();
  const detailVisible = ref(false);
  const regeneratingItemId = ref<string>();
  const errorMessage = editor.errorMessage;

  const orderedDetailItems = computed(() =>
    detailBatch.value ? [...detailBatch.value.items].sort((a, b) => a.order - b.order) : []
  );
  const retryVoiceOptions = computed(() => [
    {
      label: detailBatch.value?.referenceAvailable ? "沿用当前参考音色" : "选择永久参考音色",
      value: ""
    },
    ...editor.savedVoices.value
      .filter((voice) => voice.language === detailBatch.value?.language)
      .map((voice) => ({ label: `${voice.name} · ${voice.durationSeconds.toFixed(1)} 秒`, value: voice.id }))
  ]);

  onMounted(() => void Promise.all([loadBatches(), loadLegacyHistory()]));
  watch(options.taskEvents.task, (task) => {
    const current = editor.currentBatch.value;
    if (!task || task.id !== current?.id) return;
    const next: ChatterboxBatch = {
      ...current,
      status:
        task.status === "pending"
          ? "queued"
          : task.status === "running"
            ? "processing"
            : task.status === "completed"
              ? "completed"
              : "partial_failed",
      progress: task.progress,
      updatedAt: task.updatedAt
    };
    editor.currentBatch.value = next;
    if (detailBatch.value?.id === task.id) setDetailBatch(next);
    if (task.status === "completed" || task.status === "failed") void finishStreamedBatch(task.id);
  });
  watch(options.taskEvents.error, (error) => {
    if (error && !isApiErrorCancelled(error)) errorMessage.value = formatApiError(error);
  });

  async function loadBatches() {
    loadingBatches.value = true;
    try {
      batchHistory.value = await chatterboxApi.batches(1, 10);
    } catch (error) {
      if (!isApiErrorCancelled(error)) errorMessage.value = formatApiError(error, "批次记录读取失败");
    } finally {
      loadingBatches.value = false;
    }
  }
  async function loadLegacyHistory() {
    try {
      legacyHistory.value = await chatterboxApi.list(1, 10);
    } catch {
      // Legacy history is optional.
    }
  }

  async function createBatch() {
    if (!editor.canCreate.value) return;
    editor.creating.value = true;
    errorMessage.value = "";
    try {
      editor.currentBatch.value = await chatterboxApi.createBatch({
        reference: editor.referenceSource.value === "upload" ? editor.referenceFile.value : undefined,
        voiceId: editor.referenceSource.value === "saved" ? editor.selectedVoiceId.value : undefined,
        segments: editor.segments.value.map((item) => ({
          text: item.text.trim(),
          referenceTranslation: item.referenceTranslation.trim() || undefined,
          fileName: item.fileName.trim() || undefined
        })),
        name: editor.batchName.value.trim() || undefined,
        language: editor.language.value,
        authorization: editor.authorization.value,
        consentConfirmed: editor.consentConfirmed.value,
        exaggeration: editor.exaggeration.value,
        cfgWeight: editor.cfgWeight.value,
        temperature: editor.temperature.value,
        seed: editor.seed.value || 0,
        includeSubtitles: editor.includeSubtitles.value,
        subtitleMode: editor.subtitleMode.value,
        referenceRetained: editor.referenceRetained.value
      });
      options.message.success("批次已加入生成队列");
      await loadBatches();
    } catch (error) {
      if (!isApiErrorCancelled(error)) errorMessage.value = formatApiError(error, "声音克隆批次创建失败");
    } finally {
      editor.creating.value = false;
    }
  }

  async function finishStreamedBatch(batchId: string) {
    try {
      const batch = await chatterboxApi.batch(batchId);
      if (editor.currentBatch.value?.id !== batchId) return;
      editor.currentBatch.value = batch;
      if (detailBatch.value?.id === batchId) setDetailBatch(batch);
      if (batch.status === "completed") options.message.success("批量声音克隆生成完成");
      else options.message.warning("批次已结束，请查看失败文案段");
      await loadBatches();
    } catch (error) {
      if (!isApiErrorCancelled(error)) errorMessage.value = formatApiError(error, "批次结果读取失败");
    }
  }

  async function openBatch(id: string) {
    try {
      const batch = await chatterboxApi.batch(id);
      setDetailBatch(batch);
      if (isBatchRunning(batch)) editor.currentBatch.value = batch;
      detailVisible.value = true;
    } catch (error) {
      notifyError(options.message, error, "批次详情读取失败");
    }
  }
  function setDetailBatch(batch: ChatterboxBatch) {
    detailBatch.value = batch;
    for (const item of batch.items) {
      editor.itemDrafts[item.id] = {
        text: item.text,
        referenceTranslation: item.referenceTranslation || "",
        fileName: item.fileName || "",
        seed: item.seed ?? batch.seed,
        exaggeration: item.exaggeration ?? batch.exaggeration,
        cfgWeight: item.cfgWeight ?? batch.cfgWeight,
        temperature: item.temperature ?? batch.temperature
      };
    }
  }
  async function refreshDetail() {
    if (detailBatch.value) setDetailBatch(await chatterboxApi.batch(detailBatch.value.id));
    await loadBatches();
  }

  async function regenerateItem(itemId: string) {
    if (!detailBatch.value) return;
    if (!detailBatch.value.referenceAvailable && !editor.retryReference.value && !editor.retryVoiceId.value) {
      return options.message.warning("请先选择永久参考音色或重新上传音频");
    }
    regeneratingItemId.value = itemId;
    try {
      const draft = editor.itemDrafts[itemId];
      setDetailBatch(
        await chatterboxApi.regenerate(detailBatch.value.id, itemId, {
          text: draft.text.trim(),
          referenceTranslation: draft.referenceTranslation.trim() || undefined,
          fileName: draft.fileName.trim() || undefined,
          seed: draft.seed,
          exaggeration: draft.exaggeration,
          cfgWeight: draft.cfgWeight,
          temperature: draft.temperature,
          reference: editor.retryReference.value,
          voiceId: editor.retryReference.value ? undefined : editor.retryVoiceId.value || undefined
        })
      );
      editor.currentBatch.value = detailBatch.value;
      editor.retryReference.value = undefined;
      editor.retryVoiceId.value = "";
      options.message.success("该文案段已加入重新生成队列");
    } catch (error) {
      notifyError(options.message, error, "重新生成失败");
    } finally {
      regeneratingItemId.value = undefined;
    }
  }
  async function moveDetailItem(index: number, delta: number) {
    if (!detailBatch.value) return;
    const ids = orderedDetailItems.value.map((item) => item.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      setDetailBatch(await chatterboxApi.reorder(detailBatch.value.id, ids));
      await loadBatches();
    } catch (error) {
      notifyError(options.message, error, "调整顺序失败");
    }
  }
  async function removeBatchItem(itemId: string) {
    if (!detailBatch.value) return;
    if (!(await options.confirmAction("删除这一段及其音频，并重建总 SRT？", { title: "删除文案段" }))) return;
    try {
      const result = await chatterboxApi.removeBatchItem(detailBatch.value.id, itemId);
      if (result.batch) setDetailBatch(result.batch);
      await loadBatches();
      options.message.success("文案段已删除");
    } catch (error) {
      notifyError(options.message, error, "删除失败");
    }
  }
  async function cancelBatch(id: string) {
    if (
      !(await options.confirmAction("取消尚未开始的文案段？正在生成的一段会继续完成。", {
        title: "取消批次",
        positiveText: "确认取消"
      }))
    )
      return;
    try {
      editor.currentBatch.value = await chatterboxApi.cancelBatch(id);
      await loadBatches();
    } catch (error) {
      notifyError(options.message, error, "取消失败");
    }
  }
  async function removeReference(id: string) {
    if (
      !(await options.confirmAction("提前删除参考音色后，再次生成需要重新上传。确定删除？", { title: "删除参考音色" }))
    )
      return;
    try {
      await chatterboxApi.removeBatchReference(id);
      await refreshDetail();
      options.message.success("参考音色已删除");
    } catch (error) {
      notifyError(options.message, error, "删除参考音色失败");
    }
  }
  async function removeBatch(id: string) {
    if (!(await options.confirmAction("删除整个批次、全部音频和总 SRT？", { title: "删除整个批次" }))) return;
    try {
      await chatterboxApi.removeBatch(id);
      if (editor.currentBatch.value?.id === id) editor.currentBatch.value = undefined;
      if (detailBatch.value?.id === id) detailVisible.value = false;
      await loadBatches();
      options.message.success("批次已删除");
    } catch (error) {
      notifyError(options.message, error, "删除批次失败");
    }
  }
  async function reuseLegacy(id: string) {
    try {
      const task = await chatterboxApi.task(id);
      editor.segments.value = [editor.newEditorSegment(task.text, task.fileName || "")];
      editor.language.value = task.language;
      editor.authorization.value = task.authorization;
      editor.exaggeration.value = task.exaggeration;
      editor.cfgWeight.value = task.cfgWeight;
      editor.temperature.value = task.temperature;
      editor.seed.value = task.seed;
      editor.includeSubtitles.value = task.includeSubtitles;
      editor.consentConfirmed.value = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
      options.message.info("旧文案已载入，请重新上传参考音色并确认授权");
    } catch (error) {
      notifyError(options.message, error, "读取旧记录失败");
    }
  }
  async function removeLegacy(id: string) {
    if (!(await options.confirmAction("删除这条旧版声音克隆记录？", { title: "删除声音克隆记录" }))) return;
    try {
      await chatterboxApi.remove(id);
      await loadLegacyHistory();
    } catch (error) {
      notifyError(options.message, error, "删除失败");
    }
  }

  return {
    loadingBatches,
    batchHistory,
    legacyHistory,
    detailBatch,
    detailVisible,
    regeneratingItemId,
    errorMessage,
    orderedDetailItems,
    retryVoiceOptions,
    loadBatches,
    createBatch,
    openBatch,
    regenerateItem,
    moveDetailItem,
    removeBatchItem,
    cancelBatch,
    removeReference,
    removeBatch,
    reuseLegacy,
    removeLegacy,
    finishStreamedBatch
  };
}

function isBatchRunning(batch: ChatterboxBatch) {
  return batch.status === "queued" || batch.status === "processing";
}

function notifyError(message: BatchMessage, error: unknown, fallback: string) {
  if (!isApiErrorCancelled(error)) message.error(formatApiError(error, fallback));
}
