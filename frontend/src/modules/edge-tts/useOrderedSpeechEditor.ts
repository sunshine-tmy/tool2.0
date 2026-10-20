/** 有序双语文案草稿：仅编辑本地输入，不改变已经提交的批次。 */
import { computed, ref, type InjectionKey, type UnwrapNestedRefs } from "vue";
import {
  EDGE_TTS_MAX_BATCH_SEGMENTS,
  EDGE_TTS_MAX_BATCH_TEXT_LENGTH,
  EDGE_TTS_MAX_TRANSLATION_LENGTH
} from "@toolbox/shared";
import { createLocalId } from "../../utils/local-id";
import { parseChatterboxSegments } from "./chatterbox-segment-parser";

type Segment = { id: string; text: string; fileName: string; referenceTranslation: string };
export const orderedSpeechEditorKey: InjectionKey<UnwrapNestedRefs<ReturnType<typeof useOrderedSpeechEditor>>> =
  Symbol("ordered-speech-editor");
type Options = {
  message: { success: (value: string) => void; warning: (value: string) => void; error: (value: string) => void };
  confirm: (value: string, options: { title: string; positiveText?: string; danger?: boolean }) => Promise<boolean>;
  isSubmitting: () => boolean;
};
export function useOrderedSpeechEditor(options: Options) {
  const segment = (text = "", fileName = "", referenceTranslation = ""): Segment => ({
    id: createLocalId("speech"),
    text,
    fileName,
    referenceTranslation
  });
  const segments = ref([segment()]),
    batchName = ref(""),
    autoText = ref(""),
    autoVisible = ref(false),
    dragId = ref("");
  const parsed = computed(() => parseChatterboxSegments(autoText.value));
  const totalCharacters = computed(() => segments.value.reduce((sum, item) => sum + item.text.length, 0));
  const valid = computed(
    () =>
      segments.value.length > 0 &&
      segments.value.length <= EDGE_TTS_MAX_BATCH_SEGMENTS &&
      totalCharacters.value <= EDGE_TTS_MAX_BATCH_TEXT_LENGTH &&
      segments.value.every(
        (item) =>
          item.text.trim() &&
          item.text.length <= EDGE_TTS_MAX_BATCH_TEXT_LENGTH &&
          item.referenceTranslation.length <= EDGE_TTS_MAX_TRANSLATION_LENGTH
      )
  );
  const hasDraft = computed(() =>
    Boolean(
      batchName.value ||
      autoText.value ||
      segments.value.some((item) => item.text || item.fileName || item.referenceTranslation)
    )
  );
  function add() {
    if (segments.value.length < EDGE_TTS_MAX_BATCH_SEGMENTS) segments.value.push(segment());
  }
  function duplicate(index: number) {
    const item = segments.value[index];
    if (item && segments.value.length < EDGE_TTS_MAX_BATCH_SEGMENTS)
      segments.value.splice(index + 1, 0, segment(item.text, item.fileName, item.referenceTranslation));
  }
  function remove(index: number) {
    if (segments.value.length > 1) segments.value.splice(index, 1);
  }
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= segments.value.length) return;
    const [item] = segments.value.splice(index, 1);
    segments.value.splice(target, 0, item);
  }
  function drop(targetId: string) {
    const from = segments.value.findIndex((item) => item.id === dragId.value),
      to = segments.value.findIndex((item) => item.id === targetId);
    if (from >= 0 && to >= 0) move(from, to - from);
    dragId.value = "";
  }
  function startDrag(event: DragEvent, id: string) {
    dragId.value = id;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
    }
  }
  function split() {
    const result = segments.value.flatMap((item) =>
      item.text
        .split(/\r?\n\s*\r?\n/)
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text, index) =>
          segment(text, index === 0 ? item.fileName : "", index === 0 ? item.referenceTranslation : "")
        )
    );
    if (!result.length) return options.message.warning("请先输入需要拆分的文案");
    if (result.length > EDGE_TTS_MAX_BATCH_SEGMENTS) return options.message.error("拆分后超过 30 段，请减少文案");
    segments.value = result;
  }
  async function apply() {
    const result = parsed.value.map((item) => segment(item.text, "", item.referenceTranslation));
    if (
      !result.length ||
      result.length > EDGE_TTS_MAX_BATCH_SEGMENTS ||
      result.some((item) => item.referenceTranslation.length > EDGE_TTS_MAX_TRANSLATION_LENGTH) ||
      result.reduce((sum, item) => sum + item.text.length, 0) > EDGE_TTS_MAX_BATCH_TEXT_LENGTH
    )
      return options.message.error("识别结果为空或超过批次限制（30 段、20000 原文字符、每段 2000 中文字符）");
    if (
      segments.value.some((item) => item.text || item.fileName || item.referenceTranslation) &&
      !(await options.confirm(`识别到 ${result.length} 段，是否覆盖当前文案？`, {
        title: "覆盖当前分段",
        danger: false
      }))
    )
      return;
    segments.value = result;
    autoVisible.value = false;
    options.message.success(`已填入 ${result.length} 段双语文案`);
  }
  async function clear() {
    if (options.isSubmitting() || !hasDraft.value) return;
    if (
      !(await options.confirm("清空待提交的批次名称、外语、中文和文件名？已排队任务及生成结果不受影响。", {
        title: "清空当前批次内容",
        positiveText: "确认清空",
        danger: true
      }))
    )
      return;
    segments.value = [segment()];
    batchName.value = "";
    autoText.value = "";
    autoVisible.value = false;
    dragId.value = "";
  }
  return {
    segments,
    batchName,
    autoText,
    autoVisible,
    dragId,
    parsed,
    totalCharacters,
    valid,
    hasDraft,
    add,
    duplicate,
    remove,
    move,
    drop,
    startDrag,
    split,
    apply,
    clear,
    segment
  };
}
