<!-- 本地处理记录：仅查询已保存的任务，不启动模型或重复处理图片。 -->
<template>
  <section class="image-history" aria-label="AI 图片处理记录">
    <div class="history-toolbar">
      <div class="history-heading">
        <div>
          <h3>处理记录</h3>
          <p>成功及部分成功的结果、原图与处理参数长期保存在本机，手动删除前不会自动过期。</p>
          <p>失败且没有结果的临时任务按原保留期清理；此前已被清理的图片无法恢复。</p>
        </div>
        <n-button secondary type="primary" :loading="loading" :disabled="deletionBusy" @click="loadHistory"
          ><template #icon><RefreshCw :size="16" /></template>刷新记录</n-button
        >
      </div>
      <div class="history-filters">
        <n-input
          v-model:value="keyword"
          clearable
          maxlength="100"
          placeholder="搜索原文件名或任务编号"
          aria-label="搜索处理记录"
          :disabled="deletionBusy"
          @keyup.enter="applyFilters"
        />
        <n-select
          v-model:value="operation"
          :options="operationOptions"
          clearable
          placeholder="全部处理类型"
          aria-label="处理类型"
          :disabled="deletionBusy"
        />
        <n-select
          v-model:value="status"
          :options="statusOptions"
          clearable
          placeholder="全部状态"
          aria-label="任务状态"
          :disabled="deletionBusy"
        />
        <n-button type="primary" :disabled="deletionBusy" @click="applyFilters">搜索</n-button>
      </div>
      <div class="history-selection">
        <n-checkbox
          :checked="allSelected"
          :indeterminate="partlySelected"
          :disabled="!selectableIds.length || loading || deletionBusy"
          aria-label="选择本页可删除记录"
          @update:checked="selectPage"
          >全选当前页</n-checkbox
        >
        <span>已选 {{ selectedIds.length }} 条；排队和处理中的任务不可选</span>
        <n-button
          size="small"
          secondary
          type="error"
          :disabled="!selectedIds.length || loading || deletionBusy"
          :loading="batchDeleting"
          @click="removeSelected"
        >
          <template #icon><Trash2 :size="14" /></template
          >{{ batchDeleting ? `删除中 ${batchProcessed}/${batchTotal}` : "删除所选" }}
        </n-button>
        <n-button v-if="selectedIds.length" size="small" text :disabled="deletionBusy" @click="selectedIds = []"
          >取消选择</n-button
        >
      </div>
    </div>
    <n-alert v-if="batchError" type="warning" :bordered="false">{{ batchError }}</n-alert>
    <n-alert v-if="listError" type="error" :bordered="false">{{ listError }}</n-alert>
    <n-spin :show="loading">
      <n-empty v-if="!loading && !listError && !items.length" description="暂无处理记录；完成图片处理后会自动留档。" />
      <div v-else class="history-list" role="list">
        <article
          v-for="task in items"
          :key="task.id"
          class="history-item"
          :class="{ 'is-selected': selectedIds.includes(task.id) }"
          role="listitem"
        >
          <n-checkbox
            :checked="selectedIds.includes(task.id)"
            :disabled="isActive(task) || loading || deletionBusy"
            :aria-label="`选择处理记录 ${task.id}`"
            @update:checked="selectTask(task.id, $event)"
          />
          <div class="history-thumb checkerboard">
            <img
              v-if="task.results[0]"
              :src="
                absoluteImageAiUrl(
                  `/api/v1/tools/image-ai/tasks/${encodeURIComponent(task.id)}/files/${encodeURIComponent(task.results[0].id)}/thumbnail`
                )
              "
              :alt="task.results[0].outputName"
              loading="lazy"
            />
            <ImageIcon v-else :size="26" aria-hidden="true" />
          </div>
          <div class="history-summary">
            <div class="history-title">
              <strong>{{ operationName(task.operation) }}</strong
              ><n-tag
                size="small"
                :type="task.status === 'completed' ? 'success' : task.status === 'failed' ? 'error' : 'default'"
                :bordered="false"
                >{{ statusName(task.status) }}</n-tag
              >
            </div>
            <p class="history-filename" :title="taskFileNames(task)">
              {{ taskFileNames(task) || `任务 ${task.id}` }}
            </p>
            <p>
              {{ dateLabel(task.createdAt) }} · {{ task.results.length }} 张结果<span v-if="task.scale">
                · {{ task.scale }}× 增强</span
              >
              · {{ task.expiresAt === null ? "长期留档" : "临时任务" }}
            </p>
          </div>
          <div class="history-actions">
            <n-button size="small" secondary type="primary" @click="viewTask(task.id)">查看详情</n-button>
            <n-button
              size="small"
              quaternary
              type="primary"
              :disabled="!task.results.length"
              @click="downloadTask(task)"
              ><template #icon><Download :size="14" /></template
              >{{ task.results.length > 1 ? "下载 ZIP" : "下载结果" }}</n-button
            >
            <n-button
              size="small"
              quaternary
              type="error"
              :disabled="isActive(task) || deletionBusy"
              :loading="deletingId === task.id"
              @click="removeTask(task)"
              ><template #icon><Trash2 :size="14" /></template>删除</n-button
            >
          </div>
        </article>
      </div>
    </n-spin>
    <div class="history-pagination">
      <span>共 {{ total }} 条</span
      ><n-pagination
        :page="page"
        :page-size="pageSize"
        :item-count="total"
        :disabled="deletionBusy"
        @update:page="changePage"
      />
    </div>
    <n-drawer v-model:show="detailOpen" width="min(1100px, 96vw)" placement="right">
      <n-drawer-content title="图片处理记录详情" closable>
        <n-spin :show="loadingDetail">
          <n-alert v-if="detailError" type="error" :bordered="false">{{ detailError }}</n-alert>
          <template v-else-if="selectedTask">
            <div class="history-detail-summary">
              <h3>{{ operationName(selectedTask.operation) }}</h3>
              <p>{{ dateLabel(selectedTask.createdAt) }} · 任务 {{ selectedTask.id }}</p>
              <p v-if="selectedTask.scale">处理参数：{{ selectedTask.scale }}× 清晰度增强</p>
              <p v-if="selectedTask.recipe">
                商品图规格：{{ selectedTask.recipe.canvas.width }} × {{ selectedTask.recipe.canvas.height }} · 背景：{{
                  { transparent: "透明", color: selectedTask.recipe.background.color, image: "自定义图片" }[
                    selectedTask.recipe.background.kind
                  ]
                }}
                · 商品占比 {{ Math.round(selectedTask.recipe.layout.fill * 100) }}%
              </p>
              <p v-if="selectedTask.source">
                来源任务：{{ selectedTask.source.taskId }}（独立快照，删除来源不影响此版本）
              </p>
              <p v-for="(input, index) in selectedTask.inputs || []" :key="index">
                原图 {{ index + 1 }}：{{ input.originalName }} · {{ input.width }} × {{ input.height }}
              </p>
              <p v-if="selectedTask.expiresAt === null">
                已长期留档，删除记录时会一起移除本机保存的原图、蒙版和处理结果。
              </p>
            </div>
            <ImageAiTaskStatusCard :task="selectedTask" read-only />
            <ImageAiResultGallery
              v-if="selectedTask.results.length"
              :task="selectedTask"
              :source-files="emptyFiles"
              :checkerboard="selectedTask.operation === 'background_remove'"
              persisted-sources
              @edit="editResult"
            />
            <n-empty v-else description="该任务没有可预览或下载的处理结果。" />
          </template>
        </n-spin>
      </n-drawer-content>
    </n-drawer>
  </section>
