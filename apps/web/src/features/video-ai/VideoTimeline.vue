<template>
  <section class="video-timeline" aria-label="字幕区间时间线">
    <div class="timeline-toolbar">
      <strong>字幕时间线</strong><span>{{ currentTime.toFixed(2) }} / {{ duration.toFixed(2) }} 秒</span>
      <label><input v-model="snapping" type="checkbox" /> 自动吸附</label>
      <n-button size="small" :disabled="zoom === 1" @click="zoom = Math.max(1, zoom / 2)">缩小</n-button>
      <n-button size="small" :disabled="zoom === 16" @click="zoom = Math.min(16, zoom * 2)">放大</n-button>
    </div>
    <div ref="scrollViewport" class="timeline-scroll" @wheel="zoomWheel">
      <div
        ref="track"
        class="timeline-track"
        :style="{ width: `${zoom * 100}%`, height: `${52 + lanes.count * 44}px` }"
        @pointerdown="begin($event, 'seek')"
        @pointermove="move"
        @pointerup="finish"
        @pointercancel="cancel"
        @lostpointercapture="releaseDrag"
      >
        <div class="timeline-ruler">
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
          :class="{ selected: activeIndex === index }"
          :style="{
            left: `${(range.start / duration) * 100}%`,
            width: `${((range.end - range.start) / duration) * 100}%`,
            top: `${36 + lanes.rows[index] * 44}px`
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
            @keydown.left.prevent="nudge(index, 'move', -0.01)"
            @keydown.right.prevent="nudge(index, 'move', 0.01)"
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
        <div class="timeline-playhead" :style="{ left: `${(currentTime / duration) * 100}%` }">
          <button
            aria-label="播放指针"
            role="slider"
            :aria-valuenow="currentTime"
            :aria-valuemin="0"
            :aria-valuemax="duration"
            @pointerdown.stop="begin($event, 'seek')"
            @keydown.left.prevent="seek(currentTime - 0.01)"
            @keydown.right.prevent="seek(currentTime + 0.01)"
          >
            ▼
          </button>
        </div>
      </div>
    </div>
    <p>
      拖动标尺或指针定位视频画面；拖动片段移动区间，拉动两端调整长度。Ctrl／Command＋滚轮缩放时间线。靠近边界时自动对齐，按住
      Alt 可临时关闭吸附。选中区间后按 Backspace／Delete 删除区间及其框选。
    </p>
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { NButton } from "naive-ui";
import type { VideoAiTimedRegion } from "@toolbox/shared";
import { editTimelineRange, snapTime } from "./timeline";
const props = defineProps<{
  ranges: VideoAiTimedRegion[];
  duration: number;
  currentTime: number;
  activeIndex: number;
}>();
const emit = defineEmits<{
  "update:ranges": [value: VideoAiTimedRegion[]];
  seek: [time: number];
  select: [index: number];
  remove: [index: number];
}>();
const track = ref<HTMLElement>();
const scrollViewport = ref<HTMLElement>();
const zoom = ref(1),
  snapping = ref(true);
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
  const next = Math.max(1, Math.min(16, previous * Math.exp(-Math.max(-160, Math.min(160, pixels)) * 0.0025)));
  if (next === previous) return;
  const anchor = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
  const offset = viewport.scrollLeft + anchor * bounds.width * (next / previous - 1);
  zoom.value = next;
  await nextTick();
  if (scrollViewport.value === viewport) viewport.scrollLeft = Math.max(0, offset);
}
const lanes = computed(() => {
  const ends: number[] = [],
    rows: number[] = [];
  props.ranges
    .map((range, index) => ({ range, index }))
    .sort((a, b) => a.range.start - b.range.start)
    .forEach(({ range, index }) => {
      let row = ends.findIndex((end) => end <= range.start);
      if (row === -1) row = ends.length;
      ends[row] = range.end;
      rows[index] = row;
    });
  return { rows, count: Math.max(1, ends.length) };
});
let drag:
  | {
      operation: "seek" | "move" | "start" | "end";
      index: number;
      x: number;
      width: number;
      left: number;
      initial: VideoAiTimedRegion[];
      time: number;
      pointerId: number;
      moved: boolean;
    }
  | undefined;
