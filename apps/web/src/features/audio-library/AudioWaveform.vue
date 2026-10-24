<template>
  <div class="audio-waveform">
    <div
      ref="container"
      class="audio-waveform-canvas"
      :role="editing ? 'group' : 'slider'"
      tabindex="0"
      :aria-label="`${title} 波形播放位置`"
      :aria-valuemin="editing ? undefined : 0"
      :aria-valuemax="editing ? undefined : duration"
      :aria-valuenow="editing ? undefined : position"
      :aria-valuetext="editing ? undefined : formatDuration(position)"
      :aria-disabled="disabled || !ready"
      @keydown="onKeydown"
    />
    <div v-if="!ready" class="audio-waveform-status">
      <n-button v-if="error" text size="tiny" :disabled="disabled" @click="load">波形加载失败，点击重试</n-button>
      <span v-else>{{ available ? "正在生成真实波形…" : "音频不可用" }}</span>
    </div>
    <span v-if="editing && ready" class="audio-waveform-help">拖动两端调整范围 · 拖动选区移动 · 空白处拖选</span>
  </div>
</template>
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { NButton } from "naive-ui";
import WaveSurfer from "wavesurfer.js";
import Regions, { type Region } from "wavesurfer.js/dist/plugins/regions.js";
import { loadWaveformPeaks } from "./waveform-peaks";
import { formatDuration } from "./presentation";
const props = defineProps<{
  url: string;
  title: string;
  duration: number;
  position: number;
  range: number[];
  editing: boolean;
  disabled: boolean;
  available: boolean;
}>();
const emit = defineEmits<{ seek: [value: number]; "update:range": [value: number[]]; preview: [] }>();
const container = ref<HTMLElement>(),
  ready = ref(false),
  error = ref(false);
let wave: WaveSurfer | undefined, regions: ReturnType<typeof Regions.create> | undefined, selection: Region | undefined;
let controller: AbortController | undefined,
  observer: IntersectionObserver | undefined,
  disableDrag: (() => void) | undefined;
let syncing = false,
  disposed = false;
