<template>
  <n-button size="small" secondary title="通过 Excel / CSV 批量获取作品，每批最多 100 条" @click="model.show"
    ><template #icon><FileSpreadsheet :size="16" /></template>表格批量归档</n-button
  >
  <n-modal
    v-model:show="open"
    preset="card"
    title="表格批量归档"
    class="archive-import-dialog"
    style="width: min(1320px, calc(100vw - 32px)); max-height: 90vh; overflow-y: auto"
  >
    <n-alert type="info" :bordered="false"
      >支持 .xlsx / .csv，最大 2 MiB、每批 100 条。Excel
      读取第一张可见工作表；必填列“作品链接”，可选列“平台”。后台逐条获取，关闭此窗口仍会继续；重启后需手动重试中断项。</n-alert
    >
    <div class="archive-import-toolbar">
      <input
        ref="fileInput"
        class="archive-import-file"
        type="file"
        accept=".xlsx,.csv"
        aria-label="选择批量归档表格"
        @change="chooseFile"
      />
      <n-button :disabled="busy" :loading="busy && !batch" @click="fileInput?.click()">选择 Excel / CSV</n-button>
      <n-button tag="a" :href="excelTemplateUrl" download="多媒体批量归档空白模板.xlsx">下载 Excel 模板</n-button>
      <n-button tag="a" :href="archiveImportTemplateUrl()">下载 CSV 模板</n-button>
      <n-button :disabled="busy" @click="model.refresh">刷新批次列表</n-button>
    </div>
    <details v-if="history.length" class="archive-import-history" open>
      <summary>批次列表（{{ history.length }}）<span>点击批次查看结果，可收起列表</span></summary>
      <n-input
        v-model:value="historySearch"
        clearable
        placeholder="搜索批次名称、时间或状态"
        aria-label="搜索归档批次"
      />
      <div class="archive-import-history-list" role="group" aria-label="归档批次列表">
        <button
          v-for="entry in filteredHistory"
          :key="entry.id"
          type="button"
          :aria-pressed="selectedId === entry.id"
          :disabled="busy || loading"
          @click="model.select(entry.id)"
        >
          <strong>{{ entry.sourceName }}</strong>
          <span class="archive-import-history-meta">
            <time :datetime="entry.createdAt">{{ formatArchiveDate(entry.createdAt) }}</time>
            <n-tag size="small" :bordered="false" :type="batchTagType(entry.status)">{{
              importBatchLabels[entry.status]
            }}</n-tag>
            <span>{{ entry.ownerProfileId ? "主页归档" : "表格导入" }} · {{ entry.id.slice(0, 6) }}</span>
          </span>
        </button>
        <n-empty v-if="!filteredHistory.length" description="没有匹配的批次" />
      </div>
    </details>
    <div v-if="preview" class="archive-import-options">
      <strong>{{ preview.sourceName }}{{ preview.sheetName ? ` · ${preview.sheetName}` : "" }}</strong>
      <label>已归档作品</label>
      <n-select
        v-model:value="existing"
        :options="existingOptions"
        :disabled="busy"
        aria-label="已归档作品处理方式"
        style="width: 230px"
      />
      <label>成功结果分组</label>
      <n-select
        v-model:value="groupId"
        :disabled="busy"
        clearable
        :options="groupOptions"
        placeholder="不改变原分组（新作品为未分组）"
        aria-label="导入目标分组"
        style="width: 300px; max-width: 100%"
      />
      <small>仅本批次获取或刷新成功的作品移入目标组；已跳过的作品保持原分组。</small>
      <span>可执行 {{ counts.eligible }} 条；无效和表内重复行将跳过</span>
      <n-button type="primary" :loading="busy" :disabled="!counts.eligible || busy" @click="model.start"
        >确认并开始归档</n-button
      >
    </div>
    <div v-if="batch" class="archive-import-options">
      <strong class="archive-import-current-title"
        >{{ batch.sourceName }} · {{ importBatchLabels[batch.status] }}</strong
      >
      <div v-if="owner" class="archive-import-owner-note">
        <span
          >所属主页任务：TikTok @{{
            owner.username
          }}。可一次清理主页及其全部批次记录，已归档作品、媒体和分组保留。</span
        >
        <n-button size="small" :disabled="busy || loading" @click="openOwner">打开所属主页任务</n-button>
        <n-button
          v-if="ownerActive"
          size="small"
          :loading="busy"
          :disabled="busy || owner.phase === 'stopping'"
          @click="model.cancelOwner"
          >停止主页任务</n-button
        >
        <small v-if="ownerActive">{{
          owner.phase === "stopping"
            ? "正在等待当前作品安全结束，结束后即可清理记录。"
            : "主页任务仍在执行，停止后即可清理记录。"
        }}</small>
      </div>
      <span v-if="batch.groupId"
        >结果分组：{{
          groups?.find((group) => group.id === batch?.groupId)?.name || "目标分组已删除（后续结果保持原分组）"
        }}</span
      >
      <span role="status" class="archive-import-summary"
        >共 {{ counts.total }} 条 · 成功 {{ counts.success }} · 失败 {{ counts.failed }} · 跳过/取消
        {{ counts.skipped }} · 待完成 {{ counts.pending }}</span
      >
      <n-button v-if="importBatchActive(batch)" :disabled="busy || batch.status === 'stopping'" @click="model.cancel"
        >停止后续任务</n-button
      >
      <n-button
        v-if="!importBatchActive(batch) && counts.failed"
        :disabled="busy || loading"
        @click="owner ? openOwner() : model.retry()"
        >{{ owner ? "在主页任务中重试" : "重试失败项" }}</n-button
      >
      <n-button tag="a" :href="archiveImportResultUrl(batch.id)">导出结果 CSV</n-button>
      <n-button
        v-if="!importBatchActive(batch)"
        type="error"
        secondary
        :disabled="busy || loading || ownerActive"
        @click="removeHistory"
        >{{ owner ? "清理所属主页任务记录" : "删除批次记录" }}</n-button
      >
      <small v-if="batch.status === 'stopping'">当前正在处理的作品会按正常规则完成，后续项目不再执行。</small>
    </div>
    <n-spin :show="loading">
      <div v-if="rows.length" class="archive-import-table-wrap">
        <table class="archive-import-table">
          <colgroup>
            <col class="archive-import-col-number" />
            <col class="archive-import-col-url" />
            <col class="archive-import-col-platform" />
            <col class="archive-import-col-status" />
            <col class="archive-import-col-progress" />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th>原始行号</th>
              <th>作品链接</th>
              <th>平台</th>
              <th>状态</th>
              <th>进度</th>
              <th>结果 / 原因</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.rowNumber">
              <td>{{ row.rowNumber }}</td>
              <td>
                <span class="archive-import-url" :title="row.inputUrl">{{ row.inputUrl || "（缺少链接）" }}</span>
              </td>
              <td class="archive-import-nowrap">
                {{ row.platform ? archivePlatformLabel(row.platform) : row.inputPlatform || "自动识别" }}
              </td>
              <td
                class="archive-import-nowrap"
                :class="{ 'archive-import-error': row.status === 'failed' || row.status === 'invalid' }"
              >
                {{ importRowLabels[row.status] }}
              </td>
              <td class="archive-import-nowrap">{{ row.progress }}%</td>
              <td>
                <div class="archive-import-result">
                  <span>{{ row.message }}</span
                  ><n-button v-if="row.archiveId" text type="primary" size="tiny" @click="viewArchive(row.archiveId)"
                    >查看存档</n-button
                  >
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <n-empty v-else description="选择表格进行校验预览，或从历史批次继续查看" />
    </n-spin>
  </n-modal>
