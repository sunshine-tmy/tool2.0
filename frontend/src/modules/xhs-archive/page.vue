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

      <section class="workspace-panel fetch-panel">
        <div class="input-row">
          <n-input
            v-model:value="inputUrl"
            size="large"
            clearable
            placeholder="直接按 Ctrl+V / Command+V 粘贴小红书链接或分享文案"
            @keyup.enter="startFetch"
          />
          <n-button
            size="large"
            type="primary"
            :loading="task?.status === 'running' || task?.status === 'pending'"
            :disabled="!inputUrl.trim()"
            @click="startFetch"
            ><template #icon><Archive :size="16" /></template>获取并存档</n-button
          >
        </div>

        <div v-if="task" class="task-progress">
          <div class="task-head">
            <div class="task-status">
              <span
                class="task-status-dot"
                :class="{ failed: task.status === 'failed', completed: task.status === 'completed' }"
              />
              <div>
                <small>{{
                  task.status === "failed" ? "处理失败" : task.status === "completed" ? "处理完成" : "正在处理"
                }}</small>
                <strong>{{ task.message }}</strong>
              </div>
            </div>
            <span class="task-percentage">{{ task.progress }}%</span>
          </div>
          <n-progress
            type="line"
            :percentage="task.progress"
            :status="task.status === 'failed' ? 'error' : task.status === 'completed' ? 'success' : 'default'"
            :show-indicator="false"
            :height="8"
            :border-radius="4"
            rail-color="#e6ebf2"
          />
          <div class="stage-list">
            <div v-for="stage in stages" :key="stage.key" class="stage-step" :class="stageClass(stage.key)">
              <span class="stage-marker">
                <Check v-if="stageClass(stage.key).complete" :size="16" :stroke-width="2.6" />
                <component :is="stage.icon" v-else :size="16" />
              </span>
              <span class="stage-label">{{ stage.label }}</span>
            </div>
          </div>
          <div v-if="task.status === 'failed'" class="task-error">
            <span>{{ task.error }}</span>
            <n-button
              v-if="task.errorCode === 'XHS_AUTH_REQUIRED'"
              type="warning"
              size="small"
              :loading="authWaiting"
              @click="loginAndRetry"
              >登录小红书并重试</n-button
            >
            <n-button v-else size="small" @click="startFetch">重新尝试</n-button>
          </div>
        </div>
      </section>

      <section v-if="current" class="workspace-panel result-panel">
        <div class="result-head">
          <div>
            <n-tag :bordered="false" type="success">已存档</n-tag>
            <h3>获取结果</h3>
            <p>内容和媒体已保存到本机，可随时预览或下载。</p>
          </div>
          <div class="result-actions">
            <n-button secondary @click="copyDescription"
              ><template #icon><Copy :size="15" /></template>复制正文</n-button
            >
            <n-button secondary @click="copyCurrent('zh')">复制中文</n-button>
            <n-button secondary :disabled="!current.translation" @click="copyCurrent('en')">复制英文</n-button>
            <n-button secondary @click="copyCurrent('both')">复制中英双语</n-button>
            <n-button secondary tag="a" :href="current.canonicalUrl" target="_blank"
              ><template #icon><ExternalLink :size="15" /></template>原链接</n-button
            >
            <n-button secondary tag="a" :href="zipUrl(current.id)"
              ><template #icon><PackageOpen :size="15" /></template>下载全部 ZIP</n-button
            >
            <n-button secondary :loading="refreshing" @click="refreshItem(current.id)"
              ><template #icon><RefreshCw :size="15" /></template>重新获取</n-button
            >
            <n-button secondary @click="translateCurrent"
              ><template #icon><Languages :size="15" /></template
              >{{ current.translation?.status === "ready" ? "重新翻译" : "生成英文" }}</n-button
            >
            <n-button secondary :disabled="!current.translation" @click="editTranslation(current)">编辑英文</n-button>
            <n-button v-if="hasEdited(current)" secondary @click="resetTranslation(current)">恢复机器翻译</n-button>
          </div>
        </div>
        <div class="result-detail-layout">
          <MediaGallery :item="current" />
          <div class="drawer-meta result-meta">
            <div class="drawer-facts">
              <p>
                <span>作者</span><strong>{{ current.author?.name || "未知" }}</strong>
              </p>
              <p>
                <span>存档时间</span><strong>{{ formatDate(current.updatedAt) }}</strong>
              </p>
            </div>
            <BilingualContent :item="current" />
          </div>
        </div>
        <n-alert v-for="warning in current.warnings" :key="warning" type="warning" :bordered="false">{{
          warning
        }}</n-alert>
      </section>

      <section class="workspace-panel archive-panel">
        <div class="archive-toolbar">
          <n-input v-model:value="keyword" clearable placeholder="搜索标题、正文或作者" @keyup.enter="loadArchives"
            ><template #prefix><Search :size="16" /></template
          ></n-input>
          <n-select v-model:value="typeFilter" :options="typeOptions" style="width: 150px" />
          <n-checkbox
            class="archive-select-all"
            :checked="allCurrentArchivesSelected"
            :indeterminate="someCurrentArchivesSelected"
            :disabled="!archives.items.length"
            @update:checked="toggleSelectAllArchives"
          >
            全选
          </n-checkbox>
          <n-button secondary :loading="listLoading" @click="loadArchives">
            <template #icon><RefreshCw :size="15" /></template>刷新
          </n-button>
          <n-button type="error" secondary :disabled="!selectedArchiveIds.length" @click="removeSelected">
            删除所选 {{ selectedArchiveIds.length || "" }}
          </n-button>
          <n-button secondary @click="translateSelected"
            ><template #icon><Languages :size="15" /></template
            >{{ selectedArchiveIds.length ? `翻译所选 ${selectedArchiveIds.length} 条` : "补全未翻译内容" }}</n-button
          >
        </div>
        <n-spin :show="listLoading">
          <n-empty v-if="!archives.items.length" description="还没有内容存档，请在上方输入链接获取内容" />
          <div v-else class="archive-grid">
            <article
              v-for="archive in archives.items"
              :key="archive.id"
              class="archive-card"
              tabindex="0"
              @click="openDetail(archive.id)"
              @keyup.enter="openDetail(archive.id)"
            >
              <n-checkbox
                class="card-selector"
                :checked="selectedArchiveIds.includes(archive.id)"
                :aria-label="`选择 ${normalizeXhsText(archive.title)}`"
                @click.stop
                @update:checked="toggleArchiveSelection(archive.id, $event)"
              />
              <div class="card-cover">
                <video
                  v-if="archive.coverUrl && isVideoMedia(archive.coverKind)"
                  :src="mediaUrl(archive.coverUrl)"
                  muted
                  playsinline
                  preload="metadata"
                  @loadedmetadata="showFirstVideoFrame"
                />
                <img
                  v-else-if="archive.coverUrl"
                  :src="mediaUrl(archive.coverUrl)"
                  :alt="normalizeXhsText(archive.title)"
                  loading="lazy"
                />
                <div v-else><FileImage :size="30" /></div>
                <span class="card-type-badge" :class="`type-${archive.type}`">
                  <FileImage v-if="archive.type === 'image'" :size="13" />
                  <Play v-else-if="archive.type === 'video'" :size="13" fill="currentColor" />
                  <Sparkles v-else-if="archive.type === 'live-photo'" :size="13" />
                  <FileImage v-else :size="13" />
                  {{ typeName(archive.type) }}
                </span>
              </div>
              <div class="card-copy">
                <h3>{{ normalizeXhsText(archive.title) }}</h3>
                <p>{{ archive.author?.name || "未知作者" }}</p>
                <div>
                  <span>{{ archive.mediaCount }} 个媒体</span><span>{{ formatBytes(archive.totalBytes) }}</span
                  ><span>{{ formatDate(archive.updatedAt) }}</span>
                </div>
              </div>
            </article>
          </div>
        </n-spin>
        <n-pagination
          v-if="archives.total"
          v-model:page="page"
          :page-count="archives.pageCount"
          @update:page="loadArchives"
        />
      </section>

      <n-drawer v-model:show="drawerOpen" class="xhs-detail-drawer" :width="drawerWidth" placement="right">
        <n-drawer-content
          title="存档详情"
          closable
          body-class="xhs-detail-drawer-body"
          body-content-class="xhs-detail-drawer-body-content"
          footer-class="xhs-detail-drawer-footer"
        >
          <template v-if="detail">
            <MediaGallery :item="detail" compact />
            <div class="drawer-meta">
              <div class="drawer-facts">
                <p>
                  <span>作者</span><strong>{{ detail.author?.name || "未知" }}</strong>
                </p>
                <p>
                  <span>存档时间</span><strong>{{ formatDate(detail.updatedAt) }}</strong>
                </p>
              </div>
              <BilingualContent :item="detail" compact />
            </div>
          </template>
          <template #footer
            ><div class="drawer-actions">
              <n-button type="error" secondary @click="removeItem"
                ><template #icon><Trash2 :size="15" /></template>删除存档</n-button
              ><n-button v-if="detail" secondary @click="translateDetail"
                ><template #icon><Languages :size="15" /></template>生成英文</n-button
              ><n-button v-if="detail?.translation" secondary @click="editTranslation(detail)">编辑英文</n-button
              ><n-button v-if="detail && hasEdited(detail)" secondary @click="resetTranslation(detail)"
                >恢复机器翻译</n-button
              ><n-button v-if="detail" tag="a" :href="zipUrl(detail.id)" type="primary">下载全部 ZIP</n-button>
            </div></template
          >
        </n-drawer-content>
      </n-drawer>
      <TranslationEditModal v-model:show="editOpen" :item="editTarget" @save="saveTranslation" />
    </section>
  </ToolLayout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  NAlert,
  NButton,
  NCheckbox,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NInput,
  NPagination,
  NProgress,
  NSelect,
  NSpin,
  NTag,
  useMessage
} from "naive-ui";
import {
  Archive,
  Box,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileImage,
  FileSearch,
  HardDriveDownload,
  Languages,
  PackageOpen,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Trash2
} from "lucide-vue-next";
import {
  normalizeXhsText,
  parseXhsContentText,
  resolveXhsTranslationField,
  type XhsArchiveItem,
  type XhsArchiveListResponse,
  type XhsArchiveTask,
  type XhsArchiveTaskStage
} from "@toolbox/shared";
import ToolLayout from "../../layouts/ToolLayout.vue";
import ToolPageHeader from "../../components/tool/ToolPageHeader.vue";
import MediaGallery from "./MediaGallery.vue";
import BilingualContent from "./BilingualContent.vue";
import TranslationEditModal from "./TranslationEditModal.vue";
import { useConfirmDialog } from "../../composables/useConfirmDialog";
import { copyTextToClipboard } from "../../utils/clipboard";
import { resolveBackendUrl } from "../../config/runtime";
import { xhsArchiveApi } from "./api";

