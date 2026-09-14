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
        <n-button secondary :disabled="images.length >= lanNoteLimits.maxImages" @click="imageInput?.click()">
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
            <n-button v-if="note.content" secondary size="small" @click="$emit('copy-content', note)"
              >复制文字</n-button
            >
            <n-button v-if="canManage" tertiary size="small" @click="$emit('extend-expiry', note)">保留30天</n-button>
            <n-button v-if="canManage" tertiary size="small" type="error" @click="$emit('delete-note', note)"
              >删除</n-button
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
