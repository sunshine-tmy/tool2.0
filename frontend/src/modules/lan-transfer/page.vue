<template>
  <ToolLayout>
    <section class="main-column lan-main">
      <div class="section-title">
        <div>
          <h2>局域网文件传输</h2>
          <p>同一局域网内公开收发文件，支持预览、筛选、下载和删除。</p>
        </div>
        <n-button secondary @click="refreshLanFiles">
          <template #icon>
            <RefreshCw :size="16" />
          </template>
          刷新列表
        </n-button>
      </div>

      <section class="workspace-panel lan-panel">
        <div class="share-strip">
          <div>
            <span>访问地址</span>
            <strong>{{ publicWebUrl }}</strong>
          </div>
          <n-button secondary @click="copyText(publicWebUrl)">复制</n-button>
        </div>

        <label
          class="dropzone lan-dropzone"
          :class="{ 'is-dragging': isDraggingFiles }"
          @dragenter.prevent="isDraggingFiles = true"
          @dragover.prevent="isDraggingFiles = true"
          @dragleave.prevent="isDraggingFiles = false"
          @drop.prevent="onLanFilesDrop"
        >
          <input hidden multiple type="file" @change="onLanFilesChange" />
          <UploadCloud :size="28" />
          <span>点击选择文件上传，支持图片、视频、音频、文本、PDF、压缩包和文档</span>
          <small>单文件上限 20GB，默认保留 7 天</small>
        </label>

        <div v-if="uploadQueue.length" class="upload-list">
          <div v-for="item in uploadQueue" :key="item.name" class="task-row">
            <strong>{{ item.name }}</strong>
            <n-progress
              type="line"
              :percentage="item.progress"
              :status="item.status === 'failed' ? 'error' : item.status === 'done' ? 'success' : 'default'"
              indicator-placement="inside"
            />
            <div class="upload-actions">
              <n-button v-if="item.status === 'uploading'" tertiary size="small" @click="item.uploader?.pause()">暂停</n-button>
              <n-button v-if="item.status === 'paused' || item.status === 'failed'" secondary size="small" @click="item.uploader?.resume()">继续</n-button>
              <n-button
                v-if="item.status === 'uploading' || item.status === 'paused' || item.status === 'failed'"
                tertiary
                size="small"
                type="error"
                @click="item.uploader?.cancel()"
              >
                取消
              </n-button>
            </div>
          </div>
        </div>

        <div class="lan-filters">
          <n-input v-model:value="lanQuery.keyword" clearable placeholder="搜索文件名或扩展名" @keyup.enter="applyLanFilters" />
          <n-select v-model:value="lanQuery.category" clearable :options="lanCategoryOptions" placeholder="文件类型" />
          <n-input v-model:value="lanQuery.extension" clearable placeholder="扩展名，例如 pdf" />
          <n-select v-model:value="lanQuery.sortBy" :options="lanSortOptions" />
          <n-select v-model:value="lanQuery.sortOrder" :options="lanSortOrderOptions" />
          <n-button type="primary" @click="applyLanFilters">筛选</n-button>
        </div>

        <div class="batch-toolbar">
          <n-checkbox
            :checked="lanPageSelection.checked"
            :indeterminate="lanPageSelection.indeterminate"
            :disabled="!lanFiles.length"
            @update:checked="toggleAllLanFiles"
          >
            全选本页
          </n-checkbox>
          <n-button
            tertiary
            type="error"
            size="small"
            :disabled="!selectedLanFileIds.length"
            :loading="batchDeletingLanFiles"
            @click="deleteSelectedLanFiles"
          >
            批量删除 {{ selectedLanFileIds.length || "" }}
          </n-button>
        </div>

        <div class="file-list">
          <article v-for="file in lanFiles" :key="file.id" class="file-row">
            <div class="file-main">
              <n-checkbox
                :checked="selectedLanFileIds.includes(file.id)"
                @update:checked="(checked) => toggleLanFile(file.id, checked)"
              />
              <FileArchive v-if="file.category === 'archive'" :size="20" />
              <FileVideo v-else-if="file.category === 'video'" :size="20" />
              <ImageDown v-else-if="file.category === 'image'" :size="20" />
              <Music v-else-if="file.category === 'audio'" :size="20" />
              <FileText v-else :size="20" />
              <div>
                <strong>{{ file.originalName }}</strong>
                <span>{{ categoryName(file.category) }} · {{ formatBytes(file.size) }} · {{ file.extension || "无扩展名" }}</span>
              </div>
            </div>
            <div class="file-meta">
              <span>上传 {{ formatDate(file.createdAt) }}</span>
              <span>过期 {{ formatDate(file.expiresAt) }}</span>
              <span>下载 {{ file.downloadCount }}</span>
            </div>
            <div class="file-actions">
              <n-button secondary size="small" :disabled="!file.previewable" @click="openPreview(file)">预览</n-button>
              <n-button secondary size="small" tag="a" :href="file.downloadUrl" target="_blank">下载</n-button>
              <n-button tertiary size="small" type="error" @click="deleteLanFile(file)">删除</n-button>
            </div>
          </article>
          <n-empty v-if="!lanFiles.length" description="暂无文件" />
        </div>
        <div v-if="shouldShowPagination(lanPagination.total)" class="pagination-row">
          <span class="pagination-total">共 {{ lanPagination.total }} 个文件</span>
          <n-pagination
            v-model:page="lanPagination.page"
            v-model:page-size="lanPagination.pageSize"
            :item-count="lanPagination.total"
            :page-sizes="[10, 20, 50, 100]"
            show-size-picker
            @update:page="refreshLanFiles"
            @update:page-size="onLanPageSizeChange"
          />
        </div>
      </section>
    </section>

    <n-modal v-model:show="previewVisible" preset="card" :title="previewFile?.originalName" class="preview-modal">
      <div v-if="previewFile" class="preview-body">
        <img v-if="previewFile.category === 'image'" :src="previewFile.previewUrl" :alt="previewFile.originalName" />
        <video v-else-if="previewFile.category === 'video'" :src="previewFile.previewUrl" controls />
        <audio v-else-if="previewFile.category === 'audio'" :src="previewFile.previewUrl" controls />
        <iframe v-else-if="previewFile.category === 'pdf'" :src="previewFile.previewUrl" title="PDF preview" />
        <pre v-else-if="previewFile.category === 'text'">{{ previewText }}</pre>
        <n-empty v-else description="该文件类型不支持预览，请下载查看。" />
      </div>
      <template #footer>
        <n-button type="primary" tag="a" :href="previewFile?.downloadUrl" target="_blank">下载文件</n-button>
      </template>
    </n-modal>
  </ToolLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { NButton, NCheckbox, NEmpty, NInput, NModal, NPagination, NProgress, NSelect, useMessage } from "naive-ui";
