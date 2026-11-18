<template>
  <section class="video-timeline" aria-label="字幕区间时间线">
    <div class="timeline-toolbar">
      <strong>字幕时间线</strong><span>{{ currentTime.toFixed(2) }} / {{ duration.toFixed(2) }} 秒</span>
      <label><input v-model="snapping" type="checkbox" /> 自动吸附</label>
      <div class="timeline-zoom" role="group" aria-label="时间线缩放">
        <n-button
          size="small"
          quaternary
          aria-label="缩小时间线"
          title="缩小时间线"
          :disabled="zoom === 1"
          @click="zoom = Math.max(1, zoom / 2)"
        >
          <template #icon><ZoomOut :size="16" aria-hidden="true" /></template>
        </n-button>
        <input
          v-model.number="zoomLevel"
          type="range"
          class="timeline-zoom-slider"
          min="0"
          :max="maxZoomLevel"
          step="0.05"
          aria-label="时间线缩放比例"
          :aria-valuetext="zoomLabel"
          :title="zoomLabel"
          :style="{ '--zoom-progress': `${(zoomLevel / maxZoomLevel) * 100}%` }"
        />
        <n-button
          size="small"
          quaternary
          aria-label="放大时间线"
          title="放大时间线"
          :disabled="zoom === maxZoom"
          @click="zoom = Math.min(maxZoom, zoom * 2)"
        >
          <template #icon><ZoomIn :size="16" aria-hidden="true" /></template>
        </n-button>
      </div>
    </div>
    <div ref="scrollViewport" class="timeline-scroll" @wheel="zoomWheel">
      <div
        ref="track"
        class="timeline-track"
        :class="{ 'is-moving': clipMove }"
        tabindex="-1"
        aria-description="在空白处拖动框选区间，按 Delete 或 Backspace 删除选中区间"
        :style="{ width: `${zoom * 100}%`, height: `${52 + visibleLaneCount * laneHeight}px` }"
        @pointerdown="begin($event, ranges.length ? 'box' : 'seek')"
        @pointermove="move"
        @pointerup="finish"
        @pointercancel="cancel"
        @lostpointercapture="releaseDrag()"
        @keydown.self="deleteRange($event, activeIndex)"
      >
        <div class="timeline-ruler" @pointerdown.stop="begin($event, 'seek')">
          <span v-for="index in 11" :key="index" :style="{ left: `${(index - 1) * 10}%` }"
            >{{ (((index - 1) * duration) / 10).toFixed(1) }}s</span
          >
        </div>
        <div v-if="!ranges.length" class="timeline-empty">添加区间后，拖动片段两端调整范围</div>
        <div
          v-for="(range, index) in ranges"
          :key="index"
          class="timeline-clip"
          tabindex="0"
          role="group"
          :aria-label="`字幕区间 ${index + 1}`"
          :class="{ selected: isSelected(index), 'is-dragging': clipMove?.index === index }"
          :style="{
            left: `${(range.start / duration) * 100}%`,
            width: `${((range.end - range.start) / duration) * 100}%`,
            top: `${clipTop + lanes.rows[index] * laneHeight}px`,
            height: `${clipHeight}px`,
            transform: clipMove?.index === index ? `translate(${clipMove.dx}px, ${clipMove.dy}px)` : undefined
          }"
          @pointerdown.stop="begin($event, 'move', index)"
          @focusin="$emit('select', index)"
          @keydown="deleteRange($event, index)"
        >
          <button
            class="trim-handle start"
            :aria-label="`调整区间 ${index + 1} 开始`"
            @pointerdown.stop="begin($event, 'start', index)"
            @keydown.left.prevent="nudge(index, 'start', -0.01)"
            @keydown.right.prevent="nudge(index, 'start', 0.01)"
          ></button>
          <button
            class="clip-label"
            :aria-label="`选择区间 ${index + 1}`"
            @click="keyboardSelect($event, index)"
          >
            区间 {{ index + 1 }} · {{ range.rects.length }} 框
          </button>
          <button
            class="trim-handle end"
            :aria-label="`调整区间 ${index + 1} 结束`"
            @pointerdown.stop="begin($event, 'end', index)"
            @keydown.left.prevent="nudge(index, 'end', -0.01)"
            @keydown.right.prevent="nudge(index, 'end', 0.01)"
          ></button>
        </div>
        <div
          v-if="clipMove"
          class="timeline-drop-line"
          :style="{ top: `${clipTop + clipMove.lane * laneHeight + clipHeight / 2}px` }"
          aria-hidden="true"
        ></div>
        <div
          v-if="snapGuide !== undefined"
          class="timeline-snap-guide"
          :style="{ left: `${(snapGuide / duration) * 100}%` }"
          aria-hidden="true"
        ></div>
        <div v-if="marquee" class="timeline-marquee" :style="marqueeStyle" aria-hidden="true"></div>
        <div class="timeline-playhead" :style="{ left: `${(currentTime / duration) * 100}%` }">
          <button
            aria-label="播放指针"
            role="slider"
            :aria-valuenow="currentTime"
            :aria-valuemin="0"
            :aria-valuemax="duration"
            @pointerdown.stop="begin($event, 'seek')"
          ></button>
        </div>
      </div>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { NButton } from "naive-ui";
