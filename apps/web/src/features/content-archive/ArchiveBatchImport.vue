<template>
  <div class="archive-import-entry">
    <span>通过 Excel / CSV 批量获取作品，每批最多 100 条</span>
    <n-button secondary @click="model.show"
      ><template #icon><FileSpreadsheet :size="16" /></template>表格批量归档</n-button
    >
  </div>
  <n-modal
    v-model:show="open"
    preset="card"
    title="表格批量归档"
    class="archive-import-dialog"
    style="width: min(1100px, calc(100vw - 32px)); max-height: 90vh; overflow-y: auto"
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
      <n-select
        :value="selectedId"
        :options="historyOptions"
        :disabled="busy"
        placeholder="查看历史或正在执行的批次"
        aria-label="批量归档历史"
        class="archive-import-history"
        @update:value="model.select"
      />
      <n-button :disabled="busy" @click="model.refresh">刷新批次列表</n-button>
    </div>
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
      <strong>{{ batch.sourceName }} · {{ importBatchLabels[batch.status] }}</strong>
      <span v-if="batch.groupId"
        >结果分组：{{
          groups?.find((group) => group.id === batch?.groupId)?.name || "目标分组已删除（后续结果保持原分组）"
        }}</span
      >
      <span role="status"
        >共 {{ counts.total }} 条 · 成功 {{ counts.success }} · 失败 {{ counts.failed }} · 跳过/取消
        {{ counts.skipped }} · 待完成 {{ counts.pending }}</span
      >
      <n-button v-if="importBatchActive(batch)" :disabled="busy || batch.status === 'stopping'" @click="model.cancel"
        >停止后续任务</n-button
      >
      <n-button v-if="!importBatchActive(batch) && counts.failed" :disabled="busy" @click="model.retry"
        >重试失败项</n-button
      >
      <n-button tag="a" :href="archiveImportResultUrl(batch.id)">导出结果 CSV</n-button>
      <n-button v-if="!importBatchActive(batch)" type="error" secondary :disabled="busy" @click="removeHistory"
        >删除批次记录</n-button
      >
      <small v-if="batch.status === 'stopping'">当前正在处理的作品会按正常规则完成，后续项目不再执行。</small>
    </div>
    <n-spin :show="loading">
      <div v-if="rows.length" class="archive-import-table-wrap">
        <table class="archive-import-table">
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
              <td>{{ row.platform ? archivePlatformLabel(row.platform) : row.inputPlatform || "自动识别" }}</td>
              <td :class="{ 'archive-import-error': row.status === 'failed' || row.status === 'invalid' }">
                {{ importRowLabels[row.status] }}
              </td>
              <td>{{ row.progress }}%</td>
              <td>
                {{ row.message
                }}<n-button v-if="row.archiveId" text type="primary" size="tiny" @click="viewArchive(row.archiveId)"
                  >查看存档</n-button
                >
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
import { computed, ref } from "vue";
import { NAlert, NButton, NEmpty, NModal, NSelect, NSpin, useMessage } from "naive-ui";
import { FileSpreadsheet } from "lucide-vue-next";
import { ARCHIVE_IMPORT_ROW_LABELS as importRowLabels, type ArchiveGroup } from "@toolbox/shared/archive";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import { formatApiError } from "../../shared/http/http";
import { archiveImportTemplateUrl, archiveImportResultUrl } from "./content-api";
import { archivePlatformLabel } from "./presentation";
import { formatArchiveDate } from "./format-date";
import { useArchiveBatchImport, importBatchLabels, importBatchActive } from "./useArchiveBatchImport";
import excelTemplateUrl from "./assets/archive-import-template.xlsx?url";
const props = defineProps<{ groups?: ArchiveGroup[] }>();
const emit = defineEmits<{ changed: []; openArchive: [id: string] }>();
const message = useMessage(),
  confirm = useConfirmDialog();
const model = useArchiveBatchImport(
  (error) => message.error(formatApiError(error, "批量归档操作失败")),
  () => emit("changed")
);
const { open, busy, loading, preview, batch, history, selectedId, existing, groupId, rows, counts } = model;
const groupOptions = computed(() => (props.groups ?? []).map((group) => ({ label: group.name, value: group.id })));
const fileInput = ref<HTMLInputElement>();
const existingOptions = [
  { label: "跳过已归档作品（默认）", value: "skip" },
  { label: "重新获取并刷新已有归档", value: "refresh" }
];
const historyOptions = computed(() =>
  history.value.map((entry) => ({
    label: `${formatArchiveDate(entry.createdAt)} · ${entry.sourceName} · ${importBatchLabels[entry.status]}`,
    value: entry.id
  }))
);
async function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) await model.upload(file);
  input.value = "";
}
async function removeHistory() {
  if (
    await confirm("只删除本次批次记录，已归档作品及媒体不会删除。", { title: "删除批次记录", positiveText: "删除记录" })
  )
    await model.remove();
}
function viewArchive(id: string) {
  open.value = false;
  emit("openArchive", id);
}
</script>
<style scoped>
.archive-import-entry,
.archive-import-toolbar,
.archive-import-options {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.archive-import-entry {
  justify-content: space-between;
  color: #60708a;
  font-size: 13px;
}
.archive-import-toolbar,
.archive-import-options {
  margin: 16px 0;
}
.archive-import-file {
  display: none;
}
.archive-import-history {
  width: 340px;
  max-width: 100%;
}
.archive-import-table-wrap {
  overflow: auto;
  max-height: 52vh;
  border: 1px solid #e6ebf2;
  border-radius: 8px;
}
.archive-import-table {
  width: 100%;
  min-width: 740px;
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
  max-width: 300px;
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
</style>
