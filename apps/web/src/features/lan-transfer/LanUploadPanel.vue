<!-- 中文模块说明：局域网传输前端模块，负责文件、图文、分片上传和批量管理 -->
<template>
  <section class="lan-upload-card">
    <header><h3>上传文件</h3><p>选择文件或拖拽到此处，上传后将在局域网内共享并可下载。</p></header>
  <label
    v-if="canUploadFiles"
    class="dropzone lan-dropzone file-upload-area"
    data-upload-area
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
    <strong>点击选择、拖拽或粘贴文件</strong><span>支持图片、视频、音频、文本、PDF、压缩包和文档</span>
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
  </section>
</template>

<script setup lang="ts">
import { formatBytesAdaptive as formatBytes } from "../../shared/utils/format-bytes";
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
</script>

<style scoped>
.lan-upload-card { padding: 20px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); box-shadow: var(--shadow-card); }
.lan-upload-card header { margin-bottom: 16px; }
.lan-upload-card h3 { margin: 0 0 6px; font-size: 18px; color: var(--color-text); }
.lan-upload-card header p { margin: 0; color: var(--color-text-secondary); font-size: 13px; }
</style>
