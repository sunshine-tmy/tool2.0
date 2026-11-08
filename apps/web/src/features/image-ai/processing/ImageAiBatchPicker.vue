<!-- 中文模块说明：AI 图片前端模块，负责输入配置、任务状态、预览和下载 -->
<template>
  <div class="image-ai-stage">
    <label
      class="dropzone image-ai-dropzone compact file-upload-area"
      data-upload-area
      :class="{ 'is-disabled': props.disabled }"
      tabindex="0"
      @keydown.enter.prevent="fileInput?.click()"
      @keydown.space.prevent="fileInput?.click()"
      @dragover.prevent
      @drop.prevent="drop"
    >
      <input
        ref="fileInput"
        hidden
        multiple
        type="file"
        accept="image/jpeg,image/png,image/webp"
        :disabled="props.disabled"
        @change="select"
      />
      <UploadCloud :size="32" aria-hidden="true" />
      <strong>{{ props.title }}</strong>
      <span>{{ props.hint }}</span>
    </label>
    <div
      v-if="selectedPreview"
      class="batch-main-preview"
      :class="[
        props.checkerboard && props.previewBackground === 'transparent' && 'checkerboard',
        `is-${props.previewBackground}`
      ]"
    >
      <img :src="props.resultUrls?.[selectedIndex] || selectedPreview.url" :alt="selectedPreview.file.name" />
      <span class="batch-preview-label">{{ props.resultUrls?.[selectedIndex] ? "处理后预览" : "输入图片预览" }}</span>
    </div>
    <div v-else class="batch-main-preview batch-empty">
      <Images :size="42" :stroke-width="1.5" />
      <strong>添加图片后在这里预览</strong>
      <span>选择图片不会自动开始处理</span>
    </div>
    <div v-if="previews.length" class="batch-input-heading">
      <strong
        >输入图片 <span>（{{ previews.length }}/10）</span></strong
      >
      <span>点击缩略图切换预览</span>
    </div>
    <div v-if="previews.length" class="batch-preview-grid">
      <article
        v-for="(item, index) in previews"
        :key="item.url"
        :class="[
          'batch-preview-card',
          props.checkerboard && 'checkerboard',
          { 'is-selected': selectedIndex === index }
        ]"
        role="button"
        tabindex="0"
        :aria-label="`预览 ${item.file.name}`"
        :aria-pressed="selectedIndex === index"
        @click="selectedIndex = index"
        @keydown.enter.self.prevent="selectedIndex = index"
        @keydown.space.self.prevent="selectedIndex = index"
      >
        <img :src="item.url" :alt="item.file.name" />
        <div>
          <strong>{{ item.file.name }}</strong
          ><span>{{ props.formatBytes(item.file.size) }}</span>
        </div>
        <n-button
          circle
          size="tiny"
          tertiary
          :aria-label="`移除 ${item.file.name}`"
          :disabled="props.disabled"
          @click.stop="remove(index)"
        >
          <template #icon><X :size="14" /></template>
        </n-button>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { NButton } from "naive-ui";
import { Images, UploadCloud, X } from "lucide-vue-next";

const props = defineProps<{
  title: string;
  hint: string;
  files: File[];
  disabled: boolean;
  checkerboard?: boolean;
  previewBackground?: "transparent" | "light" | "dark";
  resultUrls?: (string | undefined)[];
  validateFile: (file: File) => boolean;
  formatBytes: (bytes: number) => string;
}>();
const emit = defineEmits<{ change: [files: File[]] }>();
const fileInput = ref<HTMLInputElement>();
const selectedIndex = ref(0);

const previews = computed(() => props.files.map((file) => ({ file, url: URL.createObjectURL(file) })));
const selectedPreview = computed(() => previews.value[selectedIndex.value]);
watch(
  () => props.files,
  () => {
    selectedIndex.value = 0;
  }
);
watch(previews, (_next, previous) => previous?.forEach((item) => URL.revokeObjectURL(item.url)));
onBeforeUnmount(() => previews.value.forEach((item) => URL.revokeObjectURL(item.url)));

function select(event: Event) {
  const input = event.target as HTMLInputElement;
  const next = Array.from(input.files ?? [])
    .filter(props.validateFile)
    .slice(0, 10);
  input.value = "";
  emit("change", next);
}

function drop(event: DragEvent) {
  if (props.disabled) return;
  emit(
    "change",
    Array.from(event.dataTransfer?.files ?? [])
      .filter(props.validateFile)
      .slice(0, 10)
  );
}

function remove(index: number) {
  emit(
    "change",
    props.files.filter((_file, current) => current !== index)
  );
}
</script>

<style scoped>
.image-ai-dropzone:focus-visible {
  outline: 2px solid var(--color-primary-600);
  outline-offset: 3px;
}
.image-ai-dropzone.is-disabled {
  cursor: default;
  opacity: 0.65;
}
.batch-main-preview {
  margin-top: 16px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: clamp(280px, 36vh, 460px);
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background-color: var(--color-surface-subtle);
}
.batch-main-preview.is-light {
  background: #f4f4f8;
}
.batch-main-preview.is-dark {
  background: #383b4b;
}
.batch-main-preview > img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: none;
}
.batch-preview-label {
  position: absolute;
  left: 12px;
  top: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  color: var(--color-text-secondary);
  background: rgba(255, 255, 255, 0.92);
  font-size: 12px;
}
.batch-empty {
  flex-direction: column;
  gap: 12px;
  color: var(--color-text-tertiary);
}
.batch-empty strong {
  color: var(--color-text-secondary);
  font-size: 14px;
}
.batch-empty span {
  font-size: 12px;
}
.batch-input-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: 16px 0 10px;
  font-size: 12px;
}
.batch-input-heading span {
  color: var(--color-text-secondary);
  font-weight: 400;
}
.batch-preview-grid {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 3px 2px;
}
.batch-preview-card {
  flex: 0 0 112px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
  padding: 6px;
  cursor: pointer;
  background: var(--color-surface-subtle);
  border-color: var(--color-border);
}
.batch-preview-card.is-selected {
  border-color: var(--color-primary-600);
  box-shadow: 0 0 0 1px var(--color-primary-600);
}
.batch-preview-card:focus-visible {
  outline: 2px solid var(--color-primary-600);
  outline-offset: 2px;
}
.batch-preview-card img {
  width: 98px;
  height: 64px;
  background: transparent;
}
.batch-preview-card :deep(.n-button) {
  position: absolute;
  right: 3px;
  top: 3px;
  background: var(--color-surface);
}
.batch-preview-card strong {
  font-size: 11px;
}
.batch-preview-card span {
  margin-top: 2px;
  color: var(--color-text-secondary);
  font-size: 10px;
}
@media (max-width: 600px) {
  .batch-main-preview {
    height: 280px;
  }
  .batch-input-heading {
    flex-wrap: wrap;
  }
}
</style>
