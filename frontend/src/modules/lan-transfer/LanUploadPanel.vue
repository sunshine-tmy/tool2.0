<template>
  <label
    v-if="canUploadFiles"
    class="dropzone lan-dropzone"
    :class="{ 'is-dragging': isDraggingFiles }"
    tabindex="0"
    @keydown.enter.prevent="fileInput?.click()"
    @keydown.space.prevent="fileInput?.click()"
    @dragenter.prevent="$emit('update:isDraggingFiles', true)"
    @dragover.prevent="$emit('update:isDraggingFiles', true)"
    @dragleave.prevent="$emit('update:isDraggingFiles', false)"
    @drop.prevent="onDrop"
  >
    <input ref="fileInput" hidden multiple type="file" @change="onChange" />
    <UploadCloud :size="28" />
    <span>点击选择、拖拽或粘贴文件，支持图片、视频、音频、文本、PDF、压缩包和文档</span>
    <small
      >在此页面按 Ctrl+V（macOS 按 Command+V）即可上传 · 单文件上限
      {{ formatBytes(info?.maxFileBytes ?? 20 * 1024 ** 3) }}，默认保留 {{ info?.retentionDays ?? 3 }} 天</small
    >
  </label>

  <div v-if="uploadQueue.length" class="upload-list">
    <div v-for="item in uploadQueue" :key="item.id" class="task-row">
      <strong>{{ item.name }} · {{ formatBytes(item.size) }}</strong>
      <n-progress
        type="line"
        :percentage="item.progress"
        :status="item.status === 'failed' ? 'error' : item.status === 'done' ? 'success' : 'default'"
        indicator-placement="inside"
      />
      <div class="upload-actions">
        <n-button v-if="item.status === 'uploading'" tertiary size="small" @click="item.uploader?.pause()"
          >暂停</n-button
        >
        <n-button
          v-if="item.status === 'paused' || item.status === 'failed'"
          secondary
          size="small"
          @click="item.uploader?.resume()"
          >继续</n-button
        >
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
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NButton, NProgress } from "naive-ui";
import { UploadCloud } from "lucide-vue-next";
import type { LanTransferInfo, UploadItem } from "./types";

defineProps<{
  canUploadFiles: boolean;
  isDraggingFiles: boolean;
  info: LanTransferInfo | null;
  uploadQueue: UploadItem[];
}>();

const emit = defineEmits<{
  "update:isDraggingFiles": [value: boolean];
  "files-selected": [files: File[]];
}>();

const fileInput = ref<HTMLInputElement>();

function onChange(event: Event) {
  const target = event.target as HTMLInputElement;
  emit("files-selected", Array.from(target.files ?? []));
  target.value = "";
}

function onDrop(event: DragEvent) {
  emit("update:isDraggingFiles", false);
  emit("files-selected", Array.from(event.dataTransfer?.files ?? []));
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
</script>
