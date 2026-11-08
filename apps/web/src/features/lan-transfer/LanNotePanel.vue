<!-- 中文模块说明：局域网传输前端模块，负责文件、图文、分片上传和批量管理 -->
<template>
  <section class="lan-note-section">
    <div class="lan-note-heading">
      <div>
        <h3>图文快传</h3>
        <p>发送文字、链接、验证码或图文内容，局域网内其他设备可直接复制和查看。</p>
      </div>
      <span v-if="info">{{ info.noteCount ?? 0 }} 条 · 默认保留 {{ info.retentionDays }} 天</span>
    </div>

    <div v-if="canUpload" class="lan-note-composer" @paste="$emit('paste', $event)">
      <n-input
        :value="title"
        clearable
        :maxlength="lanNoteLimits.titleCharacters"
        placeholder="标题（可选）"
        @update:value="$emit('update:title', $event)"
      />
      <n-input
        :value="content"
        type="textarea"
        :autosize="{ minRows: 3, maxRows: 10 }"
        :maxlength="lanNoteLimits.contentCharacters"
        show-count
        placeholder="输入要传输的文字、链接、地址或说明……"
        @update:value="$emit('update:content', $event)"
      />
      <div class="lan-note-picker">
        <input
          ref="imageInput"
          hidden
          multiple
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
          @change="onImagesChange"
        />
        <n-button secondary type="primary" :disabled="images.length >= lanNoteLimits.maxImages" @click="imageInput?.click()">
          添加图片 {{ images.length }}/{{ lanNoteLimits.maxImages }}
        </n-button>
        <span>单张不超过 10 MB，合计不超过 30 MB；支持直接粘贴剪贴板截图</span>
      </div>
      <div v-if="images.length" class="lan-note-draft-images">
        <figure v-for="(image, index) in images" :key="image.id">
          <img :src="image.previewUrl" :alt="image.file.name" />
          <figcaption>
            <span>{{ image.file.name }}</span>
            <n-button tertiary size="tiny" type="error" @click="$emit('remove-image', index)">移除</n-button>
          </figcaption>
        </figure>
      </div>
      <div class="lan-note-publish-actions">
        <span>{{ content.length.toLocaleString() }} / {{ lanNoteLimits.contentCharacters.toLocaleString() }} 字</span>
        <n-button type="primary" :loading="publishing" @click="$emit('publish')">发布图文</n-button>
      </div>
    </div>

    <div v-if="canManage" class="batch-toolbar lan-note-batch-toolbar">
      <n-checkbox
        :checked="pageSelection.checked"
        :indeterminate="pageSelection.indeterminate"
        :disabled="!notes.length"
        @update:checked="$emit('toggle-all', $event)"
      >
        全选本页
      </n-checkbox>
      <n-button
        tertiary
        type="error"
        size="small"
        :disabled="!selectedIds.length"
        :loading="batchDeleting"
        @click="$emit('delete-selected')"
      >
        批量删除 {{ selectedIds.length || "" }}
      </n-button>
    </div>

    <div v-if="canRead" class="lan-note-list">
      <article v-for="note in notes" :key="note.id" class="lan-note-card">
        <header>
          <div class="lan-note-card-main">
            <n-checkbox
              v-if="canManage"
              :checked="selectedIds.includes(note.id)"
              :aria-label="`选择 ${note.title || '图文快传'}`"
              @update:checked="$emit('toggle-note', note.id, $event)"
            />
            <div>
              <strong>{{ note.title || "图文快传" }}</strong>
              <span>发布 {{ formatDate(note.createdAt) }} · 过期 {{ formatDate(note.expiresAt) }}</span>
            </div>
          </div>
          <div class="lan-note-actions">
            <n-button v-if="note.title" quaternary size="small" @click="$emit('copy-title', note)"><template #icon><Copy :size="14" /></template>复制标题</n-button>
            <n-button v-if="note.content" quaternary size="small" @click="$emit('copy-content', note)"
              ><template #icon><ClipboardCopy :size="14" /></template>复制正文</n-button
            >
            <n-button v-if="canManage" quaternary size="small" @click="$emit('extend-expiry', note)"><template #icon><Clock3 :size="14" /></template>保留30天</n-button>
            <n-button v-if="canManage" quaternary size="small" type="error" @click="$emit('delete-note', note)"
              ><template #icon><Trash2 :size="14" /></template>删除</n-button
            >
          </div>
        </header>
        <pre v-if="note.content">{{ note.content }}</pre>
        <div v-if="note.images.length" class="lan-note-images">
          <figure v-for="image in note.images" :key="image.id">
            <a :href="image.previewUrl" target="_blank" rel="noreferrer">
              <img :src="image.previewUrl" :alt="image.originalName" loading="lazy" decoding="async" />
            </a>
            <figcaption>
              <span>{{ image.originalName }} · {{ formatBytes(image.size) }}</span>
              <span>
                <a :href="image.downloadUrl">下载</a>
                <n-button text type="primary" size="tiny" @click="$emit('copy-image-link', image.previewUrl)">
                  复制链接
                </n-button>
              </span>
            </figcaption>
          </figure>
        </div>
      </article>
      <n-empty v-if="!notes.length" description="暂无图文，发送一段文字或几张图片试试" />
      <div v-if="shouldShowPagination(pagination.total)" class="pagination-row">
        <span class="pagination-total">共 {{ pagination.total }} 条图文</span>
        <n-pagination
          :page="pagination.page"
          :page-size="pagination.pageSize"
          :item-count="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          show-size-picker
          @update:page="$emit('page-change', $event)"
          @update:page-size="$emit('page-size-change', $event)"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Copy, ClipboardCopy, Clock3, Trash2 } from "lucide-vue-next";
