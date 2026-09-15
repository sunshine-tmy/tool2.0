import { computed } from "vue";
import { useMessage } from "naive-ui";
import type { ChatterboxBatchStatus, ChatterboxLanguage, ChatterboxTaskStatus } from "@toolbox/shared";
import { useConfirmDialog } from "../../composables/useConfirmDialog";
import { useRequestScope } from "../../composables/useRequestScope";
import { useTaskEvents } from "../../composables/useTaskEvents";
import { resolveBackendUrl } from "../../config/runtime";
import { useChatterboxBatches } from "./useChatterboxBatches";
import { useChatterboxEditor } from "./useChatterboxEditor";
import { useChatterboxVoices } from "./useChatterboxVoices";

export function useChatterboxPanel() {
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
