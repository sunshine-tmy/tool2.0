<template>
  <div v-if="health?.runtime?.platform === 'Windows'" class="device-settings">
    <label :for="inputId">处理设备</label>
    <n-select
      :input-props="{ id: inputId, 'aria-label': '处理设备' }"
      :value="value"
      :options="options"
      :disabled="disabled"
      @update:value="updateDevice"
    />
    <p role="status">
      <Cpu :size="15" aria-hidden="true" />
      <span v-if="health?.runtime?.cudaAvailable"
        >{{ health.runtime.gpuName }} · {{ Math.round((health.runtime.totalMemoryMb ?? 0) / 1024) }} GB</span
      >
      <span v-else>{{ health?.runtime?.reason || "当前使用 CPU；安装图片 GPU 加速能力后可自动启用" }}</span>
    </p>
    <p v-if="value === 'cuda' && !health?.runtime?.cudaAvailable" class="device-warning">
      GPU 尚未就绪，请先到能力管理安装 AI 图片 GPU 加速并检查驱动。
    </p>
    <p v-else-if="value === 'auto'" class="device-hint">优先 GPU，不可用时回退 CPU；本次实际设备将在结果中显示。</p>
    <details v-if="health?.runtime" class="runtime-details">
      <summary>运行环境</summary>
      <span>PyTorch {{ health.runtime.torchVersion }} · CUDA {{ health.runtime.cudaVersion }}</span>
      <span
        >ONNX {{ health.runtime.onnxVersion }} ·
        {{ health.runtime.onnxCudaAvailable ? "CUDA 后端已提供" : "CPU 后端" }}</span
      >
      <span>OCR 智能框选使用 CPU</span>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from "vue";
import { NSelect } from "naive-ui";
import { Cpu } from "lucide-vue-next";
import type { ImageAiDevice, ImageAiHealth } from "@toolbox/shared";
const props = defineProps<{ value: ImageAiDevice; disabled?: boolean; health?: ImageAiHealth }>();
const emit = defineEmits<{ "update:value": [value: ImageAiDevice] }>();
const inputId = useId();
function updateDevice(value: unknown) {
  if (value === "auto" || value === "cpu" || value === "cuda") emit("update:value", value);
}
const options = computed(() => [
  { label: "自动", value: "auto" },
  { label: "NVIDIA GPU", value: "cuda", disabled: props.health?.runtime?.platform !== "Windows" },
  { label: "CPU", value: "cpu" }
]);
</script>

<style scoped>
.device-settings {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.device-settings label {
  color: var(--color-text);
  font-weight: 600;
  font-size: 14px;
}
.device-settings p {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-secondary);
  overflow-wrap: anywhere;
}
.device-settings svg {
  flex-shrink: 0;
  margin-top: 2px;
}
.device-settings .device-warning {
  color: var(--color-warning);
}
.runtime-details {
  color: var(--color-text-secondary);
  font-size: 12px;
}
.runtime-details summary {
  cursor: pointer;
}
.runtime-details span {
  display: block;
  margin-top: 6px;
  overflow-wrap: anywhere;
}
</style>
