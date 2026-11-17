<template>
  <n-button size="small" type="primary" secondary title="从 TikTok 用户主页发现公开作品，再确认批量归档" @click="show()"
    >TikTok 主页批量归档</n-button
  >
  <n-modal
    v-model:show="open"
    preset="card"
    title="TikTok 主页批量归档"
    style="width: min(1320px, calc(100vw - 32px))"
  >
    <n-alert type="info" :bordered="false"
      >读取时会打开运行服务电脑上的独立 TikTok
      浏览器；需要正常登录或验证时请在那里完成。关闭此弹窗不会停止后台任务。仅归档可访问的公开作品，每批最多 100
      条。主页任务历史长期保留，不自动清除；删除记录只影响选中的主页任务，批次和归档作品保留。</n-alert
    >
    <details class="profile-browser-help">
      <summary>自动窗口仍然出错？使用普通浏览器采集</summary>
      <p>适用于普通浏览器（含无痕窗口）可以显示视频、自动窗口返回空列表的情况。先停止当前读取，再使用此可选方式。</p>
      <ol>
        <li>下载并打开助手 HTML，把其中的“采集 TikTok 作品”链接拖到浏览器书签栏。</li>
        <li>用普通浏览器打开 TikTok 主页，确认视频可见后点击采集书签，再点“开始采集”。</li>
        <li>停止后下载 CSV，每份最多 100 条；返回“表格批量归档”预览、指定分组并确认。</li>
      </ol>
      <p>无需安装扩展或提供 Cookie。只收集页面显示的链接，数量不代表全部作品；关闭助手会丢弃未导出的链接。</p>
      <div class="profile-toolbar">
        <n-button secondary @click="downloadCollector">下载普通浏览器采集助手</n-button>
        <n-button secondary @click="copyCollector">复制采集书签地址</n-button>
      </div>
    </details>
    <div class="profile-toolbar">
      <n-input
        v-model:value="url"
        :disabled="busy || isActive"
        placeholder="https://www.tiktok.com/@用户名"
        :input-props="{ 'aria-label': 'TikTok 用户主页链接' }"
        class="profile-url"
        @keyup.enter="create"
      />
      <n-button type="primary" :disabled="busy || isActive || !url.trim()" @click="create">读取主页作品</n-button>
      <n-select
        :value="selectedId"
        :disabled="busy"
        :options="historyOptions"
        placeholder="查看主页任务历史"
        aria-label="TikTok 主页任务历史"
        class="profile-select"
        @update:value="select"
      />
      <n-button :disabled="busy" @click="refreshHistory">刷新历史</n-button>
    </div>
    <template v-if="job">
      <n-alert :type="job.complete ? 'success' : 'warning'" :bordered="false">
        <strong
          >@{{ job.username }} · {{ phases[job.phase] }} ·
          {{ job.complete ? "列表已确认完整" : "列表未确认完整" }}</strong
        >
        <p v-if="job.message !== '本次所选作品已处理完毕；失败项可手动重试' || job.failedCount" class="profile-status-message">{{ job.message }}</p>
        <div class="profile-status-counts"
          >已发现 {{ job.discoveredCount }} 条<span v-if="job.declaredCount !== undefined"
            >，主页统计 {{ job.declaredCount }} 条</span
          >。已归档 {{ job.archivedCount }} · 失败 {{ job.failedCount }} · 跳过/取消 {{ job.skippedCount }} · 待处理
          {{ job.pendingCount }}<span v-if="job.batchCount >= 900"> · 已创建 {{ job.batchCount }}/1000 批</span></div
        >
      </n-alert>
      <div class="profile-toolbar profile-task-actions" role="group" aria-label="主页任务操作">
        <strong>主页任务</strong>
        <n-button
          v-if="isActive"
          :disabled="busy || job.phase === 'stopping'"
          @click="run(() => tiktokProfileApi.cancel(job!.id, scope.signal))"
          >停止后续操作</n-button
        >
        <n-button v-if="!isActive" :disabled="busy" @click="run(() => tiktokProfileApi.discover(job!.id, scope.signal))"
          >继续读取 / 检查新作品</n-button
        >
        <n-button
          v-if="!isActive && (job.failedCount || job.pendingCount)"
          :disabled="busy"
          @click="run(() => tiktokProfileApi.retry(job!.id, scope.signal))"
          >继续未完成 / 重试失败项</n-button
        >
        <n-button tag="a" :href="tiktokProfileResultsUrl(job.id)">导出作品与结果 CSV</n-button>
        <n-button v-if="!isActive" type="error" secondary :disabled="busy" @click="remove">删除主页任务记录</n-button>
      </div>
      <section v-if="!isActive && job.discoveredCount" class="profile-operations" aria-label="作品批量操作">
        <div class="profile-operation-scope">
          <div>
            <strong>作品范围</strong>
            <p>以下归档和补充音轨操作使用同一范围。</p>
          </div>
          <n-select
            v-model:value="selection"
            :disabled="busy"
            :options="selectionOptions"
            aria-label="作品操作范围"
            class="profile-select"
          />
          <span v-if="selection === 'selected'">已选择 {{ selectedIds.length }} 条（跨页保留）</span>
        </div>
        <div class="profile-operation-grid">
          <section class="profile-operation" aria-label="归档作品">
            <div class="profile-operation-heading">
              <strong>归档作品</strong>
              <p>下载所选范围内的作品，并按设置处理已有归档。</p>
            </div>
            <div class="profile-operation-fields">
              <label
                >已有作品处理方式
                <n-select
                  v-model:value="existing"
                  :disabled="busy"
                  :options="existingOptions"
                  aria-label="主页已有作品处理方式"
                />
              </label>
              <label
                >成功结果分组（可选）
                <n-select
                  v-model:value="groupId"
                  :disabled="busy"
                  clearable
                  :options="groupOptions"
                  placeholder="不指定分组"
                  aria-label="主页归档目标分组"
                />
              </label>
            </div>
            <n-checkbox v-if="!job.complete" v-model:checked="allowPartial" :disabled="busy"
              >确认仅归档当前已发现的作品，列表尚未确认完整</n-checkbox
            >
            <n-button
              type="primary"
              :loading="archiveStarting"
              :disabled="busy || (!job.complete && !allowPartial) || (selection === 'selected' && !selectedIds.length)"
              @click="archive"
              >确认并开始主页归档</n-button
            >
          </section>
          <section class="profile-operation" aria-label="补充图文音轨">
            <div class="profile-operation-heading">
              <strong>补充图文音轨</strong>
              <p>只为范围内已归档且缺少音轨的 TikTok 图文补充原音轨。</p>
            </div>
            <div class="profile-operation-buttons">
              <n-button
                secondary
                :loading="supplementRunning"
                :disabled="busy || (selection === 'selected' && !selectedIds.length)"
                @click="supplementSoundtracks"
                >补充缺失图文音轨</n-button
              >
              <n-button v-if="supplementRunning" :disabled="supplementStop" @click="supplementStop = true">{{
                supplementStop ? "正在停止" : "停止后续补充"
              }}</n-button>
            </div>
            <p v-if="supplementSummary" class="profile-operation-status" role="status">{{ supplementSummary }}</p>
            <p v-if="supplementRunning">请保持此窗口打开；停止后会完成当前作品，再停止后续补充。</p>
            <details v-if="supplementErrors.length">
              <summary>查看失败作品（{{ supplementErrors.length }}）</summary>
              <p v-for="entry in supplementErrors" :key="entry.id">{{ entry.id }}：{{ entry.message }}</p>
            </details>
          </section>
        </div>
      </section>
      <p>失败作品可逐条重试；点击作品标题可填入主页面“获取并存档”，成功后自动同步结果。</p>
      <n-spin :show="loading"
        ><div v-if="works.items.length" class="profile-table">
          <table>
            <colgroup>
              <col class="profile-col-selection" />
              <col class="profile-col-work" />
              <col class="profile-col-date" />
              <col class="profile-col-status" />
              <col class="profile-col-progress" />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th>
                  <n-checkbox
                    :checked="allSelected"
                    :disabled="isActive || busy"
                    aria-label="选择本页主页作品"
                    @update:checked="selectPage"
                  />
                </th>
                <th>作品</th>
                <th>发布时间</th>
                <th>归档状态</th>
                <th>进度</th>
                <th>结果 / 原因</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="work in works.items" :key="work.id">
                <td>
                  <n-checkbox
                    :checked="selectedIds.includes(work.id)"
                    :disabled="isActive || busy"
                    :aria-label="`选择作品 ${work.id}`"
                    @update:checked="toggle(work.id, $event)"
                  />
                </td>
                <td>
                  <a
                    class="profile-work-link"
                    :href="work.url"
                    :title="`${work.title || work.id}；点击填入获取并存档入口`"
                    target="_blank"
                    rel="noopener noreferrer"
                    @click="retrySingle($event, work.url)"
                    >{{ work.title || work.id }}</a
                  >
                </td>
                <td class="profile-nowrap">
                  {{ work.createdAt ? formatArchiveDate(work.createdAt) : "—" }}
                </td>
                <td class="profile-nowrap">
                  {{ work.outcome ? rowLabels[work.outcome.status] : "未选择归档" }}
                </td>
                <td class="profile-nowrap">
                  {{ work.outcome ? `${work.outcome.progress}%` : "—" }}
                </td>
                <td>
                  <div class="profile-result">
                    <n-button
                      v-if="work.outcome?.status === 'failed'"
                      size="small"
                      type="primary"
                      :disabled="busy || (isActive && job.phase !== 'archiving')"
                      @click="run(() => tiktokProfileApi.retryWork(job!.id, work.id, scope.signal))"
                      >重试</n-button
                    >
                    <span>{{ work.outcome?.message || "—" }}</span
                    ><n-button
                      v-if="work.outcome?.archiveId"
                      text
                      type="primary"
                      @click="viewArchive(work.outcome.archiveId)"
                      >查看存档</n-button
                    >
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <n-empty v-else description="尚未发现作品；请查看独立浏览器提示或继续读取"
      /></n-spin>
      <n-pagination
        v-if="works.total"
        class="pagination-with-total"
        :page="page"
        :page-count="works.pageCount"
        @update:page="changePage"
      >
        <template #prefix>共 {{ works.total }} 条</template>
      </n-pagination>
    </template>
    <n-empty v-else description="先读取主页作品并核对列表，再确认归档" />
  </n-modal>
