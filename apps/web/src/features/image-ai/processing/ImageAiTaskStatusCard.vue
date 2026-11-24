<!-- 中文模块说明：AI 图片前端模块，负责输入配置、任务状态、预览和下载 -->
<template>
  <div v-if="props.task" class="ai-task-card">
    <div class="ai-task-heading">
      <strong>{{ statusName(props.task.status) }}</strong>
      <span v-if="props.task.queuePosition">队列第 {{ props.task.queuePosition }} 位</span>
    </div>
    <n-progress
      v-if="props.showDeviceDetails ? !isRunning : props.task.operation !== 'product_image' || !isRunning"
      :percentage="props.task.progress"
      :status="props.task.status === 'failed' ? 'error' : props.task.status === 'completed' ? 'success' : 'default'"
    />
    <div v-if="props.showDeviceDetails && isRunning" class="running-stage" aria-live="polite" aria-busy="true">
      <n-spin size="small" />
      <span>{{ props.task.results.length }} / {{ props.task.inputs?.length || 1 }} 张已完成</span>
    </div>
    <p v-if="props.task.operation === 'product_image'" role="status">{{ props.task.phase || "等待保存" }}</p>
    <p v-else-if="props.task.phase" role="status">{{ props.task.phase }}</p>
    <p v-for="result in executionResults" :key="result.id" class="execution-info">
      {{ result.model }} ·
      {{ result.execution?.device === "cuda" ? result.execution.gpuName || "NVIDIA GPU" : "CPU" }} ·
      {{ result.execution?.precision }} · {{ ((result.execution?.elapsedMs ?? 0) / 1000).toFixed(1) }} 秒
    </p>
    <p v-if="props.task.error" class="status-error">{{ props.task.error }}</p>
    <template v-if="props.showDeviceDetails">
      <div v-for="warning in props.task.warnings.slice(-3)" :key="warning" class="status-hint">
        <p>{{ warning.split("：")[0] }}</p>
        <details v-if="warning.includes('：')">
          <summary>技术详情</summary>
          <p>{{ warning.slice(warning.indexOf("：") + 1) }}</p>
        </details>
      </div>
    </template>
    <template v-else>
      <p v-for="warning in props.task.warnings.slice(-3)" :key="warning" class="status-hint">{{ warning }}</p>
    </template>
    <n-button v-if="isRunning && !props.readOnly" block size="small" secondary type="error" @click="emit('cancel')">
      <template #icon><Trash2 :size="15" /></template>取消任务
    </n-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NButton, NProgress, NSpin } from "naive-ui";
import { Trash2 } from "lucide-vue-next";
import type { ImageAiTask } from "@toolbox/shared";

const props = defineProps<{ task?: ImageAiTask; readOnly?: boolean; showDeviceDetails?: boolean }>();
const executionResults = computed(() =>
  props.showDeviceDetails ? (props.task?.results.filter((item) => item.execution) ?? []) : []
);
const emit = defineEmits<{ cancel: [] }>();
const isRunning = computed(() => props.task?.status === "pending" || props.task?.status === "running");

function statusName(status: ImageAiTask["status"]) {
  return { pending: "等待处理", running: "AI 处理中", completed: "处理完成", failed: "处理失败", canceled: "已取消" }[
    status
  ];
}
</script>

<style scoped>
.running-stage {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 24px;
  color: var(--color-text-secondary);
  font-size: 12px;
}
.execution-info {
  overflow-wrap: anywhere;
  color: var(--color-text-secondary);
  font-size: 12px;
}
</style>
