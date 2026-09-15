<template>
  <ToolLayout>
    <section class="main-column video-text-main">
      <ToolPageHeader
        title="视频文本解析"
        description="上传视频并调用本地语音识别提取文案，支持时间轴、摘要和结果导出。"
        kicker="VIDEO TRANSCRIPTION"
      />

      <VideoInputPanel
        v-model:is-dragging="isDragging"
        :selected-video="selectedVideo"
        :remote-video="remoteVideo"
        :video-preview-url="videoPreviewUrl"
        :submitting="submitting"
        :upload-progress="uploadProgress"
        :current-task="currentTask"
        :result="result"
        :status-label="statusLabel"
        :source-label="sourceLabel"
        :recognition-quality-rows="recognitionQualityRows"
        :on-video-drop="onVideoDrop"
        :on-video-change="onVideoChange"
        :submit="submit"
      />
      <VideoHistoryPanel
        v-model:keyword="historyKeyword"
        :history-loading="historyLoading"
        :search-history="searchHistory"
        :history-page-selection="historyPageSelection"
        :history-items="historyItems"
        :selected-history-ids="selectedHistoryIds"
        :batch-deleting-history="batchDeletingHistory"
        :toggle-all-history-items="toggleAllHistoryItems"
        :delete-selected-history="deleteSelectedHistory"
        :opening-history-id="openingHistoryId"
        :source-name="sourceName"
        :format-bytes="formatBytes"
        :format-date-time="formatDateTime"
        :toggle-history-item="toggleHistoryItem"
        :deleting-history-id="deletingHistoryId"
        :open-history="openHistory"
        :delete-history="deleteHistory"
        :total="historyPagination.total"
        :page="historyPagination.page"
        :page-size="historyPagination.pageSize"
        :load-history="loadHistory"
        :on-history-page-size-change="onHistoryPageSizeChange"
      />
      <VideoResultPanel
        v-if="result"
        :result="result"
        :low-confidence-segments="lowConfidenceSegments"
        :copy-full-text="copyFullText"
        :export-url="exportUrl"
        :format-seconds="formatSeconds"
      />
    </section>
  </ToolLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useMessage } from "naive-ui";
import ToolLayout from "../../layouts/ToolLayout.vue";
import ToolPageHeader from "../../components/tool/ToolPageHeader.vue";
import VideoHistoryPanel from "./VideoHistoryPanel.vue";
import VideoInputPanel from "./VideoInputPanel.vue";
import VideoResultPanel from "./VideoResultPanel.vue";
import { useConfirmDialog } from "../../composables/useConfirmDialog";
import { useRequestScope } from "../../composables/useRequestScope";
import { useTaskEvents } from "../../composables/useTaskEvents";
import { resolveApiUrl } from "../../config/runtime";
import { copyTextToClipboard } from "../../utils/clipboard";
import { videoTextApi } from "./api";
import { describeRecognitionQuality } from "./quality";
import { createRemoteVideoPreviewUrl, getRemoteVideoSourceFromQuery, type RemoteVideoSource } from "./remote-source";
import type { VideoTextHistoryItem, VideoTextResult } from "./types";
import type { ToolTask } from "../../types";
import {
  getPageSelectionState,
  pruneSelectedIds,
  togglePageSelection,
  toggleSelectedId
} from "../../utils/batch-selection";

const message = useMessage();
const confirmAction = useConfirmDialog();
const route = useRoute();
const selectedVideo = ref<File | null>(null);
const remoteVideo = ref<RemoteVideoSource | null>(null);
const videoPreviewUrl = ref("");
const submitting = ref(false);
const isDragging = ref(false);
const uploadProgress = ref(0);
const currentTask = ref<ToolTask | null>(null);
const result = ref<VideoTextResult | null>(null);
const streamedTaskId = computed(() =>
  currentTask.value && ["pending", "running"].includes(currentTask.value.status) ? currentTask.value.id : undefined
);
const requestScope = useRequestScope();
const taskEvents = useTaskEvents(streamedTaskId, { signal: requestScope.signal });
const historyKeyword = ref("");
const historyPagination = reactive({
  page: 1,
  pageSize: 5,
  total: 0,
  pageCount: 1
});
const historyItems = ref<VideoTextHistoryItem[]>([]);
const historyLoading = ref(false);
const openingHistoryId = ref("");
const openingTaskId = ref("");
const deletingHistoryId = ref("");
const selectedHistoryIds = ref<string[]>([]);
const batchDeletingHistory = ref(false);

const statusLabel = computed(() => {
  if (!currentTask.value) return "等待上传";
  const labels = {
    pending: "等待中",
    running: "解析中",
    completed: "已完成",
    failed: "解析失败"
  };
  return labels[currentTask.value.status];
});

