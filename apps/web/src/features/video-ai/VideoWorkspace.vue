<template>
  <section class="video-workspace" aria-label="视频预览与字幕区域">
    <div ref="stageEl" class="video-stage" :class="{ empty: !src }">
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
          @timeupdate="currentTime = videoEl?.currentTime || 0"
        />
        <div
          v-if="manualMode"
          class="overlay"
          role="presentation"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="cancelDrag"
        >
          <div v-if="manualArea" class="subtitle-rect manual" :style="rectStyle(manualArea)"></div>
        </div>
        <div
          v-for="(rect, index) in visibleManualRects"
          :key="`manual-${index}`"
          class="subtitle-rect manual saved"
          :style="rectStyle(rect)"
        >
          <span>{{ index + 1 }}</span>
        </div>
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

    <div v-if="editable && (duration || 0) > 0 && manualRanges?.length" class="range-editor">
      <div class="range-actions">
        <strong>手动字幕区间</strong>
        <n-button size="small" :disabled="manualRanges.length >= 20" @click="addRange">添加区间</n-button>
      </div>
      <div class="range-tabs">
        <n-button
          v-for="(range, index) in manualRanges"
          :key="index"
          size="small"
          :type="activeRange === index ? 'primary' : 'default'"
          @click="selectRange(index)"
          >区间 {{ index + 1 }} · {{ range.rects.length }} 处</n-button
        >
      </div>
      <template v-if="selectedRange">
        <p>
          {{ selectedRange.start.toFixed(2) }} – {{ selectedRange.end.toFixed(2) }} 秒 ·
          拖动两端调整区间，拖动中间移动区间
        </p>
        <n-slider
          range
          draggable
          :min="0"
          :max="duration"
          :step="0.01"
          :value="[selectedRange.start, selectedRange.end]"
          aria-label="字幕时间区间"
          @update:value="updateRange"
        />
        <div class="range-actions">
          <n-button size="small" @click="selectRange(activeRange)">定位区间开始</n-button>
          <n-button size="small" @click="removeRange">删除区间</n-button>
          <n-button v-for="(_, index) in selectedRange.rects" :key="index" size="small" @click="removeRect(index)"
            >删除框 {{ index + 1 }}</n-button
          >
        </div>
        <p>在右侧开启手动框选，可连续添加多个框；最多共 20 处。手动区间存在时按手动区间处理。</p>
      </template>
    </div>

    <div v-if="showSourceSwitch" class="source-switch" aria-label="预览来源">
      <button type="button" :class="{ active: sourceKind === 'original' }" @click="$emit('change-source', 'original')">
        原视频
      </button>
      <button type="button" :class="{ active: sourceKind === 'result' }" @click="$emit('change-source', 'result')">
        处理结果
      </button>
    </div>
    <p v-if="manualMode" class="workspace-tip">请在实际视频画面内拖动框选字幕区域，完成后点击右侧“完成框选”。</p>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { NButton, NSlider } from "naive-ui";
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
const currentTime = ref(0);
const selectedRange = computed(() => props.manualRanges?.[activeRange.value]);
const visibleManualRects = computed(() =>
  props.sourceKind === "result"
    ? []
    : props.manualMode
      ? selectedRange.value?.rects || []
      : (props.manualRanges || [])
          .filter((range) => currentTime.value >= range.start && currentTime.value < range.end)
          .flatMap((range) => range.rects)
);
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
  }
);
function addRange() {
  if (!props.editable || !props.duration || (props.manualRanges?.length || 0) >= 20) return;
  activeRange.value = props.manualRanges?.length || 0;
  emit("update:manual-ranges", [...(props.manualRanges || []), { start: 0, end: props.duration, rects: [] }]);
}
function selectRange(index: number) {
  activeRange.value = index;
  if (videoEl.value && props.manualRanges?.[index]) {
    videoEl.value.pause();
    videoEl.value.currentTime = props.manualRanges[index].start;
    currentTime.value = props.manualRanges[index].start;
  }
}
function updateRange(value: number | number[]) {
  if (!Array.isArray(value) || value.length !== 2 || value[1] <= value[0]) return;
  emit(
    "update:manual-ranges",
    (props.manualRanges || []).map((range, index) =>
      index === activeRange.value ? { ...range, start: value[0], end: value[1] } : range
    )
  );
  if (videoEl.value) {
    videoEl.value.currentTime = value[0];
    currentTime.value = value[0];
  }
}
function removeRange() {
  emit(
    "update:manual-ranges",
    (props.manualRanges || []).filter((_, index) => index !== activeRange.value)
  );
}
function removeRect(rectIndex: number) {
  emit(
    "update:manual-ranges",
    (props.manualRanges || []).map((range, index) =>
      index === activeRange.value ? { ...range, rects: range.rects.filter((_, index) => index !== rectIndex) } : range
    )
  );
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
  resizeObserver = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect;
    if (rect) stageSize.value = { width: rect.width, height: rect.height };
  });
  if (stageEl.value) resizeObserver.observe(stageEl.value);
});

onBeforeUnmount(() => resizeObserver?.disconnect());

watch(
  () => [props.width, props.height, props.src] as const,
  async ([width, height]) => {
    if (width && height) intrinsic.value = { width, height };
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
  if ((props.manualRanges || []).reduce((sum, range) => sum + range.rects.length, 0) >= 20) return;
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
      emit(
        "update:manual-ranges",
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
.range-actions,
.range-tabs {
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
.saved span {
  color: white;
  background: var(--color-warning);
  padding: 1px 5px;
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
</style>
