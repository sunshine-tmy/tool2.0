/**
 * 中文模块说明：配音前端模块，负责 Edge-TTS 与 Chatterbox 的编辑、任务和音色交互
 */
import { computed } from "vue";
import { useMessage } from "naive-ui";
import type { ChatterboxBatchStatus, ChatterboxLanguage, ChatterboxTaskStatus } from "@toolbox/shared";
import { useConfirmDialog } from "../../../shared/composables/useConfirmDialog";
import { useRequestScope } from "../../../shared/composables/useRequestScope";
import { useTaskEvents } from "../../../shared/composables/useTaskEvents";
import { resolveBackendUrl } from "../../../shared/config/runtime";
import { useChatterboxBatches } from "./useChatterboxBatches";
import { useChatterboxEditor } from "./useChatterboxEditor";
import { useChatterboxVoices } from "./useChatterboxVoices";
import { batchTagType, formatDate, formatDuration, taskTagType } from "../shared/speech-batch-display";

export function useChatterboxPanel() {
  // 面板 composable 负责组装编辑器、音色、批次和任务事件，页面组件只绑定统一状态对象。
  const message = useMessage();
  const confirmAction = useConfirmDialog();
  const editor = useChatterboxEditor({ message, confirmAction });
  const voices = useChatterboxVoices({
    health: editor.health,
    savedVoices: editor.savedVoices,
    referenceFile: editor.referenceFile,
    referenceSource: editor.referenceSource,
    selectedVoiceId: editor.selectedVoiceId,
    retryVoiceId: editor.retryVoiceId,
    voiceName: editor.voiceName,
    savingVoice: editor.savingVoice,
    language: editor.language,
    authorization: editor.authorization,
    consentConfirmed: editor.consentConfirmed,
    errorMessage: editor.errorMessage,
    languageSavedVoices: editor.languageSavedVoices,
    message,
    confirmAction
  });
  const streamedBatchId = computed(() => (editor.isCurrentRunning.value ? editor.currentBatch.value?.id : undefined));
  const requestScope = useRequestScope();
  const taskEvents = useTaskEvents(streamedBatchId, { signal: requestScope.signal });
  const batches = useChatterboxBatches({ editor, taskEvents, message, confirmAction });

  return {
    ...editor,
    ...voices,
    ...batches,
    ...displayHelpers
  };
}

export type ChatterboxPanelState = ReturnType<typeof useChatterboxPanel>;

const displayHelpers = {
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

function isBatchRunning(batch: { status: ChatterboxBatchStatus }) {
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

function taskStatusLabel(status: ChatterboxTaskStatus) {
  return { queued: "排队中", processing: "生成中", completed: "已完成", failed: "失败", cancelled: "已取消" }[status];
}

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

function mediaUrl(value?: string) {
  return value ? resolveBackendUrl(value) : undefined;
}
