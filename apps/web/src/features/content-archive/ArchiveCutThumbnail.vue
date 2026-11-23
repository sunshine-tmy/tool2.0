<template>
  <div ref="host" class="cut-thumb" aria-label="按时间分段的视频缩略图">
    <img
      v-for="shot in shots"
      :key="`${shot.key}/${shot.left}`"
      :src="shot.image || undefined"
      :alt="`${shot.time.toFixed(2)} 秒画面`"
      :style="{ left: `${shot.left}px`, width: `${shot.width}px`, visibility: shot.image ? 'visible' : 'hidden' }"
      draggable="false"
    />
  </div>
</template>
<script lang="ts">
type Shot = { key: string; time: number; left: number; width: number; image?: string };
const cache = new Map<string, string>();
let queue: Promise<unknown> = Promise.resolve();
function thumbnails(url: string, shots: Shot[], signal: AbortSignal, done: (key: string, image: string) => void) {
  queue = queue
    .catch(() => undefined)
    .then(async () => {
      if (signal.aborted) return;
      const missing = shots.filter((shot) => !cache.has(shot.key));
      if (!missing.length) return;
      const video = document.createElement("video");
      video.muted = true;
      video.preload = "auto";
      video.crossOrigin = "anonymous";
      function wait(name: string) {
        return new Promise<void>((resolve, reject) => {
          if (signal.aborted) {
            reject(new DOMException("取消取帧", "AbortError"));
            return;
          }
          const timer = setTimeout(() => finish(new Error("取帧超时")), 7000);
          const ok = () => finish(),
            fail = () => finish(new Error("无法读取视频帧")),
            aborted = () => finish(new DOMException("取消取帧", "AbortError"));
          function finish(error?: Error) {
            clearTimeout(timer);
            video.removeEventListener(name, ok);
            video.removeEventListener("error", fail);
            signal.removeEventListener("abort", aborted);
            error ? reject(error) : resolve();
          }
          video.addEventListener(name, ok, { once: true });
          video.addEventListener("error", fail, { once: true });
          signal.addEventListener("abort", aborted, { once: true });
        });
      }
      try {
        const ready = wait("loadeddata");
        video.src = url;
        video.load();
        await ready;
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");
        if (!ctx || !video.videoWidth) return;
        for (const shot of missing) {
          if (signal.aborted) return;
          const cached = cache.get(shot.key);
          if (cached) {
            done(shot.key, cached);
            continue;
          }
          const target = Math.min(shot.time, Math.max(0, video.duration - 0.001));
          if (Math.abs(video.currentTime - target) > 0.001) {
            const seek = wait("seeked");
            video.currentTime = target;
            await seek;
          }
          if (signal.aborted) return;
          const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
          ctx.drawImage(
            video,
            (canvas.width - video.videoWidth * scale) / 2,
            (canvas.height - video.videoHeight * scale) / 2,
            video.videoWidth * scale,
            video.videoHeight * scale
          );
          const image = canvas.toDataURL("image/jpeg", 0.65);
          cache.set(shot.key, image);
          if (cache.size > 320) cache.delete(cache.keys().next().value!);
          done(shot.key, image);
        }
      } catch {
        /* 帧读取失败不影响预览和剪辑。 */
      } finally {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    });
}
</script>
<script setup lang="ts">
import { onMounted, onScopeDispose, ref, watch } from "vue";
const props = defineProps<{
  url: string;
  time: number;
  end: number;
  fps?: number;
  revision?: string;
  reverse?: boolean;
}>();
const host = ref<HTMLElement>(),
  shots = ref<Shot[]>([]);
let viewport: HTMLElement | null = null,
  visible = false,
  intersection: IntersectionObserver | undefined,
  resize: ResizeObserver | undefined;
let controller: AbortController | undefined,
  animation: number | undefined,
  signature = "";
function schedule() {
  if (animation === undefined)
    animation = requestAnimationFrame(() => {
      animation = undefined;
      measure();
    });
}
function measure() {
  if (!visible || !host.value || !viewport || host.value.clientWidth <= 0) return;
  const bounds = host.value.getBoundingClientRect(),
    view = viewport.getBoundingClientRect();
  const count = Math.max(1, Math.ceil(bounds.width / 72)),
    width = bounds.width / count;
  const first = Math.max(0, Math.floor((view.left - bounds.left - 100) / width));
  const last = Math.min(count, Math.ceil((view.right - bounds.left + 100) / width));
  const list = Array.from({ length: Math.max(0, last - first) }, (_, offset): Shot => {
    const index = first + offset,
      raw = props.reverse
        ? props.end - 1 / (props.fps ?? 30) - ((props.end - props.time) * index) / count
        : props.time + ((props.end - props.time) * index) / count;
    const time = Math.max(props.time, Math.min(props.end, Math.round(raw * (props.fps ?? 30)) / (props.fps ?? 30)));
    const key = `${props.url}/${props.revision ?? ""}/${time.toFixed(4)}`;
    return { key, time, left: index * width, width: width + 0.5, image: cache.get(key) };
  });
  const next = JSON.stringify(list.map((shot) => [shot.key, shot.left, shot.width]));
  if (next === signature) return;
  signature = next;
  controller?.abort();
  const own = (controller = new AbortController());
  shots.value = list;
  thumbnails(props.url, list, own.signal, (key, image) => {
    if (!own.signal.aborted) shots.value = shots.value.map((shot) => (shot.key === key ? { ...shot, image } : shot));
  });
}
watch(
  () => [props.url, props.time, props.end, props.fps, props.revision, props.reverse],
  () => {
    signature = "";
    schedule();
  }
);
onMounted(() => {
  viewport = host.value!.closest(".cut-scroll");
  intersection = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
      else {
        controller?.abort();
        signature = "";
      }
    },
    { root: viewport, rootMargin: "100px" }
  );
  intersection.observe(host.value!);
  resize = new ResizeObserver(schedule);
  resize.observe(host.value!);
  if (viewport) resize.observe(viewport);
  viewport?.addEventListener("scroll", schedule, { passive: true });
});
onScopeDispose(() => {
  controller?.abort();
  resize?.disconnect();
  intersection?.disconnect();
  viewport?.removeEventListener("scroll", schedule);
  if (animation !== undefined) cancelAnimationFrame(animation);
});
</script>
<style scoped>
.cut-thumb {
  position: absolute;
  left: 0;
  right: 0;
  top: 15px;
  bottom: 0;
  overflow: hidden;
  background: #292537;
  pointer-events: none;
}
.cut-thumb img {
  position: absolute;
  top: 0;
  height: 100%;
  object-fit: cover;
}
</style>