function clear() {
  controller?.abort();
  disableDrag?.();
  disableDrag = undefined;
  wave?.destroy();
  wave = undefined;
  regions = undefined;
  selection = undefined;
  ready.value = false;
}
async function load() {
  clear();
  error.value = false;
  if (!props.available || !container.value || disposed) return;
  const own = (controller = new AbortController());
  try {
    const peaks = await loadWaveformPeaks(props.url, props.duration, own.signal);
    if (disposed || own.signal.aborted || !container.value) return;
    regions = Regions.create();
    // 波形实例仅负责显示与选区，使用自己的无源媒体，不接管实际播放通道。
    wave = WaveSurfer.create({
      container: container.value,
      peaks: [peaks],
      duration: props.duration,
      height: 64,
      barWidth: 2,
      barGap: 3,
      barRadius: 1,
      normalize: true,
      waveColor: "#aab1c1",
      progressColor: "#7665ff",
      cursorColor: "#7665ff",
      cursorWidth: 1,
      minPxPerSec: 18,
      autoScroll: true,
      autoCenter: false,
      hideScrollbar: false,
      dragToSeek: true,
      plugins: [regions]
    });
    wave.on("ready", () => {
      ready.value = true;
      wave?.setTime(props.position);
      syncEditing();
    });
    wave.on("interaction", (time) => {
      if (!props.disabled) emit("seek", time);
    });
    wave.on("error", () => {
      error.value = true;
      ready.value = false;
    });
    regions.on("region-created", (region) => {
      if (syncing) return;
      if (selection && selection !== region) selection.remove();
      selection = region;
      labelHandles(region);
      emit("update:range", [region.start, region.end]);
    });
    regions.on("region-update", (region) => {
      if (!syncing) emit("update:range", [region.start, region.end]);
    });
    regions.on("region-double-clicked", (_region, event) => {
      event.stopPropagation();
      if (!props.disabled) emit("preview");
    });
  } catch {
    if (!own.signal.aborted && !disposed) error.value = true;
  }
}
function labelHandles(region: Region) {
  const handles = region.element?.querySelectorAll<HTMLElement>('[part~="region-handle"]');
  if (!handles) return;
  handles.forEach((handle, index) => {
    handle.tabIndex = 0;
    handle.setAttribute("role", "slider");
    handle.setAttribute("aria-label", index === 0 ? "裁剪起点" : "裁剪终点");
    handle.addEventListener("keydown", (event) => {
      if (props.disabled) return;
      const delta = event.key === "ArrowLeft" ? -0.05 : event.key === "ArrowRight" ? 0.05 : 0;
      if (!delta) return;
      event.preventDefault();
      event.stopPropagation();
      const next = [region.start, region.end];
      next[index] = Math.max(0, Math.min(props.duration, next[index] + delta));
      if (next[1] - next[0] >= 0.05) emit("update:range", next);
    });
  });
}
function syncRange() {
  if (!ready.value || !regions || !props.editing) return;
  const [start, end] = props.range;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
  syncing = true;
  if (!selection) {
    selection = regions.addRegion({
      start,
      end,
      minLength: 0.05,
      color: "rgba(118,101,255,0.10)",
      drag: !props.disabled,
      resize: !props.disabled
    });
    labelHandles(selection);
  } else selection.setOptions({ start, end, drag: !props.disabled, resize: !props.disabled });
  selection.element?.querySelectorAll<HTMLElement>('[part~="region-handle"]').forEach((handle, index) => {
    handle.setAttribute("aria-valuemin", "0");
    handle.setAttribute("aria-valuemax", String(props.duration));
    handle.setAttribute("aria-valuenow", String(props.range[index]));
    handle.setAttribute("aria-valuetext", `${props.range[index].toFixed(2)} 秒`);
  });
  syncing = false;
}
function syncEditing() {
  disableDrag?.();
  disableDrag = undefined;
  if (!regions || !ready.value) return;
  wave?.toggleInteraction(!props.disabled);
  if (!props.editing) {
    selection?.remove();
    selection = undefined;
    return;
  }
  syncRange();
  if (!props.disabled) disableDrag = regions.enableDragSelection({ color: "rgba(118,101,255,0.10)", minLength: 0.05 });
}
function onKeydown(event: KeyboardEvent) {
  if (props.disabled || !ready.value || event.target !== container.value) return;
  const value =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? props.duration
        : event.key === "ArrowLeft"
          ? props.position - 0.1
          : event.key === "ArrowRight"
            ? props.position + 0.1
            : undefined;
  if (value !== undefined) {
    event.preventDefault();
    emit("seek", Math.max(0, Math.min(props.duration, value)));
  }
}
function observe() {
  observer?.disconnect();
  clear();
  if (typeof IntersectionObserver === "undefined") {
    void load();
    return;
  }
  if (container.value) {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect();
          void load();
        }
      },
      { rootMargin: "120px" }
    );
    observer.observe(container.value);
  }
}
onMounted(observe);
watch([() => props.url, () => props.duration, () => props.available], observe);
watch(
  () => props.position,
  (value) => {
    if (wave && ready.value && Math.abs(wave.getCurrentTime() - value) > 0.04) {
      wave.setTime(value);
      const { startTime, endTime } = wave.getRenderer().getVisibleRange().value;
      if (value < startTime || value > endTime) wave.setScrollTime(Math.max(0, value - (endTime - startTime) * 0.2));
    }
  }
);
watch(() => props.range, syncRange, { deep: true });
watch([() => props.editing, () => props.disabled], syncEditing);
onBeforeUnmount(() => {
  disposed = true;
  observer?.disconnect();
  clear();
});
</script>
<style scoped>
.audio-waveform {
  position: relative;
  width: 100%;
  min-width: 0;
}
.audio-waveform-canvas {
  min-height: 76px;
  outline: none;
}
.audio-waveform-canvas:focus-visible {
  outline: 2px solid #7665ff;
  outline-offset: 3px;
  border-radius: 4px;
}
.audio-waveform-status {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  font-size: 11px;
  color: #9ca3b5;
}
.audio-waveform-status :deep(button) {
  pointer-events: auto;
}
.audio-waveform-help {
  font-size: 10px;
  color: #9b95b6;
  display: block;
  margin-top: 4px;
}
.audio-waveform-canvas::part(scroll) {
  scrollbar-color: #a8a2bc #f1eff8;
  scrollbar-width: thin;
}
.audio-waveform-canvas::part(region-handle) {
  border-color: #7665ff !important;
  min-width: 6px;
}
.audio-waveform-canvas::part(region-handle):focus-visible {
  outline: 2px solid #7665ff;
}
</style>