const message = useMessage();
const confirm = useConfirmDialog();
const inputUrl = ref("");
const task = ref<XhsArchiveTask>();
const current = ref<XhsArchiveItem>();
const refreshing = ref(false);
const authWaiting = ref(false);
const keyword = ref("");
const typeFilter = ref("all");
const page = ref(1);
const listLoading = ref(false);
const archives = ref<XhsArchiveListResponse>({ items: [], total: 0, page: 1, pageSize: 12, pageCount: 1 });
const selectedArchiveIds = ref<string[]>([]);
const allCurrentArchivesSelected = computed(
  () =>
    archives.value.items.length > 0 && archives.value.items.every((item) => selectedArchiveIds.value.includes(item.id))
);
const someCurrentArchivesSelected = computed(
  () =>
    !allCurrentArchivesSelected.value && archives.value.items.some((item) => selectedArchiveIds.value.includes(item.id))
);
const drawerOpen = ref(false);
const detail = ref<XhsArchiveItem>();
const editOpen = ref(false);
const editTarget = ref<XhsArchiveItem>();
const drawerWidth = computed(() => (typeof window !== "undefined" && window.innerWidth < 720 ? "100%" : 720));
let disposed = false;
const typeOptions = [
  { label: "全部类型", value: "all" },
  { label: "图文", value: "image" },
  { label: "视频", value: "video" },
  { label: "Live Photo", value: "live-photo" }
];
const stages: Array<{ key: XhsArchiveTaskStage; label: string; icon: unknown }> = [
  { key: "installing", label: "环境安装", icon: HardDriveDownload },
  { key: "parsing", label: "链接解析", icon: FileSearch },
  { key: "downloading", label: "媒体下载", icon: Download },
  { key: "archiving", label: "写入存档", icon: Box }
];
const stageOrder: XhsArchiveTaskStage[] = ["installing", "parsing", "downloading", "archiving", "completed"];

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
    await pollTask();
  } catch (error) {
    message.error(error instanceof Error ? error.message : "获取失败");
  }
}
async function pollTask() {
  while (task.value && !["completed", "failed"].includes(task.value.status)) {
    await delay(900);
    task.value = await xhsArchiveApi.task(task.value.id);
  }
  if (task.value?.status === "completed" && task.value.archiveId) {
    current.value = await xhsArchiveApi.detail(task.value.archiveId);
    if (current.value.translation?.taskId && current.value.translation.status !== "ready") {
      void pollTranslation(current.value.translation.taskId, current.value.id, true);
    }
    message.success(task.value.message);
    await loadArchives();
  }
}
async function refreshItem(id: string) {
  refreshing.value = true;
  try {
    task.value = await xhsArchiveApi.refresh(id);
    await pollTask();
  } finally {
    refreshing.value = false;
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
    message.error(error instanceof Error ? error.message : "登录失败");
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
    message.error(error instanceof Error ? error.message : "读取存档失败");
  } finally {
    listLoading.value = false;
  }
}
async function openDetail(id: string) {
  detail.value = await xhsArchiveApi.detail(id);
  drawerOpen.value = true;
  if (detail.value.translation?.taskId && detail.value.translation.status !== "ready") {
    void pollTranslation(detail.value.translation.taskId, detail.value.id, false);
  }
}
async function translateCurrent() {
  if (!current.value) return;
  try {
    const task = await xhsArchiveApi.translate(current.value.id, current.value.translation?.status === "ready");
    if (task?.id) await pollTranslation(task.id, current.value.id, true);
  } catch (error) {
    message.error(error instanceof Error ? error.message : "创建翻译任务失败");
  }
}
async function translateDetail() {
  if (!detail.value) return;
  try {
    const task = await xhsArchiveApi.translate(detail.value.id, detail.value.translation?.status === "ready");
    if (task?.id) await pollTranslation(task.id, detail.value.id, false);
  } catch (error) {
    message.error(error instanceof Error ? error.message : "创建翻译任务失败");
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
    message.error(error instanceof Error ? error.message : "恢复机器翻译失败");
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
    message.error(error instanceof Error ? error.message : "保存英文修订失败");
  }
}
async function translateSelected() {
  try {
    const task = selectedArchiveIds.value.length
      ? await xhsArchiveApi.translateBatch({ mode: "selected", itemIds: selectedArchiveIds.value })
      : await xhsArchiveApi.translateBatch({ mode: "missing-or-stale" });
    if (task?.id) await pollTranslation(task.id, undefined, false);
    await loadArchives();
  } catch (error) {
    message.error(error instanceof Error ? error.message : "创建批量翻译任务失败");
  }
}
async function pollTranslation(taskId: string, itemId?: string, updateCurrent = false) {
  try {
    let state = await xhsArchiveApi.translationTask(taskId);
    while (!disposed && !["completed", "failed"].includes(state.status)) {
      await delay(1000);
      state = await xhsArchiveApi.translationTask(taskId);
    }
    if (state.status === "failed") {
      if (itemId) {
        const updated = await xhsArchiveApi.detail(itemId).catch(() => undefined);
        if (updated) {
          if (updateCurrent && current.value?.id === itemId) current.value = updated;
          if (detail.value?.id === itemId) detail.value = updated;
        }
      }
      await loadArchives().catch(() => undefined);
      message.error(state.error || state.message);
      return;
    }
    if (itemId) {
      const updated = await xhsArchiveApi.detail(itemId);
      if (updateCurrent && current.value?.id === itemId) current.value = updated;
      if (detail.value?.id === itemId) detail.value = updated;
    }
    message.success("英文翻译已完成");
  } catch (error) {
    if (!disposed) message.error(error instanceof Error ? error.message : "读取翻译进度失败");
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
function stageClass(stage: XhsArchiveTaskStage) {
  if (!task.value) return {};
  const active = task.value.stage === stage;
  const complete =
    task.value.status === "completed" || stageOrder.indexOf(task.value.stage) > stageOrder.indexOf(stage);
  return { active, complete };
}
function mediaUrl(url: string) {
  return resolveBackendUrl(url);
}

function isVideoMedia(kind?: string) {
  return kind === "video" || kind === "live-photo";
}

function showFirstVideoFrame(event: Event) {
  const video = event.currentTarget as HTMLVideoElement;
  if (video.currentTime > 0) return;
  const target = Number.isFinite(video.duration) && video.duration > 0 ? Math.min(0.1, video.duration / 2) : 0.1;
  video.currentTime = target;
}
function zipUrl(id: string) {
  return resolveBackendUrl(`/api/tools/xhs-archive/items/${id}/download.zip`);
}
function typeName(type: string) {
  return type === "video" ? "视频" : type === "live-photo" ? "Live Photo" : "图文";
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
.fetch-panel,
.archive-panel,
.result-panel {
  padding: 22px;
}
.input-row,
.archive-toolbar,
.result-actions,
.drawer-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}
.input-row .n-input,
.archive-toolbar .n-input {
  flex: 1;
}
.task-progress {
  margin-top: 20px;
  padding: 20px 22px 18px;
  border: 1px solid #e5eaf1;
  border-radius: 16px;
  background: linear-gradient(145deg, #ffffff 0%, #f7f9fc 100%);
  box-shadow: 0 8px 24px rgba(40, 57, 86, 0.06);
}
.task-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}
.task-status {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 11px;
}
.task-status > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}
.task-status small {
  color: #8a94a6;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
}
.task-status strong {
  overflow: hidden;
  color: #263247;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-status-dot {
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border: 3px solid #dbeafe;
  border-radius: 50%;
  background: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
}
.task-status-dot.completed {
  border-color: #d1fae5;
  background: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.08);
}
.task-status-dot.failed {
  border-color: #fee2e2;
  background: #ef4444;
  box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.08);
}
.task-percentage {
  flex: 0 0 auto;
  padding: 5px 9px;
  color: #516078;
  border: 1px solid #e1e7ef;
  border-radius: 999px;
  background: #fff;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}
.task-progress :deep(.n-progress-graph-line-fill) {
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.24);
}
.stage-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(90px, 1fr));
  margin-top: 18px;
  overflow-x: auto;
  padding: 2px 2px 4px;
}
.stage-step {
  position: relative;
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #8a94a6;
  font-size: 12px;
  text-align: center;
}
.stage-step:not(:last-child)::after {
  position: absolute;
  z-index: 0;
  top: 16px;
  left: calc(50% + 20px);
  width: calc(100% - 40px);
  height: 2px;
  border-radius: 999px;
  background: #dfe5ed;
  content: "";
}
.stage-marker {
  position: relative;
  z-index: 1;
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 2px solid #dfe5ed;
  border-radius: 50%;
  background: #fff;
  transition: 0.2s ease;
}
.stage-label {
  white-space: nowrap;
}
.stage-step.active {
  color: #2563eb;
  font-weight: 600;
}
.stage-step.active .stage-marker {
  color: #fff;
  border-color: #2563eb;
  background: #2563eb;
  box-shadow: 0 0 0 5px rgba(37, 99, 235, 0.1);
}
.stage-step.complete {
  color: #0f9f7f;
}
.stage-step.complete .stage-marker {
  color: #fff;
  border-color: #10b981;
  background: #10b981;
}
.stage-step.complete:not(:last-child)::after {
  background: #6ee7c1;
}
.task-error {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-top: 14px;
  color: #d03050;
}
.result-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 18px;
}
.result-head h3 {
  margin: 8px 0 4px;
  font-size: 22px;
}
.result-head p {
  margin: 0;
  color: #758096;
}
.result-detail-layout {
  display: grid;
  grid-template-columns: minmax(420px, 560px) minmax(320px, 1fr);
  align-items: start;
  gap: 32px;
}
.result-meta {
  margin-top: 0;
  padding: 20px;
  border: 1px solid #e6ebf2;
  border-radius: 14px;
  background: #fbfcfe;
}
.full-copy {
  white-space: pre-wrap;
  line-height: 1.8;
  color: #3f495a;
}
.topic-text {
  color: #2563eb;
  font-weight: 600;
}
.archive-toolbar {
  margin-bottom: 20px;
}
.archive-select-all {
  flex: 0 0 auto;
  padding: 8px 10px;
  border: 1px solid #e3e8ef;
  border-radius: 8px;
  background: #f8fafc;
}
.archive-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  align-items: start;
  gap: 16px;
}
.archive-card {
  position: relative;
  align-self: start;
  border: 1px solid #e6eaf0;
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
  cursor: pointer;
  transition: 0.18s ease;
}
.card-selector {
  position: absolute;
  z-index: 2;
  top: 10px;
  left: 10px;
  border-radius: 7px;
  padding: 5px;
  background: rgba(255, 255, 255, 0.92);
}
.archive-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(34, 55, 90, 0.1);
}
.card-cover {
  position: relative;
  width: 100%;
  max-height: 460px;
  aspect-ratio: 3/4;
  overflow: hidden;
  background: #eef2f7;
  display: grid;
  place-items: center;
}
.card-cover img,
.card-cover video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.card-cover video {
  pointer-events: none;
}
.card-type-badge {
  position: absolute;
  z-index: 2;
  top: 10px;
  right: 10px;
  display: inline-flex;
  height: 27px;
  align-items: center;
  gap: 5px;
  padding: 0 10px;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 999px;
  background: rgba(51, 65, 85, 0.9);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.24);
  backdrop-filter: blur(8px);
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
}
.card-type-badge.type-image {
  background: linear-gradient(135deg, rgba(13, 148, 136, 0.96), rgba(15, 118, 110, 0.96));
}
.card-type-badge.type-video {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.96), rgba(190, 24, 93, 0.96));
}
.card-type-badge.type-live-photo {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.96), rgba(37, 99, 235, 0.96));
}
.card-copy {
  padding: 14px;
}
.card-copy h3 {
  margin: 0 0 8px;
  font-size: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-copy p {
  margin: 0 0 12px;
  color: #687386;
}
.card-copy div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: #8a94a6;
}
.archive-panel .n-pagination {
  margin-top: 20px;
  justify-content: center;
}
.drawer-meta {
  display: grid;
  gap: 18px;
  margin-top: 20px;
}
.drawer-copy-section {
  display: grid;
  gap: 8px;
}
.drawer-field-label {
  width: fit-content;
  padding: 3px 8px;
  color: #2563eb;
  border-radius: 6px;
  background: #eff6ff;
  font-size: 12px;
  font-weight: 700;
}
.drawer-title {
  margin: 0;
  color: #172033;
  font-size: 19px;
  font-weight: 750;
  line-height: 1.45;
}
.drawer-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 13px 14px;
  border: 1px solid #e7ebf1;
  border-radius: 10px;
  background: #f8fafc;
}
.drawer-facts p {
  display: grid;
  gap: 3px;
  margin: 0;
}
.drawer-facts span {
  color: #8a94a6;
  font-size: 11px;
}
.drawer-facts strong {
  overflow: hidden;
  color: #3f495a;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.drawer-description {
  margin: 0;
}
.drawer-actions {
  min-width: 0;
  width: 100%;
  flex-wrap: wrap;
  justify-content: flex-start;
}
.drawer-actions > :last-child {
  margin-left: auto;
}
:global(.xhs-detail-drawer),
:global(.xhs-detail-drawer .n-drawer-content),
:global(.xhs-detail-drawer-body),
:global(.xhs-detail-drawer-body-content),
:global(.xhs-detail-drawer-footer) {
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}
:global(.xhs-detail-drawer-body) {
  overflow-y: auto !important;
  overflow-x: hidden !important;
  scrollbar-width: none;
}
:global(.xhs-detail-drawer-body::-webkit-scrollbar) {
  display: none;
  width: 0;
  height: 0;
}
@media (max-width: 900px) {
  .archive-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .result-head {
    flex-direction: column;
  }
  .result-actions {
    flex-wrap: wrap;
  }
}
@media (max-width: 1100px) {
  .result-detail-layout {
    grid-template-columns: 1fr;
  }
  .result-meta {
    width: min(100%, 720px);
    box-sizing: border-box;
    margin: 0 auto;
  }
}
@media (max-width: 640px) {
  .input-row,
  .archive-toolbar {
    flex-wrap: wrap;
  }
  .input-row .n-input,
  .archive-toolbar .n-input {
    flex-basis: 100%;
  }
  .archive-grid {
    grid-template-columns: 1fr;
  }
  .stage-list {
    grid-template-columns: repeat(4, minmax(88px, 1fr));
  }
  .fetch-panel,
  .archive-panel,
  .result-panel {
    padding: 16px;
  }
}
</style>
