<!-- 中文模块说明：小红书归档前端模块，负责列表、详情、媒体和翻译交互 -->
<template>
  <div class="media-gallery" :class="{ 'is-compact': compact }">
    <div v-if="media" class="media-stage">
      <n-image
        v-if="media.kind === 'image' || media.kind === 'cover'"
        class="media-image"
        :src="mediaUrl(media.previewUrl)"
        :alt="item.title"
        object-fit="contain"
      />
      <video
        v-else
        ref="videoElement"
        :src="mediaUrl(media.previewUrl)"
        crossorigin="anonymous"
        controls
        playsinline
        preload="metadata"
        @play="onVideoPlay"
        @pause="onVideoPause"
        @loadeddata="onVideoFrameReady"
        @seeking="onVideoSeeking"
        @seeked="onVideoFrameReady"
      />
      <span v-if="isCapturedVideoFrame(media)" class="captured-frame-badge" role="img" aria-label="视频截帧图片">
        <Camera :size="15" aria-hidden="true" />
        <span>截帧</span>
      </span>
      <template v-if="item.media.length > 1">
        <button
          class="media-nav media-nav-prev"
          type="button"
          aria-label="上一张"
          :disabled="selected === 0"
          @click="changeMedia(-1)"
        >
          <ChevronLeft :size="24" />
        </button>
        <button
          class="media-nav media-nav-next"
          type="button"
          aria-label="下一张"
          :disabled="selected === item.media.length - 1"
          @click="changeMedia(1)"
        >
          <ChevronRight :size="24" />
        </button>
      </template>
    </div>
    <div v-else class="media-empty">没有可预览媒体</div>

    <template v-if="media">
      <div class="media-thumbs">
        <button
          v-for="(entry, index) in item.media"
          :key="entry.id"
          type="button"
          :class="{ active: selected === index }"
          @click="selected = index"
        >
          <img
            v-if="entry.kind === 'image' || entry.kind === 'cover'"
            :src="mediaUrl(entry.previewUrl)"
            :alt="`媒体 ${index + 1}`"
          />
          <video
            v-else
            :src="mediaUrl(entry.previewUrl)"
            muted
            playsinline
            preload="metadata"
            @loadedmetadata="showFirstVideoFrame"
          />
          <span
            v-if="isCapturedVideoFrame(entry)"
            class="captured-frame-thumb-badge"
            title="视频截帧"
            aria-label="视频截帧"
          >
            <Camera :size="11" aria-hidden="true" />
            <span>截帧</span>
          </span>
        </button>
      </div>
      <div class="media-actions">
        <div v-if="isVideoMedia(media)" class="frame-capture-actions">
          <n-button
            size="small"
            type="primary"
            :disabled="!canCaptureFrame"
            :loading="savingFrame"
            @click="saveCurrentFrame"
          >
            保存当前帧
          </n-button>
          <small aria-live="polite">
            {{ frameMessage || frameHint }}
          </small>
        </div>
        <a :href="mediaUrl(media.downloadUrl)">下载当前媒体</a>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NButton, NImage } from "naive-ui";
import { Camera, ChevronLeft, ChevronRight } from "lucide-vue-next";
import type { XhsArchiveItem } from "@toolbox/shared";
import { resolveBackendUrl } from "../../config/runtime";
import { formatApiError } from "../../services/http";
import { xhsArchiveApi } from "./api";

const props = withDefaults(
  defineProps<{
    item: XhsArchiveItem;
    compact?: boolean;
  }>(),
  { compact: false }
);

const selected = ref(0);
const media = computed(() => props.item.media[selected.value] ?? props.item.media[0]);
const videoElement = ref<HTMLVideoElement>();
const videoPaused = ref(true);
const videoFrameReady = ref(false);
const savingFrame = ref(false);
const frameMessage = ref("");
const canCaptureFrame = computed(
  () =>
    isVideoMedia(media.value) &&
    videoPaused.value &&
    videoFrameReady.value &&
    !savingFrame.value &&
    Boolean(videoElement.value?.videoWidth && videoElement.value.videoHeight)
);
const frameHint = computed(() => {
  if (!videoPaused.value) return "请先暂停视频，再保存当前画面";
  return videoFrameReady.value ? "暂停到目标画面后保存 PNG" : "等待视频画面加载后即可保存";
});
const emit = defineEmits<{ frameSaved: [item: XhsArchiveItem] }>();

watch(
  () => props.item.id,
  () => {
    selected.value = 0;
  }
);

watch(
  () => media.value?.id,
  () => {
    videoPaused.value = true;
    videoFrameReady.value = false;
    frameMessage.value = "";
  }
);

function mediaUrl(url: string) {
  return resolveBackendUrl(url);
}

function showFirstVideoFrame(event: Event) {
  const video = event.currentTarget as HTMLVideoElement;
  if (video.currentTime > 0) return;
  const target = Number.isFinite(video.duration) && video.duration > 0 ? Math.min(0.1, video.duration / 2) : 0.1;
  video.currentTime = target;
}

function isVideoMedia(value: XhsArchiveItem["media"][number] | undefined): value is XhsArchiveItem["media"][number] {
  return value?.kind === "video" || value?.kind === "live-photo";
}

function isCapturedVideoFrame(value: XhsArchiveItem["media"][number] | undefined) {
  return value?.frameSourceMediaId !== undefined && value.frameTimestampMs !== undefined;
}

function onVideoPlay() {
  videoPaused.value = false;
}

function onVideoSeeking() {
  videoFrameReady.value = false;
}

function onVideoPause() {
  videoPaused.value = true;
  const video = videoElement.value;
  videoFrameReady.value = Boolean(video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0);
}

