<template>
  <section class="audio-preview library-item-player" :aria-label="`${title} 试听`">
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
    <header class="library-item-wave-heading">
      <span><Music2 :size="13" />音频波形</span><small>独立播放</small>
    </header>
    <ExtractionAudioWaveform
      class="library-item-waveform"
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
        v-slider-label="{
          label: '试听播放位置',
          text: formatAudioDuration(position)
        }"
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
    <div class="library-item-wave-times">
      <span>{{ formatAudioDuration(position) }}</span
      ><span>{{ formatAudioDuration(length) }}</span>
    </div>
    <div class="library-item-wave-toolbar">
      <div class="library-item-wave-settings">
        <div class="library-item-wave-volume">
          <n-button
            circle
            quaternary
            :aria-label="volume ? '静音' : '取消静音'"
            :title="volume ? '静音' : '取消静音'"
            :aria-pressed="volume === 0"
            @click="setVolume(volume ? 0 : lastAudibleVolume)"
          >
            <Volume2 v-if="volume" :size="21" /><VolumeX v-else :size="21" />
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
        <n-select
          v-model:value="rate"
          class="library-item-wave-rate"
          size="small"
          :bordered="false"
          :consistent-menu-width="false"
          :options="rateOptions"
          :input-props="{ 'aria-label': '独立播放倍速' }"
        />
      </div>
      <div class="library-item-wave-transport">
        <n-button circle quaternary aria-label="后退 3 秒" title="后退 3 秒" @click="seek(position - 3)"
          ><Rewind :size="19" fill="currentColor"
        /></n-button>
        <n-button
          circle
          type="primary"
          class="library-item-play"
          :aria-label="
            phase === 'playing' ? '暂停' : phase === 'loading' ? '取消加载' : phase === 'error' ? '重试播放' : '播放'
          "
          @click="toggle"
        >
          <Pause v-if="phase === 'playing' || phase === 'loading'" :size="25" fill="currentColor" /><Play
            v-else
            :size="25"
            fill="currentColor"
          />
        </n-button>
        <n-button circle quaternary aria-label="前进 3 秒" title="前进 3 秒" @click="seek(position + 3)"
          ><FastForward :size="19" fill="currentColor"
        /></n-button>
      </div>
      <div class="library-item-wave-actions">
        <n-button
          circle
          quaternary
          :disabled="!position && phase === 'paused'"
          aria-label="回到开头"
          title="停止并回到开头"
          @click="restart"
          ><RotateCcw :size="17"
        /></n-button>
      </div>
    </div>
    <p v-if="phase === 'loading'" class="hint" role="status">正在加载音频…</p>
    <p v-if="phase === 'error'" class="error" role="alert">
      当前浏览器无法播放此音频，请重试或下载；也可生成 MP3 副本加入素材库。
    </p>
  </section>
</template>
<script setup lang="ts">
import "../../shared/ui/audio/inline-preview.css";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { NButton, NSlider, NSelect } from "naive-ui";
import { Music2, Pause, Play, Volume2, VolumeX, Rewind, FastForward, RotateCcw } from "lucide-vue-next";
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
const rate = ref(1);
const rateOptions = [0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => ({ label: `${value}x`, value }));
watch(rate, (value) => {
  if (audio.value) audio.value.playbackRate = value;
});
const lastAudibleVolume = ref(1);
function setVolume(value: number) {
  if (!Number.isFinite(value)) return;
  if (volume.value > 0) lastAudibleVolume.value = volume.value;
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
  element.playbackRate = rate.value;
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
  margin-top: 14px;
}
audio {
  display: none;
}
.hint {
  width: 100%;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}
.error {
  width: 100%;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-error);
}
</style>