const sourceLabel = computed(() => {
  if (remoteVideo.value && !result.value) return "短视频解析";
  if (!result.value) return "未生成";
  return result.value.source === "transcriber" ? "本地语音识别" : "历史结果";
});
const recognitionQualityRows = computed(() => describeRecognitionQuality(result.value));
const lowConfidenceSegments = computed(() => result.value?.recognitionQuality?.lowConfidenceSegments ?? []);
const historyPageIds = computed(() => historyItems.value.map((item) => item.id));
const historyPageSelection = computed(() => getPageSelectionState(selectedHistoryIds.value, historyPageIds.value));

watch(taskEvents.task, (task) => {
  if (!task || task.id !== currentTask.value?.id) return;
  currentTask.value = task;
  uploadProgress.value = task.progress;
  if (task.status === "completed" || task.status === "failed") void finishStreamedTask(task.id);
});

watch(taskEvents.error, (error) => {
  if (error) message.warning(`${error.message}（${error.code}）`);
});

function onVideoChange(event: Event) {
  const target = event.target as HTMLInputElement;
  setVideo(target.files?.[0] ?? null);
}

function onVideoDrop(event: DragEvent) {
  isDragging.value = false;
  const file = Array.from(event.dataTransfer?.files ?? []).find((item) => item.type.startsWith("video/"));
  setVideo(file ?? null);
}

function setVideo(file: File | null) {
  if (!file) return;
  selectedVideo.value = file;
  remoteVideo.value = null;
  currentTask.value = null;
  result.value = null;
  uploadProgress.value = 0;
  revokeLocalPreviewUrl();
  videoPreviewUrl.value = URL.createObjectURL(file);
}

async function submit() {
  if (!selectedVideo.value && !remoteVideo.value) {
    message.warning("请先选择视频文件");
    return;
  }

  submitting.value = true;
  uploadProgress.value = 5;

  try {
    const response = remoteVideo.value
      ? await videoTextApi.createTaskFromUrl(remoteVideo.value)
      : await createUploadTask();
    currentTask.value = response.task;
    result.value = response.result;
    uploadProgress.value = response.task.status === "completed" ? 100 : response.task.progress;

    if (response.task.status === "completed") {
      message.success("视频文案解析完成");
      await loadHistory(1);
    } else if (response.task.status === "failed") {
      message.error(response.task.error || "视频文案解析失败");
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : "视频文案解析失败");
  } finally {
    submitting.value = false;
  }
}

async function finishStreamedTask(taskId: string) {
  try {
    const response = await videoTextApi.getTask(taskId);
    if (currentTask.value?.id !== taskId) return;
    currentTask.value = response.task;
    result.value = response.result;
    uploadProgress.value = response.task.progress;
    if (response.task.status === "completed") {
      message.success("视频文案解析完成");
      await loadHistory(1);
    } else {
      message.error(response.task.error || "视频文案解析失败");
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : "视频文案结果读取失败");
  }
}

function createUploadTask() {
  if (!selectedVideo.value) {
    throw new Error("请先选择视频文件");
  }

  const form = new FormData();
  form.append("file", selectedVideo.value);
  return videoTextApi.createTask(form, (event) => {
    if (event.total) {
      uploadProgress.value = Math.min(80, Math.round((event.loaded / event.total) * 80));
    }
  });
}

function setRemoteVideo(source: RemoteVideoSource) {
  selectedVideo.value = null;
  remoteVideo.value = source;
  currentTask.value = null;
  result.value = null;
  uploadProgress.value = 0;
  revokeLocalPreviewUrl();
  videoPreviewUrl.value = createRemoteVideoPreviewUrl(source.url);
}

async function loadHistory(page = historyPagination.page) {
  historyLoading.value = true;
  historyPagination.page = page;
  try {
    const response = await videoTextApi.listHistory({
      keyword: historyKeyword.value.trim() || undefined,
      page: historyPagination.page,
      pageSize: historyPagination.pageSize
    });
    historyItems.value = response.items;
    historyPagination.total = response.total;
    historyPagination.page = response.page;
    historyPagination.pageSize = response.pageSize;
    historyPagination.pageCount = response.pageCount;
    selectedHistoryIds.value = pruneSelectedIds(selectedHistoryIds.value, historyPageIds.value);
  } catch (error) {
    message.error(error instanceof Error ? error.message : "获取解析历史失败");
  } finally {
    historyLoading.value = false;
  }
}

async function searchHistory() {
  await loadHistory(1);
}

async function onHistoryPageSizeChange(pageSize: number) {
  historyPagination.page = 1;
  historyPagination.pageSize = pageSize;
  await loadHistory(1);
}

