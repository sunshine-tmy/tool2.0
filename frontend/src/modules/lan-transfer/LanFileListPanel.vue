<template>
  <div class="lan-files-workspace">
    <div v-if="canReadFiles" class="lan-filters">
      <n-input
        v-model:value="keyword"
        clearable
        placeholder="搜索文件名或扩展名"
        @keyup.enter="$emit('applyFilters')"
      />
      <n-select v-model:value="category" clearable :options="categoryOptions" placeholder="文件类型" />
      <n-input v-model:value="extension" clearable placeholder="扩展名，例如 pdf" />
      <n-select v-model:value="sortBy" :options="sortOptions" />
      <n-select v-model:value="sortOrder" :options="sortOrderOptions" />
      <n-button type="primary" @click="$emit('applyFilters')">筛选</n-button>
      <n-button secondary @click="$emit('resetFilters')">重置</n-button>
    </div>

    <div v-if="canReadFiles" class="batch-toolbar">
      <n-checkbox
        :checked="pageSelection.checked"
        :indeterminate="pageSelection.indeterminate"
        :disabled="!files.length"
        @update:checked="$emit('toggleAll', $event)"
      >
        全选本页
      </n-checkbox>
      <div class="batch-actions">
        <n-button
          secondary
          size="small"
          :disabled="!selectedIds.length"
          :loading="batchDownloading"
          @click="$emit('downloadSelected')"
          >批量下载 {{ selectedIds.length || "" }}</n-button
        >
        <n-button
          v-if="canManageFiles"
          tertiary
          type="error"
          size="small"
          :disabled="!selectedIds.length"
          :loading="batchDeleting"
          @click="$emit('deleteSelected')"
          >批量删除 {{ selectedIds.length || "" }}</n-button
        >
      </div>
    </div>

    <div v-if="canReadFiles" class="file-list">
      <article v-for="file in files" :key="file.id" class="file-row">
        <div class="file-main">
          <n-checkbox
            :checked="selectedIds.includes(file.id)"
            :aria-label="`选择 ${file.originalName}`"
            @update:checked="$emit('toggleFile', file.id, $event)"
          />
          <FileArchive v-if="file.category === 'archive'" :size="20" />
          <FileVideo v-else-if="file.category === 'video'" :size="20" />
          <ImageDown v-else-if="file.category === 'image'" :size="20" />
          <Music v-else-if="file.category === 'audio'" :size="20" />
          <FileText v-else :size="20" />
          <div>
            <strong>{{ file.originalName }}</strong>
            <span
              >{{ categoryName(file.category) }} · {{ formatBytes(file.size) }} ·
              {{ file.extension || "无扩展名" }}</span
            >
          </div>
        </div>
        <div class="file-meta">
          <span>上传 {{ formatDate(file.createdAt) }}</span>
          <span>过期 {{ formatDate(file.expiresAt) }}</span>
          <span>下载 {{ file.downloadCount }}</span>
        </div>
        <div class="file-actions">
          <n-button
            secondary
            size="small"
            :disabled="!file.previewable"
            :aria-label="`预览 ${file.originalName}`"
            @click="$emit('preview', file)"
            >预览</n-button
          >
          <n-button secondary size="small" tag="a" :href="file.downloadUrl" :aria-label="`下载 ${file.originalName}`"
            >下载</n-button
          >
          <n-button
            tertiary
            size="small"
            :aria-label="`复制 ${file.originalName} 的下载链接`"
            @click="$emit('copyLink', file)"
            >复制链接</n-button
          >
          <n-button
            v-if="canManageFiles"
            tertiary
            size="small"
            :aria-label="`将 ${file.originalName} 保留 30 天`"
            @click="$emit('extendExpiry', file)"
            >保留30天</n-button
          >
          <n-button
            v-if="canManageFiles"
            tertiary
            size="small"
            type="error"
            :aria-label="`删除 ${file.originalName}`"
            @click="$emit('deleteFile', file)"
            >删除</n-button
          >
        </div>
      </article>
      <n-empty v-if="!files.length" description="暂无文件" />
    </div>
    <div v-if="canReadFiles && shouldShowPagination(pagination.total)" class="pagination-row">
      <span class="pagination-total">共 {{ pagination.total }} 个文件</span>
      <n-pagination
        :page="page"
        :page-size="pageSize"
        :item-count="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        show-size-picker
        @update:page="updatePage"
        @update:page-size="updatePageSize"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NButton, NCheckbox, NEmpty, NInput, NPagination, NSelect } from "naive-ui";
import { FileArchive, FileText, FileVideo, ImageDown, Music } from "lucide-vue-next";
import type { LanFileCategory, LanFileSortBy, LanFileSortOrder } from "@toolbox/shared";
import { getPageSelectionState } from "../../utils/batch-selection";
import { shouldShowPagination } from "./pagination";
import type { LanFileView } from "./types";

const emit = defineEmits<{
  applyFilters: [];
  resetFilters: [];
  toggleAll: [checked: boolean];
  toggleFile: [id: string, checked: boolean];
  downloadSelected: [];
  deleteSelected: [];
  preview: [file: LanFileView];
  copyLink: [file: LanFileView];
  extendExpiry: [file: LanFileView];
  deleteFile: [file: LanFileView];
  pageChange: [];
  pageSizeChange: [pageSize: number];
}>();

const keyword = defineModel<string>("keyword", { required: true });
const category = defineModel<LanFileCategory | undefined>("category", { required: true });
const extension = defineModel<string>("extension", { required: true });
const sortBy = defineModel<LanFileSortBy>("sortBy", { required: true });
const sortOrder = defineModel<LanFileSortOrder>("sortOrder", { required: true });
const page = defineModel<number>("page", { required: true });
const pageSize = defineModel<number>("pageSize", { required: true });

const props = defineProps<{
  canReadFiles: boolean;
  canManageFiles: boolean;
  files: LanFileView[];
  selectedIds: string[];
  batchDeleting: boolean;
  batchDownloading: boolean;
  pagination: { total: number; pageCount: number };
  categoryOptions: Array<{ label: string; value: LanFileCategory }>;
  sortOptions: Array<{ label: string; value: string }>;
  sortOrderOptions: Array<{ label: string; value: string }>;
}>();

const pageSelection = computed(() =>
  getPageSelectionState(
    props.selectedIds,
    props.files.map((file) => file.id)
  )
);

function updatePage(value: number) {
  page.value = value;
  emit("pageChange");
}

function updatePageSize(value: number) {
  pageSize.value = value;
  emit("pageSizeChange", value);
}

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
