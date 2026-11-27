<template>
  <section
    class="video-workspace"
    aria-label="视频预览与字幕区域"
    data-tour="subtitle-edit-ready"
    :data-tour-ready="editable && (duration || 0) > 0 ? 'true' : 'false'"
  >
    <div ref="stageEl" class="video-stage" :class="{ empty: !src }" data-tour="subtitle-surface">
      <div v-if="src" class="video-surface" :style="surfaceStyle">
        <video
          ref="videoEl"
          class="workspace-video"
          :src="src"
          controls
          playsinline
          :muted="muted"
          preload="metadata"
          @loadedmetadata="onLoadedMetadata"
          @timeupdate="onVideoTimeUpdate"
          @seeking="onVideoSeeking"
          @play="trackFrames"
          @pause="onVideoPaused"
          @ended="onVideoPaused"
        />
        <div
          v-if="manualMode && drawingTimeAllowed"
          class="overlay"
          data-tour="subtitle-draw-overlay"
          role="presentation"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="cancelDrag"
        >
          <div v-if="manualArea" class="subtitle-rect manual" :style="rectStyle(manualArea)"></div>
        </div>
        <SubtitleRegion
          v-for="(item, index) in visibleManualRects"
          :key="`${item.rangeIndex}-${item.rectIndex}`"
          :rect="item.rect"
          :label="index + 1"
          :editable="!!editable"
          :selected="selectedRect === `${item.rangeIndex}-${item.rectIndex}`"
          :surface-width="surfaceBox.width"
          :surface-height="surfaceBox.height"
          @select="selectRect(item.rangeIndex, item.rectIndex)"
          @update="updateRect(item.rangeIndex, item.rectIndex, $event)"
          @remove="deleteRect(item.rangeIndex, item.rectIndex)"
          @edit-start="beginEditGesture"
          @edit-end="endEditGesture"
        />
        <template v-if="!manualMode && !manualRanges?.length">
          <div
            v-for="(segment, index) in segments"
            :key="`${segment.startFrame}-${segment.endFrame}-${index}`"
            class="subtitle-rect detected"
            :style="rectStyle(segment.rect)"
          ></div>
        </template>
      </div>

      <div v-else class="video-empty">
        <span class="video-empty-icon" aria-hidden="true">▶</span>
        <strong>选择视频后在这里预览</strong>
        <span>支持自动检测字幕，也可以直接手动框选</span>
      </div>
    </div>

    <div v-if="editable && (duration || 0) > 0" class="range-editor">
      <div class="range-actions" data-tour="subtitle-range-tools">
        <strong>字幕区间</strong>
        <n-button
          size="small"
          :disabled="!undoHistory.length"
          title="撤回上一步（Ctrl+Z / Command+Z）"
          data-tour="subtitle-undo"
          @click="undoEdit"
          >撤回</n-button
        >
        <n-button
          type="primary"
          size="small"
          :disabled="currentTime >= (duration || 0)"
          title="从指针位置添加 2 秒区间，视频结尾不足 2 秒时自动缩短"
          @click="addRange"
          data-tour="subtitle-add-range"
          >添加区间</n-button
        >
        <span v-for="action in rangeActions" :key="action.label" class="range-icon-action" :title="action.tooltip">
          <n-button
            class="range-icon-button"
            size="small"
            quaternary
            :type="action.danger ? 'error' : 'default'"
            :disabled="action.disabled"
            :aria-label="action.label"
            :data-tour="action.tour"
            @click="action.run"
          >
            <template #icon><component :is="action.icon" :size="16" aria-hidden="true" /></template>
            <span v-if="action.count" class="range-icon-number" aria-hidden="true">{{ action.count }}</span>
          </n-button>
        </span>
      </div>
      <p v-if="currentTime >= (duration || 0)">指针已到视频结尾，请向前移动指针后添加区间。</p>
      <VideoTimeline
        :ranges="manualRanges || []"
        :duration="duration || 0"
        :current-time="currentTime"
        :active-index="activeRange"
        :selected-indices="boxedRanges"
        @update:ranges="commitRanges"
        @edit-start="beginEditGesture"
        @edit-end="endEditGesture"
        @seek="seekVideo"
        @seek-start="scrubbing = true"
        @seek-end="finishSeeking"
        @select="selectActiveRange"
        @box-select="selectBoxedRanges"
        @remove="removeRange"
        @remove-selected="removeSelectedRanges"
      />
    </div>

    <div v-if="showSourceSwitch" class="source-switch" aria-label="预览来源">
      <button type="button" :class="{ active: sourceKind === 'original' }" @click="$emit('change-source', 'original')">
        原视频
      </button>
      <button type="button" :class="{ active: sourceKind === 'result' }" @click="$emit('change-source', 'result')">
        处理结果
      </button>
    </div>
    <p v-if="manualMode && selectedRange && !drawingTimeAllowed" class="workspace-tip">
      指针不在当前区间内，请移回区间内再框选。
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { NButton } from "naive-ui";
import { PanelLeftClose, PanelRightClose, SquareX, TableColumnsSplit, Trash2 } from "lucide-vue-next";
import VideoTimeline from "./VideoTimeline.vue";
import SubtitleRegion from "./SubtitleRegion.vue";
import type { VideoAiRect, VideoAiSegment, VideoAiTimedRegion } from "@toolbox/shared";

