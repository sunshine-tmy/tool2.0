<!-- 中文模块说明：AI 图片前端模块，负责输入配置、任务状态、预览和下载 -->
<template>
  <div>
    <div class="image-ai-tab-grid">
      <ImageAiBatchPicker
        :title="props.operation === 'enhance' ? '添加低清图片' : '添加商品图片'"
        :hint="
          props.operation === 'enhance' ? '最多 10 张；系统会预检增强后的像素尺寸' : '最多 10 张，结果统一输出透明 PNG'
        "
        :files="props.files"
        :disabled="props.isBusy"
        :checkerboard="props.operation === 'background_remove'"
        :preview-background="previewBackground"
        :result-urls="resultUrls"
        :validate-file="props.validateFile"
        :format-bytes="props.formatBytes"
        @change="emit('update:files', $event)"
      />
      <aside class="image-ai-controls">
        <h3 class="operation-title">{{ props.operation === "enhance" ? "变清晰设置" : "抠图设置" }}</h3>
        <div class="panel-heading">
          <div v-if="props.operation === 'enhance'">
            <h3>增强倍率</h3>
            <p>默认 2× 更自然，4× 适合较小原图。</p>
          </div>
          <div v-else>
            <h3>抠图模型</h3>
            <p>内部模式优先 BRIA，失败自动回退 BiRefNet。</p>
          </div>
          <n-tag v-if="props.operation === 'enhance'" size="small" :bordered="false">Real-ESRGAN</n-tag>
          <n-tag v-else size="small" type="info" :bordered="false">自动选择</n-tag>
        </div>
        <n-radio-group
          v-if="props.operation === 'enhance'"
          :value="props.scale"
          class="scale-options"
          @update:value="updateScale"
        >
          <n-radio-button :value="2">2× 均衡</n-radio-button>
          <n-radio-button :value="4">4× 高倍率</n-radio-button>
        </n-radio-group>
        <div v-else class="model-policy">
          <ShieldCheck :size="18" />
          <span>{{ props.modelPolicyLabel }}</span>
        </div>
        <p class="local-processing-note"><Info :size="16" />本地处理，图片不上传云端。</p>
        <n-alert v-if="!props.operationAvailable(props.operation)" type="warning" :bordered="false">
          {{ props.unavailableReason || "当前操作所需模型未就绪，请刷新状态或查看设置中的能力管理。" }}
        </n-alert>
        <n-button
          block
          type="primary"
          :disabled="!props.files.length || props.isBusy || !props.operationAvailable(props.operation)"
          :loading="props.isBusy"
          @click="props.submitBatch(props.operation)"
        >
          <template #icon
            ><Sparkles v-if="props.operation === 'enhance'" :size="16" /><Scan v-else :size="16"
          /></template>
          {{ props.operation === "enhance" ? "开始变清晰" : "开始抠图" }}
        </n-button>
        <ImageAiTaskStatusCard :task="resultTask" @cancel="props.cancelActiveTask" />
        <section v-if="props.operation === 'background_remove'" class="preview-background-settings">
          <h3>展示背景</h3>
          <div class="preview-background-options" aria-label="抠图预览背景">
            <button
              v-for="option in backgroundOptions"
              :key="option.value"
              type="button"
              :class="{ 'is-selected': previewBackground === option.value }"
              :aria-pressed="previewBackground === option.value"
              @click="previewBackground = option.value"
            >
              <span
                class="background-swatch"
                :class="option.value === 'transparent' ? 'checkerboard' : `is-${option.value}`"
              />
              {{ option.label }}
            </button>
          </div>
          <p>仅影响预览，抠图结果仍为透明 PNG。</p>
        </section>
      </aside>
    </div>
    <ImageAiResultGallery
      v-if="resultTask"
      :task="resultTask"
      :source-files="props.activeTaskFiles"
      :checkerboard="props.operation === 'background_remove'"
      @edit="(taskId, resultId) => emit('edit', taskId, resultId)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { NAlert, NButton, NRadioButton, NRadioGroup, NTag } from "naive-ui";
