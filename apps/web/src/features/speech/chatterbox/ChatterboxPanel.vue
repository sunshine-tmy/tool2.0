<!-- 中文模块说明：配音前端模块，负责 Edge-TTS 与 Chatterbox 的编辑、任务和音色交互 -->
<template>
  <div class="chatterbox-panel">
    <ChatterboxEditorForm />
    <DiagnosticErrorLink
      v-if="panel.health && !panel.health.available"
      error="参考音色克隆服务不可用"
      module="edge-tts"
    />
    <ChatterboxCurrentBatch />
    <ChatterboxBatchHistory />
    <ChatterboxBatchDetail />
  </div>
</template>

<script setup lang="ts">
import { provide, reactive, watch } from "vue";
import DiagnosticErrorLink from "../../../shared/ui/DiagnosticErrorLink.vue";
import ChatterboxBatchDetail from "./ChatterboxBatchDetail.vue";
import ChatterboxBatchHistory from "./ChatterboxBatchHistory.vue";
import ChatterboxCurrentBatch from "./ChatterboxCurrentBatch.vue";
import ChatterboxEditorForm from "./ChatterboxEditorForm.vue";
import { chatterboxPanelKey } from "./chatterbox-panel-context";
import { useChatterboxPanel } from "./useChatterboxPanel";

const panel = reactive(useChatterboxPanel());
provide(chatterboxPanelKey, panel);
const emit = defineEmits<{
  notice: [value: { label: string; type: "info" | "error" | "success"; message?: string }];
}>();
watch(
  () => [panel.health, panel.healthLabel] as const,
  ([health, label]) =>
    emit("notice", {
      label,
      type: !health ? "info" : !health.available ? "error" : health.modelLoaded ? "success" : "info",
      message: health?.message
    }),
  { immediate: true }
);
</script>

<style src="./ChatterboxPanel.css"></style>