const props = defineProps<{
  src?: string;
  muted?: boolean;
  sourceKind: "original" | "result";
  showSourceSwitch?: boolean;
  manualMode?: boolean;
  manualArea?: VideoAiRect;
  segments: Array<VideoAiSegment & { confidence?: number }>;
  width?: number;
  height?: number;
  duration?: number;
  fps?: number;
  editable?: boolean;
  manualRanges?: VideoAiTimedRegion[];
}>();

const emit = defineEmits<{
  "update:manual-area": [value: VideoAiRect | undefined];
  metadata: [value: { width: number; height: number; duration: number }];
  "change-source": [value: "original" | "result"];
  "update:manual-ranges": [value: VideoAiTimedRegion[]];
}>();

const activeRange = ref(0);
const boxedRanges = ref<number[]>([]);
const currentTime = ref(0);
const selectedRect = ref("");
type UndoSnapshot = { ranges: VideoAiTimedRegion[]; time: number; activeRange: number; boxedRanges: number[] };
const undoHistory = ref<UndoSnapshot[]>([]);
let editGesture: { initial: UndoSnapshot; recorded: boolean } | undefined;
function copyRanges(ranges: VideoAiTimedRegion[]) {
  return ranges.map((range) => ({ ...range, rects: range.rects.map((rect) => ({ ...rect })) }));
}
function snapshotEdit(): UndoSnapshot {
  return {
    ranges: copyRanges(props.manualRanges ?? []),
    time: currentTime.value,
    activeRange: activeRange.value,
    boxedRanges: [...boxedRanges.value]
  };
}
function beginEditGesture() {
  editGesture = { initial: snapshotEdit(), recorded: false };
}
function endEditGesture(cancelled: boolean) {
  if (cancelled && editGesture?.recorded) undoHistory.value.pop();
  editGesture = undefined;
}
function commitRanges(next: VideoAiTimedRegion[]) {
  const current = props.manualRanges ?? [];
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  if (!editGesture || !editGesture.recorded) {
    const initial = editGesture?.initial ?? snapshotEdit();
    if (JSON.stringify(next) !== JSON.stringify(initial.ranges)) {
      undoHistory.value.push(initial);
      if (undoHistory.value.length > 50) undoHistory.value.shift();
      if (editGesture) editGesture.recorded = true;
    }
  }
  emit("update:manual-ranges", next);
}
function clearUndoHistory() {
  undoHistory.value = [];
  boxedRanges.value = [];
  editGesture = undefined;
}
function undoEdit() {
  if (!props.editable || editGesture) return;
  const previous = undoHistory.value.pop();
  if (!previous) return;
  selectedRect.value = "";
  activeRange.value = Math.min(previous.activeRange, Math.max(0, previous.ranges.length - 1));
  boxedRanges.value = previous.boxedRanges;
  emit("update:manual-area", undefined);
  emit("update:manual-ranges", copyRanges(previous.ranges));
  seekVideo(Math.max(0, Math.min(props.duration ?? previous.time, previous.time)));
}
watch(activeRange, () => {
  if (!selectedRect.value.startsWith(`${activeRange.value}-`)) selectedRect.value = "";
});
function selectRect(rangeIndex: number, rectIndex: number) {
  selectActiveRange(rangeIndex);
  selectedRect.value = `${rangeIndex}-${rectIndex}`;
}
watch(
  () => props.src,
  () => {
    selectedRect.value = "";
    currentTime.value = 0;
  }
);
function selectActiveRange(index: number) {
  activeRange.value = index;
  boxedRanges.value = [];
}
function selectBoxedRanges(indices: number[]) {
  selectedRect.value = "";
  activeRange.value = indices[0] ?? -1;
  boxedRanges.value = indices.length > 1 ? indices : [];
}
const selectedRange = computed(() =>
  boxedRanges.value.length > 1 ? undefined : props.manualRanges?.[activeRange.value]
);
const canTrimRange = computed(() =>
  Boolean(
    props.editable &&
    selectedRange.value &&
    Number.isFinite(currentTime.value) &&
    currentTime.value > selectedRange.value.start &&
    currentTime.value < selectedRange.value.end
  )
);
const splitDisabledReason = computed(() => {
  if (!props.editable || !selectedRange.value) return "请先选中需要拆分的区间";
  const time = currentTime.value;
  if (!Number.isFinite(time) || time <= selectedRange.value.start || time >= selectedRange.value.end)
    return "请将指针移到选中区间内部，不能在区间端点拆分";
  return "";
});
type RangeAction = {
  tour?: string;
  label: string;
  tooltip: string;
  icon: typeof Trash2;
  run: () => void;
  disabled?: boolean;
  danger?: boolean;
  count?: number;
};
const rangeActions = computed<RangeAction[]>(() => {
  const actions: RangeAction[] = [
    {
      label: "按指针拆分",
      tour: "subtitle-range-split",
      tooltip: `按指针拆分（Ctrl+B / ⌘B）· ${splitDisabledReason.value || "将选中区间一分为二，两段均保留字幕框"}`,
      icon: TableColumnsSplit,
      run: splitRange,
      disabled: Boolean(splitDisabledReason.value)
    }
  ];
  if (boxedRanges.value.length > 1) {
    const count = boxedRanges.value.length;
    actions.push({
      label: `删除选中区间（${count}）`,
      tour: "subtitle-range-remove",
      tooltip: `删除 ${count} 个选中区间`,
      icon: Trash2,
      run: removeSelectedRanges,
      danger: true,
      count
    });
    return actions;
  }
  const range = selectedRange.value;
  if (!range) return actions;
  const trimHint = "请将指针移到选中区间内部";
  actions.push(
    {
      label: "向左裁剪",
      tooltip: `向左裁剪（Q）· ${canTrimRange.value ? "删除指针左侧，保留右侧" : trimHint}`,
      icon: PanelLeftClose,
      run: () => trimRange("left"),
      disabled: !canTrimRange.value
    },
    {
      label: "向右裁剪",
      tooltip: `向右裁剪（W）· ${canTrimRange.value ? "删除指针右侧，保留左侧" : trimHint}`,
      icon: PanelRightClose,
      run: () => trimRange("right"),
      disabled: !canTrimRange.value
    },
    {
      label: "删除区间",
      tour: "subtitle-range-remove",
      tooltip: "删除当前区间及其字幕框",
      icon: Trash2,
      run: () => removeRange(),
      danger: true
    }
  );
  range.rects.forEach((_, index) => {
    actions.push({
      label: `删除框 ${index + 1}`,
      tooltip: `删除当前区间的字幕框 ${index + 1}`,
      icon: SquareX,
      run: () => removeRect(index),
      count: range.rects.length > 1 ? index + 1 : undefined
    });
  });
  return actions;
});
const drawingTimeAllowed = computed(
  () =>
    boxedRanges.value.length <= 1 &&
    (!selectedRange.value ||
      (currentTime.value >= selectedRange.value.start && currentTime.value < selectedRange.value.end))
);
const visibleManualRects = computed(() =>
  props.sourceKind === "result"
    ? []
    : (props.manualRanges || []).flatMap((range, rangeIndex) =>
        currentTime.value >= range.start && currentTime.value < range.end
          ? range.rects.map((rect, rectIndex) => ({ rect, rangeIndex, rectIndex }))
          : []
      )
);
watch(visibleManualRects, (rects) => {
  if (!rects.some((item) => selectedRect.value === `${item.rangeIndex}-${item.rectIndex}`)) selectedRect.value = "";
});
watch(drawingTimeAllowed, (allowed) => {
  if (!allowed) cancelDrag();
});
function updateRect(rangeIndex: number, rectIndex: number, rect: VideoAiRect) {
  if (!props.editable) return;
  commitRanges(
    (props.manualRanges || []).map((range, index) =>
      index === rangeIndex
        ? { ...range, rects: range.rects.map((value, index) => (index === rectIndex ? rect : value)) }
        : range
    )
  );
}
function deleteRect(rangeIndex: number, rectIndex: number) {
  if (!props.editable) return;
  selectedRect.value = "";
  commitRanges(
    (props.manualRanges || []).map((range, index) =>
      index === rangeIndex ? { ...range, rects: range.rects.filter((_, index) => index !== rectIndex) } : range
    )
  );
}
watch(
  () => [props.manualMode, props.duration] as const,
  ([enabled]) => {
    if (enabled && props.duration && !props.manualRanges?.length) addRange();
    if (enabled) videoEl.value?.pause();
  }
);
watch(
  () => props.manualRanges?.length,
  (length) => {
    activeRange.value = Math.min(activeRange.value, Math.max(0, (length || 0) - 1));
    boxedRanges.value = boxedRanges.value.filter((index) => index < (length ?? 0));
  }
);
function addRange() {
  if (!props.editable || !props.duration) return;
  const start = Math.max(0, currentTime.value);
  if (!Number.isFinite(start) || start >= props.duration) return;
  videoEl.value?.pause();
  const index = props.manualRanges?.length || 0;
  commitRanges([...(props.manualRanges || []), { start, end: Math.min(start + 2, props.duration), rects: [] }]);
  selectActiveRange(index);
}
function splitRange() {
  if (splitDisabledReason.value || !selectedRange.value) return;
  videoEl.value?.pause();
  cancelDrag();
  const index = activeRange.value;
  const range = selectedRange.value;
  const time = currentTime.value;
  const next = [...(props.manualRanges || [])];
  // 两段的框选独立复制，后续调整任一段不会修改另一段。
  next.splice(
    index,
    1,
    { ...range, end: time, rects: range.rects.map((rect) => ({ ...rect })) },
    { ...range, start: time, rects: range.rects.map((rect) => ({ ...rect })) }
  );
  selectedRect.value = "";
  commitRanges(next);
  activeRange.value = index + 1;
}
function trimRange(side: "left" | "right") {
  if (!canTrimRange.value || !selectedRange.value) return;
  videoEl.value?.pause();
  cancelDrag();
  const time = currentTime.value;
  commitRanges(
    (props.manualRanges || []).map((range, index) =>
      index === activeRange.value ? { ...range, ...(side === "left" ? { start: time } : { end: time }) } : range
    )
  );
}
function revealRange(index: number) {
  selectActiveRange(index);
  const range = props.manualRanges?.[index];
  if (videoEl.value && range) seekVideo(range.start);
}
defineExpose({ revealRange, clearUndoHistory, replaceRanges: commitRanges });
const scrubbing = ref(false);
let seekFrame: number | undefined;
let pendingSeek: number | undefined;
let steppedFrame: { index: number; fps: number; previewTime: number } | undefined;
function flushSeek() {
  seekFrame = undefined;
  if (pendingSeek === undefined || !videoEl.value) return;
  videoEl.value.currentTime = pendingSeek;
  pendingSeek = undefined;
}
function seekVideo(time: number) {
  steppedFrame = undefined;
  currentTime.value = time;
  queueVideoSeek(time);
}
function queueVideoSeek(time: number) {
  const video = videoEl.value;
  if (!video) return;
  pendingSeek = time;
  if (!video.paused) video.pause();
  if (seekFrame === undefined) seekFrame = requestAnimationFrame(flushSeek);
}
function finishSeeking() {
  if (seekFrame !== undefined) cancelAnimationFrame(seekFrame);
  flushSeek();
  scrubbing.value = false;
}
function onVideoTimeUpdate() {
  if (!steppedFrame && !scrubbing.value && pendingSeek === undefined && videoEl.value)
    currentTime.value = videoEl.value.currentTime;
}
function onVideoSeeking() {
  // A seek from the native player starts a new position for the next frame step.
  if (steppedFrame && pendingSeek === undefined && videoEl.value) {
    const { fps, previewTime } = steppedFrame;
    if (Math.abs(videoEl.value.currentTime - previewTime) >= 0.25 / fps) steppedFrame = undefined;
  }
  onVideoTimeUpdate();
}
function removeRanges(indices: number[]) {
  if (!props.editable || editGesture || !props.manualRanges?.length) return;
  const selected = new Set(indices);
  const remaining = props.manualRanges.filter((_, index) => !selected.has(index));
  if (remaining.length === props.manualRanges.length) return;
  selectedRect.value = "";
  commitRanges(remaining);
  selectActiveRange(indices.length > 1 ? -1 : Math.min(indices[0], Math.max(0, remaining.length - 1)));
}
function removeRange(index = activeRange.value) {
  removeRanges([index]);
}
function removeSelectedRanges() {
  removeRanges(boxedRanges.value);
}
function removeRect(rectIndex: number) {
  deleteRect(activeRange.value, rectIndex);
}

