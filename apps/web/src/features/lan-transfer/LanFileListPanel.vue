<!-- 中文模块说明：局域网传输前端模块，负责文件、图文、分片上传和批量管理 -->
<template>
  <div class="lan-files-workspace">
    <header v-if="canReadFiles" class="lan-list-heading">
      <h3>共享文件列表</h3>
    <div class="lan-filters">
      <n-input
        v-model:value="keyword"
        clearable
        placeholder="搜索文件名或扩展名"
        @keyup.enter="$emit('applyFilters')"
      />
      <n-select v-model:value="category" clearable :options="categoryOptions" placeholder="文件类型" />
      <details class="lan-more-filters"><summary>更多筛选</summary><div class="lan-filter-options">
      <n-input v-model:value="extension" clearable placeholder="扩展名，例如 pdf" />
      <n-select v-model:value="sortBy" :options="sortOptions" />
      <n-select v-model:value="sortOrder" :options="sortOrderOptions" />
      <n-button type="primary" @click="$emit('applyFilters')">筛选</n-button>
      <n-button secondary @click="$emit('resetFilters')">重置</n-button>

      </div></details>
    </div>
    </header>

    <div v-if="canReadFiles" class="batch-toolbar">
      <n-checkbox
        :checked="pageSelection.checked"
        :indeterminate="pageSelection.indeterminate"
        :disabled="!files.length"
        @update:checked="$emit('toggleAll', $event)"
      >
        全选本页
      </n-checkbox>
      <span class="lan-selection-count">已选 {{ selectedIds.length }} 项</span>
      <div class="batch-actions">
        <n-button
          type="primary"
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
      <div class="lan-table-heading" aria-hidden="true"><span>文件名</span><span>大小</span><span>剩余有效期</span><span>创建时间</span><span>操作</span></div>
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
        <span class="lan-file-size">{{ formatBytes(file.size) }}</span>
        <span class="lan-file-expiry" :title="`过期 ${formatDate(file.expiresAt)}`">{{ remainingTime(file.expiresAt) }}</span>
        <span class="lan-file-created">{{ formatDate(file.createdAt) }}</span>
        <div class="file-actions">
          <n-button
            text
            size="small"
            :disabled="!file.previewable"
            :aria-label="`预览 ${file.originalName}`"
            @click="$emit('preview', file)"
            >预览</n-button
          >
          <n-button text size="small" tag="a" :href="file.downloadUrl" :aria-label="`下载 ${file.originalName}`"
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
import { formatBytesAdaptive as formatBytes } from "../../shared/utils/format-bytes";
import { categoryName } from "./presentation";
import { computed } from "vue";
import { NButton, NCheckbox, NEmpty, NInput, NPagination, NSelect } from "naive-ui";
import { FileArchive, FileText, FileVideo, ImageDown, Music } from "lucide-vue-next";
import type { LanFileCategory, LanFileSortBy, LanFileSortOrder } from "@toolbox/shared";
import { getPageSelectionState } from "../../shared/utils/batch-selection";
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
function remainingTime(value: string) {
  const hours = Math.ceil((new Date(value).getTime() - Date.now()) / 3600000);
  return hours <= 0 ? "已过期" : hours < 24 ? `剩余 ${hours} 小时` : `剩余 ${Math.ceil(hours / 24)} 天`;
}
</script>

<style scoped>
.lan-list-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--color-border); }
.lan-list-heading h3 { margin: 0; font-size: 18px; color: var(--color-text); }
.lan-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 0; border: 0; background: transparent; }
.lan-filters > .n-input { width: 280px; }
.lan-filters > .n-select { width: 150px; }
.lan-more-filters { position: relative; color: var(--color-text-secondary); font-size: 13px; }
.lan-more-filters summary { padding: 8px; cursor: pointer; }
.lan-filter-options { position: absolute; right: 0; top: 100%; z-index: 5; display: grid; gap: 12px; width: 260px; padding: 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; box-shadow: var(--shadow-card); }
.batch-toolbar { display: flex; justify-content: flex-start; flex-wrap: wrap; gap: 16px; padding: 14px 0; margin: 0; border: 0; background: transparent; }
.batch-actions { display: flex; gap: 10px; }
.lan-selection-count { color: var(--color-text-secondary); font-size: 13px; }
.file-list { display: block; min-width: 0; overflow-x: auto; }
.lan-table-heading, .file-row { display: grid; grid-template-columns: minmax(220px, 1fr) 100px 115px 155px 300px; align-items: center; gap: 16px; min-width: 970px; }
.lan-table-heading { padding: 12px 14px; border-radius: 8px; background: var(--color-primary-50); color: var(--color-text-secondary); font-size: 13px; }
.file-row { margin: 0; padding: 16px 14px; border: 0; border-bottom: 1px solid var(--color-border); border-radius: 0; background: transparent; }
.file-row:hover { background: var(--color-surface-subtle); }
.file-main { min-width: 0; gap: 12px; }
.file-main > svg { box-sizing: content-box; flex-shrink: 0; padding: 9px; width: 22px; height: 22px; color: var(--color-primary-600); background: var(--color-primary-50); border-radius: 10px; }
.file-main > div { min-width: 0; }
.file-main strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; color: var(--color-text); }
.file-main > div > span { font-size: 12px; color: var(--color-text-tertiary); }
.lan-file-size, .lan-file-expiry, .lan-file-created { font-size: 13px; color: var(--color-text-secondary); }
.file-actions { display: flex; flex-wrap: nowrap; justify-content: flex-end; gap: 10px; }
.file-actions :deep(.n-button) { padding-inline: 0; background: transparent; color: var(--color-primary-600); }
.file-actions :deep(.n-button--error-type) { color: var(--color-error); }
.pagination-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding-top: 18px; margin-top: 0; }
@media (max-width: 600px) { .lan-filters { width: 100%; } .lan-filters > .n-input { width: 100%; } }
</style>
