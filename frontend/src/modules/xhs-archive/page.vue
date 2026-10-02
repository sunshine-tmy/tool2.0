<!-- 中文模块说明：小红书归档前端模块，负责列表、详情、媒体和翻译交互 -->
<template>
  <ToolLayout>
    <section class="main-column xhs-main">
      <ToolPageHeader
        title="多媒体内容归档"
        description="浏览小红书与抖音本地存档，支持预览、翻译与视频截帧。网页端首次归档自动准备签名能力，桌面端由能力管理提供。"
        kicker="LOCAL MEDIA ARCHIVE"
      />

      <n-alert type="info" :bordered="false" class="license-note">
        仅用于个人本地归档。解析组件来自 XHS-Downloader 2.7（GPL-3.0），不绕过验证码或平台访问限制。
      </n-alert>
      <div class="platform-runtime" aria-label="分平台解析环境">
        <span>小红书：{{ xhsRuntime?.message || "正在读取环境状态" }}</span>
        <span>抖音（匿名）：{{ douyinRuntime?.message || "正在读取环境状态" }}</span>
        <n-button size="tiny" quaternary :disabled="douyinRuntimeLoading || submitting" @click="refreshDouyinRuntime">
          刷新抖音状态
        </n-button>
      </div>

      <n-alert
        v-if="desktopMode && translationRuntime?.status !== 'ready'"
        type="info"
        :bordered="false"
        class="capability-note"
      >
        <template #header>翻译能力{{ translationRuntime?.status === "failed" ? "需要修复" : "尚未就绪" }}</template>
        <div class="capability-alert-content">
          <span>{{ translationRuntime?.message || "正在读取翻译能力状态。已保存的中文归档仍可正常浏览。" }}</span>
          <n-button size="small" secondary :disabled="translationRuntimeLoading" @click="openCapabilitySettings">
            前往设置
          </n-button>
        </div>
      </n-alert>

      <ArchiveTaskPanel
        v-model:input-url="inputUrl"
        v-model:platform="platform"
        :task="task"
        :submitting="submitting"
        :cancelling="cancellingTask"
        :auth-waiting="authWaiting"
        :douyin-available="douyinRuntime?.available === true"
        :douyin-can-auto-install="douyinRuntime?.installMode === 'automatic' && douyinRuntime.state === 'not-installed'"
        :douyin-message="douyinRuntime?.message"
        @submit="startFetch"
        @login="loginAndRetry"
        @cancel="cancelFetch"
      />

      <XhsResultPanel
        v-if="current"
        :current="current"
        :refreshing="refreshing"
        :copy-description="copyDescription"
        :copy-current="copyCurrent"
        :zip-url="zipUrl"
        :refresh-item="refreshItem"
        :translate-current="translateCurrent"
        :edit-translation="editTranslation"
        :reset-translation="resetTranslation"
        :has-edited="hasEdited"
        :format-date="formatDate"
        @frame-saved="onFrameSaved"
      />
      <ArchiveListPanel
        v-model:keyword="keyword"
        v-model:type-filter="typeFilter"
        v-model:platform-filter="platformFilter"
        v-model:page="page"
        :archives="archives"
        :list-loading="listLoading"
        :selected-ids="selectedArchiveIds"
        @search="loadArchives"
        @refresh="loadArchives"
        @remove-selected="removeSelected"
        @translate-selected="translateSelected"
        @open-detail="openDetail"
        @toggle-selection="toggleArchiveSelection"
        @toggle-select-all="toggleSelectAllArchives"
        @page-change="loadArchives"
      />

      <XhsDetailDrawer
        v-model:open="drawerOpen"
        :width="drawerWidth"
        :detail="detail"
        :format-date="formatDate"
        :remove-item="removeItem"
        :translate-detail="translateDetail"
        :edit-translation="editTranslation"
        :reset-translation="resetTranslation"
        :has-edited="hasEdited"
        :zip-url="zipUrl"
        @frame-saved="onFrameSaved"
      />
      <TranslationEditModal v-model:show="editOpen" :item="editTarget" @save="saveTranslation" />
    </section>
  </ToolLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { NAlert, NButton, useMessage } from "naive-ui";
