<template>
  <canvas
    ref="canvas"
    class="cut-picture"
    aria-label="裁切、旋转与镜像预览"
    @pointerdown="onPointerDown"
    @dblclick="onDblClick"
  ></canvas>
  <svg
    v-if="trajectory"
    class="watermark-trajectory"
    :viewBox="`0 0 ${trajectoryFrame.width} ${trajectoryFrame.height}`"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
  >
    <polyline :points="trajectory.points" fill="none" stroke-dasharray="5 4" vector-effect="non-scaling-stroke" />
    <circle
      v-for="point in trajectory.anchors"
      :key="point.time"
      :cx="point.x"
      :cy="point.y"
      :r="trajectoryFrame.height / 150"
      vector-effect="non-scaling-stroke"
    />
  </svg>
  <ArchiveTransformBox
    v-if="selection && !disabled && !editing"
    :disabled="selectionLocked"
    :box="selection"
    :scale-x="selectionScale.x"
    :scale-y="selectionScale.y"
    @start="beginTransform"
    @update="updateTransform"
    @commit="commitTransform"
    @cancel="cancelTransform"
  />
  <svg
    v-if="snapGuides.x.length || snapGuides.y.length"
    class="preview-snap-guides"
    :style="snapGuideStyle"
    :viewBox="`0 0 ${canvas?.width ?? 1} ${canvas?.height ?? 1}`"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <line
      v-for="x in snapGuides.x"
      :key="`x${x}`"
      :x1="x"
      :x2="x"
      y1="0"
      :y2="canvas?.height ?? 1"
      vector-effect="non-scaling-stroke"
    />
    <line
      v-for="y in snapGuides.y"
      :key="`y${y}`"
      x1="0"
      :x2="canvas?.width ?? 1"
      :y1="y"
      :y2="y"
      vector-effect="non-scaling-stroke"
    />
  </svg>
  <textarea
    v-if="editing && selection"
    ref="editInput"
    v-model="editing.text"
    class="subtitle-editor"
    :style="editorStyle"
    placeholder="输入字幕"
    @keydown.enter.exact.prevent="commitEdit"
    @keydown.esc.prevent="cancelEdit"
    @blur="commitEdit"
  ></textarea>