const stageEl = ref<HTMLElement>();
const videoEl = ref<HTMLVideoElement>();
const intrinsic = ref({ width: props.width || 16, height: props.height || 9 });
const stageSize = ref({ width: 0, height: 0 });
let resizeObserver: ResizeObserver | undefined;

const surfaceBox = computed(() => {
  const stageWidth = stageSize.value.width || 640;
  const stageHeight = stageSize.value.height || 480;
  const sourceWidth = Math.max(1, intrinsic.value.width);
  const sourceHeight = Math.max(1, intrinsic.value.height);
  const scale = Math.min(stageWidth / sourceWidth, stageHeight / sourceHeight);
  const width = Math.max(1, sourceWidth * scale);
  const height = Math.max(1, sourceHeight * scale);
  return {
    width,
    height,
    left: (stageWidth - width) / 2,
    top: (stageHeight - height) / 2
  };
});

const surfaceStyle = computed(() => ({
  width: `${surfaceBox.value.width}px`,
  height: `${surfaceBox.value.height}px`,
  left: `${surfaceBox.value.left}px`,
  top: `${surfaceBox.value.top}px`
}));

onMounted(() => {
  window.addEventListener("keydown", onPlaybackKeydown);
  window.addEventListener("keydown", onFrameKeydown, true);
  window.addEventListener("keydown", onUndoKeydown);
  window.addEventListener("keydown", onRangeShortcut);
  resizeObserver = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect;
    if (rect) stageSize.value = { width: rect.width, height: rect.height };
  });
  if (stageEl.value) resizeObserver.observe(stageEl.value);
});

