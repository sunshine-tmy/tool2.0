<template>
  <ToolLayout>
    <section class="main-column xhs-main">
      <ToolPageHeader
        title="小红书内容归档"
        description="获取小红书标题、正文和媒体并保存到本机，远程链接失效后仍可预览和下载。"
        kicker="LOCAL XHS ARCHIVE"
      />

      <n-alert type="info" :bordered="false" class="license-note">
        仅用于个人本地归档。解析组件来自 XHS-Downloader 2.7（GPL-3.0），不绕过验证码或平台访问限制。
      </n-alert>

      <ArchiveTaskPanel
        v-model:input-url="inputUrl"
        :task="task"
        :auth-waiting="authWaiting"
        @submit="startFetch"
        @login="loginAndRetry"
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
      />
      <ArchiveListPanel
        v-model:keyword="keyword"
        v-model:type-filter="typeFilter"
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
      />
      <TranslationEditModal v-model:show="editOpen" :item="editTarget" @save="saveTranslation" />
    </section>
  </ToolLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { NAlert, useMessage } from "naive-ui";
import {
  normalizeXhsText,
  parseXhsContentText,
  resolveXhsTranslationField,
  type XhsArchiveItem,
  type XhsArchiveListResponse,
  type XhsArchiveTask
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
import { resolveBackendUrl } from "../../config/runtime";
import { formatApiError, isApiErrorCancelled } from "../../services/http";
import { xhsArchiveApi } from "./api";

const message = useMessage();
const confirm = useConfirmDialog();
const inputUrl = ref("");
const task = ref<XhsArchiveTask>();
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
const current = ref<XhsArchiveItem>();
const refreshing = ref(false);
const authWaiting = ref(false);
const keyword = ref("");
const typeFilter = ref("all");
const page = ref(1);
const listLoading = ref(false);
const archives = ref<XhsArchiveListResponse>({ items: [], total: 0, page: 1, pageSize: 12, pageCount: 1 });
const selectedArchiveIds = ref<string[]>([]);
const drawerOpen = ref(false);
const detail = ref<XhsArchiveItem>();
const editOpen = ref(false);
const editTarget = ref<XhsArchiveItem>();
const drawerWidth = computed(() => (typeof window !== "undefined" && window.innerWidth < 720 ? "100%" : 720));
let disposed = false;
let taskSyncRevision = 0;

watch(taskEvents.task, (event) => {
  if (event && event.id === task.value?.id) void syncArchiveTask(event.id);
});

watch(taskEvents.error, (error) => {
  if (error && !isApiErrorCancelled(error)) message.warning(formatApiError(error));
});

watch(translationEvents.task, (event) => {
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
  try {
    task.value = await xhsArchiveApi.create(inputUrl.value);
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "获取失败"));
  }
}
async function refreshItem(id: string) {
  refreshing.value = true;
  try {
    task.value = await xhsArchiveApi.refresh(id);
  } catch (error) {
    refreshing.value = false;
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "刷新存档失败"));
  }
}

