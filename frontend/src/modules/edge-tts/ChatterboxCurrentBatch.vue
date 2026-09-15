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
          完成 · {{ panel.formatDuration(panel.currentBatch.totalAudioDurationSeconds) }}
        </p>
      </div>
      <n-tag :type="panel.batchTagType(panel.currentBatch.status)">{{
        panel.batchStatusLabel(panel.currentBatch.status)
      }}</n-tag>
    </div>
    <div v-if="panel.isCurrentRunning" class="edge-tts-progress">
      <span :style="{ width: `${Math.max(4, panel.currentBatch.progress)}%` }" />
    </div>
    <div class="edge-tts-result-actions">
      <n-button secondary @click="panel.openBatch(panel.currentBatch.id)"><ListTree :size="17" />查看详情</n-button>
      <a
        v-if="panel.currentBatch.archiveUrl"
        class="download-button primary"
        :href="panel.mediaUrl(panel.currentBatch.archiveUrl)"
      >
        <Archive :size="17" />下载全部 ZIP
      </a>
      <a
        v-if="panel.currentBatch.combinedAudioUrl"
        class="download-button"
        :href="panel.mediaUrl(panel.currentBatch.combinedAudioUrl)"
      >
        <FileAudio :size="17" />下载总音频
      </a>
      <a
        v-if="panel.currentBatch.subtitleUrl"
        class="download-button"
        :href="panel.mediaUrl(panel.currentBatch.subtitleUrl)"
      >
        <Captions :size="17" />下载原文 SRT
      </a>
      <a
        v-if="panel.currentBatch.translationSubtitleUrl"
        class="download-button"
        :href="panel.mediaUrl(panel.currentBatch.translationSubtitleUrl)"
      >
        <Languages :size="17" />下载中文 SRT
      </a>
      <a
        v-if="panel.currentBatch.bilingualSubtitleUrl"
        class="download-button"
        :href="panel.mediaUrl(panel.currentBatch.bilingualSubtitleUrl)"
      >
        <Languages :size="17" />下载双语 SRT
      </a>
      <n-button v-if="panel.isCurrentRunning" secondary @click="panel.cancelBatch(panel.currentBatch.id)"
        >取消剩余</n-button
      >
    </div>
  </section>
</template>

<script setup lang="ts">
import { NButton, NTag } from "naive-ui";
import { Archive, Captions, FileAudio, Languages, ListTree } from "lucide-vue-next";
import { useChatterboxPanelContext } from "./chatterbox-panel-context";

const panel = useChatterboxPanelContext();
</script>
