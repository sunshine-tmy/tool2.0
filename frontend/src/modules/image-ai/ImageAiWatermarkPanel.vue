<template>
  <div class="image-ai-tab-grid">
    <div class="image-ai-stage">
      <label v-if="!props.watermarkFile" class="dropzone image-ai-dropzone">
        <input hidden type="file" accept="image/jpeg,image/png,image/webp" @change="props.selectWatermark" />
        <ScanLine :size="34" />
        <strong>选择一张需要去水印的图片</strong>
        <span>支持 JPG、PNG、WebP，单张不超过 20MB</span>
      </label>

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
      <div class="panel-heading">
        <div>
          <h3>水印区域</h3>
          <p>智能检测后仍可继续涂抹或擦除。</p>
        </div>
        <n-tag size="small" type="warning" :bordered="false">用户确认</n-tag>
      </div>
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
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NButton, NTag } from "naive-ui";
import { Download, ScanLine, ScanSearch, WandSparkles } from "lucide-vue-next";
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

function requestSuggestions() {
  return props.suggestWatermark((suggestions) => maskEditor.value?.applySuggestions(suggestions));
}

function requestSubmit() {
  if (maskEditor.value) return props.submitWatermark(maskEditor.value);
}
</script>
