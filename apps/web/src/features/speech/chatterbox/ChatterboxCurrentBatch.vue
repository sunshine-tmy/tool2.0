<!-- 中文模块说明：配音前端模块，负责 Edge-TTS 与 Chatterbox 的编辑、任务和音色交互 -->
<template>
  <section v-if="panel.currentBatch" class="edge-tts-result" :class="`status-${panel.currentBatch.status}`">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">LATEST BATCH</p>
        <h3>{{ panel.batchTitle(panel.currentBatch) }}</h3>
        <p>
          {{ panel.batchStatusLabel(panel.currentBatch.status) }} · {{ panel.currentBatch.completedItems }}/{{
            panel.currentBatch.items.length
          }}
          完成 · 累计音频 {{ formatAudioDuration(panel.currentBatch.totalAudioDurationSeconds) }}
        </p>
        <p v-if="panel.isCurrentRunning" class="chatterbox-live-progress" aria-live="polite">
          {{ progressPercent }}% · {{ currentPhase }}
        </p>
      </div>
      <span
        class="chatterbox-batch-status-badge"
        :class="`chatterbox-batch-status-badge--${panel.batchTagType(panel.currentBatch.status)}`"
        >{{ panel.batchStatusLabel(panel.currentBatch.status) }}</span
      >
    </div>
    <div
      v-if="panel.isCurrentRunning"
      class="edge-tts-progress"
      role="progressbar"
      aria-label="声音克隆批次进度"
      :aria-valuenow="progressPercent"
      :aria-valuemin="0"
      :aria-valuemax="100"
    >
      <span :style="{ width: `${progressPercent}%` }" />
    </div>
    <div class="edge-tts-result-actions">
      <SaveToAudioLibrary
        toolbar
        :batch-id="panel.currentBatch.id"
        :items="panel.currentBatch.items"
        label="全部加入音频库"
      />
      <n-button size="small" @click="panel.openBatch(panel.currentBatch.id)"
        ><template #icon><ListTree :size="15" /></template>查看详情</n-button
      >
      <SpeechBatchDownloads toolbar :batch="panel.currentBatch" />
      <n-button v-if="panel.isCurrentRunning" size="small" @click="panel.cancelBatch(panel.currentBatch.id)"
        >取消剩余</n-button
      >
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NButton } from "naive-ui";
import { ListTree } from "lucide-vue-next";
import { useChatterboxPanelContext } from "./chatterbox-panel-context";
import { SaveToAudioLibrary } from "../../audio-library/integrations/speech";
import SpeechBatchDownloads from "../shared/SpeechBatchDownloads.vue";
import { formatAudioDuration } from "../shared/speech-batch-display";

const panel = useChatterboxPanelContext();
const progressPercent = computed(() => Math.min(100, Math.max(0, Math.round(panel.currentBatch?.progress || 0))));
const currentPhase = computed(() => {
  const batch = panel.currentBatch;
  if (!batch) return "";
  const index = batch.items.findIndex((item) => item.status === "processing");
  if (index >= 0) {
    const progress = batch.items[index].progress;
    return progress >= 99
      ? "正在整理总音频与字幕"
      : progress >= 82
        ? `正在处理第 ${index + 1} 段音频`
        : `正在生成第 ${index + 1} 段`;
  }
  const queued = batch.items.findIndex((item) => item.status === "queued");
  return queued >= 0 ? `等待处理第 ${queued + 1} 段` : "正在整理总音频与字幕";
});
</script>
