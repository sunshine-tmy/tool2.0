<template>
  <ToolLayout
    ><section class="editor-handoff">
      <n-alert v-if="error" type="error">{{ error }}<n-button @click="load">重试</n-button></n-alert>
      <p v-else>正在打开视频编辑工程…</p>
      <n-button @click="router.push('/tools/media-archive')">返回归档</n-button>
    </section></ToolLayout
  >
</template>
<script setup lang="ts">
import { onScopeDispose, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { NAlert, NButton } from "naive-ui";
import ToolLayout from "../../shell/ToolLayout.vue";
import { editorProjectsApi } from "../video-editor/api";
import { formatApiError } from "../../shared/http/http";
const route = useRoute(),
  router = useRouter(),
  scope = new AbortController(),
  error = ref("");
let generation = 0;
async function load() {
  const version = ++generation;
  error.value = "";
  try {
    const project = await editorProjectsApi.create(
      String(route.params.itemId),
      String(route.params.mediaId),
      scope.signal
    );
    if (!scope.signal.aborted && version === generation)
      await router.replace({ path: `/tools/video-editor/projects/${project.id}`, query: route.query });
  } catch (e) {
    if (!scope.signal.aborted && version === generation) error.value = formatApiError(e);
  }
}
watch(() => [route.params.itemId, route.params.mediaId], load, { immediate: true });
onScopeDispose(() => scope.abort());
</script>
<style scoped>
.editor-handoff {
  grid-column: 1/-1;
  display: grid;
  gap: 16px;
}
</style>
