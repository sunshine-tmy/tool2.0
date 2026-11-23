<template>
  <div
    ref="host"
    class="timeline-audio"
    :class="{ 'is-editing': drag }"
    @pointermove="move"
    @pointerup="finish"
    @pointercancel="cancel"
    @lostpointercapture="lostCapture"
  >
    <canvas ref="canvas" class="audio-peaks" aria-label="音频真实波形"></canvas>
    <span v-if="state === 'loading'" class="wave-status">读取波形…</span>
    <button
      v-else-if="state === 'failed'"
      class="wave-status wave-retry"
      type="button"
      :title="message"
      @pointerdown.stop
      @click.stop="load"
    >
      重试波形
    </button>
    <svg
      class="audio-envelope"
      :viewBox="`0 0 ${width} ${height}`"
      preserveAspectRatio="none"
      aria-label="音量与淡入淡出"
    >
      <path class="envelope-line" :d="envelope" />
      <path
        v-if="!disabled"
        class="volume-target"
        :d="envelope"
        tabindex="0"
        role="slider"
        data-timeline-audio-control
        aria-label="拖动调整音量"
        :aria-valuemin="-61"
        :aria-valuemax="20"
        :aria-valuenow="decibels"
        :aria-valuetext="volumeTooltip(decibels)"
        @pointerdown.stop="start($event, 'volume')"
        @keydown.stop="keyboard($event, 'volume')"
      >
        <title>{{ `音量 ${volumeTooltip(decibels)}，上下拖动调整` }}</title>
      </path>
    </svg>
    <button
      v-for="edge in edges"
      v-show="!disabled"
      :key="edge"
      class="fade-dot"
      type="button"
      data-timeline-audio-control
      role="slider"
      :aria-label="edge === 'fadeIn' ? '调整淡入时长' : '调整淡出时长'"
      :aria-valuemin="0"
      :aria-valuemax="fadeLimit"
      :aria-valuenow="audio[edge]"
      :aria-valuetext="`${audio[edge].toFixed(1)} 秒`"
      :title="`${edge === 'fadeIn' ? '淡入' : '淡出'} ${audio[edge].toFixed(1)} 秒，左右拖动调整`"
      :style="{ left: `${fadeX(edge)}px`, top: `${controlY}px` }"
      @pointerdown.stop="start($event, edge)"
      @keydown.stop="keyboard($event, edge)"
    ></button>
    <span v-if="drag" class="audio-value">{{
      drag.mode === "volume" ? volumeTooltip(decibels) : `${audio[drag.mode].toFixed(1)}s`
    }}</span>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from "vue";

import { loadArchiveMusicWaveform, type ArchiveMusicWaveformData } from "../audio-library/integrations/music";
import { editorNumber, volumeDb, volumePercent, volumeTooltip } from "./editor-numbers";
import {
  audioFade,
  clampAudio,
  positionVolume,
  volumePosition,
  waveformPeak,
  type TimelineAudioChange
} from "./timeline-audio";
export type TimelineAudioValue = {
  start: number;
  end: number;
  sourceStart: number;
  reverseEnd?: number;
  speed?: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  loop: boolean;
  muted?: boolean;
  libraryRevision?: number;
};
const props = defineProps<{
  url: string;
  audio: TimelineAudioValue;
  disabled: boolean;
  waveformVersion?: string;
  loadWaveform?: (signal: AbortSignal) => Promise<ArchiveMusicWaveformData & { hasAudio?: boolean }>;
}>();
const emit = defineEmits<{ begin: []; update: [TimelineAudioChange]; commit: []; cancel: []; available: [boolean] }>();
const host = ref<HTMLElement>(),
  canvas = ref<HTMLCanvasElement>();
const width = ref(1),
  height = ref(1),
  state = ref<"loading" | "ready" | "failed">("loading"),
  message = ref("");
let data: ArchiveMusicWaveformData | undefined, controller: AbortController | undefined;
let loading = false,
  dataVersion = 0,
  sampleKey = "",
  samples = new Float32Array();