async function openHistory(taskId: string) {
  openingHistoryId.value = taskId;
  try {
    const historyResult = await videoTextApi.getHistoryResult(taskId);
    result.value = historyResult;
    currentTask.value = {
      id: historyResult.id,
      toolId: "video-text",
      status: "completed",
      progress: 100,
      createdAt: historyResult.createdAt,
      updatedAt: historyResult.createdAt
    };
    uploadProgress.value = 100;
    message.success("已打开历史解析结果");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "获取历史解析结果失败");
  } finally {
    openingHistoryId.value = "";
  }
}

async function openTaskResult(taskId: string) {
  openingTaskId.value = taskId;
  try {
    const response = await videoTextApi.getTask(taskId);
    currentTask.value = response.task;
    result.value = response.result;
    uploadProgress.value = response.task.progress;
    if (response.task.status === "completed") {
      message.success("已打开视频文案解析结果");
    } else if (response.task.status === "failed") {
      message.error(response.task.error || "视频文案解析失败");
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : "获取视频文案解析结果失败");
  } finally {
    openingTaskId.value = "";
  }
}

async function deleteHistory(item: VideoTextHistoryItem) {
  if (!(await confirmAction(`删除 ${item.fileName} 的解析历史？`, { title: "删除解析历史" }))) {
    return;
  }

  deletingHistoryId.value = item.id;
  try {
    await videoTextApi.deleteHistory(item.id);
    if (result.value?.id === item.id) {
      result.value = null;
      currentTask.value = null;
      uploadProgress.value = 0;
    }
    const nextPage =
      historyItems.value.length === 1 && historyPagination.page > 1
        ? historyPagination.page - 1
        : historyPagination.page;
    await loadHistory(nextPage);
    message.success("已删除历史记录");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "删除解析历史失败");
  } finally {
    deletingHistoryId.value = "";
  }
}

function toggleHistoryItem(id: string, checked: boolean) {
  selectedHistoryIds.value = toggleSelectedId(selectedHistoryIds.value, id, checked);
}

function toggleAllHistoryItems(checked: boolean) {
  selectedHistoryIds.value = togglePageSelection(selectedHistoryIds.value, historyPageIds.value, checked);
}

async function deleteSelectedHistory() {
  if (!selectedHistoryIds.value.length) return;
  if (
    !(await confirmAction(`删除选中的 ${selectedHistoryIds.value.length} 条解析历史？`, { title: "批量删除解析历史" }))
  ) {
    return;
  }

  batchDeletingHistory.value = true;
  try {
    const ids = [...selectedHistoryIds.value];
    await Promise.all(ids.map((id) => videoTextApi.deleteHistory(id)));
    if (result.value && ids.includes(result.value.id)) {
      result.value = null;
      currentTask.value = null;
      uploadProgress.value = 0;
    }
    selectedHistoryIds.value = [];
    if (historyItems.value.length === ids.length && historyPagination.page > 1) {
      historyPagination.page -= 1;
    }
    await loadHistory(historyPagination.page);
    message.success("已批量删除解析历史");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "批量删除解析历史失败");
  } finally {
    batchDeletingHistory.value = false;
  }
}

async function copyFullText() {
  if (!result.value?.fullText) return;
  try {
    await copyTextToClipboard(result.value.fullText);
    message.success("已复制文案");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "复制失败");
  }
}

function exportUrl(format: "txt" | "srt" | "json") {
  const taskId = result.value?.id ?? currentTask.value?.id;
  if (!taskId) return "";
  return resolveApiUrl(`/tools/video-text/tasks/${taskId}/export?format=${format}`);
}

function sourceName(source: VideoTextResult["source"]) {
  return source === "transcriber" ? "本地识别" : "历史结果";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatSeconds(seconds?: number) {
  if (seconds === undefined || Number.isNaN(seconds)) return "--:--";
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const rest = safeSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(rest).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

onBeforeUnmount(() => {
  revokeLocalPreviewUrl();
});

onMounted(async () => {
  const remoteSource = getRemoteVideoSourceFromQuery(route.query);
  if (remoteSource) {
    setRemoteVideo(remoteSource);
  }
  const taskId = typeof route.query.taskId === "string" ? route.query.taskId : "";
  if (!remoteSource && taskId) {
    await openTaskResult(taskId);
  }
  await loadHistory();
});

watch(
  () => [route.query.remoteUrl, route.query.fileName, route.query.taskId],
  async () => {
    const remoteSource = getRemoteVideoSourceFromQuery(route.query);
    if (remoteSource) {
      setRemoteVideo(remoteSource);
      return;
    }

    const taskId = typeof route.query.taskId === "string" ? route.query.taskId : "";
    if (taskId && taskId !== openingTaskId.value) {
      await openTaskResult(taskId);
    }
  }
);

function revokeLocalPreviewUrl() {
  if (videoPreviewUrl.value.startsWith("blob:")) {
    URL.revokeObjectURL(videoPreviewUrl.value);
  }
}
</script>