</template>
<script setup lang="ts">
import { paintSubtitle as drawSubtitle } from "./subtitle-paint";
import ArchiveTransformBox, { type TransformDelta } from "./ArchiveTransformBox.vue";
import { snapPreviewAxis, previewRotatedExtents, type PreviewSnapLock } from "./preview-snap";
import { editorNumber, previewRate } from "./editor-numbers";
import { watermarkTrajectory } from "./watermark-trajectory";
import { computed, nextTick, onMounted, onScopeDispose, ref, watch } from "vue";
import {
  archiveFrameGeometry,
  archiveVisibleClip,
  archiveCutStarts,
  archiveClipSourceTime,
  archiveTransitionDuration,
  archiveTransitionTarget,
  watermarkTrackGeometry,
  positionWatermarkTrack,
  type ArchiveStudioWatermark,
  type ArchiveCutClip,
  type ArchiveFrame,
  type ArchiveSubtitle
} from "@toolbox/shared/archive";
import { canvasPoint, hitSubtitle, screenPoint, stageTransform, subtitleBounds } from "./subtitle-interaction";
const props = defineProps<{
  video?: HTMLVideoElement;
  frame: ArchiveFrame;
  subtitles?: ArchiveSubtitle[];
  watermarks?: ArchiveStudioWatermark[];
  watermarkUrls?: Record<string, string>;
  activeWatermarkId?: string;
  time?: number;
  gap?: boolean;
  clips?: ArchiveCutClip[];
  sourceWidth?: number;
  sourceHeight?: number;
  activeSubtitleId?: string;
  activeClipId?: string;
  sourceUrl?: string;
  sourceUrls?: Record<string, string>;
  reverseSources?: Record<
    string,
    { url: string; start?: number; end: number; interpolation?: boolean; speed?: number }
  >;
  rawComparison?: boolean;
  playing?: boolean;
  disabled?: boolean;
}>();
const emit = defineEmits<{
  select: [id: string];
  pause: [];
  clip: [id: string, changes: Partial<ArchiveCutClip>];
  subtitle: [id: string, changes: Partial<ArchiveSubtitle>];
  watermark: [id: string, changes: Partial<ArchiveStudioWatermark>];
}>();
const canvas = ref<HTMLCanvasElement>();
const editInput = ref<HTMLTextAreaElement>();
let animation: number | undefined;
let lastPicture = "";
const frameSurface = document.createElement("canvas");
const draft = ref<Partial<ArchiveSubtitle> & { id: string }>();
const clipDraft = ref<{ id: string; transform: NonNullable<ArchiveCutClip["transform"]> }>();
const markDraft = ref<ArchiveStudioWatermark>();
const watermarkImages = new Map<string, HTMLImageElement>();
const editing = ref<{ id: string; text: string }>();
interface SelectionBox {
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
}
const selection = ref<SelectionBox | null>(null);
const snapGuides = ref<{ x: number[]; y: number[] }>({ x: [], y: [] });
let snapX: PreviewSnapLock | undefined, snapY: PreviewSnapLock | undefined;
const snapGuideStyle = computed(() => {
  // Invalidate screen geometry together with the current snap result.
  void snapGuides.value;
  const surface = canvas.value;
  if (!surface) return {};
  const { left, top, scale } = stageTransform(surface);
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${surface.width * scale}px`,
    height: `${surface.height * scale}px`
  };
});
let selectionKey = "";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const effectiveSubtitles = computed(() =>
  (props.subtitles ?? []).map((cue) => (draft.value?.id === cue.id ? { ...cue, ...draft.value, id: cue.id } : cue))
);
const visibleCues = computed(() => {
  const visible = archiveVisibleClip(props.clips ?? [], props.time ?? 0);
  return effectiveSubtitles.value
    .filter(
      (cue) =>
        !cue.hidden &&
        (props.time ?? 0) >= cue.start &&
        (props.time ?? 0) < cue.end &&
        (visible < 0 || (cue.lane ?? 0) <= (props.clips![visible].lane ?? 1))
    )
    .sort((a, b) => (b.lane ?? 0) - (a.lane ?? 0));
});
const visibleMarks = computed(() => {
  const clip = archiveVisibleClip(props.clips ?? [], props.time ?? 0);
  return (props.watermarks ?? [])
    .map((mark) => (markDraft.value?.id === mark.id ? markDraft.value : mark))
    .filter(
      (mark) =>
        !mark.hidden &&
        (props.time ?? 0) >= mark.start &&
        (props.time ?? 0) < mark.end &&
        (clip < 0 || (mark.lane ?? 0) <= (props.clips![clip].lane ?? 1))
    );
});
const activeMark = computed(() => visibleMarks.value.find((mark) => mark.id === props.activeWatermarkId));
const trajectoryFrame = computed(() =>
  archiveFrameGeometry(
    props.sourceWidth || props.video?.videoWidth || 2,
    props.sourceHeight || props.video?.videoHeight || 2,
    props.frame
  )
);
const trajectory = computed(() => {
  if (props.disabled || props.playing || props.rawComparison) return undefined;
  const selected = (props.watermarks ?? []).find((mark) => mark.id === props.activeWatermarkId && !mark.hidden);
  if (!selected) return undefined;
  return watermarkTrajectory(
    markDraft.value?.id === selected.id ? markDraft.value : selected,
    trajectoryFrame.value.width,
    trajectoryFrame.value.height
  );
});
function markGeometry(mark: ArchiveStudioWatermark, width: number, height: number) {
  const size = archiveFrameGeometry(
    props.sourceWidth || props.video?.videoWidth || 2,
    props.sourceHeight || props.video?.videoHeight || 2,
    props.frame
  );
  const g = watermarkTrackGeometry(mark, props.time ?? 0, size.width, size.height);
  return {
    ...g,
    x: (g.x * width) / size.width,
    y: (g.y * height) / size.height,
    width: (g.width * width) / size.width,
    height: (g.height * height) / size.height
  };
}
function markImage(mark: ArchiveStudioWatermark) {
  const url = props.watermarkUrls?.[mark.asset.id];
  if (!url) return;
  let image = watermarkImages.get(url);
  if (!image) {
    image = new Image();
    image.onload = () => {
      lastPicture = "";
    };
    image.src = url;
    watermarkImages.set(url, image);
  }
  return image.complete && image.naturalWidth ? image : undefined;
}
watch(
  () => props.watermarkUrls,
  (urls) => {
    for (const [url, image] of watermarkImages)
      if (!Object.values(urls ?? {}).includes(url)) {
        image.onload = null;
        watermarkImages.delete(url);
      }
  },
  { deep: true }
);
const activeCue = computed(() => visibleCues.value.find((cue) => cue.id === props.activeSubtitleId));
const visibleClip = computed(() => {
  const clips = props.clips ?? [],
    time = props.time ?? 0;
  let index = archiveVisibleClip(clips, time);
  // 停在成片终点时保留最后一帧的片段变换。
  if (index < 0 && !props.gap && time > 0) index = archiveVisibleClip(clips, time - 1e-6);
  return index >= 0 ? clips[index] : undefined;
});
const activeClip = computed(() => (visibleClip.value?.id === props.activeClipId ? visibleClip.value : undefined));
const visual = computed(() => ({
  ...props.frame,
  ...visibleClip.value?.transform,
  ...(clipDraft.value?.id === visibleClip.value?.id ? clipDraft.value?.transform : {})
}));
const selectionLocked = computed(() => Boolean((activeMark.value ?? activeCue.value ?? activeClip.value)?.locked));
const selectionScale = computed(() =>
  activeMark.value
    ? { x: activeMark.value.scaleX ?? 1, y: activeMark.value.scaleY ?? 1 }
    : activeCue.value
      ? { x: activeCue.value.scaleX ?? 1, y: activeCue.value.scaleY ?? 1 }
      : { x: visual.value.scaleX ?? 1, y: visual.value.scaleY ?? 1 }
);

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) cancelTransform();
  }
);
watch([() => props.activeSubtitleId, () => props.activeClipId, () => props.activeWatermarkId], ([text, clip, mark]) => {
  if (transformBase && transformBase.id !== text && transformBase.id !== clip && transformBase.id !== mark)
    cancelTransform();
});
watch(
  () => props.video,
  (video, _previous, onCleanup) => {
    lastPicture = "";
    if (!video) return;
    const invalidate = () => {
      lastPicture = "";
    };
    const events = ["loadeddata", "seeked", "canplay", "resize"];
    for (const name of events) video.addEventListener(name, invalidate);
    let callback: number | undefined;
    if (typeof video.requestVideoFrameCallback === "function") {
      const decoded = () => {
        invalidate();
        callback = video.requestVideoFrameCallback(decoded);
      };
      callback = video.requestVideoFrameCallback(decoded);
    }
    onCleanup(() => {
      for (const name of events) video.removeEventListener(name, invalidate);
      if (callback !== undefined) video.cancelVideoFrameCallback(callback);
    });
  },
  { immediate: true }
);
function updateSelection(ctx: CanvasRenderingContext2D | null, width: number, height: number) {
  const cue = activeCue.value,
    clip = activeClip.value,
    mark = activeMark.value,
    surface = canvas.value;
  if ((!cue && !clip && !mark) || !ctx || !surface || props.disabled) {
    selection.value = null;
    selectionKey = "";
    return;
  }
  const fit = stageTransform(surface).scale;
  let box: SelectionBox;
  if (mark) {
    const geometry = markGeometry(mark, width, height);
    const center = screenPoint(surface, geometry.x, geometry.y);
    if (!center) return;
    box = { ...center, width: geometry.width * fit, height: geometry.height * fit, rotation: geometry.rotation };
  } else if (cue) {
    const bounds = subtitleBounds(cue, width, height, ctx);
    const center = screenPoint(surface, bounds.cx, bounds.cy);
    if (!center) return;
    box = {
      ...center,
      width: Math.max(1, bounds.halfW * 2 * bounds.scale * bounds.scaleX * fit),
      height: Math.max(1, bounds.halfH * 2 * bounds.scale * bounds.scaleY * fit),
      rotation: bounds.rotation
    };
  } else {
    const size = archiveFrameGeometry(
      props.sourceWidth || props.video?.videoWidth || 2,
      props.sourceHeight || props.video?.videoHeight || 2,
      props.frame
    );
    const center = screenPoint(
      surface,
      width / 2 + (visual.value.offsetX ?? 0) * width,
      height / 2 + (visual.value.offsetY ?? 0) * height
    );
    if (!center) return;
    box = {
      ...center,
      width: (size.contentWidth / size.width) * width * (visual.value.scaleX ?? 1) * fit,
      height: (size.contentHeight / size.height) * height * (visual.value.scaleY ?? 1) * fit,
      rotation: visual.value.angle ?? 0
    };
  }
  const key = JSON.stringify(box);
  if (key !== selectionKey) {
    selectionKey = key;
    selection.value = box;
  }
}
const transitionVideos = new Map<string, HTMLVideoElement>();
function transitionAt() {
  const clips = props.clips ?? [],
    starts = archiveCutStarts(clips),
    time = props.time ?? 0,
    visible = archiveVisibleClip(clips, time);
  for (const [index, clip] of clips.entries()) {
    if (!clip.transition || clip.hidden) continue;
    const target = archiveTransitionTarget(clips, index),
      duration = archiveTransitionDuration(clips, index);
    if (duration <= 0 || clips[target]?.hidden || (visible !== index && visible !== target)) continue;
    if (time >= starts[target] && time < starts[target] + duration)
      return { index, target, progress: (time - starts[target]) / duration, type: clip.transition.type, starts };
  }
}
function transitionVideo(index: number, starts: number[]) {
  const clip = props.clips![index],
    asset = props.rawComparison ? undefined : props.reverseSources?.[clip.id],
    url = asset?.url ?? (clip.sourceId ? props.sourceUrls?.[clip.sourceId] : props.sourceUrl);
  if (!url) return undefined;
  let element = transitionVideos.get(clip.id);
  if (!element || element.getAttribute("src") !== url) {
    if (element) {
      element.pause();
      element.removeAttribute("src");
      element.load();
    }
    element = document.createElement("video");
    element.src = url;
    element.preload = "auto";
    element.muted = true;
    element.playsInline = true;
    element.addEventListener("loadeddata", () => (lastPicture = ""));
    element.addEventListener("seeked", () => (lastPicture = ""));
    transitionVideos.set(clip.id, element);
  }
  const elapsed = Math.max(0, (props.time ?? 0) - starts[index]);
  const target =
    asset && clip.freezeAt === undefined
      ? asset.interpolation
        ? (clip.reverse ? asset.end - clip.end : clip.start - (asset.start ?? clip.start)) / (asset.speed ?? 1) +
          elapsed
        : asset.end - clip.end + elapsed * (clip.speed ?? 1)
      : archiveClipSourceTime(clip, elapsed);
  element.playbackRate = previewRate(asset?.interpolation ? 1 : (clip.speed ?? 1));
  if (element.readyState >= 1 && !element.seeking && Math.abs(element.currentTime - target) > 0.06)
    element.currentTime = target;
  if (props.playing && clip.freezeAt === undefined && !(props.rawComparison && clip.reverse) && element.paused)
    void element.play().catch(() => {});
  else if (!props.playing || clip.freezeAt !== undefined || (props.rawComparison && clip.reverse)) element.pause();
  return element;
}
function draw() {
  const video = props.video,
    surface = canvas.value;
  if (
    surface &&
    ((video?.videoWidth && video.readyState >= 2) || (props.gap && props.sourceWidth && props.sourceHeight))
  ) {
    const baseWidth = props.sourceWidth || video?.videoWidth || 2,
      baseHeight = props.sourceHeight || video?.videoHeight || 2;
    const frame = props.frame,
      size = archiveFrameGeometry(baseWidth, baseHeight, frame);
    const scale = Math.min(1, 1000 / size.width, 800 / size.height),
      width = Math.max(2, Math.round(size.width * scale)),
      height = Math.max(2, Math.round(size.height * scale));
    if (surface.width !== width || surface.height !== height) {
      surface.width = width;
      surface.height = height;
    }
    const transition = transitionAt();
    const keep = new Set(transition ? [props.clips![transition.index].id, props.clips![transition.target].id] : []);
    for (const [id, element] of transitionVideos)
      if (!keep.has(id)) {
        element.pause();
        element.removeAttribute("src");
        element.load();
        transitionVideos.delete(id);
      }
    const outgoing = transition ? transitionVideo(transition.index, transition.starts) : undefined,
      incoming = transition ? transitionVideo(transition.target, transition.starts) : undefined;
    const visibleSubtitles = visibleCues.value;
    const picture = JSON.stringify([
      video?.currentTime,
      video?.readyState,
      video?.seeking,
      video?.currentSrc,
      props.gap,
      width,
      height,
      frame,
      visual.value,
      transition?.progress,
      outgoing?.currentTime,
      incoming?.currentTime,
      visibleSubtitles,
      visibleMarks.value,
      props.time,
      props.watermarkUrls
    ]);
    const ctx = surface.getContext("2d");
    if (ctx && picture !== lastPicture) {
      lastPicture = picture;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const pictureWidth = Math.max(2, Math.round(size.contentWidth * scale)),
        pictureHeight = Math.max(2, Math.round(size.contentHeight * scale));
      if (frameSurface.width !== pictureWidth || frameSurface.height !== pictureHeight) {
        frameSurface.width = pictureWidth;
        frameSurface.height = pictureHeight;
      }
      const layer = frameSurface.getContext("2d")!;
      layer.setTransform(1, 0, 0, 1, 0, 0);
      layer.clearRect(0, 0, pictureWidth, pictureHeight);
      layer.save();
      layer.scale(
        pictureWidth / (frame.fit === "contain" ? size.fullWidth : size.width),
        pictureHeight / (frame.fit === "contain" ? size.fullHeight : size.height)
      );
      layer.translate(-size.x, -size.y);
      if (frame.flipX || frame.flipY) {
        layer.translate(frame.flipX ? size.fullWidth : 0, frame.flipY ? size.fullHeight : 0);
        layer.scale(frame.flipX ? -1 : 1, frame.flipY ? -1 : 1);
      }
      if (frame.rotation === 90) {
        layer.translate(baseHeight, 0);
        layer.rotate(Math.PI / 2);
      } else if (frame.rotation === 180) {
        layer.translate(baseWidth, baseHeight);
        layer.rotate(Math.PI);
      } else if (frame.rotation === 270) {
        layer.translate(0, baseWidth);
        layer.rotate(-Math.PI / 2);
      }
      layer.fillStyle = "black";
      layer.fillRect(0, 0, baseWidth, baseHeight);
      function paint(element: HTMLVideoElement | undefined, alpha = 1, shift = 0) {
        if (!element?.videoWidth || element.readyState < 2) return;
        const fit = Math.min(baseWidth / element.videoWidth, baseHeight / element.videoHeight);
        layer.save();
        layer.globalAlpha = alpha;
        layer.translate(shift, 0);
        layer.drawImage(
          element,
          (baseWidth - element.videoWidth * fit) / 2,
          (baseHeight - element.videoHeight * fit) / 2,
          element.videoWidth * fit,
          element.videoHeight * fit
        );
        layer.restore();
      }
      if (
        transition &&
        outgoing?.readyState &&
        outgoing.readyState >= 2 &&
        incoming?.readyState &&
        incoming.readyState >= 2
      ) {
        if (transition.type === "slideleft" || transition.type === "slideright") {
          const direction = transition.type === "slideleft" ? -1 : 1;
          paint(outgoing, 1, direction * transition.progress * baseWidth);
          paint(incoming, 1, -direction * (1 - transition.progress) * baseWidth);
        } else {
          paint(outgoing);
          paint(incoming, transition.progress);
        }
      } else if (!props.gap) paint(video);
      layer.restore();
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2 + (visual.value.offsetX ?? 0) * width, height / 2 + (visual.value.offsetY ?? 0) * height);
      ctx.rotate(((visual.value.angle ?? 0) * Math.PI) / 180);
      ctx.scale(
        (visual.value.scaleX ?? 1) * (Boolean(visual.value.flipX) !== frame.flipX ? -1 : 1),
        visual.value.scaleY ?? 1
      );
      const radius = Math.min(pictureWidth, pictureHeight) * (visual.value.cornerRadius ?? 0);
      if (radius > 0) {
        ctx.beginPath();
        ctx.roundRect(-pictureWidth / 2, -pictureHeight / 2, pictureWidth, pictureHeight, radius);
        ctx.clip();
      }
      ctx.drawImage(frameSurface, -pictureWidth / 2, -pictureHeight / 2);
      ctx.restore();
      const overlays = [
        ...visibleSubtitles.map((cue) => ({ lane: cue.lane ?? 0, cue })),
        ...visibleMarks.value.map((mark) => ({ lane: mark.lane ?? 0, mark }))
      ].sort((a, b) => b.lane - a.lane);
      for (const overlay of overlays) {
        if ("cue" in overlay) drawSubtitle(ctx, overlay.cue, width, height);
        else {
          const mark = overlay.mark,
            image = markImage(mark);
          if (!image) continue;
          const g = markGeometry(mark, width, height);
          ctx.save();
          ctx.translate(g.x, g.y);
          ctx.rotate((g.rotation * Math.PI) / 180);
          ctx.globalAlpha = mark.settings.opacity / 100;
          ctx.drawImage(image, -g.width / 2, -g.height / 2, g.width, g.height);
          ctx.restore();
        }
      }
    }
    updateSelection(ctx ?? null, width, height);
  }
  animation = requestAnimationFrame(draw);
}
watch(
  canvas,
  (value) => {
    if (value && animation === undefined) animation = requestAnimationFrame(draw);
  },
  { immediate: true }
);
function cueAt(clientX: number, clientY: number) {
  const surface = canvas.value;
  const ctx = surface?.getContext("2d");
  if (!surface || !ctx || surface.width < 2) return undefined;
  const point = canvasPoint(surface, clientX, clientY);
  if (!point) return undefined;
  return hitSubtitle(visibleCues.value, point.x, point.y, surface.width, surface.height, ctx);
}
type TransformBase = {
  kind: "subtitle" | "video" | "watermark";
  mark?: ArchiveStudioWatermark;
  id: string;
  width: number;
  height: number;
  fit: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  rotation: number;
  halfW: number;
  halfH: number;
  operation: "move" | "scale" | "rotate";
  moved?: boolean;
  transform?: NonNullable<ArchiveCutClip["transform"]>;
};
let transformBase: TransformBase | undefined;
let moveOrigin: { x: number; y: number; pointer: number } | undefined;
function beginTransform(operation: "move" | "scale" | "rotate") {
  startElementTransform(activeCue.value, activeClip.value, operation, activeMark.value);
}
function startElementTransform(
  cue: ArchiveSubtitle | undefined,
  clip: ArchiveCutClip | undefined,
  operation: TransformBase["operation"] = "move",
  mark?: ArchiveStudioWatermark
) {
  const surface = canvas.value;
  if (!surface || props.disabled || (!cue && !clip && !mark) || (mark ?? cue ?? clip)?.locked) return;
  emit("pause");
  snapX = snapY = undefined;
  snapGuides.value = { x: [], y: [] };
  const common = { width: surface.width, height: surface.height, fit: stageTransform(surface).scale, operation };
  if (mark) {
    const g = markGeometry(mark, surface.width, surface.height);
    transformBase = {
      ...common,
      ...previewRotatedExtents(g.width, g.height, g.rotation),
      kind: "watermark",
      id: mark.id,
      mark: JSON.parse(JSON.stringify(mark)),
      x: g.x / surface.width,
      y: g.y / surface.height,
      sx: mark.scaleX ?? 1,
      sy: mark.scaleY ?? 1,
      rotation: g.rotation
    };
  } else if (cue) {
    const ctx = surface.getContext("2d");
    if (!ctx) return;
    const layout = subtitleBounds(cue, surface.width, surface.height, ctx);
    transformBase = {
      ...common,
      ...previewRotatedExtents(
        layout.halfW * 2 * layout.scale * layout.scaleX,
        layout.halfH * 2 * layout.scale * layout.scaleY,
        layout.rotation
      ),
      kind: "subtitle",
      id: cue.id,
      x: layout.cx / surface.width,
      y: layout.cy / surface.height,
      sx: cue.scaleX ?? 1,
      sy: cue.scaleY ?? 1,
      rotation: cue.rotation ?? 0
    };
  } else if (clip) {
    const v = { ...props.frame, ...clip.transform };
    const size = archiveFrameGeometry(
      props.sourceWidth || props.video?.videoWidth || 2,
      props.sourceHeight || props.video?.videoHeight || 2,
      props.frame
    );
    transformBase = {
      ...common,
      ...previewRotatedExtents(
        (size.contentWidth / size.width) * surface.width * (v.scaleX ?? 1),
        (size.contentHeight / size.height) * surface.height * (v.scaleY ?? 1),
        v.angle ?? 0
      ),
      kind: "video",
      id: clip.id,
      x: v.offsetX ?? 0,
      y: v.offsetY ?? 0,
      sx: v.scaleX ?? 1,
      sy: v.scaleY ?? 1,
      rotation: v.angle ?? 0,
      transform: clip.transform
    };
  }
}
const normalizedAngle = (value: number) => editorNumber(((((value + 180) % 360) + 360) % 360) - 180, 1);
function updateTransform(delta: TransformDelta) {
  const base = transformBase;
  if (!base) return;
  let x = base.x + delta.dx / base.fit / base.width,
    y = base.y + delta.dy / base.fit / base.height;
  if (delta.dx || delta.dy || delta.sx !== 1 || delta.sy !== 1 || delta.angle) base.moved = true;
  if (base.operation === "move" && base.moved) {
    const offset = base.kind === "video" ? 0.5 : 0;
    const sx = snapPreviewAxis((x + offset) * base.width, base.halfW, base.width, base.fit, snapX);
    const sy = snapPreviewAxis((y + offset) * base.height, base.halfH, base.height, base.fit, snapY);
    snapX = sx.lock;
    snapY = sy.lock;
    x = sx.value / base.width - offset;
    y = sy.value / base.height - offset;
    snapGuides.value = { x: sx.guides, y: sy.guides };
  }
  if (base.kind === "subtitle") {
    draft.value = {
      id: base.id,
      x: editorNumber(clamp(x, -10, 11), 6),
      y: editorNumber(clamp(y, -10, 11), 6),
      scaleX: editorNumber(clamp(base.sx * delta.sx, 0.01, 5), 6),
      scaleY: editorNumber(clamp(base.sy * delta.sy, 0.01, 5), 6),
      rotation: normalizedAngle(base.rotation - delta.angle),
      ...(delta.sx !== delta.sy ? { linkedScale: false } : {})
    };
  } else if (base.kind === "watermark" && base.mark) {
    const mark = {
      ...base.mark,
      scaleX: editorNumber(clamp(base.sx * delta.sx, 0.01, 5), 6),
      scaleY: editorNumber(clamp(base.sy * delta.sy, 0.01, 5), 6),
      angle: normalizedAngle(base.rotation + delta.angle)
    };
    const size = archiveFrameGeometry(
      props.sourceWidth || props.video?.videoWidth || 2,
      props.sourceHeight || props.video?.videoHeight || 2,
      props.frame
    );
    markDraft.value = {
      ...mark,
      ...positionWatermarkTrack(
        mark,
        props.time ?? mark.start,
        x * size.width,
        y * size.height,
        size.width,
        size.height
      )
    };
  } else {
    const size = archiveFrameGeometry(
      props.sourceWidth || props.video?.videoWidth || 2,
      props.sourceHeight || props.video?.videoHeight || 2,
      props.frame
    );
    clipDraft.value = {
      id: base.id,
      transform: {
        ...base.transform,
        offsetX: Math.round(clamp(x, -10, 10) * size.width) / size.width,
        offsetY: Math.round(clamp(y, -10, 10) * size.height) / size.height,
        scaleX: editorNumber(clamp(base.sx * delta.sx, 0.01, 5), 6),
        scaleY: editorNumber(clamp(base.sy * delta.sy, 0.01, 5), 6),
        angle: normalizedAngle(base.rotation + delta.angle),
        ...(delta.sx !== delta.sy ? { linkedScale: false } : {})
      }
    };
  }
}
function commitTransform(delta: TransformDelta) {
  updateTransform(delta);
  const base = transformBase;
  if (base?.moved) {
    if (base.kind === "subtitle" && draft.value) {
      const { id, ...changes } = draft.value;
      emit("subtitle", id, changes);
    } else if (base.kind === "watermark" && markDraft.value) {
      const { scaleX, scaleY, angle, offsetX, offsetY, settings, motionOffsetSeconds } = markDraft.value;
      emit("watermark", base.id, { scaleX, scaleY, angle, offsetX, offsetY, settings, motionOffsetSeconds });
    } else if (clipDraft.value) emit("clip", base.id, { transform: clipDraft.value.transform });
  }
  cancelTransform();
}
function cancelTransform() {
  snapX = snapY = undefined;
  snapGuides.value = { x: [], y: [] };
  transformBase = undefined;
  moveOrigin = undefined;
  draft.value = undefined;
  clipDraft.value = undefined;
  markDraft.value = undefined;
}
function onPointerDown(event: PointerEvent) {
  if (props.disabled || event.button !== 0) return;
  let cue = cueAt(event.clientX, event.clientY);
  const surface = canvas.value,
    point = surface ? canvasPoint(surface, event.clientX, event.clientY) : undefined;
  let mark =
    point && surface
      ? [...visibleMarks.value]
          .sort((a, b) => (a.lane ?? 0) - (b.lane ?? 0))
          .find((item) => {
            const g = markGeometry(item, surface.width, surface.height),
              r = (-g.rotation * Math.PI) / 180,
              dx = point.x - g.x,
              dy = point.y - g.y;
            return (
              Math.abs(dx * Math.cos(r) - dy * Math.sin(r)) <= g.width / 2 &&
              Math.abs(dx * Math.sin(r) + dy * Math.cos(r)) <= g.height / 2
            );
          })
      : undefined;
  if (cue && mark) {
    if ((cue.lane ?? 0) <= (mark.lane ?? 0)) mark = undefined;
    else cue = undefined;
  }
  let clip: ArchiveCutClip | undefined;
  if (!cue && !mark && visibleClip.value && canvas.value) {
    const surface = canvas.value,
      point = canvasPoint(surface, event.clientX, event.clientY);
    const size = archiveFrameGeometry(
      props.sourceWidth || props.video?.videoWidth || 2,
      props.sourceHeight || props.video?.videoHeight || 2,
      props.frame
    );
    if (point) {
      const v = visual.value,
        dx = point.x - surface.width * (0.5 + (v.offsetX ?? 0)),
        dy = point.y - surface.height * (0.5 + (v.offsetY ?? 0)),
        r = (-(v.angle ?? 0) * Math.PI) / 180;
      const x = dx * Math.cos(r) - dy * Math.sin(r),
        y = dx * Math.sin(r) + dy * Math.cos(r);
      if (
        Math.abs(x) <= ((size.contentWidth / size.width) * surface.width * (v.scaleX ?? 1)) / 2 &&
        Math.abs(y) <= ((size.contentHeight / size.height) * surface.height * (v.scaleY ?? 1)) / 2
      )
        clip = visibleClip.value;
    }
  }
  emit("select", mark?.id ?? cue?.id ?? clip?.id ?? "");
  if ((!cue && !clip && !mark) || (mark ?? cue ?? clip)?.locked) return;
  startElementTransform(cue, clip, "move", mark);
  moveOrigin = { x: event.clientX, y: event.clientY, pointer: event.pointerId };
  event.preventDefault();
}
function onPointerMove(event: PointerEvent) {
  if (!moveOrigin || event.pointerId !== moveOrigin.pointer) return;
  updateTransform({ dx: event.clientX - moveOrigin.x, dy: event.clientY - moveOrigin.y, sx: 1, sy: 1, angle: 0 });
}
function onPointerUp(event: PointerEvent) {
  if (!moveOrigin || event.pointerId !== moveOrigin.pointer) return;
  commitTransform({ dx: event.clientX - moveOrigin.x, dy: event.clientY - moveOrigin.y, sx: 1, sy: 1, angle: 0 });
}
function cancelKey(event: KeyboardEvent) {
  if (event.key === "Escape" && moveOrigin) {
    event.preventDefault();
    event.stopPropagation();
    cancelTransform();
  }
}
function onDblClick(event: MouseEvent) {
  const cue = cueAt(event.clientX, event.clientY);
  if (props.disabled || !cue || cue.locked) return;
  emit("select", cue.id);
  editing.value = { id: cue.id, text: cue.text };
  void nextTick(() => editInput.value?.focus());
}
function commitEdit() {
  if (!editing.value) return;
  const { id, text } = editing.value;
  editing.value = undefined;
  const cue = (props.subtitles ?? []).find((entry) => entry.id === id);
  if (cue && text.trim() && text !== cue.text) emit("subtitle", id, { text });
}
function cancelEdit() {
  editing.value = undefined;
}
const editorStyle = computed(() => {
  const box = selection.value;
  if (!box) return {};
  return { left: `${box.left}px`, top: `${box.top}px` };
});
onMounted(() => {
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", cancelTransform);
  window.addEventListener("blur", cancelTransform);
  window.addEventListener("resize", cancelTransform);
  window.addEventListener("keydown", cancelKey, true);
});
onScopeDispose(() => {
  for (const element of transitionVideos.values()) {
    element.pause();
    element.removeAttribute("src");
    element.load();
  }
  transitionVideos.clear();
  for (const image of watermarkImages.values()) image.onload = null;
  watermarkImages.clear();
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", cancelTransform);
  window.removeEventListener("blur", cancelTransform);
  window.removeEventListener("resize", cancelTransform);
  window.removeEventListener("keydown", cancelKey, true);
  if (animation !== undefined) cancelAnimationFrame(animation);
});
</script>
<style scoped>
.watermark-trajectory {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 3;
  pointer-events: none;
  overflow: hidden;
  stroke: var(--color-info, #38bdf8);
  stroke-width: 2;
}
.watermark-trajectory circle {
  fill: var(--color-surface, #fff);
}
.preview-snap-guides {
  position: absolute;
  z-index: 5;
  pointer-events: none;
  overflow: visible;
}
.preview-snap-guides line {
  stroke: #00c4cc;
  stroke-width: 1;
}
.cut-picture {
  display: block;
  max-width: 100%;
  max-height: 56vh;
  width: auto;
  height: auto;
  margin: 0 auto;
  object-fit: contain;
  background: #101418;
  border-radius: 10px;
  touch-action: none;
}
.subtitle-editor {
  position: absolute;
  z-index: 3;
  transform: translate(-50%, -50%);
  min-width: 120px;
  min-height: 40px;
  padding: 4px 8px;
  font-size: 14px;
  line-height: 1.4;
  color: #fff;
  background: rgba(0, 0, 0, 0.72);
  border: 1px solid #38bdf8;
  border-radius: 6px;
  resize: none;
}
</style>
