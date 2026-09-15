<!-- 中文模块说明：配音前端模块，负责 Edge-TTS 与 Chatterbox 的编辑、任务和音色交互 -->
<template>
  <div class="chatterbox-panel">
    <div class="chatterbox-notice">
      <ShieldCheck :size="19" />
      <div>
        <strong>仅克隆你本人或已获得明确授权的声音</strong>
        <span>一个批次只需上传一次参考音色，可生成独立 MP3、按顺序拼接的总音频及多种字幕。</span>
      </div>
      <n-tag :type="panel.health?.available ? 'success' : 'error'" round>{{ panel.healthLabel }}</n-tag>
    </div>

    <ChatterboxEditorForm />
    <ChatterboxCurrentBatch />
    <ChatterboxBatchHistory />
    <ChatterboxBatchDetail />
  </div>
</template>

<script setup lang="ts">
import { provide, reactive } from "vue";
import { NTag } from "naive-ui";
import { ShieldCheck } from "lucide-vue-next";
import ChatterboxBatchDetail from "./ChatterboxBatchDetail.vue";
import ChatterboxBatchHistory from "./ChatterboxBatchHistory.vue";
import ChatterboxCurrentBatch from "./ChatterboxCurrentBatch.vue";
import ChatterboxEditorForm from "./ChatterboxEditorForm.vue";
import { chatterboxPanelKey } from "./chatterbox-panel-context";
import { useChatterboxPanel } from "./useChatterboxPanel";

const panel = reactive(useChatterboxPanel());
provide(chatterboxPanelKey, panel);
</script>

<style src="./ChatterboxPanel.css"></style>
