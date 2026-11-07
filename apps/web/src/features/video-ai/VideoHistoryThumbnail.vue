<template>
  <button
    ref="container"
    class="video-history-thumbnail"
    type="button"
    :aria-label="`查看 ${name}`"
    @click="$emit('view')"
  >
    <img v-if="image" :src="image" :alt="`${name} 首帧`" />
    <template v-else>
      <video
        v-if="loading"
        :key="src"
        ref="video"
        :src="src"
        crossorigin="anonymous"
        muted
        playsinline
        preload="auto"
        aria-hidden="true"
        @loadeddata="capture"
        @error="onError"
      />
      <span aria-hidden="true">▶</span>
      <span class="thumbnail-status">{{ failed ? "预览不可用" : src ? "首帧预览" : "暂无预览" }}</span>
    </template>
  </button>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{ src?: string; name: string }>();
defineEmits<{ view: [] }>();
const video = ref<HTMLVideoElement>();
const image = ref<string>();
const loading = ref(false);
const failed = ref(false);
let observer: IntersectionObserver | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;

function stopVideo() {
  clearTimeout(timer);
  timer = undefined;
  loading.value = false;
  const element = video.value;
  if (element) {
    element.pause();
    element.removeAttribute("src");
    element.load();
  }
}

function onError(event: Event) {
  if (event.currentTarget === video.value && video.value?.getAttribute("src") === props.src) fail();
}

function fail() {
  if (!loading.value) return;
  failed.value = true;
  stopVideo();
}

function capture(event: Event) {
  const element = event.currentTarget as HTMLVideoElement;
  if (!loading.value || element !== video.value || element.getAttribute("src") !== props.src || element.readyState < 2)
    return;
  try {
    if (!element.videoWidth || !element.videoHeight) throw new Error("No decoded frame");
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 200 / Math.max(element.videoWidth, element.videoHeight));
    canvas.width = Math.max(1, Math.round(element.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(element.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.drawImage(element, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/jpeg", 0.8);
    if (!result.startsWith("data:image/jpeg")) throw new Error("No thumbnail");
    image.value = result;
    stopVideo();
  } catch {
    fail();
  }
}

const container = ref<HTMLElement>();
function observe() {
  observer?.disconnect();
  stopVideo();
  image.value = undefined;
  failed.value = false;
  if (!props.src || disposed) return;
  const source = props.src;
  const load = () => {
    if (disposed || source !== props.src || loading.value || image.value || failed.value) return;
    loading.value = true;
    timer = setTimeout(fail, 20_000);
  };
  if (typeof IntersectionObserver === "undefined") load();
  else {
    observer = new IntersectionObserver(
      (entries) => {
        if (!disposed && source === props.src && entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect();
          load();
        }
      },
      { rootMargin: "120px" }
    );
    if (container.value) observer.observe(container.value);
  }
}
onMounted(observe);
watch(() => props.src, observe);
onBeforeUnmount(() => {
  disposed = true;
  observer?.disconnect();
  stopVideo();
});
</script>

<style scoped>
.video-history-thumbnail {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  width: 100px;
  height: 76px;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text-secondary);
  background: var(--color-surface);
  cursor: pointer;
}
.video-history-thumbnail:hover,
.video-history-thumbnail:focus-visible {
  outline: 2px solid var(--color-primary-600);
  outline-offset: 2px;
}
img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
video {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
.thumbnail-status {
  font-size: 11px;
}
</style>
