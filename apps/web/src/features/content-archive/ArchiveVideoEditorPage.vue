<template>
  <ToolLayout>
    <section class="archive-video-editor-page">
      <ToolPageHeader
        title="归档视频编辑"
        description="调整配乐与水印，保存为当前归档的最新版本。"
        kicker="VIDEO EDITOR"
      />
      <n-alert v-if="error" type="error">{{ error }}<n-button @click="load">重试</n-button></n-alert>
      <p v-else-if="!item">正在读取归档视频…</p>
      <ArchiveAudioEditor
        v-if="item"
        ref="editor"
        :key="`${item.id}/${mediaId}/${initialPanel}`"
        :show="true"
        :item="item"
        :media-id="mediaId"
        embedded
        :initial-panel="initialPanel"
        @saved="item = $event"
        @update:show="leave"
      />
      <n-button v-if="error" @click="leave">返回内容归档</n-button>
    </section>
  </ToolLayout>
</template>
<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from "vue-router";
import { NAlert, NButton } from "naive-ui";
import type { ContentArchiveItem } from "@toolbox/shared/archive";
import ToolLayout from "../../shell/ToolLayout.vue";
import ToolPageHeader from "../../shared/ui/tool/ToolPageHeader.vue";
import ArchiveAudioEditor from "./ArchiveAudioEditor.vue";
import { contentArchiveApi } from "./content-api";
import { formatApiError, isApiErrorCancelled } from "../../shared/http/http";
const route = useRoute(),
  router = useRouter();
const mediaId = computed(() => String(route.params.mediaId));
const initialPanel = computed(() => (route.query.panel === "audio" ? "audio" : "watermark"));
const item = ref<ContentArchiveItem>(),
  error = ref(""),
  editor = ref<InstanceType<typeof ArchiveAudioEditor>>();
let controller = new AbortController(),
  generation = 0,
  closing = false;
async function load() {
  controller.abort();
  controller = new AbortController();
  const signal = controller.signal,
    version = ++generation;
  item.value = undefined;
  error.value = "";
  try {
    const value = await contentArchiveApi.detail(String(route.params.itemId), signal);
    if (signal.aborted || version !== generation) return;
    if (!value.media.some((media) => media.id === mediaId.value && ["video", "live-photo"].includes(media.kind))) {
      error.value = "该视频不存在或已从归档中删除";
      return;
    }
    item.value = value;
  } catch (e) {
    if (!signal.aborted && !isApiErrorCancelled(e)) error.value = formatApiError(e);
  }
}
async function leave() {
  closing = true;
  const returnTo = route.query.returnTo;
  try {
    await router.push(
      typeof returnTo === "string" && /^\/tools\/media-archive(?:\?|$)/.test(returnTo)
        ? returnTo
        : "/tools/media-archive"
    );
  } finally {
    closing = false;
  }
}
onBeforeRouteLeave(async () => closing || !editor.value || (await editor.value.canLeave()));
onBeforeRouteUpdate(async () => !editor.value || (await editor.value.canLeave()));
watch(
  () => [route.params.itemId, route.params.mediaId],
  () => void load(),
  { immediate: true }
);
onScopeDispose(() => controller.abort());
</script>
<style scoped>
.archive-video-editor-page {
  grid-column: 1 / -1;
  display: grid;
  min-width: 0;
  gap: 20px;
  align-content: start;
}
</style>
