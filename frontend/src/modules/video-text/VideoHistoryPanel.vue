<template>
  <section class="workspace-panel video-history-panel">
    <div class="panel-heading">
      <h3>解析历史</h3>
      <div class="history-search video-history-filters">
        <n-input
          :value="props.keyword"
          clearable
          size="small"
          placeholder="搜索文件名、文案或摘要"
          @update:value="emit('update:keyword', $event)"
          @keyup.enter="props.searchHistory"
        />
        <n-button type="primary" size="small" :loading="props.historyLoading" @click="props.searchHistory"
          >筛选</n-button
        >
      </div>
    </div>

    <div class="batch-toolbar">
      <n-checkbox
        :checked="props.historyPageSelection.checked"
        :indeterminate="props.historyPageSelection.indeterminate"
        :disabled="!props.historyItems.length"
        @update:checked="props.toggleAllHistoryItems"
      >
        全选本页
      </n-checkbox>
      <n-button
        tertiary
        type="error"
        size="small"
        :disabled="!props.selectedHistoryIds.length"
        :loading="props.batchDeletingHistory"
        @click="props.deleteSelectedHistory"
      >
        批量删除 {{ props.selectedHistoryIds.length || "" }}
      </n-button>
    </div>

    <div class="file-list">
      <article v-for="item in props.historyItems" :key="item.id" class="file-row">
        <div class="file-main">
          <n-checkbox
            :checked="props.selectedHistoryIds.includes(item.id)"
            @update:checked="(checked) => props.toggleHistoryItem(item.id, checked)"
          />
          <FileVideo :size="20" />
          <div>
            <strong>{{ item.fileName }}</strong>
            <span
              >{{ props.sourceName(item.source) }} · {{ props.formatBytes(item.fileSize) }} · {{ item.mimeType }}</span
            >
            <span class="history-preview">{{ item.textPreview || "无预览内容" }}</span>
          </div>
        </div>
        <div class="file-meta">
          <span>解析 {{ props.formatDateTime(item.createdAt) }}</span>
          <span>字数 {{ item.characterCount }}</span>
          <span>摘要 {{ item.summary[0] || "暂无" }}</span>
        </div>
        <div class="file-actions">
          <n-button
            secondary
            size="small"
            :loading="props.openingHistoryId === item.id"
            @click="props.openHistory(item.id)"
            >查看</n-button
          >
          <n-button
            tertiary
            type="error"
            size="small"
            :loading="props.deletingHistoryId === item.id"
            @click="props.deleteHistory(item)"
          >
            删除
          </n-button>
        </div>
      </article>
      <n-empty v-if="!props.historyItems.length && !props.historyLoading" description="暂无历史记录" />
    </div>

    <div v-if="shouldShowPagination(props.total)" class="pagination-row">
      <span class="pagination-total">共 {{ props.total }} 条历史</span>
      <n-pagination
        :page="props.page"
        :page-size="props.pageSize"
        :item-count="props.total"
        :page-sizes="[5, 10, 20, 50]"
        show-size-picker
        @update:page="props.loadHistory"
        @update:page-size="props.onHistoryPageSizeChange"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { NButton, NCheckbox, NEmpty, NInput, NPagination } from "naive-ui";
import { FileVideo } from "lucide-vue-next";
import type { VideoTextHistoryItem, VideoTextResult } from "./types";
import { shouldShowPagination } from "../lan-transfer/pagination";

const props = defineProps<{
  keyword: string;
  historyLoading: boolean;
  searchHistory: () => void | Promise<void>;
  historyPageSelection: { checked: boolean; indeterminate: boolean };
  historyItems: VideoTextHistoryItem[];
  selectedHistoryIds: string[];
  batchDeletingHistory: boolean;
  toggleAllHistoryItems: (checked: boolean) => void;
  deleteSelectedHistory: () => void | Promise<void>;
  openingHistoryId: string;
  sourceName: (source: VideoTextResult["source"]) => string;
  formatBytes: (size: number) => string;
  formatDateTime: (value: string) => string;
  toggleHistoryItem: (id: string, checked: boolean) => void;
  deletingHistoryId: string;
  openHistory: (taskId: string) => void | Promise<void>;
  deleteHistory: (item: VideoTextHistoryItem) => void | Promise<void>;
  total: number;
  page: number;
  pageSize: number;
  loadHistory: (page?: number) => void | Promise<void>;
  onHistoryPageSizeChange: (pageSize: number) => void | Promise<void>;
}>();

const emit = defineEmits<{ "update:keyword": [value: string] }>();
</script>