let frameCallback: number | undefined;
function stopTrackingFrames() {
  if (frameCallback !== undefined) videoEl.value?.cancelVideoFrameCallback?.(frameCallback);
  frameCallback = undefined;
}
function trackFrames() {
  stopTrackingFrames();
  const video = videoEl.value;
  if (!video || video.paused) return;
  steppedFrame = undefined;
  if (!video.requestVideoFrameCallback) return;
  const update = (_now: number, metadata: { mediaTime: number }) => {
    if (video.paused || video !== videoEl.value) return;
    currentTime.value = metadata.mediaTime;
    frameCallback = video.requestVideoFrameCallback(update);
  };
  frameCallback = video.requestVideoFrameCallback(update);
}
function onVideoPaused() {
  stopTrackingFrames();
  onVideoTimeUpdate();
}
function onPlaybackKeydown(event: KeyboardEvent) {
  if (event.code !== "Space" && event.key !== " ") return;
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey
  )
    return;
  const video = videoEl.value;
  if (!props.src || !video || document.querySelector('.n-modal[aria-modal="true"], .n-drawer[aria-modal="true"]'))
    return;
  const target = event.target;
  if (target instanceof Element) {
    const control = target.closest(
      'input, textarea, select, button, a[href], [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="slider"]'
    );
    if (control && !control.matches('.timeline-playhead [role="slider"]')) return;
  }
  event.preventDefault();
  if (video.paused) void video.play().catch(() => undefined);
  else video.pause();
}
function onFrameKeydown(event: KeyboardEvent) {
  const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
  if (
    !direction ||
    event.defaultPrevented ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey
  )
    return;
  if (!props.src || !props.editable || scrubbing.value || editGesture) return;
  if (document.querySelector('.n-modal[aria-modal="true"], .n-drawer[aria-modal="true"]')) return;
  const target = event.target;
  if (target instanceof Element) {
    const control = target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], button'
    );
    if (control && !control.matches(".timeline-playhead button, .clip-label")) return;
  }
  event.preventDefault();
  const { fps, duration } = props;
  if (!fps || !Number.isFinite(fps) || fps <= 0 || !duration || !Number.isFinite(duration) || duration <= 0) return;
  const currentFrame = steppedFrame?.fps === fps ? steppedFrame.index : Math.floor(currentTime.value * fps + 1e-6);
  const lastFrame = Math.max(0, Math.ceil(duration * fps - 1e-6) - 1);
  const index = Math.max(0, Math.min(lastFrame, currentFrame + direction));
  const startTime = index / fps;
  // Keep the pointer on the edit boundary and decode inside the frame, away from rounding at its edges.
  const previewTime = (startTime + Math.min(duration, (index + 1) / fps)) / 2;
  steppedFrame = { index, fps, previewTime };
  currentTime.value = startTime;
  queueVideoSeek(previewTime);
}
function onRangeShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.shiftKey) return;
  if (!props.src || !props.editable || editGesture || scrubbing.value) return;
  if (document.querySelector('.n-modal[aria-modal="true"], .n-drawer[aria-modal="true"]')) return;
  if (
    event.target instanceof Element &&
    event.target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]'
    )
  )
    return;
  const key = event.key.toLowerCase();
  const split = key === "b" && event.ctrlKey !== event.metaKey;
  const trim = !event.ctrlKey && !event.metaKey && (key === "q" || key === "w");
  if (!split && !trim) return;
  event.preventDefault();
  if (split) splitRange();
  else trimRange(key === "q" ? "left" : "right");
}
function onUndoKeydown(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.repeat ||
    event.altKey ||
    event.shiftKey ||
    event.ctrlKey === event.metaKey ||
    event.key.toLowerCase() !== "z"
  )
    return;
  if (
    !props.editable ||
    !undoHistory.value.length ||
    editGesture ||
    document.querySelector('.n-modal[aria-modal="true"], .n-drawer[aria-modal="true"]')
  )
    return;
  if (
    event.target instanceof Element &&
    event.target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]'
    )
  )
    return;
  event.preventDefault();
  undoEdit();
}
onBeforeUnmount(() => {
  if (seekFrame !== undefined) cancelAnimationFrame(seekFrame);
  window.removeEventListener("keydown", onPlaybackKeydown);
  window.removeEventListener("keydown", onFrameKeydown, true);
  window.removeEventListener("keydown", onUndoKeydown);
  window.removeEventListener("keydown", onRangeShortcut);
  resizeObserver?.disconnect();
  stopTrackingFrames();
});

