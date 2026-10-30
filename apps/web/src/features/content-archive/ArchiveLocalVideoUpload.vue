<template>
  <n-button size="small" secondary title="将本机视频批量加入归档，继续配乐、添加水印或下载" @click="opened = true"
    >批量上传视频</n-button
  >
  <n-modal
    :show="opened"
    preset="card"
    title="批量上传视频归档"
    style="width: min(1000px, 96vw)"
    :mask-closable="false"
    @update:show="close"
  >
    <n-alert type="info"
      >每批最多 {{ LOCAL_ARCHIVE_UPLOAD_MAX_FILES }} 个视频；MP4 / MOV / WebM，单个最大 500 MiB、最长 2
      小时，受主机配额限制。原文件不重新编码；部分编码的浏览器播放支持取决于设备。上传需 FFmpeg 媒体运行时。</n-alert
    >
    <div class="upload-actions">
      <n-button :disabled="running || rows.length >= LOCAL_ARCHIVE_UPLOAD_MAX_FILES" @click="fileInput?.click()"
        >选择多个视频</n-button
      >
      <n-button type="primary" :disabled="running || !rows.some((row) => row.status === 'pending')" @click="start"
        >开始批量归档</n-button
      >
      <n-button v-if="running" @click="stop">停止剩余上传</n-button>
      <n-button :disabled="running || !rows.some(retryable)" @click="retry()">重试失败/已停止项</n-button>
      <n-button :disabled="running || !rows.length" @click="clear">清空列表</n-button>
      <input
        ref="fileInput"
        type="file"
        hidden
        multiple
        accept=".mp4,.mov,.webm"
        aria-label="选择本地视频"
        @change="choose"
      />
    </div>
    <div class="upload-group">
      <label>归档分组</label>
      <n-select
        v-model:value="groupId"
        :options="groupOptions"
        :disabled="running"
        filterable
        clearable
        placeholder="未分组（新视频）"
        aria-label="上传视频归档分组"
      />
      <small>本轮新视频统一加入所选分组，重复视频保留原分组。可先在主页面新建或刷新分组，再回到此窗口选择。</small>
    </div>
    <n-alert v-if="error" type="error">{{ error }}</n-alert>
    <div class="upload-summary" role="status">
      <p>
        已处理 {{ counts.completed + counts.failed }} / {{ rows.length }} 项 · 成功 {{ counts.completed }} · 失败
        {{ counts.failed }} · 已停止 {{ counts.cancelled }} · 共 {{ formatBytes(totalBytes) }}
      </p>
      <n-progress type="line" :percentage="totalProgress" aria-label="批量归档总进度" />
      <p v-if="activeRow" class="upload-current" :title="activeRow.file.name">
        当前第 {{ activeIndex + 1 }} / {{ rows.length }} 项：{{ activeRow.file.name }} · {{ labels[activeRow.status]
        }}<span v-if="activeRow.status === 'waiting'"> · {{ activeRow.message }}</span>
      </p>
      <p>相同内容自动复用已有归档；失败项可单独重试。请保持页面打开，关闭或离开时会提示停止未完成上传。</p>
    </div>
    <div class="local-upload-table">
      <table>
        <thead>
          <tr>
            <th>视频与标题</th>
            <th>进度</th>
            <th>结果与操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visibleRows" :key="row.id">
            <td>
              <span :title="row.file.name">{{ row.file.name }}</span
              ><small>{{ formatBytes(row.file.size) }}</small>
              <n-input
                v-model:value="row.title"
                :disabled="running || row.status === 'completed'"
                :maxlength="500"
                placeholder="归档标题（默认文件名）"
                :aria-label="`${row.file.name} 的归档标题`"
              />
            </td>
            <td>
              <n-progress
                type="line"
                :percentage="row.progress"
                :status="row.status === 'failed' ? 'error' : 'default'"
              />{{ labels[row.status] }}
            </td>
            <td>
              <p>{{ row.message }}</p>
              <n-button v-if="row.archiveId" size="small" :disabled="running" @click="view(row.archiveId)"
                >查看归档</n-button
              >
              <n-button v-if="retryable(row)" size="small" :disabled="running" @click="retry(row.id)"
                >重试此项</n-button
              >
              <n-button v-if="row.status !== 'completed'" size="small" :disabled="running" @click="remove(row.id)"
                >移除此项</n-button
              >
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!rows.length">请选择要归档的视频，每个文件会保存为独立归档。</p>
    </div>
    <n-pagination
      v-if="rows.length > pageSize"
      v-model:page="page"
      :page-size="pageSize"
      :item-count="rows.length"
      :page-slot="5"
      class="upload-pagination pagination-with-total"
      aria-label="上传队列分页"
      ><template #prefix>共 {{ rows.length }} 条</template></n-pagination
    >
  </n-modal>