import { useRouter } from "vue-router";
import {
  identifyArchiveLink,
  type ArchivePlatformSelection,
  type ContentArchiveItem,
  type ContentArchiveTask,
  type ContentTranslationEditInput,
  type DouyinRuntimeStatus,
  type XhsRuntimeStatus,
  type XhsTranslationRuntimeStatus
} from "@toolbox/shared";
import ToolLayout from "../../layouts/ToolLayout.vue";
import ToolPageHeader from "../../components/tool/ToolPageHeader.vue";
import ArchiveListPanel from "./ArchiveListPanel.vue";
import ArchiveTaskPanel from "./ArchiveTaskPanel.vue";
import XhsDetailDrawer from "./XhsDetailDrawer.vue";
import XhsResultPanel from "./XhsResultPanel.vue";
import TranslationEditModal from "./TranslationEditModal.vue";
import { useConfirmDialog } from "../../composables/useConfirmDialog";
import { useRequestScope } from "../../composables/useRequestScope";
import { useTaskEvents } from "../../composables/useTaskEvents";
import { copyTextToClipboard } from "../../utils/clipboard";
import { formatApiError, isApiErrorCancelled } from "../../services/http";
import { contentArchiveApi, contentArchiveZipUrl } from "./content-api";
import { archiveDisplayTitle, archiveDisplayText, archiveClipboardText, canEditTranslation } from "./presentation";
import { useArchiveCollection } from "./useArchiveCollection";
import { formatArchiveDate } from "./format-date";

const message = useMessage();
const router = useRouter();
const confirm = useConfirmDialog();
const desktopMode = computed(() => Boolean(window.toolboxDesktop));
const translationRuntime = ref<XhsTranslationRuntimeStatus>();
const translationRuntimeLoading = ref(false);
const xhsRuntime = ref<XhsRuntimeStatus>();
const douyinRuntime = ref<DouyinRuntimeStatus>();
const douyinRuntimeLoading = ref(false);
const inputUrl = ref("");
const platform = ref<ArchivePlatformSelection>("auto");
const task = ref<ContentArchiveTask>();
const submitting = ref(false);
const cancellingTask = ref(false);
const streamedTaskId = computed(() =>
  task.value && !["completed", "failed"].includes(task.value.status) ? task.value.id : undefined
);
const requestScope = useRequestScope();
const taskEvents = useTaskEvents(streamedTaskId, { signal: requestScope.signal });
const translationTarget = ref<{ taskId: string; itemId?: string; updateCurrent: boolean }>();
const translationEvents = useTaskEvents(
  computed(() => translationTarget.value?.taskId),
  {
    signal: requestScope.signal
  }
);
const collection = useArchiveCollection((error) => message.error(formatApiError(error, "读取存档失败")));
const {
  current,
  keyword,
  typeFilter,
  platformFilter,
  page,
  listLoading,
  archives,
  selectedArchiveIds,
  drawerOpen,
  detail,
  loadArchives,
  toggleArchiveSelection,
  toggleSelectAllArchives
} = collection;
const refreshing = ref(false);
const authWaiting = ref(false);
const editOpen = ref(false);
const editTarget = ref<ContentArchiveItem>();
// CSS 自行响应窗口变化，避免非响应式 innerWidth 把移动端的 100% 宽度永久保留到桌面窗口。
const drawerWidth = "min(720px, 100vw)";
let disposed = false;
let taskSyncRevision = 0;
let douyinRuntimeRequest: Promise<DouyinRuntimeStatus | undefined> | undefined;

watch(taskEvents.task, (event) => {
  // 获取任务的每次 SSE 更新都通过 taskSyncRevision 串行补拉，避免旧请求覆盖新状态。
  if (event && event.id === task.value?.id) void syncArchiveTask(event.id);
});

watch(taskEvents.error, (error) => {
  if (error && !isApiErrorCancelled(error)) message.warning(formatApiError(error));
});

