<template>
  <div ref="stage" class="watermark-stage">
    <slot />
    <div v-if="active && asset && videoSize.width && box.width" class="watermark-viewport" :style="viewportStyle">
      <svg
        v-if="paused && settings.motion.type !== 'fixed'"
        class="watermark-path"
        :viewBox="`0 0 ${videoSize.width} ${videoSize.height}`"
        aria-hidden="true"
      >
        <polyline
          :points="trajectory"
          fill="none"
          stroke="#38bdf8"
          stroke-width="2"
          vector-effect="non-scaling-stroke"
          stroke-dasharray="5 4"
        />
      </svg>
      <button
        v-if="position.visible"
        class="watermark-handle"
        :class="{ 'is-playing': !paused }"
        type="button"
        aria-label="拖动水印位置"
        :disabled="disabled"
        :style="imageStyle"
        @pointerdown="startDrag"
        @pointermove="drag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
        @lostpointercapture="endDrag"
        @keydown="keyboardMove"
      >
        <img :src="asset.url" alt="水印效果" draggable="false" :style="{ opacity: settings.opacity / 100 }" />
      </button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onScopeDispose, reactive, ref, watch } from "vue";
import {
  archiveWatermarkBouncePath,
  archiveWatermarkPosition,
  archiveWatermarkSize,
  type ArchiveWatermarkSettings
} from "@toolbox/shared/archive";
const props = defineProps<{
  video?: HTMLVideoElement;
  active: boolean;
  disabled: boolean;
  asset?: { width: number; height: number; url: string };
  settings: ArchiveWatermarkSettings;
}>();
const emit = defineEmits<{ move: [{ x: number; y: number }]; time: [number]; duration: [number] }>();
const stage = ref<HTMLElement>(),
  time = ref(0),
  paused = ref(true);
const videoSize = reactive({ width: 0, height: 0 }),
  box = reactive({ left: 0, top: 0, width: 0, height: 0 });
