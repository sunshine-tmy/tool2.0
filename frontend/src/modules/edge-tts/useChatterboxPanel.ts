import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useMessage } from "naive-ui";
import {
  CHATTERBOX_MAX_BATCH_SEGMENTS,
  CHATTERBOX_MAX_BATCH_TEXT_LENGTH,
  CHATTERBOX_MAX_REFERENCE_BYTES,
  CHATTERBOX_MAX_REFERENCE_TRANSLATION_LENGTH,
  CHATTERBOX_MAX_TEXT_LENGTH,
  type ChatterboxBatch,
  type ChatterboxBatchStatus,
  type ChatterboxBatchList,
  type ChatterboxHealth,
  type ChatterboxLanguage,
  type ChatterboxSavedVoice,
  type ChatterboxSubtitleMode,
  type ChatterboxTaskList,
  type ChatterboxTaskStatus,
  type ChatterboxVoiceAuthorization
} from "@toolbox/shared";
import { useConfirmDialog } from "../../composables/useConfirmDialog";
import { useTaskEvents } from "../../composables/useTaskEvents";
import { resolveBackendUrl } from "../../config/runtime";
import { createLocalId } from "../../utils/local-id";
import { chatterboxApi } from "./chatterbox-api";
import { parseChatterboxSegments } from "./chatterbox-segment-parser";