</template>
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NAlert, NButton, NEmpty, NInput, NModal, NSelect, NSpin, NTag, useMessage } from "naive-ui";
import { FileSpreadsheet } from "lucide-vue-next";
import {
  ARCHIVE_IMPORT_ROW_LABELS as importRowLabels,
  type ArchiveGroup,
  type ArchiveImportSummary
} from "@toolbox/shared/archive";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import { formatApiError } from "../../shared/http/http";
import { archiveImportTemplateUrl, archiveImportResultUrl } from "./content-api";
import { archivePlatformLabel } from "./presentation";
import { formatArchiveDate } from "./format-date";
import { useArchiveBatchImport, importBatchLabels, importBatchActive } from "./useArchiveBatchImport";
import excelTemplateUrl from "./assets/archive-import-template.xlsx?url";
const props = defineProps<{ groups?: ArchiveGroup[] }>();
const emit = defineEmits<{ changed: []; openArchive: [id: string]; openProfile: [id: string] }>();
const message = useMessage(),
  confirm = useConfirmDialog();
const model = useArchiveBatchImport(
  (error) => message.error(formatApiError(error, "批量归档操作失败")),
  () => emit("changed")
);
const {
  open,
  busy,
  loading,
  preview,
  batch,
  history,
  selectedId,
  existing,
  groupId,
  rows,
  counts,
  owner,
  ownerActive
} = model;
const groupOptions = computed(() => (props.groups ?? []).map((group) => ({ label: group.name, value: group.id })));
watch(
  () => props.groups,
  (groups) => {
    if (groups && groupId.value && !groups.some((group) => group.id === groupId.value)) groupId.value = null;
  }
);
const fileInput = ref<HTMLInputElement>();
const existingOptions = [
  { label: "跳过已归档作品（默认）", value: "skip" },
  { label: "重新获取并刷新已有归档", value: "refresh" }
];
const historySearch = ref("");
const filteredHistory = computed(() => {
  const keyword = historySearch.value.trim().toLocaleLowerCase();
  return [...history.value]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((entry) =>
      `${entry.sourceName} ${entry.id} ${formatArchiveDate(entry.createdAt)} ${importBatchLabels[entry.status]}`
        .toLocaleLowerCase()
        .includes(keyword)
    );
});
function batchTagType(status: ArchiveImportSummary["status"]) {
  return status === "running" || status === "stopping" ? "info" : status === "completed" ? "success" : "warning";
}
async function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) await model.upload(file);
  input.value = "";
}
async function removeHistory() {
  const selected = batch.value;
  const profile = owner.value;
  if (!selected || busy.value || loading.value || ownerActive.value) return;
  if (
    await confirm(
      profile
        ? `将清理 TikTok @${profile.username} 的主页任务及其全部批次记录。已归档作品及媒体不会删除，分组也会保留。`
        : "只删除本次批次记录，已归档作品及媒体不会删除。",
      { title: profile ? "清理主页及批次记录" : "删除批次记录", positiveText: profile ? "确认清理记录" : "删除记录" }
    )
  )
    if (open.value && batch.value?.id === selected.id && owner.value?.id === profile?.id) await model.remove();
}
function openOwner() {
  if (!owner.value) return;
  open.value = false;
  emit("openProfile", owner.value.id);
}
function viewArchive(id: string) {
  open.value = false;
  emit("openArchive", id);
}
</script>
<style scoped>
.archive-import-toolbar,
.archive-import-options {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.archive-import-toolbar,
.archive-import-options {
  margin: 16px 0;
}
.archive-import-file {
  display: none;
}
.archive-import-history {
  margin: 16px 0;
  padding: 14px;
  border: 1px solid #e1e7ef;
  border-radius: 10px;
  background: #f8fafc;
}
.archive-import-history summary {
  cursor: pointer;
  font-weight: 600;
}
.archive-import-history summary span {
  margin-left: 12px;
  color: #60708a;
  font-size: 12px;
  font-weight: 400;
}
.archive-import-history :deep(.n-input) {
  margin-top: 12px;
}
.archive-import-history-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  max-height: 210px;
  margin-top: 10px;
  overflow-y: auto;
}
.archive-import-history-list button {
  min-width: 0;
  padding: 12px;
  border: 1px solid #e1e7ef;
  border-radius: 8px;
  background: #fff;
  text-align: left;
  cursor: pointer;
}
.archive-import-history-list button[aria-pressed="true"] {
  border-color: #2563eb;
  background: #eff6ff;
}
.archive-import-history-list button:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: -2px;
}
.archive-import-history-list button:disabled {
  cursor: wait;
}
.archive-import-history-list strong {
  display: block;
  overflow-wrap: anywhere;
  color: #1e293b;
}
.archive-import-history-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin-top: 6px;
  color: #60708a;
  font-size: 12px;
}
.archive-import-current-title,
.archive-import-summary {
  width: 100%;
}
.archive-import-owner-note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  background: #f1f5f9;
  color: #526174;
}
.archive-import-owner-note > span {
  width: 100%;
  overflow-wrap: anywhere;
}
.archive-import-table-wrap {
  overflow: auto;
  max-height: 52vh;
  border: 1px solid #e6ebf2;
  border-radius: 8px;
}
.archive-import-table {
  width: 100%;
  min-width: 960px;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 13px;
  text-align: left;
}
.archive-import-table th,
.archive-import-table td {
  padding: 10px;
  vertical-align: top;
  border-bottom: 1px solid #e6ebf2;
}
.archive-import-table th {
  position: sticky;
  top: 0;
  background: #f5f7fb;
  z-index: 1;
  white-space: nowrap;
}
.archive-import-url {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.archive-import-error {
  color: #b91c1c;
}
.archive-import-options small {
  width: 100%;
  color: #60708a;
}
.archive-import-col-number {
  width: 84px;
}
.archive-import-col-url {
  width: 32%;
}
.archive-import-col-platform {
  width: 90px;
}
.archive-import-col-status {
  width: 96px;
}
.archive-import-col-progress {
  width: 72px;
}
.archive-import-nowrap {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.archive-import-result {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
  overflow-wrap: anywhere;
}
@media (max-width: 680px) {
  .archive-import-history-list {
    grid-template-columns: minmax(0, 1fr);
  }
  .archive-import-history summary span {
    display: block;
    margin: 6px 0 0;
  }
}
</style>