import { Info, Scan, ShieldCheck, Sparkles } from "lucide-vue-next";
import type { ImageAiOperation, ImageAiTask } from "@toolbox/shared";
import ImageAiBatchPicker from "./ImageAiBatchPicker.vue";
import ImageAiResultGallery from "./ImageAiResultGallery.vue";
import ImageAiTaskStatusCard from "./ImageAiTaskStatusCard.vue";
import { absoluteImageAiUrl } from "../media-links";

type BatchOperation = "enhance" | "background_remove";

const props = defineProps<{
  operation: BatchOperation;
  files: File[];
  scale: 2 | 4;
  isBusy: boolean;
  activeTask?: ImageAiTask;
  activeTaskFiles: File[];
  modelPolicyLabel: string;
  unavailableReason?: string;
  operationAvailable: (operation: ImageAiOperation) => boolean;
  validateFile: (file: File) => boolean;
  formatBytes: (bytes: number) => string;
  submitBatch: (operation: BatchOperation) => void | Promise<void>;
  cancelActiveTask: () => void | Promise<void>;
}>();

const emit = defineEmits<{
  "update:files": [files: File[]];
  "update:scale": [scale: 2 | 4];
  edit: [taskId: string, resultId: string];
}>();
const resultTask = computed(() => (props.activeTask?.operation === props.operation ? props.activeTask : undefined));
const previewBackground = ref<"transparent" | "light" | "dark">("transparent");
const backgroundOptions = [
  { value: "transparent", label: "透明" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" }
] as const;
const resultUrls = computed(() =>
  props.files.map((file, index) => {
    const task = resultTask.value;
    if (!task || props.activeTaskFiles[index] !== file) return undefined;
    const result = task.results.find((item) => item.id === `${task.id}-${index + 1}`);
    return result ? absoluteImageAiUrl(result.downloadUrl) : undefined;
  })
);

function updateScale(value: number | string) {
  emit("update:scale", Number(value) === 4 ? 4 : 2);
}
</script>

<style scoped>
.operation-title {
  margin: 0 0 8px;
  color: var(--color-text);
  font-size: 20px;
}
.image-ai-controls .panel-heading {
  align-items: start;
  gap: 12px;
  margin: 0;
}
.panel-heading h3 {
  font-size: 14px;
  margin: 0;
}
.model-policy {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--color-primary-200);
  border-radius: 8px;
  color: var(--color-primary-700);
  background: var(--color-surface-subtle);
  font-size: 13px;
}
.local-processing-note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
  padding: 12px;
  background: var(--color-primary-50);
  color: var(--color-primary-700);
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.7;
}
.local-processing-note svg,
.model-policy svg {
  flex-shrink: 0;
}
.image-ai-controls > :deep(.n-button--primary-type) {
  height: 46px;
  margin-top: 6px;
  font-size: 15px;
  font-weight: 600;
}
.scale-options {
  display: flex;
}
.scale-options :deep(.n-radio-button) {
  flex: 1;
  text-align: center;
}
.preview-background-settings {
  margin-top: 10px;
  padding-top: 22px;
  border-top: 1px solid var(--color-border);
}
.preview-background-settings h3 {
  margin: 0 0 16px;
  font-size: 16px;
}
.preview-background-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.preview-background-options button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 6px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface-subtle);
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.preview-background-options button.is-selected {
  border-color: var(--color-primary-600);
  color: var(--color-primary-700);
  background: var(--color-primary-50);
}
.preview-background-options button:focus-visible {
  outline: 2px solid var(--color-primary-600);
  outline-offset: 2px;
}
.background-swatch {
  width: 32px;
  height: 28px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
}
.background-swatch.is-light {
  background: #f4f4f8;
}
.background-swatch.is-dark {
  background: #383b4b;
}
.preview-background-settings p {
  margin: 12px 0 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.7;
}
</style>
