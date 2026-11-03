<template>
  <section class="archive-music-range" aria-label="配乐选段">
    <audio
      ref="audio"
      :src="url"
      preload="metadata"
      @loadedmetadata="metadata"
      @timeupdate="updateTime"
      @pause="paused"
      @ended="paused"
      @error="playbackError = '音乐加载失败，请重新选择或重试'"
    />
    <strong>配乐选段</strong>
    <ArchiveMusicWaveform
      v-if="duration > 0 && videoDuration > 0"
      :key="url"
      :url="url"
      :title="title"
      :duration="duration"
      :position="position"
      :range="range"
      editing
      :fixed-range-duration="length"
      :disabled="disabled"
      available
      @update:range="move"
      @seek="seek"
      @preview="play"
    />
    <p v-else>正在读取音乐与视频时长…</p>
    <p v-if="length > 0">
      {{ range[0].toFixed(2) }} – {{ range[1].toFixed(2) }} 秒 · 选中 {{ length.toFixed(2) }} 秒 / 视频
      {{ videoDuration.toFixed(2) }} 秒
    </p>
    <p v-if="duration > 0 && duration < videoDuration">
      音乐短于视频：{{ loop ? "按循环开关重复铺满视频" : "音乐结束后保留视频原声" }}。
    </p>
    <n-button size="small" :disabled="disabled || !length" @click="playing ? stop() : play()">{{
      playing ? "暂停配乐选段" : "播放配乐选段"
    }}</n-button>
    <p v-if="playbackError" role="alert">{{ playbackError }}</p>
  </section>
</template>
<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from "vue";
import { NButton } from "naive-ui";
import { ArchiveMusicWaveform } from "../audio-library/integrations/music";
const props = defineProps<{
  url: string;
  title: string;
  musicDuration?: number;
  videoDuration: number;
  start: number;
  disabled: boolean;
  loop: boolean;
  volume: number;
}>();
const emit = defineEmits<{ "update:start": [value: number]; play: [] }>();
const audio = ref<HTMLAudioElement>(),
  loadedDuration = ref(0),
  position = ref(0),
  playing = ref(false),
  playbackError = ref("");
const duration = computed(() =>
  Number.isFinite(props.musicDuration) && props.musicDuration! > 0 ? props.musicDuration! : loadedDuration.value
);
const length = computed(() => Math.max(0, Math.min(duration.value, props.videoDuration)));
const range = computed(() => {
  const start = Math.max(0, Math.min(Math.max(0, duration.value - length.value), props.start));
  return [start, start + length.value];
});
let timer: ReturnType<typeof setTimeout> | undefined,
  generation = 0,
  disposed = false;
function paused() {
  playing.value = false;
  if (timer) clearTimeout(timer);
  timer = undefined;
}
function stop() {
  generation++;
  audio.value?.pause();
  paused();
}
function metadata() {
  const d = audio.value?.duration;
  if (d && Number.isFinite(d)) loadedDuration.value = d;
}
function move(value: number[]) {
  if (props.disabled || !Number.isFinite(value[0]) || !length.value) return;
  stop();
  const start = Math.max(0, Math.min(duration.value - length.value, value[0]));
  position.value = start;
  emit("update:start", start);
}
function seek(value: number) {
  if (props.disabled || !Number.isFinite(value)) return;
  stop();
  position.value = Math.max(range.value[0], Math.min(range.value[1], value));
  if (audio.value) audio.value.currentTime = position.value;
}
function updateTime() {
  position.value = audio.value?.currentTime ?? range.value[0];
  if (position.value >= range.value[1]) stop();
}
async function play() {
  if (props.disabled || !audio.value || !length.value || disposed) return;
  stop();
  const version = generation,
    element = audio.value;
  playbackError.value = "";
  emit("play");
  element.currentTime = range.value[0];
  position.value = range.value[0];
  element.volume = Math.max(0, Math.min(1, props.volume / 100));
  try {
    await element.play();
    if (disposed || version !== generation) {
      element.pause();
      return;
    }
    playing.value = true;
    timer = setTimeout(stop, Math.max(0, range.value[1] - element.currentTime) * 1000);
  } catch {
    if (!disposed && version === generation) playbackError.value = "播放失败，请重试或检查音乐文件";
  }
}
watch(
  () => props.url,
  () => {
    stop();
    loadedDuration.value = 0;
    position.value = 0;
    playbackError.value = "";
  }
);
watch(
  [() => props.start, duration, length],
  () => {
    stop();
    position.value = range.value[0];
    if (length.value > 0 && Math.abs(props.start - range.value[0]) > 0.000001) emit("update:start", range.value[0]);
  },
  { immediate: true }
);
watch(
  () => props.disabled,
  (value) => {
    if (value) stop();
  }
);
watch(
  () => props.volume,
  (value) => {
    if (audio.value) audio.value.volume = Math.max(0, Math.min(1, value / 100));
  }
);
onScopeDispose(() => {
  disposed = true;
  stop();
});
defineExpose({ stop });
</script>
<style scoped>
.archive-music-range {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--border-color, #dce4f1);
  border-radius: 8px;
}
.archive-music-range audio {
  display: none;
}
.archive-music-range p {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}
</style>