async function syncArchiveTask(taskId: string) {
  const revision = ++taskSyncRevision;
  try {
    const next = await xhsArchiveApi.task(taskId);
    if (revision !== taskSyncRevision || task.value?.id !== taskId) return;
    task.value = next;
    if (next.status === "failed") {
      refreshing.value = false;
      message.error(next.error || next.message);
      return;
    }
    if (next.status !== "completed" || !next.archiveId) return;
    refreshing.value = false;
    current.value = await xhsArchiveApi.detail(next.archiveId);
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
  authWaiting.value = true;
  try {
    const session = await xhsArchiveApi.startAuth();
    let state = session;
    while (!["completed", "failed"].includes(state.status)) {
      await delay(1200);
      state = await xhsArchiveApi.auth(session.id);
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
async function loadArchives() {
  listLoading.value = true;
  try {
    archives.value = await xhsArchiveApi.list({
      keyword: keyword.value,
      type: typeFilter.value,
      page: page.value,
      pageSize: 12
    });
    selectedArchiveIds.value = selectedArchiveIds.value.filter((id) =>
      archives.value.items.some((item) => item.id === id)
    );
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "读取存档失败"));
  } finally {
    listLoading.value = false;
  }
}
async function openDetail(id: string) {
  detail.value = await xhsArchiveApi.detail(id);
  drawerOpen.value = true;
  if (detail.value.translation?.taskId && detail.value.translation.status !== "ready") {
    trackTranslation(detail.value.translation.taskId, detail.value.id, false);
  }
}
async function translateCurrent() {
  if (!current.value) return;
  try {
    const task = await xhsArchiveApi.translate(current.value.id, current.value.translation?.status === "ready");
    if ("id" in task) trackTranslation(task.id, current.value.id, true);
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "创建翻译任务失败"));
  }
}
async function translateDetail() {
  if (!detail.value) return;
  try {
    const task = await xhsArchiveApi.translate(detail.value.id, detail.value.translation?.status === "ready");
    if ("id" in task) trackTranslation(task.id, detail.value.id, false);
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "创建翻译任务失败"));
  }
}
function editTranslation(item: XhsArchiveItem) {
  editTarget.value = item;
  editOpen.value = true;
}
function hasEdited(item: XhsArchiveItem) {
  const translation = item.translation;
  return Boolean(
    translation &&
    (translation.title.edited?.trim() ||
      translation.description?.edited?.trim() ||
      translation.topics.some((topic) => topic.edited?.trim()))
  );
}
async function resetTranslation(item: XhsArchiveItem) {
  const accepted = await confirm("将清除这条存档的英文人工修订并恢复机器翻译。", {
    title: "恢复机器翻译",
    positiveText: "确认恢复"
  });
  if (!accepted) return;
  try {
    await xhsArchiveApi.resetTranslation(item.id);
    const updated = await xhsArchiveApi.detail(item.id);
    if (current.value?.id === item.id) current.value = updated;
    if (detail.value?.id === item.id) detail.value = updated;
    message.success("已恢复机器翻译");
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "恢复机器翻译失败"));
  }
}
async function saveTranslation(payload: {
  sourceHash: string;
  title: { edited: string };
  description?: { edited: string };
  topics: Array<{ topicId: string; edited: string }>;
}) {
  if (!editTarget.value) return;
  try {
    const updated = await xhsArchiveApi.editTranslation(editTarget.value.id, payload);
    const refreshed = await xhsArchiveApi.detail(editTarget.value.id);
    editTarget.value = refreshed;
    if (current.value?.id === refreshed.id) current.value = refreshed;
    if (detail.value?.id === refreshed.id) detail.value = refreshed;
    editOpen.value = false;
    void updated;
    message.success("英文修订已保存");
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "保存英文修订失败"));
  }
}
async function translateSelected() {
  try {
    const task = selectedArchiveIds.value.length
      ? await xhsArchiveApi.translateBatch({ mode: "selected", itemIds: selectedArchiveIds.value })
      : await xhsArchiveApi.translateBatch({ mode: "missing-or-stale" });
    if ("id" in task) trackTranslation(task.id, undefined, false);
    await loadArchives();
  } catch (error) {
    if (!isApiErrorCancelled(error)) message.error(formatApiError(error, "创建批量翻译任务失败"));
  }
}
function trackTranslation(taskId: string, itemId?: string, updateCurrent = false) {
  translationTarget.value = { taskId, itemId, updateCurrent };
}

