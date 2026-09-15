<template>
  <ToolLayout>
    <section class="main-column video-text-main">
      <ToolPageHeader
        title="视频文本解析"
        description="上传视频并调用本地语音识别提取文案，支持时间轴、摘要和结果导出。"
        kicker="VIDEO TRANSCRIPTION"
      />

      <section class="workspace-panel video-text-panel">
        <div class="video-text-grid">
          <div class="video-input-stack">
            <label
              class="dropzone video-dropzone"
              :class="{ 'is-dragging': isDragging }"
              @dragenter.prevent="isDragging = true"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="onVideoDrop"
            >
              <input hidden type="file" accept="video/mp4,video/webm,video/quicktime" @change="onVideoChange" />
              <UploadCloud :size="28" />
              <strong>{{ selectedVideo ? selectedVideo.name : remoteVideo?.fileName || "点击或拖拽上传视频" }}</strong>
              <span>
                {{
                  remoteVideo
                    ? "已从短视频解析带入视频，点击开始解析后将提取文案。"
                    : "支持 MP4、WebM、MOV。上传后将调用后端配置的本地语音识别命令生成文案。"
                }}
              </span>
            </label>

            <div v-if="videoPreviewUrl" class="video-preview-box">
              <video :src="videoPreviewUrl" controls />
            </div>

            <n-button type="primary" :loading="submitting" :disabled="!selectedVideo && !remoteVideo" @click="submit">
              <template #icon>
                <Wand2 :size="16" />
              </template>
              开始解析
            </n-button>

            <n-progress
              v-if="submitting || currentTask"
              type="line"
              :percentage="uploadProgress"
              :status="
                currentTask?.status === 'failed' ? 'error' : currentTask?.status === 'completed' ? 'success' : 'default'
              "
              indicator-placement="inside"
            />
          </div>

          <aside class="video-status-panel">
            <h3>解析状态</h3>
            <div class="metric-list">
              <div>
                <span>任务</span>
                <strong>{{ currentTask?.id || "未开始" }}</strong>
              </div>
              <div>
                <span>状态</span>
                <strong>{{ statusLabel }}</strong>
              </div>
              <div>
                <span>来源</span>
                <strong>{{ sourceLabel }}</strong>
              </div>
              <div v-if="result">
                <span>字数</span>
                <strong>{{ result.stats.characterCount }}</strong>
              </div>
              <div v-for="row in recognitionQualityRows" :key="row.label">
                <span>{{ row.label }}</span>
                <strong>{{ row.value }}</strong>
              </div>
            </div>
            <p v-if="currentTask?.error" class="status-error">{{ currentTask.error }}</p>
            <p v-else class="status-hint">
              已支持本地识别链路：视频会先提取音频，再调用后端配置的语音识别命令生成文案。
            </p>
          </aside>
        </div>
      </section>

      <section class="workspace-panel video-history-panel">
        <div class="panel-heading">
          <h3>解析历史</h3>
          <div class="history-search video-history-filters">
            <n-input
              v-model:value="historyKeyword"
              clearable
              size="small"
              placeholder="搜索文件名、文案或摘要"
              @keyup.enter="searchHistory"
            />
            <n-button type="primary" size="small" :loading="historyLoading" @click="searchHistory">筛选</n-button>
          </div>
        </div>

        <div class="batch-toolbar">
          <n-checkbox
            :checked="historyPageSelection.checked"
            :indeterminate="historyPageSelection.indeterminate"
            :disabled="!historyItems.length"
            @update:checked="toggleAllHistoryItems"
          >
            全选本页
          </n-checkbox>
          <n-button
            tertiary
            type="error"
            size="small"
            :disabled="!selectedHistoryIds.length"
            :loading="batchDeletingHistory"
            @click="deleteSelectedHistory"
          >
            批量删除 {{ selectedHistoryIds.length || "" }}
          </n-button>
        </div>

        <div class="file-list">
          <article v-for="item in historyItems" :key="item.id" class="file-row">
            <div class="file-main">
              <n-checkbox
                :checked="selectedHistoryIds.includes(item.id)"
                @update:checked="(checked) => toggleHistoryItem(item.id, checked)"
              />
              <FileVideo :size="20" />
              <div>
                <strong>{{ item.fileName }}</strong>
                <span>{{ sourceName(item.source) }} · {{ formatBytes(item.fileSize) }} · {{ item.mimeType }}</span>
                <span class="history-preview">{{ item.textPreview || "无预览内容" }}</span>
              </div>
            </div>
            <div class="file-meta">
              <span>解析 {{ formatDateTime(item.createdAt) }}</span>
              <span>字数 {{ item.characterCount }}</span>
              <span>摘要 {{ item.summary[0] || "暂无" }}</span>
            </div>
            <div class="file-actions">
              <n-button secondary size="small" :loading="openingHistoryId === item.id" @click="openHistory(item.id)">
                查看
              </n-button>
              <n-button
                tertiary
                type="error"
                size="small"
                :loading="deletingHistoryId === item.id"
                @click="deleteHistory(item)"
              >
                删除
              </n-button>
            </div>
          </article>
          <n-empty v-if="!historyItems.length && !historyLoading" description="暂无历史记录" />
        </div>

        <div v-if="shouldShowPagination(historyPagination.total)" class="pagination-row">
          <span class="pagination-total">共 {{ historyPagination.total }} 条历史</span>
          <n-pagination
            v-model:page="historyPagination.page"
            v-model:page-size="historyPagination.pageSize"
            :item-count="historyPagination.total"
            :page-sizes="[5, 10, 20, 50]"
            show-size-picker
            @update:page="loadHistory"
            @update:page-size="onHistoryPageSizeChange"
          />
        </div>
      </section>

      <section v-if="result" class="workspace-panel result-panel">
        <div class="panel-heading">
          <h3>提取结果</h3>
          <div class="result-actions">
            <n-button secondary size="small" @click="copyFullText">复制全文</n-button>
            <n-button secondary size="small" tag="a" :href="exportUrl('txt')" target="_blank">TXT</n-button>
            <n-button secondary size="small" tag="a" :href="exportUrl('srt')" target="_blank">SRT</n-button>
            <n-button secondary size="small" tag="a" :href="exportUrl('json')" target="_blank">JSON</n-button>
          </div>
        </div>

        <div class="analysis-grid">
          <div class="analysis-section transcript-section">
            <h4>完整文案</h4>
            <pre>{{ result.fullText }}</pre>
          </div>

          <div class="analysis-section">
            <h4>摘要</h4>
            <ul>
              <li v-for="item in result.summary" :key="item">{{ item }}</li>
            </ul>
          </div>
        </div>

        <div class="timeline-list">
          <h4>时间轴文案</h4>
          <article v-for="segment in result.segments" :key="`${segment.index}-${segment.text}`" class="timeline-row">
            <span>{{ formatSeconds(segment.startSeconds) }} - {{ formatSeconds(segment.endSeconds) }}</span>
            <strong>{{ segment.text }}</strong>
          </article>
        </div>

        <div v-if="lowConfidenceSegments.length" class="timeline-list">
          <h4>建议复核片段</h4>
          <article
            v-for="segment in lowConfidenceSegments"
            :key="`${segment.index}-${segment.text}`"
            class="timeline-row"
          >
            <span>{{ formatSeconds(segment.startSeconds) }} - {{ formatSeconds(segment.endSeconds) }}</span>
            <strong>{{ segment.text }}</strong>
          </article>
        </div>
      </section>
    </section>
  </ToolLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { NButton, NCheckbox, NEmpty, NInput, NPagination, NProgress, useMessage } from "naive-ui";
import { FileVideo, UploadCloud, Wand2 } from "lucide-vue-next";
import ToolLayout from "../../layouts/ToolLayout.vue";
import ToolPageHeader from "../../components/tool/ToolPageHeader.vue";
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
import { shouldShowPagination } from "../lan-transfer/pagination";
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