function targets(index = -1) {
  return [0, props.duration, ...props.ranges.flatMap((range, i) => (i === index ? [] : [range.start, range.end]))];
}
function seek(time: number) {
  emit("seek", Math.max(0, Math.min(props.duration, time)));
}
function begin(event: PointerEvent, operation: "seek" | "move" | "start" | "end", index = -1) {
  if (event.button !== 0 || !track.value) return;
  const bounds = track.value.getBoundingClientRect();
  if (!bounds.width) return;
  drag = {
    operation,
    index,
    x: event.clientX,
    width: bounds.width,
    left: bounds.left,
    initial: props.ranges.map((range) => ({ ...range, rects: [...range.rects] })),
    time: props.currentTime,
    pointerId: event.pointerId,
    moved: false
  };
  track.value.setPointerCapture(event.pointerId);
  if (index >= 0) {
    emit("select", index);
    (event.target as HTMLElement).closest<HTMLElement>(".timeline-clip")?.focus({ preventScroll: true });
  }
  if (operation === "seek") move(event);
  event.preventDefault();
}
function move(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return;
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
  const range = editTimelineRange(
    drag.initial[drag.index],
    drag.operation,
    ((event.clientX - drag.x) / drag.width) * props.duration,
    props.duration,
    [...targets(drag.index), props.currentTime],
    tolerance
  );
  emit(
    "update:ranges",
    drag.initial.map((value, index) => (index === drag!.index ? range : value))
  );
}
function releaseDrag() {
  const pointer = drag?.pointerId;
  drag = undefined;
  if (pointer !== undefined && track.value?.hasPointerCapture(pointer)) track.value.releasePointerCapture(pointer);
}
function finish(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (Math.abs(event.clientX - drag.x) > 3) drag.moved = true;
  if (drag.operation !== "seek" && !drag.moved) {
    const tolerance = snapping.value && !event.altKey ? (props.duration / drag.width) * 8 : 0;
    seek(
      snapTime(
        Math.max(0, Math.min(props.duration, ((event.clientX - drag.left) / drag.width) * props.duration)),
        targets(),
        tolerance
      )
    );
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
  if (event.repeat || !props.ranges[index]) return;
  releaseDrag();
  emit("remove", index);
  await nextTick();
  const clips = track.value?.querySelectorAll<HTMLElement>(".timeline-clip");
  clips?.[Math.min(index, clips.length - 1)]?.focus({ preventScroll: true });
}
function cancel() {
  if (drag) {
    emit("update:ranges", drag.initial);
    if (drag.operation === "seek") seek(drag.time);
  }
  releaseDrag();
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
  height: 34px;
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
  border-left: 2px solid var(--color-error);
  pointer-events: none;
  z-index: 3;
}
.timeline-playhead button {
  position: absolute;
  left: -9px;
  top: 0;
  width: 18px;
  padding: 0;
  color: var(--color-error);
  border: 0;
  background: var(--color-surface);
  cursor: ew-resize;
  pointer-events: auto;
}
.timeline-empty {
  padding: var(--space-3);
  color: var(--color-text-secondary);
  font-size: 12px;
}
p {
  margin: var(--space-2) 0 0;
}

.video-timeline { padding: 10px 0 0; border: 0; border-radius: 0; background: transparent; }
.timeline-toolbar { gap: 10px; }
.timeline-toolbar label { display: inline-flex; align-items: center; gap: 5px; }
.timeline-toolbar input { accent-color: var(--color-primary-600); }
.timeline-toolbar :deep(.n-button:first-of-type) { margin-left: auto; }
.timeline-track { border-radius: 6px; background: var(--color-surface-subtle); }
.timeline-clip { border-color: var(--color-primary-200); border-radius: 6px; background: var(--color-primary-400, #a69aff); color: white; }
.timeline-clip.selected { border-color: var(--color-primary-600); box-shadow: inset 0 0 0 2px var(--color-surface); background: var(--color-primary-500); }
.timeline-clip:focus-visible { outline: 2px solid var(--color-primary-600); outline-offset: 2px; }
</style>