</template>
<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from "vue";
import { NAlert, NButton, NCheckbox, NEmpty, NInput, NModal, NPagination, NSelect, NSpin, useMessage } from "naive-ui";
import {
  normalizeTikTokProfileLink,
  ARCHIVE_IMPORT_ROW_LABELS as rowLabels,
  type ArchiveGroup,
  type TikTokProfileJob,
  type TikTokProfilePage
} from "@toolbox/shared/archive";
import { tiktokProfileApi, tiktokProfileResultsUrl } from "./content-api";
import { formatArchiveDate } from "./format-date";
import { useRequestScope } from "../../shared/composables/useRequestScope";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
import { formatApiError, isApiErrorCancelled } from "../../shared/http/http";
import { copyTextToClipboard } from "../../shared/utils/clipboard";
import { createTikTokCollectorBookmarklet, createTikTokCollectorHelpHtml } from "./tiktok-browser-collector";
const props = defineProps<{ groups?: ArchiveGroup[] }>();
const emit = defineEmits<{ changed: []; openArchive: [id: string]; retrySingle: [url: string] }>();
const message = useMessage(),
  confirm = useConfirmDialog(),
  scope = useRequestScope();
const open = ref(false),
  busy = ref(false),
  loading = ref(false),
  url = ref("");
const selectedId = ref<string | null>(null),
  job = ref<TikTokProfileJob>(),
  history = ref<TikTokProfileJob[]>([]),
  page = ref(1);
