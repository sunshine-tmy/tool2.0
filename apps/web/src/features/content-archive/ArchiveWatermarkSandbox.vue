<template>
  <section class="watermark-sandbox" aria-label="15 秒虚拟水印预览">
    <div class="sandbox-heading">
      <strong>15 秒虚拟视频</strong>
      <span>即时观察水印轨迹</span>
    </div>
    <ArchiveWatermarkPreview
      :active="true"
      :disabled="disabled"
      :virtual-video="virtualVideo"
      :asset="asset"
      :settings="settings"
      @move="emit('move', $event)"
      @pause="pause"
    >
      <div class="sandbox-frame" :style="frameStyle">
        <span v-if="!asset">选择水印后，在此观察运动轨迹</span>
        <span v-else class="sandbox-caption">水印轨迹示意</span>
      </div>
    </ArchiveWatermarkPreview>
    <div class="sandbox-toolbar">
      <n-button size="small" :disabled="disabled || !asset" @click="playing ? pause() : play()">
        {{ playing ? "暂停" : "播放轨迹" }}
      </n-button>
      <n-button size="small" :disabled="disabled" @click="restart">回到 0 秒</n-button>
      <span class="sandbox-clock">{{ time.toFixed(1) }} / {{ (windowStart + 15).toFixed(1) }} 秒</span>
    </div>
    <n-slider
      :value="time - windowStart"
      :min="0"
      :max="15"
      :step="0.1"
      :disabled="disabled"
      :format-tooltip="(value: number) => `${(windowStart + value).toFixed(1)} 秒`"
      aria-label="虚拟视频时间轴"
      @update:value="seek(windowStart + $event)"
    />
    <small>
      暂停后可拖动水印，虚线显示运动路径。仅作 15 秒示意，不改变各条实际时长；超出此区间的关键帧会切换示意时间段。
    </small>
  </section>
</template>
<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from "vue";
import { NButton, NSlider } from "naive-ui";
import type { ArchiveWatermarkSettings } from "@toolbox/shared/archive";
import ArchiveWatermarkPreview from "./ArchiveWatermarkPreview.vue";
const props = defineProps<{
  active: boolean;
  disabled: boolean;
  width: number;
  height: number;
  settings: ArchiveWatermarkSettings;
  asset?: { width: number; height: number; url: string };
}>();
const emit = defineEmits<{ move: [{ x: number; y: number }]; time: [number] }>();
const time = ref(0),
  windowStart = ref(0),
  playing = ref(false);
const virtualVideo = computed(() => ({
  width: props.width,
  height: props.height,
  duration: windowStart.value + 15,
  currentTime: time.value,
  paused: !playing.value
}));
const frameStyle = computed(() => ({
  aspectRatio: `${props.width} / ${props.height}`,
  maxWidth: `${(280 * props.width) / props.height}px`
}));
let animation: number | undefined;
function pause() {
  playing.value = false;
  if (animation !== undefined) cancelAnimationFrame(animation);
  animation = undefined;
}
function setTime(value: number) {
  time.value = value;
  emit("time", value);
}
function play() {
  if (!props.active || props.disabled || !props.asset || playing.value) return;
  if (time.value >= windowStart.value + 15) setTime(windowStart.value);
  const start = time.value,
    origin = performance.now();
  playing.value = true;
  const tick = (now: number) => {
    if (!playing.value) return;
    const next = Math.min(windowStart.value + 15, start + Math.max(0, now - origin) / 1000);
    setTime(next);
    if (next >= windowStart.value + 15) pause();
    else animation = requestAnimationFrame(tick);
  };
  animation = requestAnimationFrame(tick);
}
function seek(value: number) {
  if (props.disabled || !Number.isFinite(value)) return;
  pause();
  const target = Math.max(0, value);
  if (target < windowStart.value || target > windowStart.value + 15) windowStart.value = Math.max(0, target - 15);
  setTime(target);
}
function restart() {
  if (props.disabled) return;
  pause();
  windowStart.value = 0;
  setTime(0);
}
watch([() => props.active, () => props.disabled, () => props.asset?.url], () => pause());
const onVisibility = () => {
  if (document.hidden) pause();
};
document.addEventListener("visibilitychange", onVisibility);
onScopeDispose(() => {
  pause();
  document.removeEventListener("visibilitychange", onVisibility);
});
defineExpose({ seek, pause });
</script>
<style scoped>
.watermark-sandbox {
  padding: 12px;
  border: 1px solid #dce6f5;
  border-radius: 10px;
  background: #f7f9fc;
  display: grid;
  gap: 12px;
  min-width: 0;
}
.sandbox-heading,
.sandbox-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.sandbox-heading span,
.watermark-sandbox small {
  color: #687386;
  font-size: 12px;
}
.sandbox-frame {
  position: relative;
  display: grid;
  place-items: center;
  text-align: center;
  width: 100%;
  margin: 0 auto;
  border-radius: 6px;
  outline: 1px solid #dce6f5;
  background-color: white;
  background-image: linear-gradient(#e8edf4 1px, transparent 1px), linear-gradient(90deg, #e8edf4 1px, transparent 1px);
  background-size: 24px 24px;
  color: #687386;
  font-size: 12px;
}
.sandbox-caption {
  position: absolute;
  bottom: 12px;
}
.sandbox-clock {
  margin-left: auto;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
</style>
