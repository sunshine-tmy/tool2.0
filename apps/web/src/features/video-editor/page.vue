<template>
  <ToolLayout
    ><section class="editor-home v2-tool-page" data-tour="editor-home">
      <ToolPageHeader title="视频编辑" description="创建视频作品，或继续编辑本地草稿。" />
      <n-alert v-if="error" type="error" closable @close="error = ''">{{ error }}</n-alert>
      <section class="creation-banner" data-tour="editor-create" aria-labelledby="creation-title">
        <div class="creation-copy">
          <div class="creation-title">
            <span class="creation-icon"><Clapperboard :size="24" aria-hidden="true" /></span>
            <h2 id="creation-title">开始创作</h2>
          </div>
          <p>导入本地视频，或选择归档素材，继续你的创作。</p>
          <div class="creation-actions">
            <n-button type="primary" :disabled="busy" @click="fileInput?.click()"
              ><template #icon><Upload :size="18" /></template>导入本地视频</n-button
            >
            <n-button :disabled="busy" @click="picker = true"
              ><template #icon><FolderOpen :size="18" /></template>选择归档视频</n-button
            >
          </div>
        </div>
        <div class="creation-art" aria-hidden="true">
          <div class="art-orbit"></div>
          <div class="art-frame art-frame-back"><Film :size="32" /></div>
          <div class="art-editor">
            <div class="art-editor-top"><i></i><i></i><i></i></div>
            <div class="art-screen">
              <span class="art-mountain"></span><span class="art-play"><Play :size="22" fill="currentColor" /></span>
            </div>
            <div class="art-timeline"><span></span><span></span><span></span><b></b></div>
          </div>
          <span class="art-tool art-scissors"><Scissors :size="22" /></span
          ><span class="art-tool art-music"><Music2 :size="21" /></span>
        </div>
        <input
          ref="fileInput"
          hidden
          type="file"
          accept="video/mp4,video/webm,video/quicktime,.mp4,.mov,.webm"
          @change="upload"
        />
      </section>
      <section class="draft-panel" data-tour="editor-drafts" aria-labelledby="draft-title">
        <div class="draft-heading">
          <h2 id="draft-title">本地草稿</h2>
          <div class="draft-tools" data-tour="editor-draft-search">
            <n-input v-model:value="keyword" placeholder="搜索草稿名称" clearable aria-label="搜索草稿"
              ><template #prefix><Search :size="16" aria-hidden="true" /></template
            ></n-input>
            <n-button
              :type="listView ? 'default' : 'primary'"
              :aria-pressed="!listView"
              aria-label="网格视图"
              title="网格视图"
              @click="listView = false"
              ><LayoutGrid :size="17"
            /></n-button>
            <n-button
              :type="listView ? 'primary' : 'default'"
              :aria-pressed="listView"
              aria-label="列表视图"
              title="列表视图"
              @click="listView = true"
              ><List :size="17"
            /></n-button>
            <n-button :disabled="busy || loading" :loading="loading" @click="load"
              ><template #icon><RefreshCw :size="16" /></template>刷新</n-button
            >
          </div>
        </div>
        <n-spin :show="loading"
          ><n-empty
            v-if="!loading && !filtered.length"
            :description="keyword ? '没有匹配的草稿' : '暂无草稿，开始创作你的第一个视频'" />
          <div class="drafts" :class="{ 'list-view': listView }">
            <article v-for="project in pagedProjects" :key="project.id" class="draft-card">
              <button class="draft-open" :disabled="busy" @click="open(project)">
                <div class="cover">
                  <ArchiveVideoCover
                    v-if="project.previewUrl"
                    :url="resolveBackendUrl(project.previewUrl)"
                    :title="project.name"
                  /><span v-if="project.link" class="linked">关联归档</span
                  ><span class="duration">{{ duration(project.durationMs) }}</span>
                </div>
                <div class="draft-description">
                  <strong :title="project.name">{{ project.name }}</strong
                  ><span>{{ new Date(project.updatedAt).toLocaleString("zh-CN") }}</span
                  ><span>{{ bytes(project.bytes) }}</span>
                </div>
              </button>
              <div class="draft-actions">
                <n-button size="small" quaternary :disabled="busy" @click="showRename(project)"
                  ><template #icon><PencilLine :size="15" /></template>重命名</n-button
                >
                <n-button size="small" quaternary :disabled="busy" @click="copy(project)"
                  ><template #icon><Copy :size="15" /></template>复制</n-button
                >
                <n-button
                  size="small"
                  type="error"
                  quaternary
                  class="draft-delete"
                  title="删除草稿"
                  :aria-label="`删除草稿：${project.name}`"
                  :disabled="busy"
                  @click="remove(project)"
                  ><template #icon><Trash2 :size="15" /></template
                ></n-button>
              </div>
            </article></div
        ></n-spin>
        <footer class="draft-pagination">
          <span role="status">{{
            keyword.trim() ? `找到 ${filtered.length} 条草稿` : `共 ${filtered.length} 条草稿`
          }}</span>
          <n-pagination
            v-if="filtered.length"
            v-model:page="page"
            v-model:page-size="pageSize"
            :item-count="filtered.length"
            :page-sizes="pageSizes"
            :page-slot="5"
            show-size-picker
            :disabled="busy"
            aria-label="草稿分页"
          />
        </footer>
      </section>
      <ArchiveSourcePicker v-model:show="picker" :imported="[]" @select="fromArchive" />
      <n-modal
        :show="!!renaming"
        preset="card"
        title="重命名草稿"
        class="rename-dialog"
        style="width: min(480px, calc(100vw - 32px))"
        :closable="!busy"
        :mask-closable="!busy"
        :close-on-esc="!busy"
        @after-enter="focusRename"
        @update:show="!busy && (renaming = undefined)"
      >
        <div class="rename-form">
          <label for="draft-rename-input">草稿名称</label
          ><n-input
            ref="renameInput"
            v-model:value="renameValue"
            :input-props="{ id: 'draft-rename-input', 'aria-describedby': 'rename-hint' }"
            :maxlength="500"
            :disabled="busy"
            :status="renameError ? 'error' : undefined"
            placeholder="请输入草稿名称"
            @keyup.enter="rename"
          />
          <div id="rename-hint" class="rename-hint">
            <span>仅修改草稿名称，原视频文件名保持不变。</span><span>{{ renameValue.length }}/500</span>
          </div>
          <n-alert v-if="renameError" type="error">{{ renameError }}</n-alert>
        </div>
        <template #footer
          ><div class="rename-footer">
            <n-button :disabled="busy" @click="renaming = undefined">取消</n-button
            ><n-button type="primary" :loading="savingRename" :disabled="busy || !renameValue.trim()" @click="rename"
              >保存</n-button
            >
          </div></template
        >
      </n-modal>
      <n-modal
        :show="busy && !savingRename"
        preset="card"
        title="正在处理"
        style="width: min(480px, calc(100vw - 32px))"
        :closable="false"
        :mask-closable="false"
        :close-on-esc="false"
        ><p>{{ busyLabel }}</p>
        <n-progress type="line" :percentage="progress" :processing="true" :show-indicator="progress > 0"
      /></n-modal></section
  ></ToolLayout>