watch([() => props.width, () => props.height], ([width, height]) => {
  if (width && height) intrinsic.value = { width, height };
});
watch(
  () => props.src,
  async () => {
    stopTrackingFrames();
    if (seekFrame !== undefined) cancelAnimationFrame(seekFrame);
    seekFrame = undefined;
    pendingSeek = undefined;
    steppedFrame = undefined;
    scrubbing.value = false;
    await nextTick();
    videoEl.value?.load();
  }
);

function onLoadedMetadata() {
  const video = videoEl.value;
  if (!video || !video.videoWidth || !video.videoHeight) return;
  intrinsic.value = { width: video.videoWidth, height: video.videoHeight };
  emit("metadata", { width: video.videoWidth, height: video.videoHeight, duration: video.duration || 0 });
}

let dragStart: { x: number; y: number } | undefined;

function onPointerDown(event: PointerEvent) {
  if (!drawingTimeAllowed.value) return;
  if ((selectedRange.value?.rects.length || 0) >= 20) return;
  if (!selectedRange.value && props.duration) addRange();
  const target = event.currentTarget as HTMLElement;
  target.setPointerCapture(event.pointerId);
  const bounds = target.getBoundingClientRect();
  dragStart = {
    x: clamp((event.clientX - bounds.left) / bounds.width),
    y: clamp((event.clientY - bounds.top) / bounds.height)
  };
  emit("update:manual-area", { x: dragStart.x, y: dragStart.y, width: 0, height: 0 });
}

