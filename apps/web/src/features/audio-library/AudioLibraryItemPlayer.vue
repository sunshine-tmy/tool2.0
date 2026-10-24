<!-- 列表内独立单条播放：不引用队列状态，不持久化，也不自动播放下一条。 -->
<template>
  <div class="library-item-player" :class="{ 'is-open': started }" :aria-label="`${item.title} 的独立播放器`">
    <audio
      :key="reloadKey"
      ref="audio"
      data-audio-library-inline
      preload="none"
      :src="started ? resolveBackendUrl(item.audioUrl) : undefined"
      @playing="onPlaying"
      @pause="onPause"
      @ended="stop"
      @error="fail"
      @timeupdate="position = audio?.currentTime || 0"
    />
    <header class="library-item-wave-heading">
      <span><Music2 :size="13" />音频波形</span><small>独立播放</small>
    </header>
    <AudioWaveform
      class="library-item-waveform"
      :url="resolveBackendUrl(item.audioUrl)"
      :title="item.title"
      :duration="item.duration"
      :position="position"
      :range="range"
      :editing="trimOpen"
      :disabled="saving || !item.available"
      :available="item.available"
      @seek="seek"
      @update:range="updateRange"
      @preview="startPlayback(true)"
    />
    <div class="library-item-wave-times">
      <span>{{ formatDuration(trimOpen ? range[0] : position) }}</span
      ><span v-if="trimOpen">已选 {{ formatSeconds(range[1] - range[0]) }}</span
      ><span>{{ formatDuration(trimOpen ? range[1] : item.duration) }}</span>
    </div>
    <div class="library-item-wave-toolbar">
      <div class="library-item-wave-settings">
        <n-popover trigger="click" placement="top" :show-arrow="false">
          <template #trigger
            ><n-button text size="small" :aria-label="`${item.title} 音量`" title="音量"
              ><Volume2 v-if="volume > 0" :size="17" /><VolumeX v-else :size="17" /></n-button
          ></template>
          <div class="library-item-wave-volume">
            <n-button text size="tiny" @click="setVolume(volume > 0 ? 0 : 1)">{{
              volume > 0 ? "静音" : "取消静音"
            }}</n-button>
            <n-slider
              v-slider-label="{ label: '独立播放音量', text: `${Math.round(volume * 100)}%` }"
              :value="volume"
              :min="0"
              :max="1"
              :step="0.01"
              :format-tooltip="(value) => `${Math.round(value * 100)}%`"
              @update:value="setVolume"
            />
          </div>
        </n-popover>
        <n-select
          v-model:value="rate"
          class="library-item-wave-rate"
          size="small"
          :bordered="false"
          :consistent-menu-width="false"
          :menu-props="{ style: { minWidth: '112px' } }"
          :options="rateOptions"
          :input-props="{ 'aria-label': '独立播放倍速' }"
        />
      </div>
      <div class="library-item-wave-transport">
        <n-button
          text
          size="small"
          :disabled="!item.available"
          aria-label="后退 3 秒"
          title="后退 3 秒"
          @click="seek(position - 3)"
          ><Rewind :size="19" fill="currentColor"
        /></n-button>
        <n-button
          class="library-item-play"
          size="small"
          text
          color="#7665ff"
          :disabled="!item.available"
          :loading="phase === 'loading'"
          :aria-label="`${phase === 'playing' ? '暂停' : '播放'} ${item.title}`"
          title="独立播放，不改变队列；队列播放中会同时出声"
          @click="toggle"
        >
          <Pause v-if="phase === 'playing'" :size="25" fill="currentColor" /><Play
            v-else
            :size="25"
            fill="currentColor"
          />
          <span class="sr-only">{{ phase === "playing" ? "暂停" : phase === "error" ? "重试" : "播放" }}</span>
        </n-button>
        <n-button
          text
          size="small"
          :disabled="!item.available"
          aria-label="前进 3 秒"
          title="前进 3 秒"
          @click="seek(position + 3)"
          ><FastForward :size="19" fill="currentColor"
        /></n-button>
      </div>
      <div class="library-item-wave-actions">
        <n-button text size="small" :disabled="!started" aria-label="停止" title="停止并回到开头" @click="stop"
          ><Square :size="14" /><span class="sr-only">停止</span></n-button
        >
        <n-button text size="small" :disabled="saving" aria-label="重置选区" title="重置选区" @click="resetRange"
          ><RotateCcw :size="17"
        /></n-button>
        <n-button
          text
          size="small"
          :type="trimOpen ? 'primary' : 'default'"
          :disabled="!item.available || saving"
          :aria-label="trimOpen ? '收起裁剪' : '裁剪'"
          title="在波形上选取裁剪范围"
          @click="trimOpen = !trimOpen"
          ><Scissors :size="18" /><span class="sr-only">{{ trimOpen ? "收起裁剪" : "裁剪" }}</span></n-button
        >
      </div>
    </div>
    <div v-if="trimOpen" class="library-item-trim">
      <div class="library-item-trim-actions">
        <n-button size="small" :disabled="!validRange || saving" @click="startPlayback(true)">播放选段</n-button>
        <n-button
          size="small"
          type="primary"
          :disabled="!validRange || !item.available"
          :loading="saving"
          @click="saveClip"
          >另存裁剪音频</n-button
        >
      </div>
      <p :class="{ 'library-item-play-error': !validRange }">
        {{ validRange ? `选区 ${formatSeconds(range[1] - range[0])}` : "结束时间需晚于开始时间，选区至少 0.05 秒" }} ·
        另存同分组 WAV，保留原音频；中外文案需手动校对。
      </p>
      <p v-if="saving" role="status">{{ saveStatus }}</p>
      <p v-if="saveError" class="library-item-play-error" role="alert">{{ saveError }}</p>
    </div>
    <p v-if="phase === 'error'" class="library-item-play-error" role="alert">播放失败，请重试或检查音频文件。</p>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { NButton, NPopover, NSelect, NSlider } from "naive-ui";
