import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useMessage } from "naive-ui";
import type {
  EdgeTtsBatch,
  EdgeTtsBatchItem,
  EdgeTtsBatchList,
  EdgeTtsHealth,
  EdgeTtsLanguage,
  EdgeTtsTaskList,
  EdgeTtsVoice
} from "@toolbox/shared";
import { useConfirmDialog } from "../../../shared/composables/useConfirmDialog";
import { formatApiError } from "../../../shared/http/http";
import { resolveBackendUrl } from "../../../shared/config/runtime";
import { useOrderedSpeechEditor } from "../shared/useOrderedSpeechEditor";
import { edgeTtsApi as api } from "./api";
import { useSpeechBatchSelection } from "../shared/useSpeechBatchSelection";
import { formatBatchTitle } from "../shared/speech-batch-display";

export const onlineLanguages: Array<{ value: EdgeTtsLanguage; title: string; description: string }> = [
  { value: "ms-MY", title: "Bahasa Melayu", description: "马来西亚马来语" },
  { value: "en-US", title: "English US", description: "美式英语" },
  { value: "en-GB", title: "English UK", description: "英式英语" },
  { value: "pt-BR", title: "Português BR", description: "巴西葡萄牙语" }
];
export const onlinePresets = [
  { name: "自然讲解", rate: 0, volume: 0, pitch: 0 },
  { name: "商品介绍", rate: 10, volume: 5, pitch: 5 },
  { name: "短视频快节奏", rate: 25, volume: 10, pitch: 5 },
  { name: "稳重旁白", rate: -10, volume: 0, pitch: -5 }
];
export const batchRunning = (batch?: Pick<EdgeTtsBatch, "status">) =>
  Boolean(batch && (batch.status === "queued" || batch.status === "processing"));