</template>

<script setup lang="ts">
import {
  NAlert,
  NButton,
  NCheckbox,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NInput,
  NPagination,
  NSelect,
  NSpin,
  NTag
} from "naive-ui";
import { Download, Image as ImageIcon, RefreshCw, Trash2 } from "lucide-vue-next";

import type { ImageAiTask } from "@toolbox/shared";
import { absoluteImageAiUrl, resultDownloadUrl, triggerImageAiDownload } from "../media-links";
import ImageAiResultGallery from "../processing/ImageAiResultGallery.vue";
import ImageAiTaskStatusCard from "../processing/ImageAiTaskStatusCard.vue";
import {
  operationOptions,
  statusOptions,
  isActive,
  taskFileNames,
  operationName,
  statusName,
  dateLabel
} from "./presentation";
import { useImageAiHistory } from "./useImageAiHistory";
import { useImageAiHistoryDetail } from "./useImageAiHistoryDetail";
const props = defineProps<{ refreshVersion: number }>();
const emit = defineEmits<{ deleted: [id: string]; edit: [taskId: string, resultId: string] }>();
const { detailOpen, loadingDetail, detailError, selectedTask, viewTask, closeRemoved } = useImageAiHistoryDetail();
const {
  items,
  total,
  page,
  pageSize,
  keyword,
  operation,
  status,
  loading,
  listError,
  deletingId,
  selectedIds,
  batchDeleting,
  batchProcessed,
  batchTotal,
  batchError,
  deletionBusy,
  selectableIds,
  allSelected,
  partlySelected,
  loadHistory,
  applyFilters,
  changePage,
  removeTask,
  selectTask,
  selectPage,
  removeSelected
} = useImageAiHistory(props, (id) => emit("deleted", id), closeRemoved);
const emptyFiles: File[] = [];
function editResult(taskId: string, resultId: string) {
  detailOpen.value = false;
  emit("edit", taskId, resultId);
}