import { NButton, NCheckbox, NEmpty, NInput, NPagination } from "naive-ui";
import { lanNoteLimits } from "@toolbox/shared";
import { shouldShowPagination } from "./pagination";
import type { LanNoteView, LanTransferInfo } from "./types";

type DraftImage = { id: string; file: File; previewUrl: string };
type Pagination = { page: number; pageSize: number; total: number; pageCount: number };

defineProps<{
  info: LanTransferInfo | null;
  canUpload: boolean;
  canRead: boolean;
  canManage: boolean;
  title: string;
  content: string;
  images: DraftImage[];
  publishing: boolean;
  notes: LanNoteView[];
  selectedIds: string[];
  pageSelection: { checked: boolean; indeterminate: boolean };
  batchDeleting: boolean;
  pagination: Pagination;
}>();

const emit = defineEmits<{
  "update:title": [value: string];
  "update:content": [value: string];
  "select-images": [files: File[]];
  paste: [event: ClipboardEvent];
  "remove-image": [index: number];
  publish: [];
  "copy-title": [note: LanNoteView];
  "copy-content": [note: LanNoteView];
  "copy-image-link": [url: string];
  "extend-expiry": [note: LanNoteView];
  "delete-note": [note: LanNoteView];
  "toggle-note": [id: string, checked: boolean];
  "toggle-all": [checked: boolean];
  "delete-selected": [];
  "page-change": [page: number];
  "page-size-change": [pageSize: number];
}>();

const imageInput = ref<HTMLInputElement | null>(null);

function onImagesChange(event: Event) {
  const input = event.target as HTMLInputElement;
  emit("select-images", Array.from(input.files ?? []));
  input.value = "";
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
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

<style scoped>
.lan-note-section {
  gap: 20px;
  margin: 0;
  padding: 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  box-shadow: var(--shadow-card);
}
.lan-note-heading { align-items: flex-start; flex-wrap: wrap; gap: 12px; }
.lan-note-heading h3 { color: var(--color-text); font-size: 18px; line-height: 1.5; }
.lan-note-heading p { margin-top: 6px; color: var(--color-text-secondary); font-size: 13px; line-height: 1.6; }
.lan-note-heading > span { margin: 0; padding: 5px 10px; border-radius: 6px; background: var(--color-primary-50); color: var(--color-primary-600); font-size: 12px; white-space: nowrap; }
.lan-note-composer {
  gap: 14px;
  padding: 18px;
  background: var(--color-surface-subtle);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}
.lan-note-composer :deep(.n-input) { background: var(--color-surface); border-radius: 8px; }
.lan-note-composer :deep(.n-input__textarea-el) { line-height: 1.8; }
.lan-note-picker { flex-wrap: wrap; gap: 10px 14px; }
.lan-note-picker > span { margin: 0; color: var(--color-text-tertiary); line-height: 1.6; }
.lan-note-publish-actions { padding-top: 12px; border-top: 1px solid var(--color-border); }
.lan-note-publish-actions > span { margin: 0; color: var(--color-text-tertiary); }
.lan-note-publish-actions > .n-button { min-width: 104px; }
.lan-note-batch-toolbar { padding: 0 0 14px; margin: 0; border: 0; border-bottom: 1px solid var(--color-border); background: transparent; }
.lan-note-list { gap: 14px; }
.lan-note-list > :deep(.n-empty) { padding: 24px 12px 28px; }
.lan-note-card { gap: 16px; padding: 18px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; }
.lan-note-card > header { align-items: flex-start; flex-wrap: wrap; gap: 12px; }
.lan-note-card-main { flex: 1; min-width: 180px; }
.lan-note-card-main strong { color: var(--color-text); font-size: 15px; overflow-wrap: anywhere; }
.lan-note-card-main > div > span { margin-top: 6px; color: var(--color-text-tertiary); }
.lan-note-card pre { padding: 14px 16px; color: var(--color-text); background: var(--color-surface-subtle); border: 1px solid var(--color-border); border-radius: 8px; font-size: 14px; }
.lan-note-actions { gap: 6px; align-items: center; }
.lan-note-actions :deep(.n-button) { height: 32px; padding: 0 10px; border-radius: 7px; font-size: 12px; background: transparent; }
.lan-note-actions :deep(.n-button:not(.n-button--error-type)) { color: var(--color-primary-600); }
.lan-note-actions :deep(.n-button:not(.n-button--error-type):hover) { background: var(--color-primary-50); }
.lan-note-actions :deep(.n-button--error-type) { color: var(--color-error); }
.lan-note-actions :deep(.n-button--error-type:hover) { background: var(--color-error-50, #fff1f2); }
.lan-note-draft-images, .lan-note-images { gap: 12px; }
.lan-note-draft-images figure, .lan-note-images figure { border-color: var(--color-border); border-radius: 10px; background: var(--color-surface); }
.lan-note-draft-images img, .lan-note-images img { background: var(--color-surface-subtle); }
.lan-note-draft-images figcaption, .lan-note-images figcaption { padding: 10px; color: var(--color-text-secondary); }
.lan-note-images figcaption a, .lan-note-images figcaption button { color: var(--color-primary-600); }
.pagination-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding-top: 16px; border-top: 1px solid var(--color-border); color: var(--color-text-secondary); }
@media (max-width: 600px) {
  .lan-note-section { padding: 16px; gap: 16px; }
  .lan-note-composer, .lan-note-card { padding: 14px; }
  .lan-note-actions { justify-content: flex-start; }
}
</style>
