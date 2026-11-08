<template>
  <section class="workspace-panel history-panel">
    <div class="history-header">
      <div>
        <h2>处理记录</h2>
        <p>共 {{ total }} 条，成功后原视频、成品及编辑信息长期留档，手动删除</p>
      </div>
      <n-button :loading="loading" @click="$emit('refresh')">刷新</n-button>
    </div>

    <div v-if="!items.length" class="history-empty">暂无处理记录</div>
    <div v-else class="history-table">
    <div class="history-table-heading" aria-hidden="true"><span>文件名</span><span>修复档位</span><span>处理时间</span><span>状态</span><span>操作</span></div>
    <ul class="history-list">
      <li v-for="item in items" :key="item.id" :class="{ selected: selectedId === item.id }">
        <VideoHistoryThumbnail
          :src="item.status === 'completed' && item.output ? `${outputUrl(item.id)}?preview=1` : undefined"
          :name="item.inputName"
          @view="$emit('view', item.id)"
        />
        <div class="video-history-main">
          <div class="history-title-row">
            <strong class="history-name" :title="item.inputName">{{ item.inputName }}</strong>
          </div>
          <p class="video-history-meta">
            <span v-if="item.output">{{ item.output.width }}×{{ item.output.height }}</span>
            <span v-if="item.status === 'completed'">{{ item.inputRetained ? "原片与成品留档" : "成品留档" }}</span>
            <span v-if="item.manualRanges?.length">{{ item.manualRanges.length }} 个区间</span>
          </p>
          <p v-if="item.status === 'failed'" class="history-failure">
            原始上传副本已清理；如需重试，请重新选择原视频。
          </p>
          <p v-else-if="item.status === 'completed' && !item.inputRetained" class="history-failure">
            旧记录未留存原视频，可继续编辑成品
          </p>
        </div>
        <span class="history-mode">{{ modeLabel(item.mode) }}</span>
        <time class="history-time" :datetime="item.createdAt">{{ new Date(item.createdAt).toLocaleString() }}</time>
        <span class="status-pill" :class="item.status">{{ statusLabel(item.status) }}</span>
        <div class="video-history-actions">
          <n-button size="small" @click="$emit('view', item.id)">查看</n-button>
          <n-button
            v-if="item.status === 'completed' && item.output"
            size="small"
            type="primary"
            secondary
            :disabled="editingDisabled || !item.inputRetained"
            @click="$emit('edit', item.id, 'original')"
            >原片再编辑</n-button
          >
          <n-button
            v-if="item.status === 'completed' && item.output"
            size="small"
            :disabled="editingDisabled"
            @click="$emit('edit', item.id, 'output')"
            >结果再编辑</n-button
          >
          <n-button v-if="item.output" size="small" tag="a" :href="outputUrl(item.id)" target="_blank" rel="noopener"
            >下载</n-button
          >
          <n-button
            size="small"
            type="error"
            quaternary
            :disabled="item.status === 'pending' || item.status === 'running' || editingId === item.id"
            @click="$emit('remove', item.id)"
          >
            删除
          </n-button>
        </div>
      </li>
    </ul>
    </div>

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
import VideoHistoryThumbnail from "./VideoHistoryThumbnail.vue";

defineProps<{
  items: VideoAiTask[];
  total: number;
  page: number;
  selectedId?: string;
  loading?: boolean;
  outputUrl: (id: string) => string;
  editingDisabled?: boolean;
  editingId?: string;
}>();

defineEmits<{
  refresh: [];
  view: [id: string];
  edit: [id: string, source: "original" | "output"];
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
.video-history-actions {
  display: flex;
  align-items: center;
}
.history-header {
  justify-content: space-between;
  gap: var(--space-3);
}
.history-header h2,
.history-header p,
.video-history-main p {
  margin: 0;
}
.history-header h2 {
  font-size: 18px;
}
.history-header p,
.video-history-main p {
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
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-subtle);
  text-align: left;
}
.history-list li.selected {
  border-color: var(--color-primary-200);
  background: var(--color-primary-50);
}
.video-history-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  align-items: stretch;
}
.history-title-row {
  gap: var(--space-2);
}
.history-name {
  min-width: 0;
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
.video-history-actions {
  gap: var(--space-2);
  flex-wrap: wrap;
  justify-content: flex-end;
}
.video-history-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
}
.video-history-meta time {
  white-space: nowrap;
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
@media (max-width: 900px) {
  .history-list li {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .video-history-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }
}

.history-panel { padding: 20px; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); box-shadow: var(--shadow-card); }
.history-header h2 { color: var(--color-text); }
.history-header p { margin-top: 5px; line-height: 1.6; color: var(--color-text-tertiary); }
.history-table { min-width: 0; }
.history-table-heading, .history-list li { display: grid; grid-template-columns: 88px minmax(130px, 1fr) 70px 145px 65px minmax(290px, auto); gap: 12px; align-items: center; }
.history-table-heading { padding: 10px 12px; border-radius: 7px; background: var(--color-primary-50); color: var(--color-text-secondary); font-size: 12px; }
.history-table-heading > span:first-child { grid-column: span 2; }
.history-list { gap: 0; }
.history-list li { padding: 12px; border: 0; border-bottom: 1px solid var(--color-border); border-radius: 0; background: transparent; }
.history-list li.selected { background: var(--color-surface-subtle); box-shadow: inset 3px 0 var(--color-primary-500); }
.history-list li > :deep(.video-history-thumbnail) { width: 88px; height: 52px; border-radius: 6px; }
.history-name { color: var(--color-text); font-size: 13px; }
.video-history-meta { gap: 4px 8px; }
.history-mode, .history-time { font-size: 12px; color: var(--color-text-secondary); }
.status-pill { justify-self: start; font-size: 11px; }
.video-history-actions { flex-wrap: wrap; gap: 6px; grid-column: auto; }
.video-history-actions :deep(.n-button) { padding-inline: 8px; height: 28px; font-size: 12px; border-radius: 6px; }
.video-history-actions :deep(.n-button:not(.n-button--error-type)) { color: var(--color-primary-600); background: var(--color-surface-subtle); }
@media (max-width: 1200px) {
  .history-table-heading { display: none; }
  .history-list li { grid-template-columns: 88px minmax(0, 1fr) auto; gap: 10px; }
  .history-mode { grid-column: 2; }
  .history-time { grid-column: 2; }
  .status-pill { grid-column: 3; grid-row: 1; }
  .video-history-actions { grid-column: 2 / -1; justify-content: flex-start; }
}
@media (max-width: 600px) { .history-panel { padding: 16px; } .video-history-actions { grid-column: 1 / -1; } }
</style>
