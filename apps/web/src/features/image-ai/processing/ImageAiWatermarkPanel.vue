<!-- 中文模块说明：AI 图片前端模块，负责输入配置、任务状态、预览和下载 -->
<template>
  <div class="image-ai-tab-grid">
    <div class="image-ai-stage">
      <template v-if="!props.watermarkFile">
        <label
          class="dropzone image-ai-dropzone file-upload-area"
          data-upload-area
          tabindex="0"
          @keydown.enter.prevent="fileInput?.click()"
          @keydown.space.prevent="fileInput?.click()"
        >
          <input
            ref="fileInput"
            hidden
            type="file"
            accept="image/jpeg,image/png,image/webp"
            @change="props.selectWatermark"
          />
          <UploadCloud :size="32" aria-hidden="true" />
          <strong>选择一张需要去水印的图片</strong>
          <span>支持 JPG、PNG、WebP，单张不超过 20MB</span>
        </label>
        <div class="watermark-empty-preview">
          <ScanLine :size="42" :stroke-width="1.5" />
          <strong>添加图片后框选需要修复的区域</strong>
          <span>支持智能检测，也可手动涂抹与擦除</span>
        </div>
      </template>

      <template v-else>
        <div class="image-ai-filebar">
          <div>
            <strong>{{ props.watermarkFile.name }}</strong>
            <span>{{ props.formatBytes(props.watermarkFile.size) }} · {{ props.watermarkDimensionsLabel }}</span>
          </div>
          <n-button size="small" secondary :disabled="props.isBusy" @click="props.clearWatermark">更换图片</n-button>
        </div>
        <MaskEditor
          v-if="!props.watermarkResultUrl"
          ref="maskEditor"
          :image-url="props.watermarkPreviewUrl"
          @ready="props.onDimensions"
        />
        <BeforeAfterCompare
          v-else
          class="watermark-result-compare"
          :before-url="props.watermarkPreviewUrl"
          :after-url="props.watermarkResultUrl"
        />
      </template>
    </div>

    <aside class="image-ai-controls">
      <h3 class="operation-title">去水印设置</h3>
      <div class="panel-heading">
        <div>
          <h3>水印区域</h3>
          <p>智能检测后仍可继续涂抹或擦除。</p>
        </div>
        <n-tag size="small" type="warning" :bordered="false">用户确认</n-tag>
      </div>
      <p class="local-processing-note"><Info :size="16" />本地修复，原图与成功结果自动留档。</p>
      <n-button
        block
        secondary
        :disabled="!props.watermarkFile || Boolean(props.watermarkResultUrl)"
        :loading="props.suggesting"
        @click="requestSuggestions"
      >
        <template #icon><ScanSearch :size="16" /></template>OCR 智能框选
      </n-button>
      <n-button
        v-if="!props.watermarkResultUrl"
        block
        type="primary"
        :disabled="!props.watermarkFile || props.isBusy || !props.operationAvailable('watermark_remove')"
        :loading="props.isBusy"
        @click="requestSubmit"
      >
        <template #icon><WandSparkles :size="16" /></template>开始去水印
      </n-button>
      <n-button v-else block type="primary" @click="props.downloadWatermarkResult">
        <template #icon><Download :size="16" /></template>下载 PNG
      </n-button>
      <n-button v-if="props.watermarkResultUrl" block secondary @click="props.resetWatermarkResult"
        >重新编辑蒙版</n-button
      >
      <ImageAiTaskStatusCard :task="props.activeTask" @cancel="props.cancelActiveTask" />
      <div class="watermark-help">
        <h4>操作提示</h4>
        <p>1. 上传图片，使用 OCR 检测或手动涂抹。</p>
        <p>2. 检查红色蒙版，确认需要修复的区域。</p>
        <p>3. 开始处理，完成后拖动分割线查看对比。</p>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NButton, NTag } from "naive-ui";
import { Download, Info, ScanLine, ScanSearch, UploadCloud, WandSparkles } from "lucide-vue-next";
import type { ImageAiOperation, ImageAiTask, WatermarkSuggestion } from "@toolbox/shared";
import BeforeAfterCompare from "./BeforeAfterCompare.vue";
import ImageAiTaskStatusCard from "./ImageAiTaskStatusCard.vue";
import MaskEditor from "./MaskEditor.vue";

type MaskEditorExposed = {
  applySuggestions: (suggestions: WatermarkSuggestion[]) => void;
  toMaskBlob: () => Promise<Blob>;
};

const props = defineProps<{
  watermarkFile?: File;
  watermarkPreviewUrl: string;
  watermarkResultUrl: string;
  watermarkDimensionsLabel: string;
  isBusy: boolean;
  suggesting: boolean;
  activeTask?: ImageAiTask;
  operationAvailable: (operation: ImageAiOperation) => boolean;
  selectWatermark: (event: Event) => void;
  clearWatermark: () => void;
  suggestWatermark: (applySuggestions: (suggestions: WatermarkSuggestion[]) => void) => void | Promise<void>;
  submitWatermark: (editor: Pick<MaskEditorExposed, "toMaskBlob">) => void | Promise<void>;
  downloadWatermarkResult: () => void;
  resetWatermarkResult: () => void;
  cancelActiveTask: () => void | Promise<void>;
  formatBytes: (bytes: number) => string;
  onDimensions: (value: { width: number; height: number }) => void;
}>();

const maskEditor = ref<MaskEditorExposed>();
const fileInput = ref<HTMLInputElement>();

function requestSuggestions() {
  return props.suggestWatermark((suggestions) => maskEditor.value?.applySuggestions(suggestions));
}

function requestSubmit() {
  if (maskEditor.value) return props.submitWatermark(maskEditor.value);
}
</script>

<style scoped>
.image-ai-dropzone:focus-visible {
  outline: 2px solid var(--color-primary-600);
  outline-offset: 3px;
}
.watermark-empty-preview {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  min-height: 340px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  color: var(--color-text-tertiary);
  background: var(--color-surface-subtle);
}
.watermark-empty-preview strong {
  color: var(--color-text-secondary);
  font-size: 14px;
}
.watermark-empty-preview span {
  font-size: 12px;
}
.operation-title {
  margin: 0 0 8px;
  color: var(--color-text);
  font-size: 20px;
}
.panel-heading {
  align-items: start;
  gap: 12px;
  margin: 0;
}
.panel-heading h3 {
  margin: 0;
  font-size: 14px;
}
.local-processing-note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 12px;
  border-radius: 8px;
  background: var(--color-primary-50);
  color: var(--color-primary-700);
  font-size: 12px;
  line-height: 1.7;
}
.local-processing-note svg {
  flex-shrink: 0;
}
.image-ai-controls > :deep(.n-button--primary-type) {
  min-height: 46px;
  font-size: 15px;
  font-weight: 600;
}
.watermark-help {
  margin-top: 8px;
  padding-top: 18px;
  border-top: 1px solid var(--color-border);
}
.watermark-help h4 {
  margin: 0 0 12px;
  font-size: 14px;
}
.watermark-help p {
  margin: 8px 0 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.8;
}
@media (max-width: 600px) {
  .watermark-empty-preview {
    min-height: 260px;
    text-align: center;
    padding: 12px;
  }
}
</style>