import {
  FastForward,
  Music2,
  Pause,
  Play,
  Rewind,
  RotateCcw,
  Scissors,
  Square,
  Volume2,
  VolumeX
} from "lucide-vue-next";
import type { AudioLibraryItemView } from "@toolbox/shared";
import { resolveBackendUrl } from "../../shared/config/runtime";
import { audioLibraryApi } from "./api";
import { formatDuration } from "./presentation";
import { cropAudio } from "./clip-audio";
import { ApiRequestError, formatApiError } from "../../shared/http/http";
import { vSliderLabel } from "./slider-label";
import AudioWaveform from "./AudioWaveform.vue";
const props = defineProps<{ item: AudioLibraryItemView }>();
const emit = defineEmits<{ saved: [item: AudioLibraryItemView] }>();
const trimOpen = ref(false),
  range = ref([0, props.item.duration]),
  saving = ref(false),
  saveError = ref(""),
  saveStatus = ref("");
const validRange = computed(
  () =>
    range.value.every(Number.isFinite) &&
    range.value[0] >= 0 &&
    range.value[1] <= props.item.duration &&
    range.value[1] - range.value[0] >= 0.05 - 1e-6
);
const formatSeconds = (value: number) => `${value.toFixed(2)} 秒`;
const rate = ref(1),
  volume = ref(1);
const rateOptions = [0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => ({ label: `${value}x`, value }));
function setVolume(value: number) {
  volume.value = Math.max(0, Math.min(1, value));
  if (audio.value) audio.value.volume = volume.value;
}
function resetRange() {
  range.value = [0, props.item.duration];
  trimOpen.value = false;
}
watch(rate, (value) => {
  if (audio.value) audio.value.playbackRate = value;
  if (previewEnd !== undefined) armSegmentStop();
});
let saveController: AbortController | undefined, segmentTimer: ReturnType<typeof setTimeout> | undefined;
let previewEnd: number | undefined;
function updateRange(value: number[]) {
  if (value.length === 2 && value.every(Number.isFinite))
    range.value = value.map((x) => Math.max(0, Math.min(props.item.duration, x)));
}
async function saveClip() {
  if (!validRange.value || saving.value || !props.item.available) return;
  saving.value = true;
  saveError.value = "";
  const controller = (saveController = new AbortController());
  const source = props.item,
    [start, end] = range.value;
  try {
    const file = await cropAudio(
      resolveBackendUrl(source.audioUrl),
      source.duration,
      start,
      end,
      controller.signal,
      (text) => {
        saveStatus.value = text;
      }
    );
    controller.signal.throwIfAborted();
    saveStatus.value = "正在保存到音频库…";
    const result = await audioLibraryApi.clip(source.id, file, start, end, source.revision, controller.signal);
    if (!disposed && !controller.signal.aborted) {
      trimOpen.value = false;
      emit("saved", result.item);
    }
  } catch (error) {
    if (!disposed && !controller.signal.aborted)
      saveError.value =
        error instanceof ApiRequestError
          ? formatApiError(error)
          : error instanceof Error
            ? error.message
            : "裁剪失败，请重试";
  } finally {
    if (saveController === controller) {
      saving.value = false;
      saveController = undefined;
    }
  }
}
const audio = ref<HTMLAudioElement>();
const reloadKey = ref(0);
const started = ref(false),
  position = ref(0);
const phase = ref<"idle" | "loading" | "playing" | "paused" | "error">("idle");
let generation = 0,
  disposed = false;
