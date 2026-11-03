<template>
  <section class="audio-preview" :aria-label="`${title} 试听`">
    <audio
      ref="audio"
      :src="url"
      preload="metadata"
      @loadedmetadata="metadata"
      @durationchange="metadata"
      @timeupdate="updateTime"
      @playing="onPlaying"
      @pause="onPause"
      @ended="onPause"
      @error="fail"
    />
    <header>
      <span><AudioLines :size="15" />音频波形</span
      ><small>{{ canShowWaveform ? "点击音轨定位试听" : "拖动进度条定位试听" }}</small>
    </header>
    <ExtractionAudioWaveform
      v-if="canShowWaveform"
      :url="url"
      :title="title"
      :duration="length"
      :position="position"
      :range="[0, length]"
      :editing="false"
      :disabled="false"
      available
      @seek="seek"
    />
    <template v-else>
      <n-slider
        v-slider-label="{ label: '试听播放位置', text: formatAudioDuration(position) }"
        :value="position"
        :min="0"
        :max="length || 1"
        :step="0.1"
        :disabled="!length"
        :format-tooltip="formatAudioDuration"
        @update:value="seek"
      />
      <p class="hint">长音频或大文件使用进度条试听，无需等待波形生成。</p>
    </template>
    <div class="times">
      <span>{{ formatAudioDuration(position) }}</span
      ><span>{{ formatAudioDuration(length) }}</span>
    </div>
    <div class="controls">
      <n-button size="small" :type="phase === 'playing' ? 'default' : 'primary'" @click="toggle">
        <template #icon
          ><Pause v-if="phase === 'playing' || phase === 'loading'" :size="16" /><Play v-else :size="16"
        /></template>
        {{ phase === "playing" ? "暂停" : phase === "loading" ? "取消加载" : phase === "error" ? "重试播放" : "播放" }}
      </n-button>
      <n-button size="small" :disabled="!position && phase === 'paused'" @click="restart">回到开头</n-button>
      <span v-if="phase === 'loading'" class="hint" role="status">正在加载音频…</span>
      <div class="volume">
        <n-button text :aria-label="volume ? '静音' : '取消静音'" @click="setVolume(volume ? 0 : 1)">
          <Volume2 v-if="volume" :size="17" /><VolumeX v-else :size="17" />
        </n-button>
        <n-slider
          v-slider-label="{ label: '试听音量', text: `${Math.round(volume * 100)}%` }"
          :value="volume"
          :min="0"
          :max="1"
          :step="0.01"
          :format-tooltip="(value) => `${Math.round(value * 100)}%`"
          @update:value="setVolume"
        />
      </div>
    </div>
    <p v-if="phase === 'error'" class="error" role="alert">
      当前浏览器无法播放此音频，请重试或下载；也可生成 MP3 副本加入素材库。
    </p>
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { NButton, NSlider } from "naive-ui";
import { AudioLines, Pause, Play, Volume2, VolumeX } from "lucide-vue-next";
import { AUDIO_LIBRARY_MAX_FILE_BYTES } from "@toolbox/shared/audio-library";
import { ExtractionAudioWaveform, formatAudioDuration, vSliderLabel } from "../audio-library/integrations/extraction";
const props = defineProps<{ url: string; title: string; duration: number; bytes?: number }>();
const audio = ref<HTMLAudioElement>(),
  position = ref(0),
  loadedDuration = ref(0),
  phase = ref<"paused" | "loading" | "playing" | "error">("paused"),
  volume = ref(1);
const length = computed(
  () => loadedDuration.value || (Number.isFinite(props.duration) ? Math.max(0, props.duration) : 0)
);
// The shared decoder is bounded; long extraction results still stream through the media element.
const canShowWaveform = computed(
  () =>
    length.value > 0 && length.value <= 3600 && props.bytes !== undefined && props.bytes <= AUDIO_LIBRARY_MAX_FILE_BYTES
);
let generation = 0,
  disposed = false;
function pause() {
  generation++;
  phase.value = "paused";
  audio.value?.pause();
}
function onPause() {
  generation++;
  if (phase.value !== "error") phase.value = "paused";
}
function onPlaying() {
  if (disposed || phase.value === "paused" || phase.value === "error") audio.value?.pause();
  else phase.value = "playing";
}
function seek(value: number) {
  if (!Number.isFinite(value)) return;
  position.value = Math.max(0, Math.min(length.value, value));
  if (audio.value?.readyState) audio.value.currentTime = position.value;
}
function metadata() {
  const duration = audio.value?.duration;
  if (duration && Number.isFinite(duration)) {
    loadedDuration.value = duration;
    seek(position.value);
  }
}
function updateTime() {
  const value = audio.value?.currentTime;
  if (value !== undefined && Number.isFinite(value)) position.value = Math.max(0, Math.min(length.value, value));
}
function setVolume(value: number) {
  if (!Number.isFinite(value)) return;
  volume.value = Math.max(0, Math.min(1, value));
  if (audio.value) audio.value.volume = volume.value;
}
function fail() {
  pause();
  phase.value = "error";
}
function restart() {
  pause();
  seek(0);
}
async function toggle() {
  if (disposed || !audio.value) return;
  if (phase.value === "playing" || phase.value === "loading") return pause();
  const element = audio.value,
    version = ++generation;
  if (phase.value === "error") element.load();
  phase.value = "loading";
  if (element.ended || position.value >= length.value) seek(0);
  element.volume = volume.value;
  try {
    await element.play();
    if (disposed || version !== generation) {
      if (disposed || !["loading", "playing"].includes(phase.value)) element.pause();
    } else phase.value = "playing";
  } catch {
    if (!disposed && version === generation) fail();
  }
}
watch(
  () => props.url,
  () => {
    pause();
    position.value = 0;
    loadedDuration.value = 0;
  }
);
onBeforeUnmount(() => {
  disposed = true;
  pause();
  audio.value?.removeAttribute("src");
  audio.value?.load();
});
</script>
<style scoped>
.audio-preview {
  min-width: 0;
  margin-top: 14px;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid #dfe4f2;
  border-radius: 10px;
}
audio {
  display: none;
}
header,
.times,
.controls,
header span,
.volume {
  display: flex;
  align-items: center;
  gap: 8px;
}
header,
.times {
  justify-content: space-between;
}
header {
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 13px;
}
header small,
.times,
.hint {
  color: #60718d;
  font-size: 12px;
  font-weight: 400;
}
.times {
  margin: 4px 0 12px;
  font-variant-numeric: tabular-nums;
}
.controls {
  flex-wrap: wrap;
}
.volume {
  width: 130px;
  margin-left: auto;
}
.volume .n-slider {
  flex: 1;
}
.error {
  color: #c53030;
  font-size: 13px;
}
@media (max-width: 480px) {
  header {
    align-items: flex-start;
    flex-direction: column;
  }
  .audio-preview {
    padding: 12px;
  }
}
</style>