</template>
<script setup lang="ts">
import { computed, markRaw, onScopeDispose, ref, watch } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { NAlert, NButton, NInput, NModal, NPagination, NProgress, NSelect } from "naive-ui";
import {
  LOCAL_ARCHIVE_UPLOAD_MAX_BYTES,
  LOCAL_ARCHIVE_UPLOAD_MAX_FILES,
  type ContentArchiveItem,
  type ArchiveGroup
} from "@toolbox/shared/archive";
import { uploadLocalArchiveVideo } from "./content-api";
import { useRequestScope } from "../../shared/composables/useRequestScope";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import { formatBytesThroughGb as formatBytes } from "../../shared/utils/format-bytes";
import { ApiRequestError, formatApiError, isApiErrorCancelled } from "../../shared/http/http";
type Row = {
  id: number;
  file: File;
  title: string;
  progress: number;
  status: "pending" | "uploading" | "processing" | "waiting" | "completed" | "failed" | "cancelled";
  message: string;
  archiveId?: string;
};
const emit = defineEmits<{
  archived: [ContentArchiveItem];
  finished: [ContentArchiveItem | undefined];
  openArchive: [string];
}>();
const props = defineProps<{ groups?: ArchiveGroup[] }>();
const scope = useRequestScope(),
  confirm = useConfirmDialog();
const opened = ref(false),
  running = ref(false),
  error = ref(""),
  rows = ref<Row[]>([]),
  groupId = ref<string | null>(null),
  page = ref(1),
  activeId = ref<number>(),
  fileInput = ref<HTMLInputElement>();
const groupOptions = computed(() => {
  const options = (props.groups ?? []).map((group) => ({ label: group.name, value: group.id, disabled: false }));
  if (groupId.value && !options.some((option) => option.value === groupId.value))
    options.push({ label: "所选分组已删除，请停止后重选", value: groupId.value, disabled: true });
  return options;
});
watch([() => props.groups?.map((group) => group.id), running], () => {
  if (!running.value && groupId.value && !props.groups?.some((group) => group.id === groupId.value)) {
    groupId.value = null;
    error.value = "所选归档分组已删除，请重新选择分组";
  }
});
const pageSize = 20;
const visibleRows = computed(() => rows.value.slice((page.value - 1) * pageSize, page.value * pageSize));
const activeIndex = computed(() => rows.value.findIndex((row) => row.id === activeId.value));
const activeRow = computed(() => rows.value[activeIndex.value]);
const labels = {
  pending: "待上传",
  uploading: "正在上传",
  processing: "校验视频并生成封面",
  waiting: "等待服务额度",
  completed: "已归档",
  failed: "失败",
  cancelled: "已停止"
};
const counts = computed(() => {
  const result = { completed: 0, failed: 0, cancelled: 0 };
  for (const row of rows.value)
    if (row.status === "completed" || row.status === "failed" || row.status === "cancelled") result[row.status]++;
  return result;
});
const totalBytes = computed(() => rows.value.reduce((sum, row) => sum + row.file.size, 0));
const totalProgress = computed(() => {
  if (!rows.value.length) return 0;
  const done = counts.value.completed + counts.value.failed;
  const progress =
    activeRow.value && ["uploading", "processing"].includes(activeRow.value.status) ? activeRow.value.progress : 0;
  return done === rows.value.length
    ? 100
    : Math.min(99, Math.floor(((done + progress / 100) * 100) / rows.value.length));
});
let sequence = 0,
  stopRequested = false,
  controller: AbortController | undefined,
  pending: Promise<void> | undefined;