function onPointerMove(event: PointerEvent) {
  if (!dragStart) return;
  const target = event.currentTarget as HTMLElement;
  const bounds = target.getBoundingClientRect();
  const x = clamp((event.clientX - bounds.left) / bounds.width);
  const y = clamp((event.clientY - bounds.top) / bounds.height);
  emit("update:manual-area", {
    x: Math.min(dragStart.x, x),
    y: Math.min(dragStart.y, y),
    width: clamp(Math.abs(x - dragStart.x)),
    height: clamp(Math.abs(y - dragStart.y))
  });
}

function onPointerUp() {
  dragStart = undefined;
  if (props.manualArea && props.manualArea.width >= 0.01 && props.manualArea.height >= 0.01 && selectedRange.value) {
    const total = (props.manualRanges || []).reduce((sum, range) => sum + range.rects.length, 0);
    if (total < 20)
      commitRanges(
        (props.manualRanges || []).map((range, index) =>
          index === activeRange.value ? { ...range, rects: [...range.rects, { ...props.manualArea! }] } : range
        )
      );
    emit("update:manual-area", undefined);
    return;
  }
  if (props.manualArea && (props.manualArea.width < 0.01 || props.manualArea.height < 0.01)) {
    emit("update:manual-area", undefined);
  }
}
function cancelDrag() {
  dragStart = undefined;
  emit("update:manual-area", undefined);
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, Number(value.toFixed(4))));
}