import type { LanFileCategory, LanFileSortBy, LanFileSortOrder } from "@toolbox/shared";
import { lanFileCategories } from "@toolbox/shared";
import { FileArchive, FileText, FileVideo, ImageDown, Music, RefreshCw, UploadCloud } from "lucide-vue-next";
import ToolLayout from "../../layouts/ToolLayout.vue";
import { copyTextToClipboard } from "../../utils/clipboard";
import { ConcurrentChunkUploader } from "./chunk-uploader";
import { lanTransferApi } from "./api";
import { shouldShowPagination } from "./pagination";
import type { LanFileView, UploadItem } from "./types";
import { removeUploadItem } from "./upload-queue";
import {
  getPageSelectionState,
  pruneSelectedIds,
  togglePageSelection,
  toggleSelectedId
} from "../../utils/batch-selection";

const message = useMessage();
const publicWebUrl = "http://192.168.1.241:5173";
const lanFiles = ref<LanFileView[]>([]);
const uploadQueue = ref<UploadItem[]>([]);
const isDraggingFiles = ref(false);
const previewVisible = ref(false);
const previewFile = ref<LanFileView | null>(null);
const previewText = ref("");
const selectedLanFileIds = ref<string[]>([]);
const batchDeletingLanFiles = ref(false);
const lanQuery = reactive({
  keyword: "",
  category: undefined as LanFileCategory | undefined,
  extension: "",
  sortBy: "createdAt" as LanFileSortBy,
  sortOrder: "desc" as LanFileSortOrder
});
const lanPagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
  pageCount: 1
});

const lanCategoryOptions = lanFileCategories.map((category) => ({
  label: categoryName(category),
  value: category
}));
const lanSortOptions = [
  { label: "上传时间", value: "createdAt" },
  { label: "文件大小", value: "size" },
  { label: "文件名", value: "name" },
  { label: "下载次数", value: "downloadCount" }
];
const lanSortOrderOptions = [
  { label: "降序", value: "desc" },
  { label: "升序", value: "asc" }
];
const lanPageFileIds = computed(() => lanFiles.value.map((file) => file.id));
const lanPageSelection = computed(() => getPageSelectionState(selectedLanFileIds.value, lanPageFileIds.value));

onMounted(() => {
  refreshLanFiles();
});

function categoryName(category: LanFileCategory) {
  const names: Record<LanFileCategory, string> = {
    image: "图片",
    video: "视频",
    audio: "音频",
    text: "文本",
    pdf: "PDF",
    archive: "压缩包",
    document: "文档",
    other: "其他"
  };
  return names[category];
}

async function onLanFilesChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = Array.from(target.files ?? []);
  target.value = "";
  await uploadLanFiles(files);
}

async function onLanFilesDrop(event: DragEvent) {
  isDraggingFiles.value = false;
  await uploadLanFiles(Array.from(event.dataTransfer?.files ?? []));
}

async function uploadLanFiles(files: File[]) {
  for (const file of files) {
    await uploadLanFile(file);
  }
  await refreshLanFiles();
}