const buffer = document.createElement("canvas");
let intersection: IntersectionObserver | undefined,
  observer: ResizeObserver | undefined,
  visible = false;
let drawFrame: number | undefined;
const edges = ["fadeIn", "fadeOut"] as const;
type Mode = "volume" | (typeof edges)[number];
const length = computed(() => Math.max(0.01, props.audio.end - props.audio.start));
const fadeLimit = 10;
const decibels = computed(() => volumeDb(props.audio.volume));
const levelY = computed(() => 6 + volumePosition(decibels.value) * Math.max(1, height.value - 12));
const controlY = computed(() => clampAudio(levelY.value, 6, Math.max(6, height.value - 6)));
const fadeX = (edge: (typeof edges)[number]) => {
  const distance = (Math.min(length.value, props.audio[edge]) / length.value) * width.value;
  return clampAudio(edge === "fadeIn" ? distance : width.value - distance, 6, Math.max(6, width.value - 6));
};
const envelope = computed(() => {
  const points: string[] = [],
    h = height.value - 2;
  for (let i = 0; i <= 64; i++) {
    const gain = audioFade((i / 64) * length.value, length.value, props.audio.fadeIn, props.audio.fadeOut);
    points.push(`${i ? "L" : "M"}${(i / 64) * width.value},${h - (h - levelY.value) * gain}`);
  }
  return points.join(" ");
});
function scheduleDraw() {
  if (drawFrame !== undefined || !visible) return;
  drawFrame = requestAnimationFrame(() => {
    drawFrame = undefined;
    draw();
  });
}
function draw() {
  const surface = canvas.value;
  if (!surface) return;
  const w = Math.max(1, Math.min(3000, Math.ceil(width.value))),
    h = Math.max(1, Math.ceil(height.value));
  if (surface.width !== w) surface.width = w;
  if (surface.height !== h) surface.height = h;
  const output = surface.getContext("2d");
  if (!output) return;
  if (!data) {
    output.clearRect(0, 0, w, h);
    return;
  }
  if (buffer.width !== w) buffer.width = w;
  if (buffer.height !== h) buffer.height = h;
  const ctx = buffer.getContext("2d");
  if (!ctx) return;
  const duration = length.value,
    base = h - 2;
  const key = `${dataVersion}:${w}:${duration}:${props.audio.sourceStart}:${props.audio.speed ?? 1}:${props.audio.loop}:${props.audio.reverseEnd}`;
  if (key !== sampleKey) {
    sampleKey = key;
    samples = new Float32Array(w);
    for (let x = 0; x < w; x++)
      samples[x] = waveformPeak(
        data.peaks,
        data.duration,
        props.audio.reverseEnd !== undefined
          ? props.audio.reverseEnd - ((x + 1) / w) * duration * (props.audio.speed ?? 1)
          : props.audio.sourceStart + (x / w) * duration * (props.audio.speed ?? 1),
        props.audio.reverseEnd !== undefined
          ? props.audio.reverseEnd - (x / w) * duration * (props.audio.speed ?? 1)
          : props.audio.sourceStart + ((x + 1) / w) * duration * (props.audio.speed ?? 1),
        props.audio.loop
      );
  }
  ctx.clearRect(0, 0, w, h);
  const gain = props.audio.muted ? 0 : props.audio.volume / 100;
  ctx.beginPath();
  ctx.moveTo(0, base);
  for (let x = 0; x < w; x++) {
    const fade = audioFade(((x + 0.5) / w) * duration, duration, props.audio.fadeIn, props.audio.fadeOut);
    ctx.lineTo(x + 0.5, base - Math.min(1, samples[x] * gain * fade * 0.85) * (h - 4));
  }
  ctx.lineTo(w, base);
  ctx.closePath();
  ctx.fillStyle = getComputedStyle(host.value!).getPropertyValue("--timeline-wave-fill").trim() || "#0e91bc";
  ctx.fill();
  // 一次替换完整图像，不在参数拖动期间清空或反复重建可见画布。
  output.globalCompositeOperation = "copy";
  output.drawImage(buffer, 0, 0);
  output.globalCompositeOperation = "source-over";
}
async function load() {
  if (!props.url || !visible || loading) return;
  state.value = "loading";
  message.value = "正在读取实际音频波形";
  loading = true;
  const own = (controller = new AbortController());
  try {
    const result = props.loadWaveform
      ? await props.loadWaveform(own.signal)
      : await loadArchiveMusicWaveform(props.url, 0, own.signal, String(props.audio.libraryRevision ?? ""));
    if (own.signal.aborted) return;
    data = result;
    dataVersion++;
    state.value = "ready";
    if ("hasAudio" in result) emit("available", result.hasAudio !== false);
    scheduleDraw();
  } catch (error) {
    if (!own.signal.aborted) {
      state.value = "failed";
      message.value = error instanceof Error ? error.message : "波形读取失败";
      scheduleDraw();
    }
  } finally {
    if (controller === own) loading = false;
  }
}
watch([() => props.url, () => props.audio.libraryRevision, () => props.waveformVersion], () => {
  controller?.abort();
  controller = undefined;
  loading = false;
  data = undefined;
  sampleKey = "";
  state.value = "loading";
  scheduleDraw();
  void load();
});
watch(
  [
    () => props.audio.sourceStart,
    () => props.audio.reverseEnd,
    () => length.value,
    () => props.audio.loop,
    () => props.audio.speed,
    () => props.audio.volume,
    () => props.audio.fadeIn,
    () => props.audio.fadeOut,
    () => props.audio.muted
  ],
  scheduleDraw
);
interface Drag {
  mode: Mode;
  x: number;
  y: number;
  volume: number;
  fade: number;
  pointer: number;
  element: Element;
}
const drag = ref<Drag>();
let zeroSnap = false;
function start(event: PointerEvent, mode: Mode) {
  if (props.disabled || drag.value || event.button !== 0) return;
  event.preventDefault();
  emit("begin");
  const element = event.currentTarget as Element;
  (element as HTMLElement).focus?.({ preventScroll: true });
  drag.value = {
    mode,
    x: event.clientX,
    y: event.clientY,
    volume: decibels.value,
    fade: mode === "volume" ? 0 : Math.min(fadeLimit, props.audio[mode]),
    pointer: event.pointerId,
    element
  };
  zeroSnap = false;
  element.setPointerCapture(event.pointerId);
}
function move(event: PointerEvent) {
  const g = drag.value;
  if (!g || event.pointerId !== g.pointer) return;
  event.preventDefault();
  event.stopPropagation();
  if (g.mode === "volume") {
    const position = volumePosition(g.volume) + (event.clientY - g.y) / Math.max(1, height.value - 12);
    let db = editorNumber(clampAudio(positionVolume(position), -61, 20), 1);
    if (Math.abs(db) <= (zeroSnap ? 2.5 : 1.5)) {
      db = 0;
      zeroSnap = true;
    } else zeroSnap = false;
    emit("update", { volume: volumePercent(db < -60 ? -61 : db) });
  } else {
    const delta = ((event.clientX - g.x) / Math.max(1, width.value)) * length.value * (g.mode === "fadeIn" ? 1 : -1);
    emit("update", { [g.mode]: editorNumber(clampAudio(g.fade + delta, 0, fadeLimit), 1) });
  }
}
function clearDrag() {
  const g = drag.value;
  drag.value = undefined;
  if (g?.element === document.activeElement) (g.element as HTMLElement).blur?.();
  if (g?.element.hasPointerCapture(g.pointer)) g.element.releasePointerCapture(g.pointer);
}
function finish(event: PointerEvent) {
  if (!drag.value || event.pointerId !== drag.value.pointer) return;
  move(event);
  clearDrag();
  emit("commit");
}
function cancel() {
  if (drag.value) {
    clearDrag();
    emit("cancel");
  }
}
function lostCapture() {
  if (drag.value) cancel();
}
function keyboard(event: KeyboardEvent, mode: Mode) {
  if (props.disabled || drag.value || event.ctrlKey || event.metaKey || event.altKey) return;
  const amount = ["ArrowUp", "ArrowRight"].includes(event.key)
    ? 0.1
    : ["ArrowDown", "ArrowLeft"].includes(event.key)
      ? -0.1
      : 0;
  if (!amount && event.key !== "Home" && event.key !== "End") return;
  event.preventDefault();
  emit("begin");
  const min = mode === "volume" ? -61 : 0,
    max = mode === "volume" ? 20 : fadeLimit;
  const value =
    event.key === "Home"
      ? min
      : event.key === "End"
        ? max
        : clampAudio((mode === "volume" ? decibels.value : props.audio[mode]) + amount, min, max);
  emit(
    "update",
    mode === "volume"
      ? { volume: volumePercent(value < -60 ? (amount > 0 ? -60 : -61) : value) }
      : { [mode]: editorNumber(value, 1) }
  );
  emit("commit");
}
function escape(event: KeyboardEvent) {
  if (event.key === "Escape" && drag.value) {
    event.preventDefault();
    event.stopImmediatePropagation();
    cancel();
  }
}
watch(
  () => props.disabled,
  (value) => {
    if (value) cancel();
  }
);
onMounted(() => {
  const element = host.value!;
  observer = new ResizeObserver(() => {
    width.value = element.clientWidth;
    height.value = element.clientHeight;
    scheduleDraw();
  });
  observer.observe(element);
  intersection = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        if (!data && state.value !== "failed") void load();
        else scheduleDraw();
      } else if (state.value === "loading") {
        controller?.abort();
        controller = undefined;
        loading = false;
      }
    },
    { root: element.closest(".cut-scroll"), rootMargin: "150px" }
  );
  intersection.observe(element);
  window.addEventListener("keydown", escape, true);
  window.addEventListener("blur", cancel);
});
onScopeDispose(() => {
  cancel();
  controller?.abort();
  intersection?.disconnect();
  observer?.disconnect();
  if (drawFrame !== undefined) cancelAnimationFrame(drawFrame);
  window.removeEventListener("keydown", escape, true);
  window.removeEventListener("blur", cancel);
});
</script>
<style scoped>
.timeline-audio {
  position: absolute;
  inset: 12px 0 0;
  --timeline-wave-fill: var(--timeline-audio-wave, #0e91bc);
  pointer-events: none;
}
.audio-peaks,
.audio-envelope {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.envelope-line {
  fill: none;
  stroke: #fff;
  stroke-width: 1.25;
  vector-effect: non-scaling-stroke;
}
.volume-target {
  fill: none;
  stroke: transparent;
  stroke-width: 10;
  pointer-events: var(--audio-controls-events, none);
  cursor: ns-resize;
}
.volume-target:focus-visible {
  stroke: rgb(101 88 255 / 25%);
  outline: none;
}
.fade-dot {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  padding: 0;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 35%);
  border-radius: 50%;
  background: #fff;
  cursor: ew-resize;
  pointer-events: var(--audio-controls-events, none);
  touch-action: none;
}
.fade-dot:focus-visible {
  outline: 2px solid var(--color-primary-600);
  outline-offset: 2px;
}
.wave-retry {
  border: 0;
  padding: 0;
  background: var(--timeline-audio-background, #12345a);
  pointer-events: auto;
  cursor: pointer;
  z-index: 3;
}
.wave-status {
  position: absolute;
  left: 10px;
  bottom: 2px;
  font-size: 10px;
  color: var(--timeline-audio-text, #e4f3ff);
}
.audio-value {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translateX(-50%);
  background: var(--color-text-primary);
  color: var(--color-surface);
  padding: 0 4px;
  border-radius: 3px;
  font-size: 10px;
  line-height: 16px;
  z-index: 4;
  white-space: nowrap;
}
.audio-envelope,
.fade-dot {
  opacity: var(--audio-controls-opacity, 0);
  visibility: var(--audio-controls-visibility, hidden);
}
.timeline-audio.is-editing {
  --audio-controls-opacity: 1;
  --audio-controls-visibility: visible;
  --audio-controls-events: auto;
}
</style>