function rectStyle(rect: VideoAiRect) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`
  };
}
</script>

<style scoped>
.video-workspace {
  min-width: 0;
}
.range-editor {
  margin-top: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-subtle);
}
.range-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
.range-editor p {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.video-stage {
  position: relative;
  width: 100%;
  height: clamp(400px, 55vh, 560px);
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: #101418;
}
.video-stage.empty {
  background: var(--color-surface-subtle);
  border-style: dashed;
}
.video-surface {
  position: absolute;
}
.workspace-video {
  display: block;
  width: 100%;
  height: 100%;
  background: #101418;
}
.video-empty {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: var(--space-2);
  color: var(--color-text-secondary);
}
.video-empty-icon {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 1px solid var(--color-border-strong);
  border-radius: 50%;
  color: var(--color-primary-600);
}
.video-empty span:last-child,
.workspace-tip {
  font-size: 13px;
  color: var(--color-text-secondary);
}
.overlay {
  position: absolute;
  inset: 0;
  cursor: crosshair;
  touch-action: none;
}
.subtitle-rect {
  position: absolute;
  box-sizing: border-box;
  pointer-events: none;
  border: 2px solid var(--color-warning);
  background: color-mix(in srgb, var(--color-warning) 18%, transparent);
}
.subtitle-rect.detected {
  border-color: var(--color-primary-500);
  background: color-mix(in srgb, var(--color-primary-500) 16%, transparent);
}
.source-switch {
  display: inline-flex;
  gap: 2px;
  margin-top: var(--space-3);
  padding: 3px;
  border-radius: var(--radius-control);
  background: var(--color-surface-subtle);
}
.source-switch button {
  border: 0;
  border-radius: 6px;
  padding: 6px 14px;
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
}
.source-switch button.active {
  color: var(--color-primary-700);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
.workspace-tip {
  margin: var(--space-2) 0 0;
}
@media (max-width: 768px) {
  .video-stage {
    height: min(55vh, 440px);
  }
}

.video-stage {
  height: clamp(300px, 48vh, 500px);
  border-radius: 10px;
}
.range-editor {
  margin-top: 14px;
  padding: 12px 0 0;
  border: 0;
  border-top: 1px solid var(--color-border);
  border-radius: 0;
  background: transparent;
}
.range-actions {
  gap: 8px;
  margin-bottom: 10px;
}
.range-actions > strong {
  margin-right: 4px;
  font-size: 13px;
}
.range-editor p {
  margin-block: 8px;
  line-height: 1.6;
  color: var(--color-text-tertiary);
}
.range-actions :deep(.n-button) {
  border-radius: 7px;
}
.range-icon-action {
  display: inline-flex;
}
.range-icon-action :deep(.range-icon-button) {
  min-width: 30px;
  padding-inline: 5px;
}
.range-icon-action :deep(.range-icon-button:disabled) {
  pointer-events: none;
}
.range-icon-number {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.source-switch {
  border: 1px solid var(--color-border);
}
@media (max-width: 640px) {
  .video-stage {
    height: 340px;
  }
}
</style>