export function useEdgeTtsPanel() {
  const message = useMessage(),
    confirm = useConfirmDialog();
  const creating = ref(false),
    busy = ref(false),
    health = ref<EdgeTtsHealth>(),
    language = ref<EdgeTtsLanguage>("ms-MY");
  const voice = ref("ms-MY-YasminNeural"),
    voices = ref<EdgeTtsVoice[]>([]),
    loadingVoices = ref(false);
  const rate = ref(0),
    volume = ref(0),
    pitch = ref(0),
    includeSubtitles = ref(true),
    subtitleMode = ref<"segments" | "sentences">("sentences");
  const error = ref(""),
    loadingBatches = ref(false),
    historyPage = ref(1),
    current = ref<EdgeTtsBatch>(),
    detail = ref<EdgeTtsBatch>();
  const detailVisible = ref(false),
    selectedItems = ref<string[]>([]);
  const reusingBatchId = ref<string>();
  const editor = useOrderedSpeechEditor({ message, confirm, isSubmitting: () => creating.value });
  const history = ref<EdgeTtsBatchList>({
    batches: [],
    pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 }
  });
  const legacy = ref<EdgeTtsTaskList>({ tasks: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } });
  const batchSelection = useSpeechBatchSelection({
    batches: computed(() => history.value.batches),
    blocked: () => busy.value || loadingBatches.value,
    remove: (id) => api.removeBatch(id),
    onRemoved: forgetBatch,
    reload: loadBatches,
    confirm,
    message
  });
  function forgetBatch(id: string) {
    if (current.value?.id === id) current.value = undefined;
    if (detail.value?.id === id) detailVisible.value = false;
  }
  const drafts = reactive<
    Record<
      string,
      { text: string; referenceTranslation: string; fileName: string; rate: number; volume: number; pitch: number }
    >
  >({});
  const canCreate = computed(() =>
    Boolean(
      health.value?.available &&
      editor.valid.value &&
      voice.value.startsWith(`${language.value}-`) &&
      !loadingVoices.value &&
      !creating.value
    )
  );
  let disposed = false,
    listRequest = 0,
    voiceRequest = 0,
    pollTimer: ReturnType<typeof setTimeout> | undefined;
  onMounted(async () => {
    await Promise.all([loadHealth(), loadVoices(), loadBatches(), loadLegacy()]);
    if (!disposed) pollTimer = setTimeout(poll, 2500);
  });
  onBeforeUnmount(() => {
    disposed = true;
    listRequest++;
    voiceRequest++;
    if (pollTimer) clearTimeout(pollTimer);
  });
  watch(language, () => void loadVoices());
  async function loadHealth() {
    try {
      const result = await api.health();
      if (!disposed) health.value = result;
    } catch (e) {
      if (!disposed) error.value = formatApiError(e);
    }
  }
  async function loadVoices() {
    const request = ++voiceRequest;
    loadingVoices.value = true;
    try {
      const result = await api.voices(language.value);
      if (disposed || request !== voiceRequest) return;
      voices.value = result.voices;
      if (!voices.value.some((item) => item.shortName === voice.value))
        voice.value = voices.value.find((item) => item.suggested)?.shortName || voices.value[0]?.shortName || "";
    } catch (e) {
      if (!disposed && request === voiceRequest) error.value = formatApiError(e);
    } finally {
      if (request === voiceRequest) loadingVoices.value = false;
    }
  }
  async function loadBatches() {
    const request = ++listRequest;
    loadingBatches.value = true;
    try {
      const result = await api.batches(historyPage.value, 10);
      if (disposed || request !== listRequest) return;
      history.value = result;
      historyPage.value = result.pagination.page;
    } catch (e) {
      if (!disposed && request === listRequest) {
        historyPage.value = history.value.pagination.page;
        error.value = formatApiError(e);
      }
    } finally {
      if (request === listRequest) loadingBatches.value = false;
    }
  }
  async function changePage(page: number) {
    if (!Number.isInteger(page) || page < 1 || page > history.value.pagination.totalPages) return;
    historyPage.value = page;
    await loadBatches();
  }
  async function createBatch() {
    if (!canCreate.value) return;
    creating.value = true;
    error.value = "";
    try {
      current.value = await api.createBatch({
        name: editor.batchName.value.trim() || undefined,
        segments: editor.segments.value.map((item) => ({
          text: item.text.trim(),
          referenceTranslation: item.referenceTranslation.trim() || undefined,
          fileName: item.fileName.trim() || undefined
        })),
        language: language.value,
        voice: voice.value,
        rate: rate.value,
        volume: volume.value,
        pitch: pitch.value,
        includeSubtitles: includeSubtitles.value,
        subtitleMode: subtitleMode.value
      });
      message.success("在线配音批次已加入生成队列");
      historyPage.value = 1;
      await loadBatches();
    } catch (e) {
      error.value = formatApiError(e);
    } finally {
      creating.value = false;
    }
  }
  function setDetail(batch: EdgeTtsBatch) {
    detail.value = batch;
    selectedItems.value = selectedItems.value.filter((id) =>
      batch.items.some((item) => item.id === id && item.status === "completed")
    );
    for (const item of batch.items)
      drafts[item.id] = {
        text: item.text,
        referenceTranslation: item.referenceTranslation || "",
        fileName: item.fileName || "",
        rate: item.rate,
        volume: item.volume,
        pitch: item.pitch
      };
  }
  async function openBatch(id: string) {
    try {
      const batch = await api.batch(id);
      setDetail(batch);
      detailVisible.value = true;
      selectedItems.value = [];
    } catch (e) {
      message.error(formatApiError(e));
    }
  }
  async function poll() {
    try {
      if (disposed) return;
      const ids = new Set(
        [current.value, detailVisible.value ? detail.value : undefined].filter(batchRunning).map((batch) => batch!.id)
      );
      await Promise.all(
        [...ids].map(async (id) => {
          const batch = await api.batch(id);
          if (disposed) return;
          if (current.value?.id === id) current.value = batch;
          if (detail.value?.id === id && detailVisible.value) setDetail(batch);
        })
      );
      if (!disposed && (ids.size || history.value.batches.some(batchRunning))) await loadBatches();
    } catch (e) {
      if (!disposed) error.value = formatApiError(e);
    } finally {
      if (!disposed) pollTimer = setTimeout(poll, 2500);
    }
  }
  async function action(operation: () => Promise<unknown>) {
    if (busy.value || batchSelection.deletingBatches.value) return;
    busy.value = true;
    try {
      await operation();
      await loadBatches();
    } catch (e) {
      message.error(formatApiError(e));
    } finally {
      busy.value = false;
    }
  }
  async function updateBatch(batch: EdgeTtsBatch) {
    if (detail.value?.id === batch.id) setDetail(batch);
    if (current.value?.id === batch.id) current.value = batch;
  }
  async function cancelBatch(id: string) {
    if (!(await confirm("取消尚未开始的文案段？正在生成的一段会继续完成。", { title: "取消批次" }))) return;
    await action(async () => updateBatch(await api.cancelBatch(id)));
  }
  async function removeBatch(id: string) {
    if (batchSelection.deletingBatches.value) return;
    if (!(await confirm("删除整个在线配音批次及全部产物？已加入音频库的独立副本不受影响。", { title: "删除整个批次" })))
      return;
    await action(async () => {
      await api.removeBatch(id);
      forgetBatch(id);
    });
  }
  async function regenerate(item: EdgeTtsBatchItem) {
    if (!detail.value || batchRunning(detail.value)) return;
    const id = detail.value.id,
      draft = drafts[item.id];
    await action(async () => {
      const batch = await api.regenerate(id, item.id, {
        ...draft,
        text: draft.text.trim(),
        referenceTranslation: draft.referenceTranslation.trim() || undefined
      });
      await updateBatch(batch);
      current.value = batch;
    });
  }
  async function moveItem(index: number, delta: number) {
    if (!detail.value || batchRunning(detail.value)) return;
    const ids = detail.value.items.map((item) => item.id),
      target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await action(async () => updateBatch(await api.reorder(detail.value!.id, ids)));
  }
  async function removeItem(id: string) {
    if (
      !detail.value ||
      batchRunning(detail.value) ||
      !(await confirm("删除这一段及音频？总音频与字幕将重新按剩余段落生成。", { title: "删除文案段" }))
    )
      return;
    await action(async () => updateBatch(await api.removeBatchItem(detail.value!.id, id)));
  }
  async function loadLegacy(page = legacy.value.pagination.page) {
    try {
      const result = await api.list(page, 10);
      if (!disposed) legacy.value = result;
    } catch {
      /* 单条旧记录读取失败不阻断新批次。 */
    }
  }
  async function reuseBatch(id: string) {
    if (disposed || creating.value || reusingBatchId.value) return;
    reusingBatchId.value = id;
    try {
      const batch = await api.batch(id);
      if (disposed) return;
      if (
        editor.hasDraft.value &&
        !(await confirm("用该批次的完整文案和设置覆盖当前待提交内容？已排队任务及原批次不受影响。", {
          title: "重新填入批次",
          positiveText: "确认填入",
          danger: false
        }))
      )
        return;
      if (disposed || creating.value) return;
      editor.segments.value = [...batch.items]
        .sort((a, b) => a.order - b.order)
        .map((item) => editor.segment(item.text, item.fileName || "", item.referenceTranslation || ""));
      editor.batchName.value = batch.name || "";
      editor.autoText.value = "";
      editor.autoVisible.value = false;
      editor.dragId.value = "";
      language.value = batch.language;
      voice.value = batch.voice;
      rate.value = batch.rate;
      volume.value = batch.volume;
      pitch.value = batch.pitch;
      includeSubtitles.value = batch.includeSubtitles;
      subtitleMode.value = batch.subtitleMode;
      document
        .querySelector<HTMLElement>(".online-tts-panel .batch-editor")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      message.success("文案和设置已重新填入，可编辑后生成；原批次不变");
    } catch (e) {
      if (!disposed) message.error(formatApiError(e));
    } finally {
      if (!disposed) reusingBatchId.value = undefined;
    }
  }
  async function reuseLegacy(id: string) {
    try {
      const task = await api.task(id);
      if (
        editor.hasDraft.value &&
        !(await confirm("用这条旧文案覆盖当前待提交文案？", { title: "载入旧文案", danger: false }))
      )
        return;
      editor.segments.value = [editor.segment(task.text, task.fileName || "")];
      language.value = task.language;
      voice.value = task.voice;
      rate.value = task.rate;
      volume.value = task.volume;
      pitch.value = task.pitch;
      includeSubtitles.value = task.includeSubtitles;
    } catch (e) {
      message.error(formatApiError(e));
    }
  }
  async function removeLegacy(id: string) {
    if (!(await confirm("删除旧版单条记录和生成文件？", { title: "删除语音记录" }))) return;
    await action(async () => {
      await api.remove(id);
      await loadLegacy();
    });
  }
  function preset(value: { rate: number; volume: number; pitch: number }) {
    rate.value = value.rate;
    volume.value = value.volume;
    pitch.value = value.pitch;
  }
  const statusLabel = (status: string) =>
    ({
      queued: "排队中",
      processing: "生成中",
      completed: "已完成",
      partial_failed: "部分失败或取消",
      failed: "失败",
      cancelled: "已取消"
    })[status] || status;
  const languageLabel = (value: EdgeTtsLanguage) =>
    onlineLanguages.find((item) => item.value === value)?.description || value;
  const title = (batch: { name?: string; id: string; createdAt?: string }) => formatBatchTitle(batch, "在线配音");
  const mediaUrl = (value?: string) => (value ? resolveBackendUrl(value) : undefined);
  return {
    ...batchSelection,
    editor,
    health,
    language,
    voice,
    voices,
    loadingVoices,
    rate,
    volume,
    pitch,
    includeSubtitles,
    subtitleMode,
    creating,
    busy,
    error,
    loadingBatches,
    history,
    current,
    detail,
    detailVisible,
    drafts,
    selectedItems,
    reusingBatchId,
    legacy,
    canCreate,
    loadHealth,
    loadVoices,
    loadBatches,
    changePage,
    createBatch,
    openBatch,
    cancelBatch,
    removeBatch,
    regenerate,
    moveItem,
    removeItem,
    loadLegacy,
    reuseLegacy,
    reuseBatch,
    removeLegacy,
    preset,
    statusLabel,
    languageLabel,
    title,
    mediaUrl
  };
}