async function toggle() {
  if (!props.item.available || disposed) return;
  if (phase.value === "playing" || phase.value === "loading") {
    generation++;
    audio.value?.pause();
    phase.value = "paused";
    return;
  }
  await startPlayback();
}
async function startPlayback(selection = false) {
  if (!props.item.available || disposed || (selection && !validRange.value)) return;
  cancelSegment();
  if (selection) position.value = range.value[0];
  if (phase.value === "error") {
    // 新建媒体节点重新加载，避免浏览器保留上一次的解码/网络错误。
    reloadKey.value++;
    position.value = 0;
  }
  const token = ++generation;
  started.value = true;
  phase.value = "loading";
  await nextTick();
  if (disposed || token !== generation || !audio.value) return;
  try {
    audio.value.currentTime = position.value;
    audio.value.playbackRate = rate.value;
    audio.value.volume = volume.value;
    previewEnd = selection ? range.value[1] : undefined;
    await audio.value.play();
    if (!disposed && token === generation) {
      phase.value = "playing";
      armSegmentStop();
    }
  } catch {
    if (!disposed && token === generation) fail();
  }
}
function onPause() {
  cancelSegment();
  generation++;
  if (phase.value === "playing" || phase.value === "loading") phase.value = "paused";
}
function onPlaying() {
  if (!disposed && phase.value === "loading") {
    phase.value = "playing";
    armSegmentStop();
  }
}
function cancelSegment() {
  if (segmentTimer !== undefined) clearTimeout(segmentTimer);
  segmentTimer = undefined;
  previewEnd = undefined;
}
function armSegmentStop() {
  if (previewEnd === undefined || !audio.value) return;
  if (segmentTimer !== undefined) clearTimeout(segmentTimer);
  const end = previewEnd;
  segmentTimer = setTimeout(
    () => {
      audio.value?.pause();
      seek(end);
      phase.value = "paused";
    },
    (Math.max(0, end - audio.value.currentTime) * 1000) / rate.value
  );
}
function stop() {
  cancelSegment();
  generation++;
  audio.value?.pause();
  if (audio.value) audio.value.currentTime = 0;
  position.value = 0;
  phase.value = "idle";
}
function seek(value: number) {
  cancelSegment();
  if (!Number.isFinite(value) || !audio.value) return;
  position.value = Math.max(0, Math.min(props.item.duration, value));
  audio.value.currentTime = position.value;
}
function fail() {
  generation++;
  audio.value?.pause();
  phase.value = "error";
}
watch([() => props.item.id, () => props.item.audioUrl, () => props.item.available], () => {
  saveController?.abort();
  stop();
  started.value = false;
  range.value = [0, props.item.duration];
  saveError.value = "";
});
onBeforeUnmount(() => {
  disposed = true;
  saveController?.abort();
  stop();
});
</script>
<style scoped>
.library-item-player {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  max-width: 100%;
  min-width: 0;
  padding: 12px;
  border: 1px solid #ece9f6;
  border-radius: 8px;
  background: #fff;
  box-sizing: border-box;
}
.library-item-player.is-open {
  width: 100%;
}
.library-item-wave-heading {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
  gap: 8px;
}
.library-item-wave-heading > span {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #7665ff;
  background: #f0edff;
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}
.library-item-wave-heading small {
  font-size: 10px;
  color: #a7adba;
}
.library-item-wave-times {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 5px;
  color: #9ca3b5;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  margin-top: 1px;
}
.library-item-wave-times span:nth-child(2):not(:last-child) {
  color: #8c80c0;
  font-size: 10px;
}
.library-item-wave-toolbar {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  color: #9ca3b5;
}
.library-item-wave-settings,
.library-item-wave-transport,
.library-item-wave-actions {
  display: flex;
  align-items: center;
  gap: 7px;
}
.library-item-wave-transport {
  justify-content: center;
  gap: 8px;
}
.library-item-wave-toolbar :deep(.n-button) {
  color: #9ca3b5;
}
.library-item-wave-toolbar :deep(.library-item-play) {
  color: #7665ff;
}
.library-item-wave-rate {
  width: 76px;
}
.library-item-wave-settings {
  gap: 4px;
}
.library-item-wave-volume {
  width: 140px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.library-item-wave-volume :deep(.n-slider) {
  flex: 1;
  min-width: 0;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.library-item-play-error {
  flex-basis: 100%;
  margin: 0;
  color: #dc2626;
  font-size: 12px;
}
.library-item-trim {
  width: 100%;
  min-width: 0;
  border-top: 1px solid #dce5f3;
  padding-top: 12px;
}
.library-item-trim-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.library-item-trim p {
  margin: 8px 0 0;
  font-size: 11px;
  color: #64748b;
}
.library-item-trim p.library-item-play-error {
  color: #dc2626;
}
</style>
