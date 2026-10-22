<!-- 本地处理记录：仅查询已保存的任务，不启动模型或重复处理图片。 -->
<template>
  <section class="image-history" aria-label="AI 图片处理记录">
    <div class="history-heading">
      <div>
        <h3>处理记录</h3>
        <p>成功及部分成功的结果、原图与处理参数长期保存在本机，手动删除前不会自动过期。</p>
        <p>失败且没有结果的临时任务按原保留期清理；此前已被清理的图片无法恢复。</p>
      </div>
      <n-button secondary :loading="loading" :disabled="deletionBusy" @click="loadHistory"
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
      <n-button secondary :disabled="deletionBusy" @click="applyFilters">搜索</n-button>
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
            <n-button size="small" secondary @click="viewTask(task.id)">查看详情</n-button>
            <n-button size="small" secondary :disabled="!task.results.length" @click="downloadTask(task)"
              ><template #icon><Download :size="14" /></template
              >{{ task.results.length > 1 ? "下载 ZIP" : "下载结果" }}</n-button
            >
            <n-button
              size="small"
              secondary
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
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
  NTag,
  useMessage
} from "naive-ui";
import { Download, Image as ImageIcon, RefreshCw, Trash2 } from "lucide-vue-next";
import type { ImageAiOperation, ImageAiTask, ImageAiTaskStatus } from "@toolbox/shared";
import { useConfirmDialog } from "../../composables/useConfirmDialog";
import { formatApiError, isApiErrorCancelled } from "../../services/http";
import { absoluteImageAiUrl, imageAiApi, resultDownloadUrl, triggerImageAiDownload } from "./api";
import ImageAiResultGallery from "./ImageAiResultGallery.vue";
import ImageAiTaskStatusCard from "./ImageAiTaskStatusCard.vue";