const works = ref<TikTokProfilePage>({ items: [], page: 1, pageCount: 1, total: 0 });
const selectedIds = ref<string[]>([]),
  selection = ref<"all" | "selected">("all"),
  existing = ref<"skip" | "refresh">("skip"),
  groupId = ref<string | null>(null),
  allowPartial = ref(false);
const archiveStarting = ref(false),
  supplementRunning = ref(false),
  supplementStop = ref(false),
  supplementSummary = ref("");
const supplementErrors = ref<Array<{ id: string; message: string }>>([]);
let generation = 0,
  historyGeneration = 0,
  timer: ReturnType<typeof setTimeout> | undefined,
  controller: AbortController | undefined;
let collectorDownloadUrl: string | undefined;
function downloadCollector() {
  let link: HTMLAnchorElement | undefined;
  try {
    collectorDownloadUrl ??= URL.createObjectURL(
      new Blob([createTikTokCollectorHelpHtml()], { type: "text/html;charset=utf-8" })
    );
    link = document.createElement("a");
    link.href = collectorDownloadUrl;
    link.download = "TikTok普通浏览器采集助手.html";
    document.body.append(link);
    link.click();
  } catch (error) {
    report(error);
  } finally {
    link?.remove();
  }
}
async function copyCollector() {
  try {
    await copyTextToClipboard(createTikTokCollectorBookmarklet());
    if (!scope.aborted) message.success("已复制。请粘贴到浏览器书签的网址中，在 TikTok 主页点击该书签使用。");
  } catch (error) {
    report(error);
  }
}
const phases: Record<TikTokProfileJob["phase"], string> = {
  discovering: "正在发现作品",
  "waiting-user": "等待浏览器内操作",
  ready: "等待确认归档",
  archiving: "正在分批归档",
  stopping: "正在安全停止",
  completed: "本次归档已处理完毕",
  cancelled: "已停止",
  interrupted: "已中断，需手动继续",
  failed: "读取失败"
};
const active = (value?: TikTokProfileJob) =>
  Boolean(value && ["discovering", "waiting-user", "archiving", "stopping"].includes(value.phase));