watch(translationEvents.task, (event) => {
  // 翻译任务只在进入终态时读取详情，减少轮询并确保正文与译文同时刷新。
  if (event && (event.status === "completed" || event.status === "failed")) void finishTranslation(event.id);
});

watch(translationEvents.error, (error) => {
  if (error && !isApiErrorCancelled(error)) message.warning(formatApiError(error));
});

function handlePagePaste(event: ClipboardEvent) {
  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
    return;
  const text = event.clipboardData?.getData("text/plain") || "";
  if (!text.trim()) return;
  event.preventDefault();
  inputUrl.value = text;
  message.success("已粘贴到链接输入框");
}
async function startFetch() {
  if (!inputUrl.value.trim()) return;
  if (submitting.value) return;
  if (task.value && ["running", "pending"].includes(task.value.status)) return;
  const link = identifyArchiveLink(inputUrl.value, platform.value);
  if (!link.ok) {
    message.warning(link.message);
    return;
  }
  submitting.value = true;
  try {
    if (link.platform === "douyin") {
      // 提交前重新读取能力状态，避免页面挂起期间组件被卸载或修复后仍使用过期状态。
      const runtime = await refreshDouyinRuntime();
      if (!runtime?.available && !(runtime?.installMode === "automatic" && runtime.state === "not-installed")) {
        if (runtime) message.warning(`抖音归档环境未就绪：${runtime.message}`);
        return;
      }
    }
    // 创建获取任务立即返回 taskId；后续进度由 SSE 驱动，不阻塞页面输入和浏览。
    task.value = await contentArchiveApi.create({ url: link.url, platform: link.platform }, requestScope.signal);
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "获取失败"));
  } finally {
    submitting.value = false;
  }
}
function refreshDouyinRuntime(): Promise<DouyinRuntimeStatus | undefined> {
  if (douyinRuntimeRequest) return douyinRuntimeRequest;
  douyinRuntimeLoading.value = true;
  const request = contentArchiveApi
    .douyinRuntime(requestScope.signal)
    .then((status) => {
      if (!disposed) douyinRuntime.value = status;
      return status;
    })
    .catch((error: unknown) => {
      if (!disposed && !isApiErrorCancelled(error)) {
        douyinRuntime.value = undefined;
        message.warning(formatApiError(error, "读取抖音环境失败"));
      }
      return undefined;
    })
    .finally(() => {
      if (!disposed) douyinRuntimeLoading.value = false;
      if (douyinRuntimeRequest === request) douyinRuntimeRequest = undefined;
    });
  douyinRuntimeRequest = request;
  return request;
}
async function cancelFetch() {
  const active = task.value;
  if (!active || cancellingTask.value || !["pending", "running"].includes(active.status)) return;
  cancellingTask.value = true;
  // 先使当前进度读取失效，避免它在取消响应后用旧状态覆盖最终结果。
  taskSyncRevision++;
  try {
    const next = await contentArchiveApi.cancel(active.id, requestScope.signal);
    if (disposed || task.value?.id !== active.id) return;
    taskSyncRevision++;
    task.value = next;
    if (next.errorCode === "ARCHIVE_CANCELLED") {
      refreshing.value = false;
      message.info("获取任务已取消");
    } else if (next.status === "completed") {
      // 取消请求到达时任务可能已完成；按完成态补取归档详情，不把成功误显示为取消。
      await syncArchiveTask(next.id);
    } else if (next.status === "failed") {
      refreshing.value = false;
      message.error(next.error || next.message);
    }
  } catch (error) {
    if (disposed || task.value?.id !== active.id) return;
    taskSyncRevision++;
    if (!isApiErrorCancelled(error)) {
      message.error(formatApiError(error, "取消获取失败"));
      // 原子提交阶段可能返回 409；失败后重新读取服务端状态，给出准确的可操作提示。
      await syncArchiveTask(active.id);
    }
  } finally {
    if (!disposed) cancellingTask.value = false;
  }
}
async function refreshItem(id: string) {
  refreshing.value = true;
  try {
    task.value = await contentArchiveApi.refresh(id, requestScope.signal);
  } catch (error) {
    refreshing.value = false;
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "刷新存档失败"));
  }
}