const props = defineProps<{ refreshVersion: number }>();
const emit = defineEmits<{ deleted: [id: string]; edit: [taskId: string, resultId: string] }>();
function editResult(taskId: string, resultId: string) {
  detailOpen.value = false;
  emit("edit", taskId, resultId);
}
const message = useMessage();
const confirm = useConfirmDialog();
const items = ref<ImageAiTask[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const keyword = ref("");
const appliedKeyword = ref("");
const operation = ref<ImageAiOperation | null>(null);
const status = ref<ImageAiTaskStatus | null>(null);
const loading = ref(false);
const listError = ref("");
const deletingId = ref<string>();
const selectedIds = ref<string[]>([]);
const batchDeleting = ref(false);
const batchProcessed = ref(0);
const batchTotal = ref(0);
const batchError = ref("");
const deletionBusy = computed(() => batchDeleting.value || deletingId.value !== undefined);
const selectableIds = computed(() => items.value.filter((task) => !isActive(task)).map((task) => task.id));
const allSelected = computed(
  () => selectableIds.value.length > 0 && selectableIds.value.every((id) => selectedIds.value.includes(id))
);
const partlySelected = computed(() => selectedIds.value.length > 0 && !allSelected.value);
const detailOpen = ref(false);
const loadingDetail = ref(false);
const detailError = ref("");
const selectedTask = ref<ImageAiTask>();
const viewedTaskId = ref<string>();
const emptyFiles: File[] = [];
let controller: AbortController | undefined;
let detailGeneration = 0;
let disposed = false;
const operationOptions = [
  { label: "去水印", value: "watermark_remove" },
  { label: "变清晰", value: "enhance" },
  { label: "抠图", value: "background_remove" },
  { label: "商品图编辑", value: "product_image" }
];
const statusOptions = [
  { label: "已完成", value: "completed" },
  { label: "处理失败", value: "failed" },
  { label: "已取消", value: "canceled" },
  { label: "等待处理", value: "pending" },
  { label: "处理中", value: "running" }
];
onMounted(loadHistory);
watch(
  () => props.refreshVersion,
  () => {
    void loadHistory();
  }
);
watch([operation, status], applyFilters);
onBeforeUnmount(() => {
  disposed = true;
  controller?.abort();
  detailGeneration += 1;
});

async function loadHistory() {
  controller?.abort();
  const request = new AbortController();
  controller = request;
  loading.value = true;
  listError.value = "";
  try {
    const result = await imageAiApi.history(
      {
        page: page.value,
        pageSize,
        operation: operation.value ?? undefined,
        status: status.value ?? undefined,
        keyword: appliedKeyword.value || undefined
      },
      request.signal
    );
    if (disposed || request.signal.aborted) return;
    const lastPage = Math.max(1, Math.ceil(result.total / pageSize));
    if (page.value > lastPage) {
      page.value = lastPage;
      await loadHistory();
      return;
    }
    items.value = result.items;
    total.value = result.total;
    selectedIds.value = selectedIds.value.filter((id) => selectableIds.value.includes(id));
  } catch (error) {
    if (!disposed && !request.signal.aborted && !isApiErrorCancelled(error))
      listError.value = formatApiError(error, "读取处理记录失败");
  } finally {
    if (!disposed && controller === request) loading.value = false;
  }
}
function applyFilters() {
  if (deletionBusy.value) return;
  selectedIds.value = [];
  batchError.value = "";
  appliedKeyword.value = keyword.value.trim();
  page.value = 1;
  void loadHistory();
}
function changePage(value: number) {
  if (deletionBusy.value) return;
  selectedIds.value = [];
  batchError.value = "";
  page.value = value;
  void loadHistory();
}
async function viewTask(id: string) {
  const generation = ++detailGeneration;
  viewedTaskId.value = id;
  selectedTask.value = undefined;
  detailError.value = "";
  detailOpen.value = true;
  loadingDetail.value = true;
  try {
    const task = await imageAiApi.getTask(id);
    if (!disposed && generation === detailGeneration) selectedTask.value = task;
  } catch (error) {
    if (!disposed && generation === detailGeneration && !isApiErrorCancelled(error))
      detailError.value = formatApiError(error, "读取处理记录详情失败");
  } finally {
    if (!disposed && generation === detailGeneration) loadingDetail.value = false;
  }
}
function downloadTask(task: ImageAiTask) {
  if (task.results.length > 1)
    triggerImageAiDownload(`/api/v1/tools/image-ai/tasks/${encodeURIComponent(task.id)}/download.zip`);
  else if (task.results[0]) triggerImageAiDownload(resultDownloadUrl(task.results[0].downloadUrl));
}
async function removeTask(task: ImageAiTask) {
  if (isActive(task) || deletionBusy.value) return;
  batchError.value = "";
  deletingId.value = task.id;
  try {
    if (
      !(await confirm(
        "将删除这条处理记录及应用保存在本机的原图、蒙版和处理结果，无法撤销。不会删除您电脑中另外保存的原始文件。",
        { title: "删除图片处理记录", danger: true, positiveText: "确认删除" }
      ))
    )
      return;
    if (disposed) return;
    await imageAiApi.removeHistory(task.id);
    if (disposed) return;
    removedFromView(task.id);
    message.success("处理记录及本机文件已删除");
    await loadHistory();
  } catch (error) {
    if (!disposed && !isApiErrorCancelled(error)) message.error(formatApiError(error, "删除处理记录失败"));
  } finally {
    if (!disposed) deletingId.value = undefined;
  }
}
function selectTask(id: string, checked: boolean) {
  if (loading.value || deletionBusy.value || !selectableIds.value.includes(id)) return;
  selectedIds.value = checked
    ? [...new Set([...selectedIds.value, id])]
    : selectedIds.value.filter((value) => value !== id);
}
function selectPage(checked: boolean) {
  if (loading.value || deletionBusy.value) return;
  selectedIds.value = checked ? [...selectableIds.value] : [];
}
function removedFromView(id: string) {
  if (viewedTaskId.value === id) {
    detailOpen.value = false;
    selectedTask.value = undefined;
    detailGeneration += 1;
  }
  selectedIds.value = selectedIds.value.filter((value) => value !== id);
  items.value = items.value.filter((task) => task.id !== id);
  total.value = Math.max(0, total.value - 1);
  emit("deleted", id);
}
async function removeSelected() {
  if (loading.value || deletionBusy.value) return;
  const ids = selectedIds.value.filter((id) => selectableIds.value.includes(id));
  if (!ids.length) return;
  batchDeleting.value = true;
  batchProcessed.value = 0;
  batchTotal.value = ids.length;
  batchError.value = "";
  try {
    if (
      !(await confirm(
        `将删除所选 ${ids.length} 条处理记录，以及应用保存在本机的对应原图、蒙版和处理结果，无法撤销。不会删除其他记录或电脑中另外保存的原始文件。`,
        { title: "批量删除图片处理记录", danger: true, positiveText: `确认删除 ${ids.length} 条` }
      ))
    )
      return;
    const failures: string[] = [];
    let deleted = 0;
    // Use the same server-side guarded operation for each fixed confirmed ID.
    // Serial execution avoids concurrent recursive removals and reports real outcomes.
    for (const id of ids) {
      if (disposed) return;
      try {
        await imageAiApi.removeHistory(id);
        if (disposed) return;
        removedFromView(id);
        deleted += 1;
      } catch (error) {
        if (disposed) return;
        failures.push(`${id}：${formatApiError(error, "删除失败")}`);
      }
      batchProcessed.value += 1;
    }
    if (deleted) message.success(`已删除 ${deleted} 条处理记录及本机文件`);
    if (failures.length)
      batchError.value = `${failures.length} 条未能完成删除，请检查提示后重试。${failures.slice(0, 3).join("；")}${failures.length > 3 ? "；还有其他未删除项目，可刷新后检查" : ""}`;
    await loadHistory();
  } catch (error) {
    if (!disposed && !isApiErrorCancelled(error)) message.error(formatApiError(error, "批量删除处理记录失败"));
  } finally {
    if (!disposed) batchDeleting.value = false;
  }
}
function isActive(task: ImageAiTask) {
  return task.status === "pending" || task.status === "running";
}
function taskFileNames(task: ImageAiTask) {
  return (
    task.inputs?.map((input) => input.originalName).join("、") ||
    task.results.map((result) => result.originalName).join("、")
  );
}
function operationName(value: ImageAiOperation) {
  return operationOptions.find((option) => option.value === value)?.label ?? value;
}
function statusName(value: ImageAiTaskStatus) {
  return statusOptions.find((option) => option.value === value)?.label ?? value;
}
function dateLabel(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}
</script>

<style scoped>
.image-history {
  display: grid;
  gap: 18px;
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
}
.history-heading,
.history-pagination {
  justify-content: space-between;
  flex-wrap: wrap;
}
.history-heading h3,
.history-detail-summary h3 {
  margin: 0 0 6px;
}
.history-heading p,
.history-summary p,
.history-detail-summary p {
  margin: 4px 0;
  color: var(--color-text-secondary);
  font-size: 13px;
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
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
}
.history-item.is-selected {
  border-color: var(--color-primary-200);
  background: var(--color-primary-50);
}
.history-thumb {
  height: 68px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  overflow: hidden;
  background-color: #f1f5f9;
}
.history-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.history-summary {
  min-width: 0;
}
.history-filename {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}
.history-detail-summary {
  margin-bottom: 18px;
  overflow-wrap: anywhere;
}
.history-pagination {
  color: var(--color-text-secondary);
  font-size: 13px;
}
@media (max-width: 1000px) {
  .history-item {
    grid-template-columns: 20px 76px minmax(0, 1fr);
  }
  .history-actions {
    grid-column: 1 / -1;
  }
}
@media (max-width: 640px) {
  .history-filters {
    grid-template-columns: 1fr;
  }
  .history-pagination {
    justify-content: center;
  }
}
</style>