const isActive = computed(() => active(job.value));
const historyOptions = computed(() =>
  history.value.map((value) => ({
    label: `@${value.username} · ${phases[value.phase]} · ${formatArchiveDate(value.createdAt)}`,
    value: value.id
  }))
);
const groupOptions = computed(() => (props.groups ?? []).map((value) => ({ label: value.name, value: value.id })));
watch(
  () => props.groups,
  (groups) => {
    if (groups && groupId.value && !groups.some((group) => group.id === groupId.value)) groupId.value = null;
  }
);
const allSelected = computed(
  () => works.value.items.length > 0 && works.value.items.every((work) => selectedIds.value.includes(work.id))
);
const selectionOptions = [
  { label: "全部已发现作品", value: "all" },
  { label: "仅勾选作品", value: "selected" }
];
const existingOptions = [
  { label: "跳过已归档作品（默认）", value: "skip" },
  { label: "重新获取并刷新已有归档", value: "refresh" }
];
function invalidate() {
  generation++;
  controller?.abort();
  clearTimeout(timer);
}
function report(error: unknown) {
  if (!scope.aborted && !isApiErrorCancelled(error)) message.error(formatApiError(error, "主页任务操作失败"));
}
function retrySingle(event: MouseEvent, workUrl: string) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  open.value = false;
  emit("retrySingle", workUrl);
}
function apply(value: TikTokProfileJob) {
  if (
    job.value?.id === value.id &&
    (job.value.archivedCount !== value.archivedCount ||
      job.value.skippedCount !== value.skippedCount ||
      (active(job.value) && !active(value)))
  )
    emit("changed");
  job.value = value;
  history.value = [value, ...history.value.filter((entry) => entry.id !== value.id)].slice(0, 20);
}
function schedule() {
  clearTimeout(timer);
  if (open.value && !busy.value && isActive.value && !scope.aborted) timer = setTimeout(() => void refresh(true), 1800);
}
async function refresh(poll = false) {
  if (!open.value || !selectedId.value || scope.aborted) return;
  invalidate();
  const revision = generation,
    id = selectedId.value;
  controller = new AbortController();
  const signal = AbortSignal.any([scope.signal, controller.signal]);
  if (!poll) loading.value = true;
  try {
    const [value, result] = await Promise.all([
      tiktokProfileApi.get(id, signal),
      tiktokProfileApi.works(id, page.value, signal)
    ]);
    if (scope.aborted || !open.value || generation !== revision) return;
    apply(value);
    works.value = result;
  } catch (error) {
    if (generation === revision && !signal.aborted) report(error);
  } finally {
    if (generation === revision) {
      loading.value = false;
      schedule();
    }
  }
}
async function refreshHistory() {
  const revision = ++historyGeneration;
  try {
    const values = await tiktokProfileApi.list(scope.signal);
    if (!scope.aborted && revision === historyGeneration) history.value = values;
  } catch (error) {
    report(error);
  }
}
async function show(id?: string) {
  open.value = true;
  const revision = historyGeneration + 1;
  await refreshHistory();
  if (!scope.aborted && open.value && revision === historyGeneration) {
    const requested = id ?? selectedId.value;
    const next =
      history.value.find((value) => value.id === requested)?.id ??
      history.value.find(active)?.id ??
      history.value[0]?.id;
    if (next) {
      if (selectedId.value !== next || job.value?.id !== next) await select(next);
      else await refresh();
    } else {
      invalidate();
      selectedId.value = null;
      job.value = undefined;
      selectedIds.value = [];
      page.value = 1;
      allowPartial.value = false;
      works.value = { items: [], page: 1, pageCount: 1, total: 0 };
    }
  }
}
async function select(id: string) {
  invalidate();
  selectedId.value = id;
  job.value = undefined;
  selectedIds.value = [];
  page.value = 1;
  allowPartial.value = false;
  await refresh();
}
async function run(operation: () => Promise<TikTokProfileJob>) {
  if (busy.value) return;
  busy.value = true;
  invalidate();
  try {
    const value = await operation();
    if (scope.aborted) return;
    if (selectedId.value !== value.id || value.phase === "discovering") {
      selectedIds.value = [];
      page.value = 1;
      allowPartial.value = false;
    }
    selectedId.value = value.id;
    apply(value);
    await refresh();
  } catch (error) {
    report(error);
  } finally {
    if (!scope.aborted) {
      busy.value = false;
      schedule();
    }
  }
}
async function create() {
  const value = normalizeTikTokProfileLink(url.value);
  if (!value) {
    message.warning("请输入有效的 HTTPS TikTok 用户主页链接");
    return;
  }
  await run(() => tiktokProfileApi.create(value.url, scope.signal));
}
async function archive() {
  if (!job.value || busy.value) return;
  const id = job.value.id;
  archiveStarting.value = true;
  try {
    await run(() =>
      tiktokProfileApi.archive(
        id,
        {
          selection: selection.value,
          ...(selection.value === "selected" ? { itemIds: [...selectedIds.value] } : {}),
          existing: existing.value,
          ...(groupId.value ? { groupId: groupId.value } : {}),
          allowPartial: allowPartial.value
        },
        scope.signal
      )
    );
  } finally {
    archiveStarting.value = false;
  }
}
async function supplementSoundtracks() {
  if (!job.value || busy.value || isActive.value) return;
  const id = job.value.id;
  busy.value = true;
  supplementRunning.value = true;
  supplementStop.value = false;
  supplementErrors.value = [];
  supplementSummary.value = "正在读取作品列表…";
  const counts = { added: 0, exists: 0, unavailable: 0, skipped: 0, failed: 0, done: 0 };
  try {
    const ids: string[] = [];
    if (selection.value === "selected") ids.push(...selectedIds.value);
    else {
      for (let index = 1; index <= Math.max(1, Math.ceil(job.value.discoveredCount / 50)); index++) {
        if (supplementStop.value || scope.aborted) break;
        const result = await tiktokProfileApi.works(id, index, scope.signal);
        ids.push(...result.items.map((work) => work.id));
      }
    }
    for (const workId of ids) {
      if (supplementStop.value || scope.aborted) break;
      try {
        const result = await tiktokProfileApi.supplementSoundtrack(id, workId, scope.signal);
        counts[result.status]++;
      } catch (error) {
        if (scope.aborted) break;
        counts.failed++;
        supplementErrors.value.push({ id: workId, message: formatApiError(error, "补充失败") });
      }
      counts.done++;
      supplementSummary.value = `已处理 ${counts.done}/${ids.length} · 新增 ${counts.added} · 已有 ${counts.exists} · 无可用音轨 ${counts.unavailable} · 不适用 ${counts.skipped} · 失败 ${counts.failed}`;
    }
    if (supplementStop.value) supplementSummary.value += " · 已停止";
    if (counts.added) emit("changed");
  } catch (error) {
    report(error);
    supplementSummary.value = "读取作品列表失败，请重试";
  } finally {
    supplementRunning.value = false;
    busy.value = false;
    if (!scope.aborted && open.value) await refresh();
  }
}
async function remove() {
  const id = job.value?.id;
  if (
    !id ||
    busy.value ||
    !(await confirm("只删除当前主页任务历史，表格批次、其他主页任务、已归档作品、媒体及分组均保留。", {
      title: "删除主页任务记录",
      positiveText: "删除记录"
    })) ||
    scope.aborted
  )
    return;
  busy.value = true;
  invalidate();
  try {
    await tiktokProfileApi.remove(id, scope.signal);
    if (!scope.aborted) {
      historyGeneration++;
      history.value = history.value.filter((entry) => entry.id !== id);
      selectedId.value = null;
      job.value = undefined;
      works.value = { items: [], page: 1, pageCount: 1, total: 0 };
      selectedIds.value = [];
      page.value = 1;
      allowPartial.value = false;
      loading.value = false;
    }
  } catch (error) {
    report(error);
  } finally {
    if (!scope.aborted) busy.value = false;
  }
}
defineExpose({ show });
function toggle(id: string, checked: boolean) {
  if (!works.value.items.some((work) => work.id === id)) return;
  selectedIds.value = checked
    ? [...new Set([...selectedIds.value, id])]
    : selectedIds.value.filter((value) => value !== id);
}
function selectPage(checked: boolean) {
  const ids = new Set(works.value.items.map((work) => work.id));
  selectedIds.value = checked
    ? [...new Set([...selectedIds.value, ...ids])]
    : selectedIds.value.filter((id) => !ids.has(id));
}
async function changePage(value: number) {
  page.value = value;
  await refresh();
}
function viewArchive(id: string) {
  open.value = false;
  emit("openArchive", id);
}
watch(open, (value) => {
  if (!value) {
    supplementStop.value = true;
    invalidate();
    loading.value = false;
  } else schedule();
});
onScopeDispose(() => {
  invalidate();
  if (collectorDownloadUrl) URL.revokeObjectURL(collectorDownloadUrl);
});
</script>
<style scoped>
.profile-status-message,
.profile-status-counts {
  margin: 6px 0 0;
  line-height: 1.5;
}
.profile-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.profile-toolbar {
  margin: 16px 0;
}
.profile-browser-help {
  margin: 16px 0;
  padding: 12px 16px;
  border: 1px solid #e6ebf2;
  border-radius: 8px;
  color: #40516d;
  font-size: 13px;
}
.profile-browser-help summary {
  cursor: pointer;
  font-weight: 600;
}
.profile-url {
  flex: 1;
  min-width: 200px;
}
.profile-select {
  width: 260px;
  max-width: 100%;
}
.profile-task-actions strong {
  margin-right: 4px;
}
.profile-operations {
  display: grid;
  gap: 16px;
  margin: 16px 0;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface-subtle);
}
.profile-operation-scope,
.profile-operation-buttons {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 16px;
}
.profile-operation-scope p,
.profile-operation p {
  margin: 4px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.5;
}
.profile-operation-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.profile-operation {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}
.profile-operation-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
  gap: 10px;
}
.profile-operation-fields label {
  display: grid;
  min-width: 0;
  gap: 6px;
  color: var(--color-text-secondary);
  font-size: 13px;
}
.profile-operation .profile-operation-status {
  margin: 0;
  overflow-wrap: anywhere;
}
@media (max-width: 900px) {
  .profile-operation-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 520px) {
  .profile-operation-fields {
    grid-template-columns: minmax(0, 1fr);
  }
  .profile-operation-scope .profile-select {
    width: 100%;
  }
}
.profile-table {
  overflow: auto;
  max-height: 48vh;
  border: 1px solid #e6ebf2;
  border-radius: 8px;
  margin-bottom: 12px;
}
.profile-table table {
  width: 100%;
  min-width: 1080px;
  table-layout: fixed;
  border-collapse: collapse;
  text-align: left;
  font-size: 13px;
}
.profile-table td,
.profile-table th {
  padding: 12px;
  vertical-align: top;
  border-bottom: 1px solid #e6ebf2;
}
.profile-table th {
  position: sticky;
  top: 0;
  background: var(--color-surface-subtle);
  z-index: 1;
  white-space: nowrap;
}
.profile-col-selection {
  width: 48px;
}
.profile-col-work {
  width: 31%;
}
.profile-col-date {
  width: 188px;
}
.profile-col-status {
  width: 116px;
}
.profile-col-progress {
  width: 76px;
}
.profile-nowrap {
  white-space: nowrap;
}
.profile-work-link {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.profile-result {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 12px;
  overflow-wrap: anywhere;
}
.profile-result > span {
  min-width: 0;
  max-width: 100%;
}
.profile-table tbody tr:hover {
  background: var(--color-surface-subtle);
}
</style>
