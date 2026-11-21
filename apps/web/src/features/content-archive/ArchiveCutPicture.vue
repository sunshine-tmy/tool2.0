<template><canvas ref="canvas" class="cut-picture" aria-label="裁切、旋转与镜像预览"></canvas></template>
<script setup lang="ts">
import { ref, watch, onScopeDispose } from "vue";
import {
  archiveFrameGeometry,
  archiveVisibleClip,
  type ArchiveCutClip,
  type ArchiveFrame,
  type ArchiveSubtitle
} from "@toolbox/shared/archive";
const props = defineProps<{
  video?: HTMLVideoElement;
  frame: ArchiveFrame;
  subtitles?: ArchiveSubtitle[];
  time?: number;
  gap?: boolean;
  clips?: ArchiveCutClip[];
  sourceWidth?: number;
  sourceHeight?: number;
}>();
const canvas = ref<HTMLCanvasElement>();
let animation: number | undefined;
let lastPicture = "";
// 元数据就绪不代表已有可绘制的视频帧；首帧或 seek 解码完成后强制重绘。
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
    const visible = archiveVisibleClip(props.clips ?? [], props.time ?? 0);
    const visibleSubtitles = (props.subtitles ?? [])
      .filter(
        (cue) =>
          (props.time ?? 0) >= cue.start &&
          (props.time ?? 0) < cue.end &&
          (visible < 0 || (cue.lane ?? 0) <= (props.clips![visible].lane ?? 1))
      )
      .sort((a, b) => (b.lane ?? 0) - (a.lane ?? 0));
    const picture = JSON.stringify([
      video?.currentTime,
      video?.readyState,
      video?.seeking,
      video?.currentSrc,
      props.gap,
      width,
      height,
      frame,
      visibleSubtitles
    ]);
    const ctx = surface.getContext("2d");
    if (ctx && picture !== lastPicture) {
      lastPicture = picture;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.scale(width / size.width, height / size.height);
      ctx.translate(-size.x, -size.y);
      if (frame.flipX || frame.flipY) {
        ctx.translate(frame.flipX ? size.fullWidth : 0, frame.flipY ? size.fullHeight : 0);
        ctx.scale(frame.flipX ? -1 : 1, frame.flipY ? -1 : 1);
      }
      if (frame.rotation === 90) {
        ctx.translate(baseHeight, 0);
        ctx.rotate(Math.PI / 2);
      } else if (frame.rotation === 180) {
        ctx.translate(baseWidth, baseHeight);
        ctx.rotate(Math.PI);
      } else if (frame.rotation === 270) {
        ctx.translate(0, baseWidth);
        ctx.rotate(-Math.PI / 2);
      }
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, baseWidth, baseHeight);
      if (!props.gap && video?.videoWidth && video.readyState >= 2) {
        const fit = Math.min(baseWidth / video.videoWidth, baseHeight / video.videoHeight);
        ctx.drawImage(
          video,
          (baseWidth - video.videoWidth * fit) / 2,
          (baseHeight - video.videoHeight * fit) / 2,
          video.videoWidth * fit,
          video.videoHeight * fit
        );
      }
      ctx.restore();
      for (const cue of visibleSubtitles) {
        const font = (cue.fontSize * height) / 720;
        ctx.font = `${font}px Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const lines = cue.text.split(/\r?\n/),
          lineHeight = font * 1.2;
        const center =
          cue.position === "top"
            ? (24 * height) / 720 + (lines.length * lineHeight) / 2
            : cue.position === "center"
              ? height / 2
              : height - (24 * height) / 720 - (lines.length * lineHeight) / 2;
        lines.forEach((line, i) => {
          const y = center + (i - (lines.length - 1) / 2) * lineHeight;
          ctx.strokeStyle = "black";
          ctx.lineWidth = Math.max(1, (2 * height) / 720);
          ctx.strokeText(line, width / 2, y, width - 16);
          ctx.fillStyle = cue.color;
          ctx.fillText(line, width / 2, y, width - 16);
        });
      }
    }
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
onScopeDispose(() => {
  if (animation !== undefined) cancelAnimationFrame(animation);
});
</script>
<style scoped>
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
}
</style>
