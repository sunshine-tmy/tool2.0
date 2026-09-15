/**
 * 中文模块说明：配音前端模块，负责 Edge-TTS 与 Chatterbox 的编辑、任务和音色交互
 */
import { computed, onBeforeUnmount, reactive, ref } from "vue";
import {
  CHATTERBOX_MAX_BATCH_SEGMENTS,
  CHATTERBOX_MAX_BATCH_TEXT_LENGTH,
  CHATTERBOX_MAX_REFERENCE_BYTES,
  CHATTERBOX_MAX_REFERENCE_TRANSLATION_LENGTH,
  CHATTERBOX_MAX_TEXT_LENGTH,
  type ChatterboxBatch,
  type ChatterboxHealth,
  type ChatterboxLanguage,
  type ChatterboxSavedVoice,
  type ChatterboxSubtitleMode,
  type ChatterboxVoiceAuthorization
} from "@toolbox/shared";
import { createLocalId } from "../../utils/local-id";
import { parseChatterboxSegments } from "./chatterbox-segment-parser";

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

type EditorMessage = {
  success: (message: string) => void;
  warning: (message: string) => void;
  error: (message: string) => void;
};

type ConfirmAction = (
  message: string,
  options: { title: string; positiveText?: string; danger?: boolean }
) => Promise<boolean>;

export function useChatterboxEditor(options: { message: EditorMessage; confirmAction: ConfirmAction }) {
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
  const currentBatch = ref<ChatterboxBatch>();
  const itemDrafts = reactive<Record<string, ItemDraft>>({});
  const dragItemId = ref<string>();
  const errorMessage = ref("");

  const totalCharacters = computed(() => segments.value.reduce((sum, item) => sum + item.text.length, 0));
  const validSegmentCount = computed(() => segments.value.filter((item) => item.text.trim()).length);
  const parsedAutoSegments = computed(() => parseChatterboxSegments(autoSegmentText.value));
  const translatedAutoSegmentCount = computed(
    () => parsedAutoSegments.value.filter((item) => item.referenceTranslation).length
  );
  const isCurrentRunning = computed(() => currentBatch.value && isBatchRunning(currentBatch.value));
  const languageSavedVoices = computed(() => savedVoices.value.filter((voice) => voice.language === language.value));
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
    if (!expanded.length) return options.message.warning("请先输入需要拆分的文案");
    if (expanded.length > maxBatchSegments) return options.message.error(`按空行拆分后超过 ${maxBatchSegments} 段`);
    segments.value = expanded;
    options.message.success(`已拆分为 ${expanded.length} 段`);
  }

  function openAutoSegment() {
    autoSegmentVisible.value = true;
  }
  async function applyAutoSegments() {
    const parsed = parsedAutoSegments.value;
    if (!parsed.length) return options.message.warning("没有识别到有效文案");
    if (parsed.length > maxBatchSegments)
      return options.message.error(`识别结果超过 ${maxBatchSegments} 段，请删减后重试`);
    if (parsed.some((item) => item.text.length > maxTextLength)) {
      return options.message.error(`存在超过 ${maxTextLength} 字符的原文段落，请拆短后重试`);
    }
    if (parsed.some((item) => item.referenceTranslation.length > maxReferenceTranslationLength)) {
      return options.message.error(`存在超过 ${maxReferenceTranslationLength} 字符的中文翻译，请拆短后重试`);
    }
    const parsedCharacters = parsed.reduce((sum, item) => sum + item.text.length, 0);
    if (parsedCharacters > maxBatchTextLength) {
      return options.message.error(`识别结果共 ${parsedCharacters} 字符，超过批次上限 ${maxBatchTextLength}`);
    }
    const hasExistingContent = segments.value.some(
      (item) => item.text.trim() || item.referenceTranslation.trim() || item.fileName.trim()
    );
    if (
      hasExistingContent &&
      !(await options.confirmAction(`识别到 ${parsed.length} 段，填入后会覆盖当前文案。是否继续？`, {
        title: "覆盖当前分段",
        positiveText: "覆盖并填入",
        danger: false
      }))
    ) {
      return;
    }
    segments.value = parsed.map((item) => newEditorSegment(item.text, "", item.referenceTranslation));
    autoSegmentVisible.value = false;
    options.message.success(`已自动识别并填入 ${parsed.length} 段文案`);
  }

  function selectReference(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > CHATTERBOX_MAX_REFERENCE_BYTES) return options.message.error("参考音频不能超过 20 MB");
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
  function resetParameters() {
    exaggeration.value = 0.5;
    cfgWeight.value = 0.5;
    temperature.value = 0.8;
    seed.value = 0;
  }

  onBeforeUnmount(revokePreview);

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
    currentBatch,
    itemDrafts,
    dragItemId,
    errorMessage,
    totalCharacters,
    validSegmentCount,
    parsedAutoSegments,
    translatedAutoSegmentCount,
    isCurrentRunning,
    canCreate,
    healthLabel,
    languageSavedVoices,
    newEditorSegment,
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
    revokePreview,
    resetParameters
  };
}

export type ChatterboxEditorState = ReturnType<typeof useChatterboxEditor>;

function isBatchRunning(batch: ChatterboxBatch) {
  return batch.status === "queued" || batch.status === "processing";
}