function onVideoFrameReady() {
  const video = videoElement.value;
  videoFrameReady.value = Boolean(video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0);
}

async function saveCurrentFrame() {
  const video = videoElement.value;
  const sourceMedia = media.value;
  if (!video || !isVideoMedia(sourceMedia) || !video.paused || !videoFrameReady.value || !video.videoWidth) return;

  savingFrame.value = true;
  frameMessage.value = "正在保存截帧…";
  const timestampMs = Math.max(0, Math.round(video.currentTime * 1000));
  let uploadStarted = false;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器无法读取视频画面");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("无法生成 PNG 截帧"))), "image/png");
    });
    const form = new FormData();
    form.append("sourceMediaId", sourceMedia.id);
    form.append("timestampMs", String(timestampMs));
    form.append("file", png, "video-frame.png");
    uploadStarted = true;
    const updated = await xhsArchiveApi.addFrame(props.item.id, form);
    emit("frameSaved", updated);
    frameMessage.value = `已保存 ${formatTimestamp(timestampMs)} 的 PNG 截帧`;
  } catch (error) {
    frameMessage.value =
      !uploadStarted && error instanceof Error ? error.message : formatApiError(error, "保存视频截帧失败");
  } finally {
    savingFrame.value = false;
  }
}

function formatTimestamp(timestampMs: number) {
  const hours = Math.floor(timestampMs / 3_600_000);
  const minutes = Math.floor((timestampMs % 3_600_000) / 60_000);
  const seconds = Math.floor((timestampMs % 60_000) / 1_000);
  const milliseconds = timestampMs % 1_000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function changeMedia(direction: -1 | 1) {
  const count = props.item.media.length;
  if (count < 2) return;
  selected.value = Math.max(0, Math.min(count - 1, selected.value + direction));
}
</script>

<style scoped>
.media-gallery {
  display: grid;
  min-width: 0;
  justify-items: center;
  gap: 10px;
  margin-bottom: 18px;
}
.media-stage {
  position: relative;
  display: flex;
  width: min(100%, 520px);
  height: auto;
  aspect-ratio: 3 / 4;
  min-width: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-sizing: border-box;
  padding: 12px;
  border-radius: 14px;
  background: #101318;
}
.media-nav {
  position: absolute;
  z-index: 2;
  top: 50%;
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  padding: 0;
  color: #172033;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
  cursor: pointer;
  transform: translateY(-50%);
  transition:
    background 0.18s ease,
    transform 0.18s ease;
}
.media-nav:hover {
  background: #fff;
  transform: translateY(-50%) scale(1.06);
}
.media-nav:disabled {
  opacity: 0.32;
  cursor: not-allowed;
}
.media-nav:disabled:hover {
  background: rgba(255, 255, 255, 0.9);
  transform: translateY(-50%);
}
.media-nav:focus-visible {
  outline: 3px solid rgba(37, 99, 235, 0.45);
  outline-offset: 2px;
}
.media-nav-prev {
  left: 14px;
}
.media-nav-next {
  right: 14px;
}
.media-image {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  align-items: center;
  justify-content: center;
}
.media-image :deep(img),
.media-stage video {
  display: block;
  width: auto !important;
  height: auto !important;
  max-width: 100% !important;
  max-height: 100% !important;
  object-fit: contain;
}
.is-compact .media-stage {
  width: min(100%, 480px);
  height: auto;
  padding: 8px;
}
.media-thumbs {
  display: flex;
  width: min(100%, 520px);
  min-width: 0;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.media-thumbs button {
  position: relative;
  flex: 0 0 60px;
  height: 80px;
  overflow: hidden;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 9px;
  background: #eef2f7;
  cursor: pointer;
}
.is-compact .media-thumbs button {
  flex-basis: 54px;
  height: 72px;
}
.is-compact .media-thumbs,
.is-compact .media-actions {
  width: min(100%, 480px);
}
.media-thumbs button.active {
  border-color: #2563eb;
}
.media-thumbs img,
.media-thumbs video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.media-thumbs video {
  display: block;
  pointer-events: none;
}
.captured-frame-badge,
.captured-frame-thumb-badge {
  position: absolute;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: #e85d04;
  box-shadow: 0 2px 8px rgb(0 0 0 / 32%);
  pointer-events: none;
}
.captured-frame-badge {
  top: 20px;
  right: 20px;
  gap: 5px;
  padding: 6px 10px;
  border: 1px solid rgb(255 255 255 / 32%);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.captured-frame-thumb-badge {
  top: 4px;
  right: 4px;
  gap: 2px;
  padding: 3px 4px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}
.media-thumbs .captured-frame-thumb-badge {
  height: auto;
  flex-direction: row;
  font-size: 9px;
}
.media-thumbs span {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 11px;
}
.media-actions {
  display: flex;
  width: min(100%, 520px);
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.frame-capture-actions {
  display: grid;
  justify-items: start;
  gap: 5px;
}
.frame-capture-actions small {
  color: #758096;
  line-height: 1.4;
}
.media-actions > a {
  flex: 0 0 auto;
  margin-top: 5px;
  margin-left: auto;
  text-align: right;
  color: #2563eb;
  text-decoration: none;
}
.media-empty {
  display: grid;
  min-height: 160px;
  place-items: center;
  color: #8a94a6;
  border-radius: 14px;
  background: #f3f5f8;
}

@media (max-width: 640px) {
  .media-stage {
    width: min(100%, 420px);
    height: auto;
    padding: 8px;
  }
  .is-compact .media-stage {
    width: min(100%, 400px);
    height: auto;
  }
  .media-nav {
    width: 36px;
    height: 36px;
  }
  .media-nav-prev {
    left: 8px;
  }
  .media-nav-next {
    right: 8px;
  }
}
</style>