import { ZoomIn, ZoomOut } from "lucide-vue-next";
import type { VideoAiTimedRegion } from "@toolbox/shared";
import {
  editTimelineRange,
  layoutTimelineLanes,
  previewTimelineRangeEdit,
  snapTime,
  timelineRangesOverlap
} from "./timeline";
const props = defineProps<{
  ranges: VideoAiTimedRegion[];
  duration: number;
  currentTime: number;
  activeIndex: number;
  selectedIndices?: number[];
}>();
const emit = defineEmits<{
  "update:ranges": [value: VideoAiTimedRegion[]];
  seek: [time: number];
  "seek-start": [];
  "seek-end": [];
  select: [index: number];
  "box-select": [indices: number[]];
  remove: [index: number];
  "remove-selected": [];
  "edit-start": [];
  "edit-end": [cancelled: boolean];
}>();
const track = ref<HTMLElement>();
const scrollViewport = ref<HTMLElement>();
const clipTop = 36;
const clipHeight = 34;
const laneHeight = 44;
const maxZoomLevel = 4;
const maxZoom = 2 ** maxZoomLevel;
const zoom = ref(1),
  snapping = ref(true);
const zoomLevel = computed({
  get: () => Math.log2(zoom.value),
  set: (level: number) => {
    zoom.value = 2 ** level;
  }
});
const zoomLabel = computed(() => `${Math.round(zoom.value * 100)}%`);
async function zoomWheel(event: WheelEvent) {
  if ((!event.ctrlKey && !event.metaKey) || !event.deltaY) return;
  event.preventDefault();
  const viewport = scrollViewport.value,
    element = track.value;
  if (!viewport || !element || drag) return;
  const bounds = element.getBoundingClientRect();
  if (!bounds.width) return;
  const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
  const previous = zoom.value;
  const next = Math.max(1, Math.min(maxZoom, previous * Math.exp(-Math.max(-160, Math.min(160, pixels)) * 0.0025)));
  if (next === previous) return;
  const anchor = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
  const offset = viewport.scrollLeft + anchor * bounds.width * (next / previous - 1);
  zoom.value = next;
  await nextTick();
  if (scrollViewport.value === viewport) viewport.scrollLeft = Math.max(0, offset);
}
const lanes = computed(() => layoutTimelineLanes(props.ranges));
const clipMove = ref<{ index: number; dx: number; dy: number; lane: number; range: VideoAiTimedRegion }>();
const snapGuide = ref<number>();
const lastDropLane = computed(() => Math.min(lanes.value.count, props.ranges.length));
const visibleLaneCount = computed(() => (clipMove.value ? lastDropLane.value + 1 : lanes.value.count));
type TimelineGesture = "seek" | "move" | "start" | "end" | "box";
let drag:
  | {
      operation: TimelineGesture;
      index: number;
      x: number;
      y: number;
      width: number;
      left: number;
      top: number;
      initial: VideoAiTimedRegion[];
      time: number;
      pointerId: number;
      moved: boolean;
    }
  | undefined;
