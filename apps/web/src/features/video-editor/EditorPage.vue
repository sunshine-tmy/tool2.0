<template>
  <ToolLayout
    ><section class="editor-page v2-tool-page">
      <div class="project-heading" data-tour="editor-navigation">
        <n-button :disabled="syncing" @click="leave">返回草稿主页</n-button
        ><strong>{{ project?.name || "视频编辑" }}</strong
        ><n-button
          v-if="project?.link && savedRevision > (project.syncedRevision ?? 0)"
          :disabled="syncing"
          @click="sync"
          >同步归档</n-button
        ><n-button v-if="project?.link" :disabled="syncing" @click="returnArchive">返回归档</n-button>
      </div>
      <n-alert v-if="error" type="error"
        >{{ error
        }}<n-button v-if="project?.link && savedRevision" :disabled="syncing" @click="sync">重试同步归档</n-button
        ><n-button v-else @click="load">重试</n-button></n-alert
      >
      <p v-if="loading">正在读取工程…</p>
      <ArchiveAudioEditor
        v-if="item && project"
        ref="editor"
        :key="project.id"
        :show="true"
        :item="item"
        :media-id="project.mediaId"
        embedded
        :initial-panel="initialPanel"
        :draft-assets="draftAssets"
        :save-label="project.link ? '保存并同步归档' : '保存工程成品'"
        @saved="saved"
        @update:show="closeEditor"
      />
      <n-modal
        :show="syncing"
        preset="card"
        title="正在同步归档"
        style="width: min(480px, calc(100vw - 32px))"
        :closable="false"
        :mask-closable="false"
        :close-on-esc="false"
        ><p>工程成品已保存，正在更新关联归档。请稍候…</p>
        <n-progress type="line" :percentage="90" processing :show-indicator="false"
      /></n-modal></section
  ></ToolLayout>
</template>
<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from "vue-router";
import { NAlert, NButton, NModal, NProgress } from "naive-ui";
import type { ContentArchiveItem, VideoEditorProject, ArchiveVideoEdit } from "@toolbox/shared/archive";
import ToolLayout from "../../shell/ToolLayout.vue";
import ArchiveAudioEditor from "../content-archive/ArchiveAudioEditor.vue";
import { editorProjectsApi } from "./api";
import { formatApiError } from "../../shared/http/http";
const route = useRoute(),
  router = useRouter(),
  scope = new AbortController();
const draftAssets = ref<Pick<ArchiveVideoEdit, "studioSources" | "studioMusic">>({});
const project = ref<VideoEditorProject>(),
  item = ref<ContentArchiveItem>(),
  error = ref(""),
  loading = ref(false),
  syncing = ref(false),
  savedRevision = ref(0),
  editor = ref<InstanceType<typeof ArchiveAudioEditor>>();
const initialPanel = computed(() =>
  route.query.panel === "watermark" ? "watermark" : route.query.panel === "audio" ? "audio" : "cut"
);
let generation = 0,
  leaving = false;
async function load() {
  const id = String(route.params.projectId),
    version = ++generation;
  loading.value = true;
  error.value = "";
  item.value = undefined;
  try {
    const result = await editorProjectsApi.detail(id, scope.signal);
    if (version !== generation || scope.signal.aborted) return;
    project.value = result.project;
    draftAssets.value = result.draftAssets;
    item.value = result.item;
    const media = result.item.media.find((m) => m.id === result.project.mediaId);
    savedRevision.value = media?.audioEdit?.revision ?? 0;
  } catch (e) {
    if (!scope.signal.aborted && version === generation) error.value = formatApiError(e);
  } finally {
    if (version === generation) loading.value = false;
  }
}
async function saved(value: ContentArchiveItem) {
  item.value = value;
  savedRevision.value = value.media.find((m) => m.id === project.value?.mediaId)?.audioEdit?.revision ?? 0;
  if (project.value?.link) await sync();
}
async function sync() {
  if (!project.value || !savedRevision.value || syncing.value) return;
  syncing.value = true;
  error.value = "";
  try {
    project.value = await editorProjectsApi.sync(project.value.id, savedRevision.value);
  } catch (e) {
    error.value = `工程已保存，归档同步失败：${formatApiError(e)}`;
  } finally {
    syncing.value = false;
  }
}
async function navigate(path: string) {
  if (syncing.value || (editor.value && !(await editor.value.canLeave()))) return;
  leaving = true;
  try {
    await router.push(path);
  } finally {
    leaving = false;
  }
}
const leave = () => navigate("/tools/video-editor");
async function closeEditor() {
  if (syncing.value) return;
  leaving = true;
  try {
    await router.push("/tools/video-editor");
  } finally {
    leaving = false;
  }
}
const returnArchive = () => {
  const back = route.query.returnTo;
  return navigate(
    typeof back === "string" && /^\/tools\/media-archive(?:\?|$)/.test(back) ? back : "/tools/media-archive"
  );
};
onBeforeRouteLeave(async () => !syncing.value && (leaving || !editor.value || (await editor.value.canLeave())));
onBeforeRouteUpdate(
  async (to, from) =>
    to.params.projectId === from.params.projectId ||
    (!syncing.value && (!editor.value || (await editor.value.canLeave())))
);
watch(() => route.params.projectId, load, { immediate: true });
onScopeDispose(() => scope.abort());
</script>
<style scoped>
.editor-page {
  grid-column: 1/-1;
  display: grid;
  gap: 16px;
  min-width: 0;
}
.project-heading {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.project-heading strong {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