const position = computed(() => archiveWatermarkPosition(props.settings, time.value));
const size = computed(() =>
  props.asset ? archiveWatermarkSize(props.settings, props.asset, videoSize) : { width: 0, height: 0 }
);
const viewportStyle = computed(() => ({
  left: `${box.left}px`,
  top: `${box.top}px`,
  width: `${box.width}px`,
  height: `${box.height}px`
}));
const imageStyle = computed(() => ({
  left: `${position.value.x * (1 - size.value.width / videoSize.width) * 100}%`,
  top: `${position.value.y * (1 - size.value.height / videoSize.height) * 100}%`,
  width: `${(size.value.width / videoSize.width) * 100}%`,
  height: `${(size.value.height / videoSize.height) * 100}%`
}));
const trajectory = computed(() => {
  if (!props.asset || !props.video) return "";
  const start = props.settings.startSeconds,
    end = Math.min(
      props.settings.endSeconds ?? props.video.duration,
      props.video.duration,
      props.settings.motion.type === "bounce" &&
        props.settings.motion.bounceStyle &&
        props.settings.motion.bounceStyle !== "standard"
        ? start + props.settings.motion.periodSeconds
        : Infinity
    );
  const times = Array.from({ length: 61 }, (_, index) => start + ((end - start) * index) / 60);
  const path = props.settings.motion.type === "bounce" ? archiveWatermarkBouncePath(props.settings) : undefined;
  if (path)
    for (let i = 0; i <= (path.length - 1) * 2; i++) {
      const time = start + (i * props.settings.motion.periodSeconds) / ((path.length - 1) * 2);
      if (time <= end) times.push(time);
    }
  return [...new Set(times)]
    .sort((a, b) => a - b)
    .map((time) => {
      const p = archiveWatermarkPosition(props.settings, time);
      return `${p.x * (videoSize.width - size.value.width) + size.value.width / 2},${p.y * (videoSize.height - size.value.height) + size.value.height / 2}`;
    })
    .join(" ");
});
let stop = () => undefined as void;
watch(
  () => props.video,
  (video) => {
    stop();
    if (!video) return;
    let animation: number | undefined;
    const measure = () => {
      const bounds = video.getBoundingClientRect(),
        parent = stage.value?.getBoundingClientRect();
      videoSize.width = video.videoWidth;
      videoSize.height = video.videoHeight;
      if (!parent || !videoSize.width || !videoSize.height) return;
      const scale = Math.min(bounds.width / videoSize.width, bounds.height / videoSize.height);
      Object.assign(box, {
        width: videoSize.width * scale,
        height: videoSize.height * scale,
        left: bounds.left - parent.left + (bounds.width - videoSize.width * scale) / 2,
        top: bounds.top - parent.top + (bounds.height - videoSize.height * scale) / 2
      });
      if (Number.isFinite(video.duration)) emit("duration", video.duration);
    };
    const update = () => {
      time.value = video.currentTime;
      paused.value = video.paused;
      emit("time", video.currentTime);
    };
    const animate = () => {
      update();
      if (!video.paused) animation = requestAnimationFrame(animate);
    };
    const play = () => {
      if (animation !== undefined) cancelAnimationFrame(animation);
      animate();
    };
    const events = ["timeupdate", "seeking", "seeked", "pause", "ended"];
    events.forEach((name) => video.addEventListener(name, update));
    video.addEventListener("play", play);
    video.addEventListener("loadedmetadata", measure);
    const resize = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    resize?.observe(video);
    if (stage.value) resize?.observe(stage.value);
    window.addEventListener("resize", measure);
    measure();
    update();
    stop = () => {
      if (animation !== undefined) cancelAnimationFrame(animation);
      resize?.disconnect();
      window.removeEventListener("resize", measure);
      events.forEach((name) => video.removeEventListener(name, update));
      video.removeEventListener("play", play);
      video.removeEventListener("loadedmetadata", measure);
    };
  },
  { flush: "post" }
);
onScopeDispose(() => stop());
let pointer: { id: number; x: number; y: number; left: number; top: number } | undefined;
function startDrag(event: PointerEvent) {
  if (props.disabled) return;
  props.video?.pause();
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, left: position.value.x, top: position.value.y };
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  event.preventDefault();
}
function drag(event: PointerEvent) {
  if (!pointer || pointer.id !== event.pointerId || props.disabled) return;
  const width = box.width * (1 - size.value.width / videoSize.width),
    height = box.height * (1 - size.value.height / videoSize.height);
  emit("move", {
    x: Math.max(0, Math.min(1, pointer.left + (width > 0 ? (event.clientX - pointer.x) / width : 0))),
    y: Math.max(0, Math.min(1, pointer.top + (height > 0 ? (event.clientY - pointer.y) / height : 0)))
  });
}
function endDrag() {
  pointer = undefined;
}
function keyboardMove(event: KeyboardEvent) {
  const offset: Record<string, [number, number]> = {
    ArrowLeft: [-0.01, 0],
    ArrowRight: [0.01, 0],
    ArrowUp: [0, -0.01],
    ArrowDown: [0, 0.01]
  };
  if (!offset[event.key] || props.disabled) return;
  event.preventDefault();
  props.video?.pause();
  const [x, y] = offset[event.key];
  emit("move", {
    x: Math.max(0, Math.min(1, position.value.x + x)),
    y: Math.max(0, Math.min(1, position.value.y + y))
  });
}
</script>
<style scoped>
.watermark-stage {
  position: relative;
  width: 100%;
}
.watermark-viewport {
  position: absolute;
  pointer-events: none;
  overflow: hidden;
}
.watermark-path {
  position: absolute;
  width: 100%;
  height: 100%;
}
.watermark-handle {
  position: absolute;
  display: block;
  border: 0;
  padding: 0;
  background: transparent;
  pointer-events: auto;
  cursor: move;
  touch-action: none;
}
.watermark-handle:focus-visible {
  outline: 2px solid #38bdf8;
  outline-offset: 2px;
}
.watermark-handle img {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.watermark-handle.is-playing {
  pointer-events: none;
}
</style>