async function syncArchiveTask(taskId: string) {
  const revision = ++taskSyncRevision;
  try {
    // revision 令牌保证快速连续提交时只有最后一次请求可以更新当前内容。
    const next = await contentArchiveApi.task(taskId, requestScope.signal);
    if (disposed || revision !== taskSyncRevision || task.value?.id !== taskId) return;
    task.value = next;
    if (next.status === "failed") {
      refreshing.value = false;
      message.error(next.error || next.message);
      return;
    }
    if (next.status !== "completed" || !next.archiveId) return;
    refreshing.value = false;
    const result = await contentArchiveApi.detail(next.archiveId, requestScope.signal);
    if (disposed || revision !== taskSyncRevision || task.value?.id !== taskId) return;
    current.value = result;
    if (current.value.translation?.taskId && current.value.translation.status !== "ready") {
      trackTranslation(current.value.translation.taskId, current.value.id, true);
    }
    message.success(next.message);
    await loadArchives();
  } catch (error) {
    if (revision === taskSyncRevision) {
      refreshing.value = false;
      if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "读取获取任务失败"));
    }
  }
}
async function loginAndRetry() {
  // 本期抖音不提供登录，不因输入平台切换而误启动 XHS 登录窗口。
  if (task.value?.platform !== "xiaohongshu" || authWaiting.value) return;
  authWaiting.value = true;
  try {
    // 登录流程由后端管理 Cookie；前端仅等待状态终止，再复用原输入重新创建获取任务。
    const session = await contentArchiveApi.startXhsAuth(requestScope.signal);
    let state = session;
    while (!["completed", "failed"].includes(state.status)) {
      await delay(1200, requestScope.signal);
      state = await contentArchiveApi.xhsAuth(session.id, requestScope.signal);
    }
    if (state.status === "failed") throw new Error(state.error || state.message);
    message.success("登录成功，正在重新获取");
    await startFetch();
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "登录失败"));
  } finally {
    authWaiting.value = false;
  }
}
async function openDetail(id: string) {
  const item = await collection.openDetail(id);
  if (item?.translation?.taskId && !["ready", "stale", "failed"].includes(item.translation.status)) {
    trackTranslation(item.translation.taskId, item.id, false);
  }
}
async function onFrameSaved(updated: ContentArchiveItem) {
  collection.updateItem(updated);
  await loadArchives();
  message.success("视频截帧已保存到当前归档");
}
async function translateCurrent() {
  if (!(await requireTranslationCapability())) return;
  if (!current.value) return;
  try {
    const item = current.value;
    const task = await contentArchiveApi.translate(item.id, item.translation?.status === "ready", requestScope.signal);
    if (disposed) return;
    if ("id" in task) trackTranslation(task.id, item.id, true);
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "创建翻译任务失败"));
  }
}
async function translateDetail() {
  if (!(await requireTranslationCapability())) return;
  if (!detail.value) return;
  try {
    const item = detail.value;
    const task = await contentArchiveApi.translate(item.id, item.translation?.status === "ready", requestScope.signal);
    if (disposed) return;
    if ("id" in task) trackTranslation(task.id, item.id, false);
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "创建翻译任务失败"));
  }
}
function editTranslation(item: ContentArchiveItem) {
  if (!canEditTranslation(item)) return;
  editTarget.value = item;
  editOpen.value = true;
}
function hasEdited(item: ContentArchiveItem) {
  const translation = item.translation;
  return Boolean(
    translation &&
    (translation.title.edited?.trim() ||
      translation.description?.edited?.trim() ||
      translation.topics.some((topic) => topic.edited?.trim()))
  );
}
async function resetTranslation(item: ContentArchiveItem) {
  const accepted = await confirm("将清除这条存档的英文人工修订并恢复机器翻译。", {
    title: "恢复机器翻译",
    positiveText: "确认恢复"
  });
  if (!accepted) return;
  try {
    await contentArchiveApi.resetTranslation(item.id, requestScope.signal);
    const updated = await contentArchiveApi.detail(item.id, requestScope.signal);
    if (current.value?.id === item.id) current.value = updated;
    if (detail.value?.id === item.id) detail.value = updated;
    message.success("已恢复机器翻译");
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "恢复机器翻译失败"));
  }
}
async function saveTranslation(payload: ContentTranslationEditInput) {
  const target = editTarget.value;
  if (!target) return;
  try {
    await contentArchiveApi.editTranslation(target.id, payload, requestScope.signal);
    const refreshed = await contentArchiveApi.detail(target.id, requestScope.signal);
    if (disposed || editTarget.value !== target) return;
    editTarget.value = refreshed;
    if (current.value?.id === refreshed.id) current.value = refreshed;
    if (detail.value?.id === refreshed.id) detail.value = refreshed;
    editOpen.value = false;
    message.success("英文修订已保存");
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "保存英文修订失败"));
  }
}
async function translateSelected() {
  if (!(await requireTranslationCapability())) return;
  try {
    const task = selectedArchiveIds.value.length
      ? await contentArchiveApi.translateBatch(
          { mode: "selected", itemIds: [...selectedArchiveIds.value] },
          requestScope.signal
        )
      : await contentArchiveApi.translateBatch(
          { mode: "missing-or-stale", filter: collection.filter() },
          requestScope.signal
        );
    if ("id" in task) trackTranslation(task.id, undefined, false);
    await loadArchives();
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "创建批量翻译任务失败"));
  }
}
async function requireTranslationCapability() {
  if (!desktopMode.value) return true;
  if (translationRuntime.value?.status === "ready") return true;
  if (translationRuntimeLoading.value) {
    message.info("正在检查翻译能力，请稍后重试");
    return false;
  }
  await openCapabilitySettings();
  return false;
}
async function openCapabilitySettings() {
  await router.push("/settings");
}
function trackTranslation(taskId: string, itemId?: string, updateCurrent = false) {
  translationTarget.value = { taskId, itemId, updateCurrent };
}