function fileIssue(file: File) {
  return !/\.(mp4|mov|webm)$/i.test(file.name) || !file.size || file.size > LOCAL_ARCHIVE_UPLOAD_MAX_BYTES
    ? "文件为空、格式不支持或超过 500 MiB"
    : "";
}
function retryable(row: Row) {
  return ["failed", "cancelled"].includes(row.status) && !fileIssue(row.file);
}
function choose(event: Event) {
  const input = event.target as HTMLInputElement,
    files = [...(input.files ?? [])];
  input.value = "";
  if (running.value || !files.length) return;
  error.value = "";
  if (rows.value.length + files.length > LOCAL_ARCHIVE_UPLOAD_MAX_FILES) {
    error.value = `每批最多 ${LOCAL_ARCHIVE_UPLOAD_MAX_FILES} 个视频，请分批选择`;
    return;
  }
  for (const file of files) {
    const issue = fileIssue(file);
    rows.value.push({
      id: ++sequence,
      file: markRaw(file),
      title: file.name.replace(/\.[^.]+$/, "").slice(0, 500),
      progress: 0,
      status: issue ? "failed" : "pending",
      message: issue
    });
  }
}
async function process() {
  running.value = true;
  stopRequested = false;
  const targetGroupId = groupId.value ?? undefined;
  const targetGroupName = props.groups?.find((group) => group.id === targetGroupId)?.name;
  let lastArchived: ContentArchiveItem | undefined;
  try {
    for (const row of rows.value) {
      if (stopRequested || scope.aborted) break;
      if (row.status !== "pending") continue;
      activeId.value = row.id;
      controller = new AbortController();
      try {
        const result = await upload(row, AbortSignal.any([scope.signal, controller.signal]), targetGroupId);
        if (scope.aborted) return;
        row.status = "completed";
        row.progress = 100;
        row.archiveId = result.item.id;
        row.message = result.duplicate
          ? "复用已存在的归档，保留其当前版本和原分组"
          : targetGroupName
            ? `已归档至“${targetGroupName}”`
            : "已归档至未分组";
        lastArchived = result.item;
        emit("archived", result.item);
      } catch (e) {
        if (scope.aborted) return;
        row.status = stopRequested || isApiErrorCancelled(e) ? "cancelled" : "failed";
        row.message =
          row.status === "cancelled" ? "已停止；提交阶段可能已完成，重试会自动去重" : formatApiError(e, "视频归档失败");
      } finally {
        controller = undefined;
      }
    }
  } finally {
    if (stopRequested)
      rows.value.forEach((row) => {
        if (row.status === "pending") row.status = "cancelled";
      });
    running.value = false;
    activeId.value = undefined;
    if (!scope.aborted) emit("finished", lastArchived);
  }
}
async function upload(row: Row, signal: AbortSignal, targetGroupId?: string) {
  for (let retries = 0; ; retries++) {
    signal.throwIfAborted();
    row.status = "uploading";
    row.progress = 0;
    row.message = "";
    let acceptsProgress = true;
    try {
      return await uploadLocalArchiveVideo(
        row.file,
        row.title,
        signal,
        (percent) => {
          if (!acceptsProgress || signal.aborted || scope.aborted || stopRequested) return;
          row.progress = Math.min(95, Math.round(percent * 0.95));
          if (percent >= 100) row.status = "processing";
        },
        targetGroupId
      );
    } catch (error) {
      acceptsProgress = false;
      // A 429 rejects admission before archive processing. Other failures require an explicit retry.
      if (!(error instanceof ApiRequestError) || error.status !== 429 || retries >= 5 || signal.aborted) throw error;
      row.status = "waiting";
      row.progress = 0;
      await waitForAdmission(row, retries + 1, signal);
    } finally {
      acceptsProgress = false;
    }
  }
}
function waitForAdmission(row: Row, attempt: number, signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const deadline = Date.now() + 60000;
    const message = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      row.message = `服务繁忙或请求限流，${remaining} 秒后自动重试（${attempt}/5）`;
    };
    message();
    const finish = () => {
      clearTimeout(timer);
      clearInterval(ticker);
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      finish();
      reject(new DOMException("上传已停止", "AbortError"));
    };
    const timer = setTimeout(() => {
      finish();
      resolve();
    }, 60000);
    const ticker = setInterval(message, 1000);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}
function clear() {
  if (running.value) return;
  rows.value = [];
  page.value = 1;
  error.value = "";
}
function remove(id: number) {
  if (running.value) return;
  rows.value = rows.value.filter((row) => row.id !== id);
  page.value = Math.max(1, Math.min(page.value, Math.ceil(rows.value.length / pageSize)));
}
function start() {
  if (groupId.value && !props.groups?.some((group) => group.id === groupId.value)) {
    error.value = "请选择有效的归档分组";
    return;
  }
  if (!running.value) {
    pending = process();
    void pending;
  }
}
function stop() {
  stopRequested = true;
  controller?.abort();
}
function retry(id?: number) {
  if (running.value) return;
  rows.value.forEach((row) => {
    if ((!id || row.id === id) && retryable(row)) {
      row.status = "pending";
      row.progress = 0;
    }
  });
  start();
}
async function canLeave() {
  if (!running.value) return true;
  if (
    !(await confirm("视频尚未全部上传。停止未完成的上传并离开？已成功归档的内容会保留。", {
      title: "停止批量上传",
      positiveText: "停止并离开"
    }))
  )
    return false;
  stop();
  await pending;
  return true;
}
async function close() {
  if (await canLeave()) opened.value = false;
}
function view(id: string) {
  if (!running.value) {
    opened.value = false;
    emit("openArchive", id);
  }
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (running.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}
window.addEventListener("beforeunload", beforeUnload);
onScopeDispose(() => {
  stop();
  window.removeEventListener("beforeunload", beforeUnload);
});
onBeforeRouteLeave(canLeave);
</script>
<style scoped>
.upload-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.upload-group {
  display: grid;
  grid-template-columns: auto minmax(180px, 320px);
  align-items: center;
  gap: 8px 12px;
  margin: 16px 0;
}
.upload-group small {
  grid-column: 1 / -1;
}
.upload-actions {
  margin: 16px 0;
}
.local-upload-table {
  overflow: auto;
  max-height: 55vh;
}
.upload-summary {
  margin: 16px 0;
}
.upload-summary p {
  font-size: 13px;
  overflow-wrap: anywhere;
}
.upload-current {
  font-weight: 600;
}
.upload-pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
table {
  width: 100%;
  min-width: 650px;
  border-collapse: collapse;
  table-layout: fixed;
}
th,
td {
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
  vertical-align: top;
}
th:first-child {
  width: 44%;
}
th:nth-child(2) {
  width: 23%;
}
td > span {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
small {
  display: block;
  color: var(--text-secondary, #64748b);
  margin: 6px 0;
}
td p {
  margin-top: 0;
  overflow-wrap: anywhere;
}
</style>
