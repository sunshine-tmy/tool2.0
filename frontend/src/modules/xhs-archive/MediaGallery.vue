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
      <video v-else :src="mediaUrl(media.previewUrl)" controls preload="metadata" />
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
        </button>
      </div>
      <div class="media-download"><a :href="mediaUrl(media.downloadUrl)">下载当前媒体</a></div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NImage } from "naive-ui";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import type { XhsArchiveItem } from "@toolbox/shared";
import { resolveBackendUrl } from "../../config/runtime";

const props = withDefaults(
  defineProps<{
    item: XhsArchiveItem;
    compact?: boolean;
  }>(),
  { compact: false }
);

const selected = ref(0);
const media = computed(() => props.item.media[selected.value] ?? props.item.media[0]);

watch(
  () => props.item.id,
  () => {
    selected.value = 0;
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
.is-compact .media-download {
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
.media-thumbs span {
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 11px;
}
.media-download {
  width: min(100%, 520px);
  text-align: right;
}
.media-download a {
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
