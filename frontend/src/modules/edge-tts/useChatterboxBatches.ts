/**
 * 中文模块说明：配音前端模块，负责 Edge-TTS 与 Chatterbox 的编辑、任务和音色交互
 */
import { computed, onMounted, onScopeDispose, ref, watch, type Ref } from "vue";
import type { ChatterboxBatch, ChatterboxBatchList, ChatterboxTaskList, TaskDto } from "@toolbox/shared";
import { chatterboxApi } from "./chatterbox-api";
import type { ChatterboxEditorState } from "./useChatterboxEditor";
import { ApiRequestError, formatApiError, isApiErrorCancelled } from "../../services/http";
import { useSpeechBatchSelection } from "./useSpeechBatchSelection";

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
  const batchPage = ref(1);
  let batchesRequestId = 0;
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
  const reusingBatchId = ref<string>();
  const errorMessage = editor.errorMessage;
  let disposed = false;
  let mutationVersion = 0;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingRefresh: { id: string; notify: boolean } | undefined;
  let refreshPromise: Promise<void> | undefined;
  let refreshController: AbortController | undefined;
  let refreshError: string | undefined;
  const notifiedRuns = new Set<string>();
  const batchSelection = useSpeechBatchSelection({
    batches: computed(() => batchHistory.value.batches),
    blocked: () => loadingBatches.value,
    remove: (id) => chatterboxApi.removeBatch(id),
    onRemoved: forgetBatch,
    reload: loadBatches,
    confirm: options.confirmAction,
    message: options.message
  });
  function forgetBatch(id: string) {
    mutationVersion++;
    if (editor.currentBatch.value?.id === id) editor.currentBatch.value = undefined;
    if (detailBatch.value?.id === id) detailVisible.value = false;
  }

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

  // 页面进入时并行读取新批次和旧任务历史；旧历史读取失败不阻断新批次功能。
  onMounted(() => void Promise.all([loadBatches(), loadLegacyHistory()]));
  watch(options.taskEvents.task, (task) => {
    // 通用任务事件不包含分段状态和音频时长，必须同步完整批次，不能只移动进度条。
    const current = editor.currentBatch.value;
    if (!task || task.id !== current?.id) return;
    void refreshBatch(task.id, task.status === "completed" || task.status === "failed");
  });
  watch(options.taskEvents.error, (error) => {
    if (error && !isApiErrorCancelled(error)) errorMessage.value = formatApiError(error);
  });
  watch([() => editor.currentBatch.value?.id, editor.isCurrentRunning], ([id], [previousId]) => {
    if (id !== previousId) refreshController?.abort();
    schedulePoll();
  });
  onScopeDispose(() => {
    disposed = true;
    pendingRefresh = undefined;
    refreshController?.abort();
    if (pollTimer) clearTimeout(pollTimer);
  });

  function schedulePoll() {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = undefined;
    const batch = editor.currentBatch.value;
    if (disposed || !batch || !isBatchRunning(batch)) return;
    // SSE 断连、静默或事件遗漏时仍每两秒补齐一次真实快照，不制造估算进度。
    pollTimer = setTimeout(async () => {
      await refreshBatch(batch.id);
      schedulePoll();
    }, 2000);
  }

  function refreshBatch(id: string, notify = false): Promise<void> {
    if (disposed || editor.currentBatch.value?.id !== id) return Promise.resolve();
    pendingRefresh = { id, notify: notify || (pendingRefresh?.id === id && pendingRefresh.notify) };
    if (!refreshPromise)
      refreshPromise = drainRefreshes().finally(() => {
        refreshPromise = undefined;
      });
    return refreshPromise;
  }

  async function drainRefreshes() {
    while (!disposed && pendingRefresh) {
      const request = pendingRefresh;
      pendingRefresh = undefined;
      const version = mutationVersion;
      const controller = new AbortController();
      refreshController = controller;
      try {
        const batch = await chatterboxApi.batch(request.id, controller.signal);
        const previous = editor.currentBatch.value;
        if (disposed || controller.signal.aborted || previous?.id !== request.id || version !== mutationVersion)
          continue;
        if (refreshError && errorMessage.value === refreshError) errorMessage.value = "";
        refreshError = undefined;
        editor.currentBatch.value = batch;
        if (detailBatch.value?.id === batch.id) setDetailBatch(batch, true);
        const terminal = !isBatchRunning(batch);
        if (terminal && (request.notify || isBatchRunning(previous))) {
          const run = `${batch.id}:${batch.items.map((item) => `${item.id}:${item.attempt}`).join(",")}`;
          if (!notifiedRuns.has(run)) {
            notifiedRuns.add(run);
            if (batch.status === "completed") options.message.success("批量声音克隆生成完成");
            else options.message.warning("批次已结束，请查看失败或取消的文案段");
          }
        }
        if (terminal || previous.completedItems !== batch.completedItems || previous.failedItems !== batch.failedItems)
          void loadBatches();
      } catch (error) {
        if (
          !disposed &&
          !controller.signal.aborted &&
          version === mutationVersion &&
          editor.currentBatch.value?.id === request.id &&
          !isApiErrorCancelled(error)
        ) {
          refreshError = formatApiError(error, "批次进度读取失败");
          errorMessage.value = refreshError;
        }
      } finally {
        if (refreshController === controller) refreshController = undefined;
      }
    }
  }

  async function loadBatches() {
    const requestId = ++batchesRequestId;
    loadingBatches.value = true;
    try {
      // 列表刷新使用共享 API 和 Schema 解码，取消请求不显示为业务错误。
      const result = await chatterboxApi.batches(batchPage.value, 10);
      if (disposed || requestId !== batchesRequestId) return;
      batchHistory.value = result;
      // 删除最后一页的最后一条后，沿用服务端校正后的页码。
      batchPage.value = result.pagination.page;
    } catch (error) {
      if (disposed || requestId !== batchesRequestId) return;
      batchPage.value = batchHistory.value.pagination.page;
      if (!isApiErrorCancelled(error)) errorMessage.value = formatApiError(error, "批次记录读取失败");
    } finally {
      if (!disposed && requestId === batchesRequestId) loadingBatches.value = false;
    }
  }
  async function changeBatchPage(page: number) {
    if (!Number.isInteger(page) || page < 1 || page > batchHistory.value.pagination.totalPages) return;
    batchPage.value = page;
    await loadBatches();
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
    // canCreate 已集中校验音色、授权、文本长度和模型状态，提交函数只负责组装 DTO 与刷新列表。
    editor.creating.value = true;
    mutationVersion++;
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
        device: editor.device.value,
        authorization: editor.authorization.value,
        consentConfirmed: editor.consentConfirmed.value,
        exaggeration: editor.exaggeration.value,
        cfgWeight: editor.cfgWeight.value,
        temperature: editor.temperature.value,
        seed: editor.seed.value || 0,
        includeSubtitles: editor.includeSubtitles.value,
        subtitleMode: editor.subtitleMode.value,
        referenceRetained: true
      });
      options.message.success("批次已加入生成队列");
      batchPage.value = 1;
      await loadBatches();
    } catch (error) {
      if (!isApiErrorCancelled(error)) errorMessage.value = formatApiError(error, "声音克隆批次创建失败");
    } finally {
      editor.creating.value = false;
    }
  }

  function finishStreamedBatch(batchId: string) {
    return refreshBatch(batchId, true);
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
  function setDetailBatch(batch: ChatterboxBatch, preserveDrafts = false) {
    detailBatch.value = batch;
    for (const item of batch.items) {
      if (preserveDrafts && editor.itemDrafts[item.id]) continue;
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
    mutationVersion++;
    try {
      // 重生成沿用当前批次参数，只覆盖当前段草稿；服务端负责重新排队并保持其他段的音频。
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
    mutationVersion++;
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
    mutationVersion++;
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
    mutationVersion++;
    try {
      editor.currentBatch.value = await chatterboxApi.cancelBatch(id);
      if (detailBatch.value?.id === id) setDetailBatch(editor.currentBatch.value, true);
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
    mutationVersion++;
    try {
      await chatterboxApi.removeBatchReference(id);
      await refreshDetail();
      options.message.success("参考音色已删除");
    } catch (error) {
      notifyError(options.message, error, "删除参考音色失败");
    }
  }
  async function removeBatch(id: string) {
    if (batchSelection.deletingBatches.value) return;
    if (!(await options.confirmAction("删除整个批次、全部音频和总 SRT？", { title: "删除整个批次" }))) return;
    mutationVersion++;
    try {
      await chatterboxApi.removeBatch(id);
      forgetBatch(id);
      await loadBatches();
      options.message.success("批次已删除");
    } catch (error) {
      notifyError(options.message, error, "删除批次失败");
    }
  }
  async function reuseBatch(id: string) {
    if (disposed || editor.creating.value || reusingBatchId.value) return;
    reusingBatchId.value = id;
    try {
      // 列表只含预览摘要；必须读取完整文案及中文，不能将截断预览写回输入区。
      const batch = await chatterboxApi.batch(id);
      if (disposed) return;
      if (
        editor.hasBatchDraft.value &&
        !(await options.confirmAction("用该批次的完整文案和设置覆盖当前待提交内容？已排队任务及原批次不受影响。", {
          title: "重新填入批次",
          positiveText: "确认填入",
          danger: false
        }))
      )
        return;
      if (disposed || editor.creating.value) return;
      editor.segments.value = [...batch.items]
        .sort((a, b) => a.order - b.order)
        .map((item) => editor.newEditorSegment(item.text, item.fileName || "", item.referenceTranslation || ""));
      editor.batchName.value = batch.name || "";
      editor.language.value = batch.language;
      editor.device.value =
        batch.device === "cuda" && editor.health.value?.cudaAvailable !== true ? "cpu" : batch.device || "cpu";
      editor.authorization.value = batch.authorization;
      editor.consentConfirmed.value = false;
      editor.exaggeration.value = batch.exaggeration;
      editor.cfgWeight.value = batch.cfgWeight;
      editor.temperature.value = batch.temperature;
      editor.seed.value = batch.seed;
      editor.includeSubtitles.value = batch.includeSubtitles;
      editor.subtitleMode.value = batch.subtitleMode;
      editor.autoSegmentText.value = "";
      editor.autoSegmentVisible.value = false;
      editor.dragItemId.value = undefined;
      document
        .querySelector<HTMLElement>(".chatterbox-panel .batch-editor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      options.message.success("文案和设置已重新填入，请确认参考音色与授权后生成；原批次不变");
    } catch (error) {
      if (!disposed) notifyError(options.message, error, "重新填入批次失败");
    } finally {
      if (!disposed) reusingBatchId.value = undefined;
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
    ...batchSelection,
    loadingBatches,
    batchHistory,
    legacyHistory,
    detailBatch,
    detailVisible,
    regeneratingItemId,
    reusingBatchId,
    errorMessage,
    orderedDetailItems,
    retryVoiceOptions,
    loadBatches,
    changeBatchPage,
    createBatch,
    openBatch,
    regenerateItem,
    moveDetailItem,
    removeBatchItem,
    cancelBatch,
    removeReference,
    removeBatch,
    reuseLegacy,
    reuseBatch,
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