export function useChatterboxPanel() {
  type EditorSegment = { id: string; text: string; referenceTranslation: string; fileName: string };
  type ItemDraft = {
    text: string;
    referenceTranslation: string;
    fileName: string;
    seed: number;
    exaggeration: number;
    cfgWeight: number;
    temperature: number;
  };

  const message = useMessage();
  const confirmAction = useConfirmDialog();
  const maxTextLength = CHATTERBOX_MAX_TEXT_LENGTH;
  const maxReferenceTranslationLength = CHATTERBOX_MAX_REFERENCE_TRANSLATION_LENGTH;
  const maxBatchSegments = CHATTERBOX_MAX_BATCH_SEGMENTS;
  const maxBatchTextLength = CHATTERBOX_MAX_BATCH_TEXT_LENGTH;
  const authorizationOptions = [
    { label: "这是我本人的声音", value: "self" },
    { label: "已取得声音所有者明确授权", value: "authorized" }
  ];
  const subtitleModeOptions = [
    { label: "段内按完整句子分段（推荐）", value: "sentences" },
    { label: "每段文案一个字幕块", value: "segments" }
  ];
  const health = ref<ChatterboxHealth>();
  const referenceFile = ref<File>();
  const referencePreview = ref("");
  const retryReference = ref<File>();
  const retryReferenceInput = ref<HTMLInputElement>();
  const referenceSource = ref<"upload" | "saved">("upload");
  const savedVoices = ref<ChatterboxSavedVoice[]>([]);
  const selectedVoiceId = ref("");
  const retryVoiceId = ref("");
  const voiceName = ref("");
  const savingVoice = ref(false);
  const batchName = ref("");
  const segments = ref<EditorSegment[]>([newEditorSegment()]);
  const autoSegmentVisible = ref(false);
  const autoSegmentText = ref("");
  const language = ref<ChatterboxLanguage>("ms");
  const authorization = ref<ChatterboxVoiceAuthorization>("self");
  const consentConfirmed = ref(false);
  const exaggeration = ref(0.5);
  const cfgWeight = ref(0.5);
  const temperature = ref(0.8);
  const seed = ref(0);
  const includeSubtitles = ref(true);
  const subtitleMode = ref<ChatterboxSubtitleMode>("sentences");
  const referenceRetained = ref(false);
  const creating = ref(false);
  const loadingBatches = ref(false);
  const currentBatch = ref<ChatterboxBatch>();
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
  const itemDrafts = reactive<Record<string, ItemDraft>>({});
  const errorMessage = ref("");
  const dragItemId = ref<string>();

  const totalCharacters = computed(() => segments.value.reduce((sum, item) => sum + item.text.length, 0));
  const validSegmentCount = computed(() => segments.value.filter((item) => item.text.trim()).length);
  const parsedAutoSegments = computed(() => parseChatterboxSegments(autoSegmentText.value));
  const translatedAutoSegmentCount = computed(
    () => parsedAutoSegments.value.filter((item) => item.referenceTranslation).length
  );
  const isCurrentRunning = computed(() => currentBatch.value && isBatchRunning(currentBatch.value));
  const streamedBatchId = computed(() => (isCurrentRunning.value ? currentBatch.value?.id : undefined));
  const taskEvents = useTaskEvents(streamedBatchId);
  const hasSelectedReference = computed(() =>
    referenceSource.value === "upload"
      ? Boolean(referenceFile.value)
      : languageSavedVoices.value.some((voice) => voice.id === selectedVoiceId.value)
  );
  const canCreate = computed(() =>
    Boolean(
      health.value?.available &&
      hasSelectedReference.value &&
      consentConfirmed.value &&
      segments.value.every((item) => item.text.trim() && item.text.length <= maxTextLength) &&
      segments.value.every((item) => item.referenceTranslation.length <= maxReferenceTranslationLength) &&
      totalCharacters.value <= maxBatchTextLength &&
      !isCurrentRunning.value
    )
  );
  const healthLabel = computed(() =>
    !health.value?.available
      ? "克隆环境未就绪"
      : health.value.modelLoaded
        ? `V3 已加载 · ${health.value.gpuName || health.value.device?.toUpperCase() || "本机"}`
        : "V3 待加载"
  );
  const orderedDetailItems = computed(() =>
    detailBatch.value ? [...detailBatch.value.items].sort((a, b) => a.order - b.order) : []
  );
  const languageSavedVoices = computed(() => savedVoices.value.filter((voice) => voice.language === language.value));
  const retryVoiceOptions = computed(() => [
    {
      label: detailBatch.value?.referenceAvailable ? "沿用当前参考音色" : "选择永久参考音色",
      value: ""
    },
    ...savedVoices.value
      .filter((voice) => voice.language === detailBatch.value?.language)
      .map((voice) => ({ label: `${voice.name} · ${voice.durationSeconds.toFixed(1)} 秒`, value: voice.id }))
  ]);

  onMounted(() => void Promise.all([loadHealth(), loadBatches(), loadLegacyHistory(), loadSavedVoices()]));
  watch(language, () => {
    if (referenceSource.value !== "saved") return;
    if (!languageSavedVoices.value.some((voice) => voice.id === selectedVoiceId.value)) {
      selectedVoiceId.value = languageSavedVoices.value[0]?.id || "";
    }
  });
  onBeforeUnmount(() => {
    revokePreview();
  });

  watch(taskEvents.task, (task) => {
    const current = currentBatch.value;
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
    currentBatch.value = next;
    if (detailBatch.value?.id === task.id) setDetailBatch(next);
    if (task.status === "completed" || task.status === "failed") void finishStreamedBatch(task.id);
  });

  watch(taskEvents.error, (error) => {
    if (error) errorMessage.value = `${error.message}（${error.code}）`;
  });

  function newEditorSegment(text = "", fileName = "", referenceTranslation = ""): EditorSegment {
    return { id: createLocalId("chatterbox-segment"), text, referenceTranslation, fileName };
  }
  function addSegment() {
    if (segments.value.length < maxBatchSegments) segments.value.push(newEditorSegment());
  }
  function duplicateSegment(index: number) {
    if (segments.value.length < maxBatchSegments)
      segments.value.splice(
        index + 1,
        0,
        newEditorSegment(
          segments.value[index].text,
          segments.value[index].fileName,
          segments.value[index].referenceTranslation
        )
      );
  }
  function removeEditorSegment(index: number) {
    if (segments.value.length > 1) segments.value.splice(index, 1);
  }
  function moveSegment(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= segments.value.length) return;
    const [item] = segments.value.splice(index, 1);
    segments.value.splice(target, 0, item);
  }
  function startSegmentDrag(event: DragEvent, segmentId: string) {
    dragItemId.value = segmentId;
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", segmentId);
  }
  function allowSegmentDrop(event: DragEvent) {
    if (!dragItemId.value) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  }
  function dropSegment(event: DragEvent, targetId: string) {
    if (!dragItemId.value) return;
    event.preventDefault();
    const source = segments.value.findIndex((item) => item.id === dragItemId.value);
    const target = segments.value.findIndex((item) => item.id === targetId);
    if (source >= 0 && target >= 0 && source !== target) {
      const [item] = segments.value.splice(source, 1);
      segments.value.splice(target, 0, item);
    }
    dragItemId.value = undefined;
  }
  function splitByBlankLines() {
    const expanded = segments.value.flatMap((item) =>
      item.text
        .split(/\r?\n\s*\r?\n/)
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text, index) =>
          newEditorSegment(text, index === 0 ? item.fileName : "", index === 0 ? item.referenceTranslation : "")
        )
    );
    if (!expanded.length) return message.warning("请先输入需要拆分的文案");
    if (expanded.length > maxBatchSegments) return message.error(`按空行拆分后超过 ${maxBatchSegments} 段`);
    segments.value = expanded;
    message.success(`已拆分为 ${expanded.length} 段`);
  }

  function openAutoSegment() {
    autoSegmentVisible.value = true;
  }

  async function applyAutoSegments() {
    const parsed = parsedAutoSegments.value;
    if (!parsed.length) return message.warning("没有识别到有效文案");
    if (parsed.length > maxBatchSegments) return message.error(`识别结果超过 ${maxBatchSegments} 段，请删减后重试`);
    if (parsed.some((item) => item.text.length > maxTextLength)) {
      return message.error(`存在超过 ${maxTextLength} 字符的原文段落，请拆短后重试`);
    }
    if (parsed.some((item) => item.referenceTranslation.length > maxReferenceTranslationLength)) {
      return message.error(`存在超过 ${maxReferenceTranslationLength} 字符的中文翻译，请拆短后重试`);
    }
    const parsedCharacters = parsed.reduce((sum, item) => sum + item.text.length, 0);
    if (parsedCharacters > maxBatchTextLength) {
      return message.error(`识别结果共 ${parsedCharacters} 字符，超过批次上限 ${maxBatchTextLength}`);
    }

    const hasExistingContent = segments.value.some(
      (item) => item.text.trim() || item.referenceTranslation.trim() || item.fileName.trim()
    );
    if (
      hasExistingContent &&
      !(await confirmAction(`识别到 ${parsed.length} 段，填入后会覆盖当前文案。是否继续？`, {
        title: "覆盖当前分段",
        positiveText: "覆盖并填入",
        danger: false
      }))
    ) {
      return;
    }

    segments.value = parsed.map((item) => newEditorSegment(item.text, "", item.referenceTranslation));
    autoSegmentVisible.value = false;
    message.success(`已自动识别并填入 ${parsed.length} 段文案`);
  }

  function selectReference(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > CHATTERBOX_MAX_REFERENCE_BYTES) return message.error("参考音频不能超过 20 MB");
    revokePreview();
    referenceFile.value = file;
    referenceSource.value = "upload";
    referencePreview.value = URL.createObjectURL(file);
  }
  function selectRetryReference(event: Event) {
    const input = event.target as HTMLInputElement;
    retryReference.value = input.files?.[0];
    input.value = "";
  }
  function revokePreview() {
    if (referencePreview.value) URL.revokeObjectURL(referencePreview.value);
    referencePreview.value = "";
  }

  async function loadSavedVoices() {
    try {
      savedVoices.value = (await chatterboxApi.voices()).voices;
      if (selectedVoiceId.value && !savedVoices.value.some((voice) => voice.id === selectedVoiceId.value)) {
        selectedVoiceId.value = "";
      }
      if (!referenceFile.value && languageSavedVoices.value.length) {
        selectedVoiceId.value ||= languageSavedVoices.value[0].id;
        referenceSource.value = "saved";
      }
    } catch (error) {
      errorMessage.value = readableError(error, "永久参考音色读取失败");
    }
  }

  async function saveCurrentVoice() {
    if (!referenceFile.value || !voiceName.value.trim() || !consentConfirmed.value) return;
    savingVoice.value = true;
    try {
      const voice = await chatterboxApi.saveVoice({
        reference: referenceFile.value,
        name: voiceName.value.trim(),
        language: language.value,
        authorization: authorization.value,
        consentConfirmed: consentConfirmed.value
      });
      await loadSavedVoices();
      selectedVoiceId.value = voice.id;
      referenceSource.value = "saved";
      voiceName.value = "";
      message.success("参考音色已永久保存");
    } catch (error) {
      message.error(readableError(error, "永久保存参考音色失败"));
    } finally {
      savingVoice.value = false;
    }
  }

  async function removeSavedVoice(voiceId: string) {
    if (!(await confirmAction("永久删除该参考音色？已经生成的音频不会受影响。", { title: "删除参考音色" }))) return;
    try {
      await chatterboxApi.removeVoice(voiceId);
      if (selectedVoiceId.value === voiceId) selectedVoiceId.value = "";
      if (retryVoiceId.value === voiceId) retryVoiceId.value = "";
      await loadSavedVoices();
      message.success("永久参考音色已删除");
    } catch (error) {
      message.error(readableError(error, "删除永久参考音色失败"));
    }
  }

  async function loadHealth() {
    try {
      health.value = await chatterboxApi.health();
    } catch (error) {
      errorMessage.value = readableError(error, "无法读取声音克隆服务状态");
    }
  }
  async function loadBatches() {
    loadingBatches.value = true;
    try {
      batchHistory.value = await chatterboxApi.batches(1, 10);
    } catch (error) {
      errorMessage.value = readableError(error, "批次记录读取失败");
    } finally {
      loadingBatches.value = false;
    }
  }
  async function loadLegacyHistory() {
    try {
      legacyHistory.value = await chatterboxApi.list(1, 10);
    } catch {
      /* Legacy history is optional. */
    }
  }

  async function createBatch() {
    if (!canCreate.value) return;
    creating.value = true;
    errorMessage.value = "";
    try {
      currentBatch.value = await chatterboxApi.createBatch({
        reference: referenceSource.value === "upload" ? referenceFile.value : undefined,
        voiceId: referenceSource.value === "saved" ? selectedVoiceId.value : undefined,
        segments: segments.value.map((item) => ({
          text: item.text.trim(),
          referenceTranslation: item.referenceTranslation.trim() || undefined,
          fileName: item.fileName.trim() || undefined
        })),
        name: batchName.value.trim() || undefined,
        language: language.value,
        authorization: authorization.value,
        consentConfirmed: consentConfirmed.value,
        exaggeration: exaggeration.value,
        cfgWeight: cfgWeight.value,
        temperature: temperature.value,
        seed: seed.value || 0,
        includeSubtitles: includeSubtitles.value,
        subtitleMode: subtitleMode.value,
        referenceRetained: referenceRetained.value
      });
      message.success("批次已加入生成队列");
      await loadBatches();
    } catch (error) {
      errorMessage.value = readableError(error, "声音克隆批次创建失败");
    } finally {
      creating.value = false;
    }
  }

  async function finishStreamedBatch(batchId: string) {
    try {
      const batch = await chatterboxApi.batch(batchId);
      if (currentBatch.value?.id !== batchId) return;
      currentBatch.value = batch;
      if (detailBatch.value?.id === batchId) setDetailBatch(batch);
      message[batch.status === "completed" ? "success" : "warning"](
        batch.status === "completed" ? "批量声音克隆生成完成" : "批次已结束，请查看失败文案段"
      );
      await loadBatches();
    } catch (error) {
      errorMessage.value = readableError(error, "批次结果读取失败");
    }
  }

  async function openBatch(id: string) {
    try {
      const batch = await chatterboxApi.batch(id);
      setDetailBatch(batch);
      if (isBatchRunning(batch)) {
        currentBatch.value = batch;
      }
      detailVisible.value = true;
    } catch (error) {
      message.error(readableError(error, "批次详情读取失败"));
    }
  }
  function setDetailBatch(batch: ChatterboxBatch) {
    detailBatch.value = batch;
    for (const item of batch.items)
      itemDrafts[item.id] = {
        text: item.text,
        referenceTranslation: item.referenceTranslation || "",
        fileName: item.fileName || "",
        seed: item.seed ?? batch.seed,
        exaggeration: item.exaggeration ?? batch.exaggeration,
        cfgWeight: item.cfgWeight ?? batch.cfgWeight,
        temperature: item.temperature ?? batch.temperature
      };
  }
  async function refreshDetail() {
    if (detailBatch.value) setDetailBatch(await chatterboxApi.batch(detailBatch.value.id));
    await loadBatches();
  }

  async function regenerateItem(itemId: string) {
    if (!detailBatch.value) return;
    if (!detailBatch.value.referenceAvailable && !retryReference.value && !retryVoiceId.value) {
      return message.warning("请先选择永久参考音色或重新上传音频");
    }
    regeneratingItemId.value = itemId;
    try {
      const draft = itemDrafts[itemId];
      setDetailBatch(
        await chatterboxApi.regenerate(detailBatch.value.id, itemId, {
          text: draft.text.trim(),
          referenceTranslation: draft.referenceTranslation.trim() || undefined,
          fileName: draft.fileName.trim() || undefined,
          seed: draft.seed,
          exaggeration: draft.exaggeration,
          cfgWeight: draft.cfgWeight,
          temperature: draft.temperature,
          reference: retryReference.value,
          voiceId: retryReference.value ? undefined : retryVoiceId.value || undefined
        })
      );
      currentBatch.value = detailBatch.value;
      retryReference.value = undefined;
      retryVoiceId.value = "";
      message.success("该文案段已加入重新生成队列");
    } catch (error) {
      message.error(readableError(error, "重新生成失败"));
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
      message.error(readableError(error, "调整顺序失败"));
    }
  }
  async function removeBatchItem(itemId: string) {
    if (!detailBatch.value) return;
    if (!(await confirmAction("删除这一段及其音频，并重建总 SRT？", { title: "删除文案段" }))) return;
    try {
      const result = await chatterboxApi.removeBatchItem(detailBatch.value.id, itemId);
      if (result.batch) setDetailBatch(result.batch);
      await loadBatches();
      message.success("文案段已删除");
    } catch (error) {
      message.error(readableError(error, "删除失败"));
    }
  }
  async function cancelBatch(id: string) {
    if (
      !(await confirmAction("取消尚未开始的文案段？正在生成的一段会继续完成。", {
        title: "取消批次",
        positiveText: "确认取消"
      }))
    )
      return;
    try {
      currentBatch.value = await chatterboxApi.cancelBatch(id);
      await loadBatches();
    } catch (error) {
      message.error(readableError(error, "取消失败"));
    }
  }
  async function removeReference(id: string) {
    if (!(await confirmAction("提前删除参考音色后，再次生成需要重新上传。确定删除？", { title: "删除参考音色" })))
      return;
    try {
      await chatterboxApi.removeBatchReference(id);
      await refreshDetail();
      message.success("参考音色已删除");
    } catch (error) {
      message.error(readableError(error, "删除参考音色失败"));
    }
  }
  async function removeBatch(id: string) {
    if (!(await confirmAction("删除整个批次、全部音频和总 SRT？", { title: "删除整个批次" }))) return;
    try {
      await chatterboxApi.removeBatch(id);
      if (currentBatch.value?.id === id) currentBatch.value = undefined;
      if (detailBatch.value?.id === id) detailVisible.value = false;
      await loadBatches();
      message.success("批次已删除");
    } catch (error) {
      message.error(readableError(error, "删除批次失败"));
    }
  }

  async function reuseLegacy(id: string) {
    try {
      const task = await chatterboxApi.task(id);
      segments.value = [newEditorSegment(task.text, task.fileName || "")];
      language.value = task.language;
      authorization.value = task.authorization;
      exaggeration.value = task.exaggeration;
      cfgWeight.value = task.cfgWeight;
      temperature.value = task.temperature;
      seed.value = task.seed;
      includeSubtitles.value = task.includeSubtitles;
      consentConfirmed.value = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
      message.info("旧文案已载入，请重新上传参考音色并确认授权");
    } catch (error) {
      message.error(readableError(error, "读取旧记录失败"));
    }
  }
  async function removeLegacy(id: string) {
    if (!(await confirmAction("删除这条旧版声音克隆记录？", { title: "删除声音克隆记录" }))) return;
    try {
      await chatterboxApi.remove(id);
      await loadLegacyHistory();
    } catch (error) {
      message.error(readableError(error, "删除失败"));
    }
  }

  function resetParameters() {
    exaggeration.value = 0.5;
    cfgWeight.value = 0.5;
    temperature.value = 0.8;
    seed.value = 0;
  }
  function isBatchRunning(batch: ChatterboxBatch) {
    return batch.status === "queued" || batch.status === "processing";
  }
  function languageLabel(value: ChatterboxLanguage) {
    return { ms: "Bahasa Melayu", en: "English", "pt-BR": "巴西葡萄牙语" }[value];
  }
  function batchTitle(batch: { name?: string; id: string }) {
    return batch.name || `声音批次 ${batch.id.slice(0, 6)}`;
  }
  function batchStatusLabel(status: ChatterboxBatchStatus) {
    return {
      queued: "排队中",
      processing: "生成中",
      partial_failed: "部分失败",
      completed: "已完成",
      cancelled: "已取消"
    }[status];
  }
  function batchTagType(status: ChatterboxBatchStatus): "success" | "warning" | "error" | "default" {
    return status === "completed"
      ? "success"
      : status === "partial_failed" || status === "cancelled"
        ? "error"
        : "warning";
  }
  function taskStatusLabel(status: ChatterboxTaskStatus) {
    return { queued: "排队中", processing: "生成中", completed: "已完成", failed: "失败", cancelled: "已取消" }[status];
  }
  function taskTagType(status: ChatterboxTaskStatus): "success" | "warning" | "error" | "default" {
    return status === "completed" ? "success" : status === "failed" || status === "cancelled" ? "error" : "warning";
  }
  function formatDate(value: string) {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  }
  function formatDuration(value?: number) {
    if (!value) return "0 秒";
    const minutes = Math.floor(value / 60);
    const seconds = Math.round(value % 60);
    return minutes ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;
  }
  function formatBytes(bytes: number) {
    return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
  }
  function mediaUrl(value?: string) {
    return value ? resolveBackendUrl(value) : undefined;
  }
  function readableError(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
  }

  return {
    maxTextLength,
    maxReferenceTranslationLength,
    maxBatchSegments,
    maxBatchTextLength,
    authorizationOptions,
    subtitleModeOptions,
    health,
    referenceFile,
    referencePreview,
    retryReference,
    retryReferenceInput,
    referenceSource,
    savedVoices,
    selectedVoiceId,
    retryVoiceId,
    voiceName,
    savingVoice,
    batchName,
    segments,
    autoSegmentVisible,
    autoSegmentText,
    language,
    authorization,
    consentConfirmed,
    exaggeration,
    cfgWeight,
    temperature,
    seed,
    includeSubtitles,
    subtitleMode,
    referenceRetained,
    creating,
    loadingBatches,
    currentBatch,
    batchHistory,
    legacyHistory,
    detailBatch,
    detailVisible,
    regeneratingItemId,
    itemDrafts,
    errorMessage,
    dragItemId,
    totalCharacters,
    validSegmentCount,
    parsedAutoSegments,
    translatedAutoSegmentCount,
    isCurrentRunning,
    canCreate,
    healthLabel,
    orderedDetailItems,
    languageSavedVoices,
    retryVoiceOptions,
    addSegment,
    duplicateSegment,
    removeEditorSegment,
    moveSegment,
    startSegmentDrag,
    allowSegmentDrop,
    dropSegment,
    splitByBlankLines,
    openAutoSegment,
    applyAutoSegments,
    selectReference,
    selectRetryReference,
    saveCurrentVoice,
    removeSavedVoice,
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
    resetParameters,
    isBatchRunning,
    languageLabel,
    batchTitle,
    batchStatusLabel,
    batchTagType,
    taskStatusLabel,
    taskTagType,
    formatDate,
    formatDuration,
    formatBytes,
    mediaUrl
  };
}
