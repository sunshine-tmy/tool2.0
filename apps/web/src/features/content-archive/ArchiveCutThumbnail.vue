<template>
  <div ref="host" class="cut-thumb" :style="image ? { backgroundImage: `url(${image})` } : undefined"></div>
</template>
<script lang="ts">
const cache = new Map<string, string>();
let queue = Promise.resolve();
function thumbnail(url: string, time: number, alive: () => boolean, done: (value: string) => void) {
  const key = `${url}/${time.toFixed(3)}`;
  if (cache.has(key)) {
    done(cache.get(key)!);
    return;
  }
  queue = queue
    .catch(() => {})
    .then(async () => {
      if (!alive()) return;
      if (cache.has(key)) {
        done(cache.get(key)!);
        return;
      }
      const video = document.createElement("video");
      video.muted = true;
      video.preload = "auto";
      video.crossOrigin = "anonymous";
      video.src = url;
      const wait = (event: string) =>
        new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => finish(new Error("thumbnail timeout")), 7000);
          const ok = () => finish(),
            fail = () => finish(new Error("thumbnail unavailable"));
          function finish(error?: Error) {
            clearTimeout(timer);
            video.removeEventListener(event, ok);
            video.removeEventListener("error", fail);
            error ? reject(error) : resolve();
          }
          video.addEventListener(event, ok, { once: true });
          video.addEventListener("error", fail, { once: true });
        });
      try {
        const ready = wait("loadeddata");
        video.load();
        await ready;
        if (!alive()) return;
        const target = Math.min(time, Math.max(0, video.duration - 0.05));
        if (Math.abs(video.currentTime - target) > 0.001) {
          const seeked = wait("seeked");
          video.currentTime = target;
          await seeked;
        }
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 60;
        const ctx = canvas.getContext("2d");
        if (!ctx || !video.videoWidth) return;
        const scale = Math.max(128 / video.videoWidth, 60 / video.videoHeight);
        ctx.drawImage(
          video,
          (128 - video.videoWidth * scale) / 2,
          (60 - video.videoHeight * scale) / 2,
          video.videoWidth * scale,
          video.videoHeight * scale
        );
        const image = canvas.toDataURL("image/jpeg", 0.65);
        cache.set(key, image);
        if (cache.size > 80) cache.delete(cache.keys().next().value!);
        if (alive()) done(image);
      } catch {
        /* 缩略图加载失败不阻断剪辑和原片预览。 */
      } finally {
        video.removeAttribute("src");
        video.load();
      }
    });
}
</script>
<script setup lang="ts">
import { ref, watch, onMounted, onScopeDispose } from "vue";
const props = defineProps<{ url: string; time: number }>();
const host = ref<HTMLElement>(),
  image = ref("");
let observer: IntersectionObserver | undefined,
  visible = false,
  generation = 0;
function load() {
  const token = ++generation;
  if (visible && props.url)
    thumbnail(
      props.url,
      props.time,
      () => token === generation,
      (value) => (image.value = value)
    );
}
onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible) load();
    },
    { rootMargin: "100px" }
  );
  if (host.value) observer.observe(host.value);
});
watch(
  () => [props.url, props.time],
  () => {
    image.value = "";
    load();
  }
);
onScopeDispose(() => {
  generation++;
  observer?.disconnect();
});
</script>
<style scoped>
.cut-thumb {
  width: 100%;
  height: 100%;
  background-position: left center;
  background-repeat: repeat-x;
  background-size: auto 60px;
  background-color: #292537;
}
</style>