async function finishTranslation(taskId: string) {
  const target = translationTarget.value;
  if (!target || target.taskId !== taskId) return;
  try {
    // 翻译终态后按目标 item 刷新当前抽屉和列表，失败时保留原文并展示可重试错误。
    const state = await contentArchiveApi.translationTask(taskId, requestScope.signal);
    if (disposed || translationTarget.value !== target) return;
    if (state.status === "failed") {
      if (target.itemId) {
        const updated = await contentArchiveApi.detail(target.itemId, requestScope.signal).catch(() => undefined);
        if (disposed || translationTarget.value !== target) return;
        if (updated) {
          if (target.updateCurrent && current.value?.id === target.itemId) current.value = updated;
          if (detail.value?.id === target.itemId) detail.value = updated;
        }
      }
      await loadArchives().catch(() => undefined);
      message.error(state.error || state.message);
      return;
    }
    if (target.itemId) {
      const updated = await contentArchiveApi.detail(target.itemId, requestScope.signal);
      if (disposed || translationTarget.value !== target) return;
      if (target.updateCurrent && current.value?.id === target.itemId) current.value = updated;
      if (detail.value?.id === target.itemId) detail.value = updated;
    }
    message.success("英文翻译已完成");
    await loadArchives();
  } catch (error) {
    if (!disposed && !isApiErrorCancelled(error)) message.error(formatApiError(error, "读取翻译进度失败"));
  } finally {
    if (translationTarget.value?.taskId === taskId) translationTarget.value = undefined;
  }
}
async function removeItem() {
  if (!detail.value) return;
  // 删除前展示媒体数量和字节数；确认后由服务端事务同时删除元数据和文件。
  const item = detail.value;
  const accepted = await confirm(
    `将永久删除“${archiveDisplayTitle(item)}”及 ${item.media.length} 个本地媒体（${formatBytes(item.totalBytes)}）。此操作无法撤销。`,
    { title: "删除内容存档", positiveText: "确认删除" }
  );
  if (!accepted) return;
  try {
    await contentArchiveApi.remove(item.id, requestScope.signal);
    if (disposed) return;
    collection.forgetItem(item.id);
    message.success("存档已删除");
    await loadArchives();
  } catch (error) {
    if (!disposed && !isApiErrorCancelled(error)) message.error(formatApiError(error, "删除存档失败"));
  }
}
async function removeSelected() {
  const selected = archives.value.items.filter((item) => selectedArchiveIds.value.includes(item.id));
  if (!selected.length) return;
  // 批量删除只针对当前已选 ID；仅清除成功项，失败项保留选择以便显式重试。
  const mediaCount = selected.reduce((sum, item) => sum + item.mediaCount, 0);
  const bytes = selected.reduce((sum, item) => sum + item.totalBytes, 0);
  const accepted = await confirm(
    `将永久删除 ${selected.length} 条存档、${mediaCount} 个本地媒体（${formatBytes(bytes)}）。此操作无法撤销。`,
    { title: "批量删除内容存档", positiveText: "确认全部删除" }
  );
  if (!accepted) return;
  const results = await Promise.allSettled(
    selected.map(async (item) => {
      await contentArchiveApi.remove(item.id, requestScope.signal);
      collection.forgetItem(item.id);
    })
  );
  if (disposed) return;
  const removed = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected" && !isApiErrorCancelled(failed.reason))
    message.error(formatApiError(failed.reason, "部分存档删除失败"));
  if (removed) message.success(`已删除 ${removed} 条存档`);
  await loadArchives();
}
async function copyDescription() {
  if (!current.value) return;
  await copyTextToClipboard(archiveDisplayText(current.value).body);
  message.success("正文已复制");
}
async function copyCurrent(language: "zh" | "en" | "both") {
  if (!current.value) return;
  await copyItem(current.value, language);
}
async function copyItem(item: ContentArchiveItem, language: "zh" | "en" | "both") {
  await copyTextToClipboard(archiveClipboardText(item, language));
  message.success("内容已复制");
}
const zipUrl = contentArchiveZipUrl;
function formatDate(value: string) {
  return formatArchiveDate(value);
}
function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}
function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("请求已取消", "AbortError"));
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("请求已取消", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
onMounted(() => {
  // 页面级粘贴监听便于快速输入链接；输入框和可编辑元素会主动忽略该快捷操作。
  void loadArchives();
  // 独立读取平台环境，仅影响状态提示，能力离线不会阻断已保存归档的浏览。
  void contentArchiveApi
    .xhsRuntime(requestScope.signal)
    .then((status) => {
      if (!disposed) xhsRuntime.value = status;
    })
    .catch((error) => {
      if (!disposed && !isApiErrorCancelled(error)) message.warning(formatApiError(error, "读取小红书环境失败"));
    });
  void refreshDouyinRuntime();
  if (desktopMode.value) {
    translationRuntimeLoading.value = true;
    void contentArchiveApi
      .translationRuntime(requestScope.signal)
      .then((status) => {
        if (!disposed) translationRuntime.value = status;
      })
      .catch((error) => {
        if (!disposed && !isApiErrorCancelled(error)) message.warning(formatApiError(error, "读取翻译能力状态失败"));
      })
      .finally(() => {
        if (!disposed) translationRuntimeLoading.value = false;
      });
  }
  window.addEventListener("paste", handlePagePaste);
});
onBeforeUnmount(() => {
  // 标记 disposed 让迟到的异步结果不再弹出提示或修改已卸载页面。
  disposed = true;
  window.removeEventListener("paste", handlePagePaste);
});
</script>

<style scoped>
.xhs-main {
  display: grid;
  grid-column: 1 / -1;
  gap: 18px;
}
.license-note {
  margin-top: 0;
}
.platform-runtime {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  color: #687386;
  font-size: 12px;
}
.capability-note {
  margin-top: 0;
}
.capability-alert-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
</style>