const marquee = ref<{ left: number; top: number; width: number; height: number; trackWidth: number }>();
const marqueeStyle = computed(() => {
  if (!marquee.value) return undefined;
  const { left, top, width, height } = marquee.value;
  return { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` };
});
const marqueeHits = computed(() => {
  const box = marquee.value;
  if (!box) return new Set<number>();
  const start = (box.left / box.trackWidth) * props.duration;
  const end = ((box.left + box.width) / box.trackWidth) * props.duration;
  const hits = new Set<number>();
  props.ranges.forEach((range, index) => {
    const top = clipTop + lanes.value.rows[index] * laneHeight;
    if (range.start < end && range.end > start && top < box.top + box.height && top + clipHeight > box.top) {
      hits.add(index);
    }
  });
  return hits;
});
function isSelected(index: number) {
  if (marquee.value) return marqueeHits.value.has(index);
  return props.selectedIndices?.length ? props.selectedIndices.includes(index) : props.activeIndex === index;
}
function targets(index = -1) {
  return [0, props.duration, ...props.ranges.flatMap((range, i) => (i === index ? [] : [range.start, range.end]))];
}
function seek(time: number) {
  emit("seek", Math.max(0, Math.min(props.duration, time)));
}
function begin(event: PointerEvent, operation: TimelineGesture, index = -1) {
  if (event.button !== 0 || !track.value || drag) return;
  const bounds = track.value.getBoundingClientRect();
  if (!bounds.width) return;
  drag = {
    operation,
    index,
    x: event.clientX,
    y: event.clientY,
    width: bounds.width,
    left: bounds.left,
    top: bounds.top,
    initial: props.ranges,
    time: props.currentTime,
    pointerId: event.pointerId,
    moved: false
  };
  if (operation === "seek") emit("seek-start");
  else if (operation !== "box") emit("edit-start");
  track.value.setPointerCapture(event.pointerId);
  if (index >= 0) {
    emit("select", index);
    (event.target as HTMLElement).closest<HTMLElement>(".timeline-clip")?.focus({ preventScroll: true });
  }
  if (operation === "seek") {
    track.value.querySelector<HTMLButtonElement>(".timeline-playhead button")?.focus({ preventScroll: true });
    move(event);
  }
  event.preventDefault();
}
function move(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (drag.operation === "box") {
    if (Math.abs(event.clientX - drag.x) > 3 || Math.abs(event.clientY - drag.y) > 3) drag.moved = true;
    if (!drag.moved) return;
    marquee.value = {
      left: Math.min(drag.x, event.clientX) - drag.left,
      top: Math.min(drag.y, event.clientY) - drag.top,
      width: Math.max(1, Math.abs(event.clientX - drag.x)),
      height: Math.max(1, Math.abs(event.clientY - drag.y)),
      trackWidth: drag.width
    };
    return;
  }
  if (drag.operation === "move") {
    previewClipMove(event, drag);
    return;
  }
  if (Math.abs(event.clientX - drag.x) > 3) drag.moved = true;
  const tolerance = snapping.value && !event.altKey ? (props.duration / drag.width) * 8 : 0;
  if (drag.operation === "seek") {
    seek(
      snapTime(
        Math.max(0, Math.min(props.duration, ((event.clientX - drag.left) / drag.width) * props.duration)),
        targets(),
        tolerance
      )
    );
    return;
  }
  if (!drag.moved) return;
  const { range, snappedAt } = previewTimelineRangeEdit(
    drag.initial[drag.index],
    drag.operation,
    ((event.clientX - drag.x) / drag.width) * props.duration,
    props.duration,
    [props.currentTime, ...targets(drag.index)],
    tolerance
  );
  snapGuide.value = snappedAt;
  emit(
    "update:ranges",
    drag.initial.map((value, index) => (index === drag!.index ? range : value))
  );
}
function previewClipMove(event: PointerEvent, gesture: NonNullable<typeof drag>) {
  const bounds = track.value?.getBoundingClientRect();
  const initial = gesture.initial[gesture.index];
  if (!bounds || !initial) return;
  const dx = event.clientX - gesture.x + gesture.left - bounds.left;
  const dy = event.clientY - gesture.y + gesture.top - bounds.top;
  if (!gesture.moved && Math.max(Math.abs(dx), Math.abs(dy)) <= 3) return;
  gesture.moved = true;
  const secondsPerPixel = props.duration / gesture.width;
  const tolerance = snapping.value && !event.altKey ? secondsPerPixel * 8 : 0;
  const snapTargets = [props.currentTime, ...targets(gesture.index)];
  const { range, snappedAt } = previewTimelineRangeEdit(
    initial,
    "move",
    dx * secondsPerPixel,
    props.duration,
    snapTargets,
    dx === 0 ? Math.min(tolerance, Number.EPSILON) : tolerance
  );
  snapGuide.value = snappedAt;
  const originalLane = lanes.value.rows[gesture.index];
  const floatLane = originalLane + dy / laneHeight;
  const occupied = new Set<number>();
  gesture.initial.forEach((other, index) => {
    if (index !== gesture.index && timelineRangesOverlap(range, other)) occupied.add(lanes.value.rows[index]);
  });
  let lane = 0;
  let distance = Infinity;
  for (let row = 0; row <= lastDropLane.value; row++) {
    const fromPointer = Math.abs(row - floatLane);
    if (occupied.has(row) || fromPointer >= distance) continue;
    lane = row;
    distance = fromPointer;
  }
  clipMove.value = {
    index: gesture.index,
    dx: (range.start - initial.start) / secondsPerPixel,
    dy: Math.max(-originalLane * laneHeight, Math.min((lastDropLane.value - originalLane) * laneHeight, dy)),
    lane,
    range
  };
}
function releaseDrag(cancelled = false) {
  const pointer = drag?.pointerId;
  if (drag?.operation === "seek") emit("seek-end");
  else if (drag && drag.operation !== "box") emit("edit-end", cancelled);
  drag = undefined;
  clipMove.value = undefined;
  snapGuide.value = undefined;
  marquee.value = undefined;
  if (pointer !== undefined && track.value?.hasPointerCapture(pointer)) track.value.releasePointerCapture(pointer);
}
function finish(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (drag.operation === "box") {
    move(event);
    if (drag.moved) {
      emit("box-select", [...marqueeHits.value]);
      track.value?.focus({ preventScroll: true });
    } else {
      emit("select", props.activeIndex);
      const tolerance = snapping.value && !event.altKey ? (props.duration / drag.width) * 8 : 0;
      seek(snapTime(((event.clientX - drag.left) / drag.width) * props.duration, targets(), tolerance));
      track.value?.querySelector<HTMLButtonElement>(".timeline-playhead button")?.focus({ preventScroll: true });
    }
  } else if (drag.operation === "move") {
    previewClipMove(event, drag);
    const preview = clipMove.value;
    if (preview) {
      const { index, lane, range } = preview;
      const original = drag.initial[index];
      if (range.start !== original.start || lane !== lanes.value.rows[index]) {
        emit(
          "update:ranges",
          drag.initial.map((other, i) => (i === index ? { ...range, lane } : { ...other, lane: lanes.value.rows[i] }))
        );
      }
    }
  } else if (drag.operation === "start" || drag.operation === "end") {
    move(event);
  }
  releaseDrag();
}
function keyboardSelect(event: MouseEvent, index: number) {
  if (event.detail !== 0) return;
  emit("select", index);
}
async function deleteRange(event: KeyboardEvent, index: number) {
  if (
    (event.key !== "Backspace" && event.key !== "Delete") ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    (event.target as HTMLElement).closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
  )
    return;
  event.preventDefault();
  event.stopPropagation();
  const multiple = (props.selectedIndices?.length ?? 0) > 1;
  if (event.repeat || (!multiple && !props.ranges[index])) return;
  releaseDrag();
  if (multiple) {
    emit("remove-selected");
    track.value?.focus({ preventScroll: true });
    return;
  }
  emit("remove", index);
  await nextTick();
  const clips = track.value?.querySelectorAll<HTMLElement>(".timeline-clip");
  clips?.[Math.min(index, clips.length - 1)]?.focus({ preventScroll: true });
}
function cancel() {
  if (drag?.operation === "seek") seek(drag.time);
  else if (drag?.operation === "start" || drag?.operation === "end") emit("update:ranges", drag.initial);
  releaseDrag(true);
}
function nudge(index: number, operation: "start" | "end" | "move", delta: number) {
  emit(
    "update:ranges",
    props.ranges.map((range, i) =>
      i === index ? editTimelineRange(range, operation, delta, props.duration, [], 0) : range
    )
  );
}
</script>
<style scoped>
.video-timeline {
  min-width: 0;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
}
.timeline-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
.timeline-toolbar span,
.timeline-toolbar label,
p {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.timeline-scroll {
  overflow-x: auto;
  padding: 0 10px;
}
.timeline-track {
  position: relative;
  min-width: 100%;
  touch-action: none;
  user-select: none;
  background: var(--color-surface-subtle);
}
.timeline-ruler {
  height: 28px;
  border-bottom: 1px solid var(--color-border);
  cursor: crosshair;
}
.timeline-ruler span {
  position: absolute;
  transform: translateX(-50%);
  font-size: 10px;
  color: var(--color-text-secondary);
  border-left: 1px solid var(--color-border-strong);
  padding-top: 4px;
  pointer-events: none;
}
.timeline-clip {
  position: absolute;
  display: flex;
  box-sizing: border-box;
  border: 1px solid var(--color-primary-200);
  border-radius: 5px;
  background: var(--color-primary-100);
  color: var(--color-primary-800);
  cursor: grab;
}
.timeline-clip.selected {
  border: 2px solid var(--color-primary-600);
}
.timeline-drop-line {
  position: absolute;
  inset-inline: 0;
  z-index: 1;
  height: 2px;
  transform: translateY(-50%);
  background: var(--color-primary-600);
  pointer-events: none;
}
.timeline-snap-guide {
  position: absolute;
  inset-block: 12px 0;
  z-index: 4;
  width: 2px;
  transform: translateX(-50%);
  background: var(--color-primary-600);
  pointer-events: none;
}
.timeline-clip button {
  color: inherit;
  border: 0;
  background: transparent;
  padding: 0;
}
.clip-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  cursor: grab;
}
.trim-handle {
  width: 12px;
  flex: 0 0 12px;
  cursor: ew-resize;
  z-index: 1;
}
.timeline-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 3;
}
.timeline-marquee {
  position: absolute;
  z-index: 2;
  border: 1px solid var(--color-primary-600);
  background: color-mix(in srgb, var(--color-primary-600) 16%, transparent);
  pointer-events: none;
  box-sizing: border-box;
}
.timeline-playhead::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 10px;
  transform: translateX(-50%);
  background: var(--color-error);
  clip-path: polygon(0 4px, 100% 4px, 60% 12px, 60% 100%, 40% 100%, 40% 12px);
}
.timeline-playhead button {
  position: absolute;
  left: 0;
  transform: translateX(-50%);
  top: 0;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: ew-resize;
  pointer-events: auto;
}
.timeline-playhead button:focus-visible {
  outline: none;
}
.timeline-playhead:has(> button:focus-visible)::before {
  background: linear-gradient(
    color-mix(in srgb, var(--color-error) 72%, black) 12px,
    var(--color-error) 12px
  );
}
.timeline-empty {
  padding: var(--space-3);
  color: var(--color-text-secondary);
  font-size: 12px;
}
p {
  margin: var(--space-2) 0 0;
}

.video-timeline {
  padding: 10px 0 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.timeline-toolbar {
  gap: 10px;
}
.timeline-toolbar label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.timeline-toolbar input {
  accent-color: var(--color-primary-600);
}
.timeline-zoom {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.timeline-zoom-slider {
  appearance: none;
  width: 96px;
  height: 28px;
  margin: 0;
  background: transparent;
  cursor: pointer;
}
.timeline-zoom-slider::-webkit-slider-runnable-track {
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(
    to right,
    var(--color-primary-600) var(--zoom-progress),
    var(--color-border-strong) var(--zoom-progress)
  );
}
.timeline-zoom-slider::-webkit-slider-thumb {
  appearance: none;
  width: 8px;
  height: 12px;
  margin-top: -5px;
  border-radius: 3px;
  background: var(--color-primary-600);
}
.timeline-zoom-slider::-moz-range-track {
  height: 2px;
  border-radius: 2px;
  background: var(--color-border-strong);
}
.timeline-zoom-slider::-moz-range-progress {
  height: 2px;
  background: var(--color-primary-600);
}
.timeline-zoom-slider::-moz-range-thumb {
  width: 8px;
  height: 12px;
  border: 0;
  border-radius: 3px;
  background: var(--color-primary-600);
}
.timeline-zoom-slider:focus-visible {
  outline: 2px solid var(--color-primary-600);
  outline-offset: 2px;
  border-radius: 4px;
}
.timeline-track {
  border-radius: 6px;
  background: var(--color-surface-subtle);
}
.timeline-clip {
  border-color: var(--color-primary-200);
  border-radius: 6px;
  background: var(--color-primary-400, #a69aff);
  color: white;
}
.timeline-clip.selected {
  border-color: var(--color-primary-600);
  box-shadow: inset 0 0 0 2px var(--color-surface);
  background: var(--color-primary-500);
}
.timeline-track.is-moving,
.timeline-track.is-moving :is(.timeline-ruler, .timeline-clip, .clip-label, .trim-handle) {
  cursor: grabbing;
}
.timeline-clip.is-dragging {
  z-index: 2;
  pointer-events: none;
  box-shadow: 0 3px 14px color-mix(in srgb, var(--color-primary-600) 26%, transparent);
}
.timeline-clip:focus-visible {
  outline: 2px solid var(--color-primary-600);
  outline-offset: 2px;
}
</style>
