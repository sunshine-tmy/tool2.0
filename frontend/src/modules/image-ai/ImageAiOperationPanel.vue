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
        :validate-file="props.validateFile"
        :format-bytes="props.formatBytes"
        @change="emit('update:files', $event)"
      />
      <aside class="image-ai-controls">
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
        <ImageAiTaskStatusCard :task="props.activeTask" @cancel="props.cancelActiveTask" />
      </aside>
    </div>
    <ImageAiResultGallery
      v-if="resultTask"
      :task="resultTask"
      :source-files="props.activeTaskFiles"
      :checkerboard="props.operation === 'background_remove'"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NButton, NRadioButton, NRadioGroup, NTag } from "naive-ui";
import { Scan, ShieldCheck, Sparkles } from "lucide-vue-next";
import type { ImageAiOperation, ImageAiTask } from "@toolbox/shared";
import ImageAiBatchPicker from "./ImageAiBatchPicker.vue";
import ImageAiResultGallery from "./ImageAiResultGallery.vue";
import ImageAiTaskStatusCard from "./ImageAiTaskStatusCard.vue";

type BatchOperation = "enhance" | "background_remove";

const props = defineProps<{
  operation: BatchOperation;
  files: File[];
  scale: 2 | 4;
  isBusy: boolean;
  activeTask?: ImageAiTask;
  activeTaskFiles: File[];
  modelPolicyLabel: string;
  operationAvailable: (operation: ImageAiOperation) => boolean;
  validateFile: (file: File) => boolean;
  formatBytes: (bytes: number) => string;
  submitBatch: (operation: BatchOperation) => void | Promise<void>;
  cancelActiveTask: () => void | Promise<void>;
}>();

const emit = defineEmits<{ "update:files": [files: File[]]; "update:scale": [scale: 2 | 4] }>();
const resultTask = computed(() => (props.activeTask?.operation === props.operation ? props.activeTask : undefined));

function updateScale(value: number | string) {
  emit("update:scale", Number(value) === 4 ? 4 : 2);
}
</script>