async function finishTranslation(taskId: string) {
  const target = translationTarget.value;
  if (!target || target.taskId !== taskId) return;
  try {
    const state = await xhsArchiveApi.translationTask(taskId);
    if (state.status === "failed") {
      if (target.itemId) {
        const updated = await xhsArchiveApi.detail(target.itemId).catch(() => undefined);
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
      const updated = await xhsArchiveApi.detail(target.itemId);
      if (target.updateCurrent && current.value?.id === target.itemId) current.value = updated;
      if (detail.value?.id === target.itemId) detail.value = updated;
    }
    message.success("英文翻译已完成");
  } catch (error) {
    if (!disposed && !isApiErrorCancelled(error)) message.error(formatApiError(error, "读取翻译进度失败"));
  } finally {
    if (translationTarget.value?.taskId === taskId) translationTarget.value = undefined;
  }
}
async function removeItem() {
  if (!detail.value) return;
  const item = detail.value;
  const accepted = await confirm(
    `将永久删除“${normalizeXhsText(item.title)}”及 ${item.media.length} 个本地媒体（${formatBytes(item.totalBytes)}）。此操作无法撤销。`,
    { title: "删除小红书存档", positiveText: "确认删除" }
  );
  if (!accepted) return;
  await xhsArchiveApi.remove(item.id);
  drawerOpen.value = false;
  if (current.value?.id === item.id) current.value = undefined;
  message.success("存档已删除");
  await loadArchives();
}
function toggleArchiveSelection(id: string, checked: boolean) {
  selectedArchiveIds.value = checked
    ? [...new Set([...selectedArchiveIds.value, id])]
    : selectedArchiveIds.value.filter((value) => value !== id);
}
function toggleSelectAllArchives(checked: boolean) {
  const currentIds = archives.value.items.map((item) => item.id);
  selectedArchiveIds.value = checked
    ? [...new Set([...selectedArchiveIds.value, ...currentIds])]
    : selectedArchiveIds.value.filter((id) => !currentIds.includes(id));
}
async function removeSelected() {
  const selected = archives.value.items.filter((item) => selectedArchiveIds.value.includes(item.id));
  const mediaCount = selected.reduce((sum, item) => sum + item.mediaCount, 0);
  const bytes = selected.reduce((sum, item) => sum + item.totalBytes, 0);
  const accepted = await confirm(
    `将永久删除 ${selected.length} 条存档、${mediaCount} 个本地媒体（${formatBytes(bytes)}）。此操作无法撤销。`,
    { title: "批量删除小红书存档", positiveText: "确认全部删除" }
  );
  if (!accepted) return;
  await Promise.all(selected.map((item) => xhsArchiveApi.remove(item.id)));
  selectedArchiveIds.value = [];
  if (current.value && selected.some((item) => item.id === current.value?.id)) current.value = undefined;
  message.success(`已删除 ${selected.length} 条存档`);
  await loadArchives();
}
async function copyDescription() {
  if (!current.value) return;
  await copyTextToClipboard(cleanDescription(current.value.description || ""));
  message.success("正文已复制");
}
async function copyCurrent(language: "zh" | "en" | "both") {
  if (!current.value) return;
  await copyItem(current.value, language);
}
async function copyItem(item: XhsArchiveItem, language: "zh" | "en" | "both") {
  const parsed = parseXhsContentText(item.description);
  const chinese = [
    `标题：${item.title}`,
    "",
    parsed.body,
    parsed.topics.length ? `\n话题：${parsed.topics.map((topic) => `#${topic.source}`).join(" ")}` : ""
  ].join("\n");
  const translation = item.translation;
  const english = translation
    ? [
        `Title: ${resolveXhsTranslationField(translation.title)}`,
        "",
        resolveXhsTranslationField(translation.description),
        translation.topics.length
          ? `\nTopics: ${translation.topics.map((topic) => `#${resolveXhsTranslationField(topic)}`).join(" ")}`
          : ""
      ].join("\n")
    : "";
  await copyTextToClipboard(language === "zh" ? chinese : language === "en" ? english : `${chinese}\n\n${english}`);
  message.success("内容已复制");
}

function cleanDescription(value: string) {
  return normalizeXhsText(value)
    .replace(/\[话题\]#?/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
}
function zipUrl(id: string) {
  return resolveBackendUrl(`/api/v1/tools/xhs-archive/items/${id}/download.zip`);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
onMounted(() => {
  void loadArchives();
  window.addEventListener("paste", handlePagePaste);
});
onBeforeUnmount(() => {
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
</style>
