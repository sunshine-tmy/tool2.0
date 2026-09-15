<template>
  <div v-if="props.task" class="ai-task-card">
    <div class="ai-task-heading">
      <strong>{{ statusName(props.task.status) }}</strong>
      <span v-if="props.task.queuePosition">队列第 {{ props.task.queuePosition }} 位</span>
    </div>
    <n-progress
      :percentage="props.task.progress"
      :status="props.task.status === 'failed' ? 'error' : props.task.status === 'completed' ? 'success' : 'default'"
    />
    <p v-if="props.task.error" class="status-error">{{ props.task.error }}</p>
    <p v-for="warning in props.task.warnings.slice(-3)" :key="warning" class="status-hint">{{ warning }}</p>
    <n-button v-if="isRunning" block size="small" secondary type="error" @click="emit('cancel')">
      <template #icon><Trash2 :size="15" /></template>取消任务
    </n-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NButton, NProgress } from "naive-ui";
import { Trash2 } from "lucide-vue-next";
import type { ImageAiTask } from "@toolbox/shared";

const props = defineProps<{ task?: ImageAiTask }>();
const emit = defineEmits<{ cancel: [] }>();
const isRunning = computed(() => props.task?.status === "pending" || props.task?.status === "running");

function statusName(status: ImageAiTask["status"]) {
  return { pending: "等待处理", running: "AI 处理中", completed: "处理完成", failed: "处理失败", canceled: "已取消" }[
    status
  ];
}
</script>