function downloadTask(task: ImageAiTask) {
  if (task.results.length > 1)
    triggerImageAiDownload(`/api/v1/tools/image-ai/tasks/${encodeURIComponent(task.id)}/download.zip`);
  else if (task.results[0]) triggerImageAiDownload(resultDownloadUrl(task.results[0].downloadUrl));
}
</script>

<style scoped>
.image-history {
  display: grid;
  gap: 18px;
}
.history-toolbar {
  display: grid;
  gap: 20px;
  padding: 24px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  box-shadow: var(--shadow-card);
}
.history-heading,
.history-title,
.history-actions,
.history-pagination {
  display: flex;
  align-items: center;
  gap: 10px;
}
.history-selection {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  color: var(--color-text-secondary);
  font-size: 13px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}
.history-selection > .n-button {
  margin-left: auto;
}
.history-selection > .n-button + .n-button {
  margin-left: 0;
}
.history-heading,
.history-pagination {
  justify-content: space-between;
  flex-wrap: wrap;
}
.history-heading h3,
.history-detail-summary h3 {
  margin: 0 0 6px;
  color: var(--color-text);
  font-size: 18px;
  font-weight: 700;
}
.history-heading > .n-button {
  flex-shrink: 0;
}
.history-heading p,
.history-summary p,
.history-detail-summary p {
  margin: 4px 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.7;
}
.history-filters {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 150px 140px auto;
  gap: 12px;
}
.history-list {
  display: grid;
  gap: 12px;
}
.history-item {
  display: grid;
  grid-template-columns: 20px 76px minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.history-item:hover {
  border-color: var(--color-primary-200);
}
.history-item.is-selected {
  border-color: var(--color-primary-500);
  background: var(--color-primary-50);
  box-shadow: 0 0 0 1px var(--color-primary-200);
}
.history-thumb {
  height: 76px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  background-color: var(--color-surface-subtle);
  color: var(--color-primary-500);
}
.history-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.history-summary {
  min-width: 0;
}
.history-title {
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
}
.history-title > strong {
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--color-primary-50);
  color: var(--color-primary-700);
  font-size: 12px;
  font-weight: 600;
}
.history-title :deep(.n-tag) {
  border-radius: 6px;
}
.history-filename {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-summary .history-filename {
  color: var(--color-text);
  font-size: 14px;
  font-weight: 600;
}
.history-summary > p:last-child {
  color: var(--color-text-tertiary);
  font-size: 12px;
}
.history-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.history-actions :deep(.n-button) {
  height: 34px;
  border-radius: 8px;
}
.history-actions :deep(.n-button--quaternary-type) {
  background: transparent;
  box-shadow: none;
}
.history-detail-summary {
  margin-bottom: 18px;
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface-subtle);
  overflow-wrap: anywhere;
}
.history-pagination {
  padding: 16px 20px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 13px;
}
.image-history :deep(.n-empty) {
  padding: 48px 20px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 14px;
}
@container tool-content (max-width: 1000px) {
  .history-item {
    grid-template-columns: 20px 76px minmax(0, 1fr);
  }
  .history-actions {
    grid-column: 3;
    justify-content: flex-start;
  }
}
@container tool-content (max-width: 640px) {
  .history-toolbar {
    padding: 16px;
    gap: 16px;
  }
  .history-item {
    grid-template-columns: 18px 60px minmax(0, 1fr);
    padding: 14px;
    gap: 12px;
  }
  .history-thumb {
    height: 60px;
  }
  .history-actions {
    grid-column: 2 / -1;
  }
  .history-selection > span {
    flex-basis: 100%;
    order: 1;
    font-size: 12px;
  }
  .history-filters {
    grid-template-columns: 1fr;
  }
  .history-pagination {
    justify-content: center;
  }
}
</style>