async function uploadLanFile(file: File) {
  const item = reactive<UploadItem>({
    name: file.name,
    progress: 0,
    status: "uploading"
  });
  uploadQueue.value = [item, ...uploadQueue.value].slice(0, 8);
  const uploader = new ConcurrentChunkUploader(file);
  let activeUiRun: Promise<void> | undefined;

  uploader.onProgress((snapshot) => {
    item.progress = snapshot.progress;
    item.status = snapshot.status;
  });

  function runUploadOnce(resume = false) {
    if (activeUiRun) {
      return activeUiRun;
    }

    activeUiRun = runUpload(resume).finally(() => {
      activeUiRun = undefined;
    });
    return activeUiRun;
  }

  async function runUpload(resume = false) {
    try {
      item.status = "uploading";
      const result = resume ? await uploader.resume() : await uploader.start();
      item.status = result.status;

      if (result.status === "done") {
        item.progress = 100;
        message.success(`${file.name} 上传完成`);
        await refreshLanFiles();
      } else if (result.status === "paused") {
        message.info(`${file.name} 已暂停`);
      } else if (result.status === "canceled") {
        message.warning(`${file.name} 已取消`);
      }
    } catch (error) {
      item.status = "failed";
      message.error(error instanceof Error ? error.message : `${file.name} 上传失败`);
    }
  }

  item.uploader = {
    pause: () => uploader.pause(),
    resume: async () => {
      await runUploadOnce(true);
    },
    cancel: async () => {
      try {
        await uploader.cancel();
        uploadQueue.value = removeUploadItem(uploadQueue.value, item);
        message.warning(`${file.name} 已取消`);
      } catch (error) {
        item.status = "failed";
        message.error(error instanceof Error ? error.message : `${file.name} 取消失败`);
      }
    }
  };

  await runUploadOnce();
}

async function refreshLanFiles() {
  try {
    const result = await lanTransferApi.listFiles({
      keyword: lanQuery.keyword,
      category: lanQuery.category,
      extension: lanQuery.extension,
      sortBy: lanQuery.sortBy,
      sortOrder: lanQuery.sortOrder,
      page: lanPagination.page,
      pageSize: lanPagination.pageSize
    });
    lanFiles.value = result.files;
    lanPagination.page = result.pagination.page;
    lanPagination.pageSize = result.pagination.pageSize;
    lanPagination.total = result.pagination.total;
    lanPagination.pageCount = result.pagination.pageCount;
    selectedLanFileIds.value = pruneSelectedIds(selectedLanFileIds.value, lanPageFileIds.value);
  } catch (error) {
    message.error(error instanceof Error ? error.message : "获取文件列表失败");
  }
}

async function applyLanFilters() {
  lanPagination.page = 1;
  await refreshLanFiles();
}

async function onLanPageSizeChange(pageSize: number) {
  lanPagination.page = 1;
  lanPagination.pageSize = pageSize;
  await refreshLanFiles();
}

async function openPreview(file: LanFileView) {
  previewFile.value = file;
  previewText.value = "";
  previewVisible.value = true;
  if (file.category === "text") {
    try {
      previewText.value = await lanTransferApi.getTextPreview(file.previewUrl);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "获取预览失败");
    }
  }
}

async function deleteLanFile(file: LanFileView) {
  if (!window.confirm(`删除 ${file.originalName}？`)) {
    return;
  }
  try {
    await lanTransferApi.deleteFile(file.id);
    message.success("文件已删除");
    await refreshLanFiles();
  } catch (error) {
    message.error(error instanceof Error ? error.message : "删除文件失败");
  }
}

function toggleLanFile(id: string, checked: boolean) {
  selectedLanFileIds.value = toggleSelectedId(selectedLanFileIds.value, id, checked);
}

function toggleAllLanFiles(checked: boolean) {
  selectedLanFileIds.value = togglePageSelection(selectedLanFileIds.value, lanPageFileIds.value, checked);
}

async function deleteSelectedLanFiles() {
  if (!selectedLanFileIds.value.length) return;
  if (!window.confirm(`删除选中的 ${selectedLanFileIds.value.length} 个文件？`)) {
    return;
  }

  batchDeletingLanFiles.value = true;
  try {
    const ids = [...selectedLanFileIds.value];
    await Promise.all(ids.map((id) => lanTransferApi.deleteFile(id)));
    selectedLanFileIds.value = [];
    if (lanFiles.value.length === ids.length && lanPagination.page > 1) {
      lanPagination.page -= 1;
    }
    await refreshLanFiles();
    message.success("已批量删除文件");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "批量删除文件失败");
  } finally {
    batchDeletingLanFiles.value = false;
  }
}

async function copyText(value: string) {
  try {
    await copyTextToClipboard(value);
    message.success("已复制");
  } catch {
    message.error("复制失败，请手动选中地址复制");
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
</script>