</template>
<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { NAlert, NButton, NInput, NSpin, NEmpty, NModal, NProgress, NPagination, type InputInst } from "naive-ui";
import {
  Upload,
  FolderOpen,
  LayoutGrid,
  List,
  Search,
  RefreshCw,
  PencilLine,
  Copy,
  Trash2,
  Clapperboard,
  Film,
  Play,
  Scissors,
  Music2
} from "lucide-vue-next";
import type { VideoEditorProject, ArchiveStudioSource } from "@toolbox/shared/archive";
import ToolLayout from "../../shell/ToolLayout.vue";
import ToolPageHeader from "../../shared/ui/tool/ToolPageHeader.vue";
import ArchiveSourcePicker from "../content-archive/ArchiveSourcePicker.vue";
import ArchiveVideoCover from "../content-archive/ArchiveVideoCover.vue";
import { editorProjectsApi } from "./api";
import { resolveBackendUrl } from "../../shared/config/runtime";
import { formatApiError } from "../../shared/http/http";
import { useConfirmDialog } from "../../shared/composables/useConfirmDialog";
const router = useRouter(),
  confirm = useConfirmDialog(),
  scope = new AbortController();
const projects = ref<VideoEditorProject[]>([]),
  keyword = ref(""),
  listView = ref(false),
  picker = ref(false),
  loading = ref(false),
  busy = ref(false),
  busyLabel = ref(""),
  error = ref(""),
  progress = ref(0),
  fileInput = ref<HTMLInputElement>(),
  renaming = ref<VideoEditorProject>(),
  renameValue = ref(""),
  renameInput = ref<InputInst>(),
  renameError = ref(""),
  savingRename = ref(false),
  page = ref(1),
  pageSize = ref(12);
