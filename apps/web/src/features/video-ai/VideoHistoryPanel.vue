<template>
  <section class="workspace-panel history-panel">
    <div class="history-header">
      <div>
        <h2>处理记录</h2>
        <p>共 {{ total }} 条，成功结果长期保留</p>
      </div>
      <n-button :loading="loading" @click="$emit('refresh')">刷新</n-button>
    </div>

    <div v-if="!items.length" class="history-empty">暂无处理记录</div>
    <ul v-else class="history-list">
      <li v-for="item in items" :key="item.id" :class="{ selected: selectedId === item.id }">
        <div class="history-main">
          <div class="history-title-row">
            <strong class="history-name" :title="item.inputName">{{ item.inputName }}</strong>
            <span class="status-pill" :class="item.status">{{ statusLabel(item.status) }}</span>
          </div>
          <p>
            {{ modeLabel(item.mode) }} · {{ new Date(item.createdAt).toLocaleString() }}
            <template v-if="item.output"> · {{ item.output.width }}×{{ item.output.height }}</template>
          </p>
          <p v-if="item.status === 'failed'" class="history-failure">
            原始上传副本已清理；如需重试，请重新选择原视频。
          </p>
        </div>
        <div class="history-actions">
          <n-button text @click="$emit('view', item.id)">查看</n-button>
          <n-button v-if="item.output" text tag="a" :href="outputUrl(item.id)" target="_blank" rel="noopener"
            >下载</n-button
          >
          <n-button
            text
            :disabled="item.status === 'pending' || item.status === 'running'"
            @click="$emit('remove', item.id)"
          >
            删除
          </n-button>
        </div>
      </li>
    </ul>

    <n-pagination
      v-if="total"
      :page="page"
      class="pagination-with-total"
      :page-size="20"
      :item-count="total"
      @update:page="$emit('update:page', $event)"
    >
      <template #prefix>共 {{ total }} 条</template>
    </n-pagination>
  </section>
</template>

<script setup lang="ts">
import { NButton, NPagination } from "naive-ui";
import type { VideoAiMode, VideoAiTask } from "@toolbox/shared";

defineProps<{
  items: VideoAiTask[];
  total: number;
  page: number;
  selectedId?: string;
  loading?: boolean;
  outputUrl: (id: string) => string;
}>();

defineEmits<{
  refresh: [];
  view: [id: string];
  remove: [id: string];
  "update:page": [page: number];
}>();

function statusLabel(status: VideoAiTask["status"]) {
  return { pending: "排队中", running: "处理中", completed: "已完成", failed: "失败", canceled: "已取消" }[status];
}
function modeLabel(mode: VideoAiMode) {
  return { delogo: "极速", fast: "快速", balanced: "均衡", extreme: "极致" }[mode];
}
</script>

<style scoped>
.history-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.history-header,
.history-title-row,
.history-actions {
  display: flex;
  align-items: center;
}
.history-header {
  justify-content: space-between;
  gap: var(--space-3);
}
.history-header h2,
.history-header p,
.history-main p {
  margin: 0;
}
.history-header h2 {
  font-size: 18px;
}
.history-header p,
.history-main p {
  color: var(--color-text-secondary);
  font-size: 12px;
}
.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.history-list li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-subtle);
}
.history-list li.selected {
  border-color: var(--color-primary-200);
  background: var(--color-primary-50);
}
.history-main {
  min-width: 0;
}
.history-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.history-title-row {
  gap: var(--space-2);
}
.history-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status-pill {
  flex: 0 0 auto;
  padding: 2px 7px;
  border-radius: 999px;
  color: var(--color-text-secondary);
  background: var(--color-surface);
  font-size: 11px;
}
.status-pill.completed {
  color: var(--color-success);
  background: color-mix(in srgb, var(--color-success) 10%, var(--color-surface));
}
.status-pill.failed {
  color: var(--color-error);
  background: color-mix(in srgb, var(--color-error) 9%, var(--color-surface));
}
.status-pill.running,
.status-pill.pending {
  color: var(--color-primary-700);
  background: var(--color-primary-100);
}
.history-actions {
  gap: var(--space-2);
}
.history-failure {
  color: var(--color-warning) !important;
}
.history-empty {
  display: grid;
  min-height: 120px;
  place-items: center;
  color: var(--color-text-tertiary);
}
@media (max-width: 700px) {
  .history-list li {
    grid-template-columns: 1fr;
  }
  .history-actions {
    justify-content: flex-end;
  }
}
</style>
