<template>
  <div class="results">
    <article v-for="job in jobs" :key="job.id" class="result record-card">
      <n-checkbox
        :checked="selected.includes(job.id)"
        :disabled="job.status !== 'completed' || locked"
        :aria-label="`选择 ${job.name} 音轨 ${job.track.index}`"
        @update:checked="emit('select', job.id, $event)"
      />
      <div class="body">
        <strong>{{ job.name }}</strong>
        <p>
          音轨 {{ job.track.index }} · {{ job.track.language }} {{ job.track.title }} · {{ job.track.codec }} ·
          {{ job.track.channels }} 声道 · {{ job.track.duration.toFixed(2) }} 秒 → {{ job.extension.toUpperCase()
          }}<span v-if="job.format === 'mp3'"> · {{ job.bitrate }} kbps</span>
        </p>
        <n-progress
          v-if="job.status === 'pending' || job.status === 'running'"
          type="line"
          :percentage="Math.floor(job.progress)"
        />
        <p>
          {{ job.phase }}{{ job.error ? `：${job.error}` : "" }} · {{ new Date(job.createdAt).toLocaleString() }} ·
          {{ formatBytesAdaptive(job.bytes ?? 0) }}
        </p>
        <div class="actions">
          <template v-if="job.status === 'completed'">
            <n-button tag="a" :href="api.media(job.id, true)" size="small"
              >下载 {{ job.extension.toUpperCase() }}</n-button
            >
            <n-button v-if="job.extension !== 'mka'" size="small" @click="playing = playing === job.id ? '' : job.id">{{
              playing === job.id ? "收起试听" : "试听"
            }}</n-button>
            <n-button size="small" :disabled="locked" @click="emit('library', job.id)">加入音频素材库</n-button>
          </template>
          <n-button v-if="['pending', 'running'].includes(job.status)" size="small" @click="emit('cancel', job.id)"
            >取消提取</n-button
          >
          <n-button v-else size="small" type="error" :disabled="locked" @click="emit('remove', job.id)"
            >删除记录</n-button
          >
        </div>
        <ExtractionAudioPreview
          v-if="playing === job.id && job.status === 'completed'"
          :key="job.id"
          :url="api.media(job.id)"
          :title="job.name"
          :duration="job.track.duration"
          :bytes="job.bytes"
        />
      </div>
    </article>
    <n-empty v-if="!jobs.length" description="暂无提取记录" />
  </div>
</template>
<script setup lang="ts">
import { ref, watch } from "vue";
import { formatBytesAdaptive } from "../../shared/utils/format-bytes";
import { NButton, NCheckbox, NProgress, NEmpty } from "naive-ui";
import type { AudioExtractJob } from "@toolbox/shared/audio-extract";
import { audioExtractApi as api } from "./api";
import ExtractionAudioPreview from "./ExtractionAudioPreview.vue";
const props = defineProps<{ jobs: AudioExtractJob[]; selected: string[]; locked: boolean }>();
const emit = defineEmits<{ select: [string, boolean]; library: [string]; remove: [string]; cancel: [string] }>();
const playing = ref("");
watch(
  () => props.jobs,
  (jobs) => {
    if (!jobs.some((job) => job.id === playing.value && job.status === "completed")) playing.value = "";
  }
);
</script>
<style scoped>
.results {
  display: grid;
  gap: 12px;
}
.results .result {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  background: var(--color-surface-subtle);
  border: 1px solid #e1e8f3;
  border-radius: 10px;
}
.body {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 16px;
}
.body strong {
  overflow-wrap: anywhere;
  font-size: 15px;
  line-height: 1.5;
}
.body p {
  color: var(--color-text-secondary);
  font-size: 13px;
  overflow-wrap: anywhere;
  grid-column: 1;
  margin: 0;
  line-height: 1.5;
}
.body > :deep(.n-progress),
.body > :deep(.audio-preview) {
  grid-column: 1 / -1;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  grid-column: 2;
  grid-row: 1 / 4;
  align-self: center;
  max-width: 360px;
  justify-content: flex-end;
}
@container tool-content (max-width: 1000px) {
  .body {
    grid-template-columns: minmax(0, 1fr);
  }
  .actions {
    grid-column: 1;
    grid-row: auto;
    justify-content: flex-start;
    max-width: none;
  }
}
</style>