const pageSizes = [12, 24, 48].map((value) => ({ label: `${value} 条/页`, value }));
const filtered = computed(() =>
  projects.value.filter((p) => p.name.toLocaleLowerCase().includes(keyword.value.trim().toLocaleLowerCase()))
);
const pagedProjects = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value)
);
watch([keyword, pageSize], () => {
  page.value = 1;
});
watch(
  () => filtered.value.length,
  (count) => {
    page.value = Math.min(page.value, Math.max(1, Math.ceil(count / pageSize.value)));
  }
);
function showRename(project: VideoEditorProject) {
  if (busy.value) return;
  renaming.value = project;
  renameValue.value = project.name;
  renameError.value = "";
}
function focusRename() {
  renameInput.value?.focus();
}
const duration = (ms?: number) => {
  const seconds = Math.floor((ms ?? 0) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
const bytes = (value?: number) => (value ? `${(value / 1024 / 1024).toFixed(1)} MB` : "");
const open = (project: VideoEditorProject) => router.push(`/tools/video-editor/projects/${project.id}`);
async function load() {
  loading.value = true;
  try {
    projects.value = await editorProjectsApi.list(scope.signal);
  } catch (e) {
    if (!scope.signal.aborted) error.value = formatApiError(e);
  } finally {
    loading.value = false;
  }
}
async function action(label: string, run: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  busyLabel.value = label;
  progress.value = 0;
  error.value = "";
  try {
    await run();
  } catch (e) {
    if (!scope.signal.aborted) error.value = formatApiError(e);
  } finally {
    busy.value = false;
    busyLabel.value = "";
  }
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  input.value = "";
  if (!file) return;
  await action("正在导入视频并创建工程…", async () => {
    const result = await editorProjectsApi.upload(file, scope.signal, (value) => (progress.value = value));
    const video = result.item.media.find((m) => ["video", "live-photo"].includes(m.kind));
    if (!video) throw new Error("视频导入失败");
    const project = await editorProjectsApi.create(result.item.id, video.id, scope.signal);
    await open(result.duplicate ? await editorProjectsApi.copy(project.id) : project);
  });
}
async function fromArchive(source: ArchiveStudioSource) {
  picker.value = false;
  await action("正在复制素材并创建工程…", async () => {
    await open(await editorProjectsApi.create(source.itemId, source.mediaId, scope.signal));
  });
}
async function rename() {
  if (busy.value || !renaming.value || !renameValue.value.trim()) return;
  const id = renaming.value.id;
  busy.value = true;
  savingRename.value = true;
  renameError.value = "";
  try {
    const updated = await editorProjectsApi.rename(id, renameValue.value.trim());
    projects.value = projects.value
      .map((project) => (project.id === id ? { ...project, ...updated } : project))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    renaming.value = undefined;
  } catch (e) {
    if (!scope.signal.aborted) renameError.value = formatApiError(e);
  } finally {
    busy.value = false;
    savingRename.value = false;
  }
}
async function copy(project: VideoEditorProject) {
  await action("正在复制工程和素材…", async () => {
    await editorProjectsApi.copy(project.id);
    await load();
  });
}
async function remove(project: VideoEditorProject) {
  if (
    !(await confirm(`删除「${project.name}」及其独立工程素材？原片归档和其他工程不会被删除。`, {
      title: "删除草稿",
      positiveText: "删除",
      negativeText: "取消"
    }))
  )
    return;
  await action("正在删除草稿…", async () => {
    await editorProjectsApi.remove(project.id);
    await load();
  });
}
onMounted(load);
onScopeDispose(() => scope.abort());
</script>
<style scoped>
.editor-home {
  display: grid;
  gap: 24px;
  min-width: 0;
  grid-column: 1/-1;
  container-type: inline-size;
}
.creation-banner {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  align-items: center;
  gap: 32px;
  min-height: 192px;
  padding: 28px 36px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: linear-gradient(110deg, var(--color-surface, #fff) 15%, var(--color-primary-50, #f5f3ff) 100%);
  overflow: hidden;
}
.creation-copy {
  position: relative;
  z-index: 1;
  min-width: 0;
}
.creation-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.creation-title h2 {
  margin: 0;
  font-size: 22px;
  line-height: 32px;
}
.creation-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border: 1px solid var(--color-primary-100);
  border-radius: 12px;
  color: var(--color-primary-600);
  background: var(--color-primary-50);
}
.creation-copy > p {
  margin: 10px 0 20px;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.7;
}
.creation-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.creation-actions :deep(.n-button) {
  height: 44px;
  padding-inline: 18px;
}
.creation-art {
  position: relative;
  width: 300px;
  height: 160px;
  justify-self: center;
  pointer-events: none;
}
.art-orbit {
  position: absolute;
  inset: 0 5px;
  border: 1px solid var(--color-primary-100);
  border-radius: 50%;
  background: radial-gradient(ellipse, var(--color-primary-100), transparent 70%);
  transform: rotate(-16deg);
}
.art-frame {
  position: absolute;
  display: grid;
  place-items: center;
  width: 82px;
  height: 98px;
  border: 1px solid var(--color-primary-200);
  border-radius: 12px;
  color: var(--color-primary-400);
  background: var(--color-surface, #fff);
}
.art-frame-back {
  top: 15px;
  right: 14px;
  transform: rotate(12deg);
}
.art-editor {
  position: absolute;
  top: 10px;
  left: 36px;
  width: 202px;
  padding: 10px;
  border: 1px solid var(--color-primary-200);
  border-radius: 13px;
  background: var(--color-surface, #fff);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--color-primary-600) 12%, transparent);
  transform: rotate(-5deg);
}
.art-editor-top {
  display: flex;
  gap: 4px;
  padding-bottom: 8px;
}
.art-editor-top i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-primary-200);
}
.art-screen {
  position: relative;
  display: grid;
  place-items: center;
  height: 72px;
  border-radius: 7px;
  background: linear-gradient(125deg, var(--color-primary-100), var(--color-primary-200));
  overflow: hidden;
}
.art-mountain {
  position: absolute;
  width: 110px;
  height: 65px;
  left: 16px;
  bottom: -32px;
  background: var(--color-primary-300);
  transform: rotate(24deg);
  border-radius: 12px;
}
.art-play {
  position: relative;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: var(--color-primary-600);
  background: var(--color-surface, #fff);
}
.art-play svg {
  margin-left: 2px;
}
.art-timeline {
  position: relative;
  display: flex;
  gap: 4px;
  margin-top: 10px;
  padding-block: 3px;
}
.art-timeline span {
  height: 14px;
  border-radius: 3px;
  flex: 1;
  background: var(--color-primary-200);
}
.art-timeline span:nth-child(2) {
  flex: 1.6;
  background: var(--color-primary-400);
}
.art-timeline b {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 44%;
  width: 2px;
  background: var(--color-primary-700);
}
.art-tool {
  position: absolute;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border: 1px solid var(--color-primary-100);
  border-radius: 12px;
  color: var(--color-primary-600);
  background: var(--color-surface, #fff);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary-600) 8%, transparent);
}
.art-scissors {
  left: 5px;
  top: 68px;
  transform: rotate(-9deg);
}
.art-music {
  right: 16px;
  bottom: 2px;
  transform: rotate(8deg);
}
.draft-panel {
  display: grid;
  gap: 20px;
  min-width: 0;
  padding: 24px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-surface, #fff);
}
.draft-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--color-border);
}
.draft-heading h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 18px;
  line-height: 28px;
}
.draft-tools {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.draft-tools .n-input {
  width: 240px;
}
.draft-tools :deep(.n-button) {
  height: 40px;
}
.drafts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 228px), 1fr));
  gap: 16px;
  min-width: 0;
}
.draft-panel :deep(.n-empty) {
  padding: 44px 16px;
}
.draft-card {
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  min-width: 0;
  background: var(--color-surface, #fff);
  transition:
    border-color 150ms,
    box-shadow 150ms;
}
.draft-card:focus-within {
  border-color: var(--color-primary-400);
}
.draft-open {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.draft-open:disabled {
  cursor: default;
}
.cover {
  position: relative;
  aspect-ratio: 16/10;
  overflow: hidden;
  border-radius: 8px;
  background: #17262e;
}
.cover :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.linked,
.duration {
  position: absolute;
  background: #17262ed9;
  color: white;
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 12px;
  line-height: 18px;
}
.linked {
  left: 6px;
  top: 6px;
}
.duration {
  right: 6px;
  bottom: 6px;
  font-variant-numeric: tabular-nums;
}
.draft-description {
  display: grid;
  gap: 6px;
  margin-top: 12px;
  min-width: 0;
}
.draft-description strong {
  font-size: 14px;
  line-height: 22px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.draft-description span {
  font-size: 12px;
  line-height: 18px;
  color: var(--color-text-secondary);
}
.draft-actions {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) 32px;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border);
}
.draft-actions :deep(.n-button) {
  height: 32px;
  width: 100%;
  min-width: 0;
  padding-inline: 4px;
  font-size: 12px;
}
.draft-actions :deep(.n-button__icon) {
  margin-right: 4px;
}
.draft-delete :deep(.n-button__icon) {
  margin: 0;
}
.list-view {
  grid-template-columns: 1fr;
}
.list-view .draft-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.list-view .draft-open {
  display: flex;
  gap: 16px;
  align-items: center;
  min-width: 0;
}
.list-view .draft-description {
  margin-top: 0;
}
.list-view .cover {
  width: 136px;
  flex-shrink: 0;
}
.list-view .draft-actions {
  margin: 0;
  padding: 0;
  border: 0;
  flex-shrink: 0;
  width: 212px;
}
.draft-open:focus-visible {
  outline: 2px solid var(--color-primary-600);
  outline-offset: 3px;
  border-radius: 8px;
}
.draft-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding-top: 20px;
  border-top: 1px solid var(--color-border);
  min-width: 0;
}
.draft-pagination > span {
  color: var(--color-text-secondary);
  font-size: 13px;
}
.draft-pagination :deep(.n-pagination) {
  flex-wrap: wrap;
  gap: 8px;
}
.rename-form {
  display: grid;
  gap: 10px;
}
.rename-form label {
  font-size: 14px;
  font-weight: 500;
}
.rename-hint {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 20px;
}
.rename-hint > span:last-child {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
.rename-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
.rename-footer :deep(.n-button) {
  height: 40px;
  min-width: 80px;
}
@media (hover: hover) {
  .draft-card:hover {
    border-color: var(--color-primary-200);
    box-shadow: 0 3px 12px color-mix(in srgb, var(--color-primary-600) 5%, transparent);
  }
}
@container (max-width:720px) {
  .creation-banner {
    grid-template-columns: 1fr;
    padding: 24px;
    min-height: 0;
  }
  .creation-art {
    display: none;
  }
  .draft-tools {
    width: 100%;
  }
  .draft-tools .n-input {
    flex: 1;
    min-width: 180px;
  }
  .draft-panel {
    padding: 20px;
  }
}
@media (max-width: 600px) {
  .editor-home {
    gap: 16px;
  }
  .creation-banner {
    grid-template-columns: 1fr;
    padding: 20px;
  }
  .creation-art {
    display: none;
  }
  .draft-panel {
    padding: 16px;
  }
  .draft-tools .n-input {
    flex: 0 0 100%;
    width: 100%;
  }
  .list-view .draft-card {
    display: block;
  }
  .list-view .draft-actions {
    width: 100%;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--color-border);
  }
  .list-view .cover {
    width: 100px;
  }
  .creation-actions :deep(.n-button) {
    flex: 1;
  }
  .draft-pagination {
    align-items: flex-start;
    flex-direction: column;
  }
}
@media (pointer: coarse) {
  .draft-tools :deep(.n-button),
  .draft-actions :deep(.n-button),
  .rename-footer :deep(.n-button) {
    min-height: 44px;
  }
  .draft-actions {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) 44px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .draft-card {
    transition: none;
  }
}
</style>
