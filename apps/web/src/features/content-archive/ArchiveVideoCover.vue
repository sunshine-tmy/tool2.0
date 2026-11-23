<template>
  <div ref="host" class="source-cover" :aria-busy="loading">
    <img v-if="poster && !failed" :src="poster" :alt="title" @error="failed = true" />
    <div v-else class="cover-placeholder">
      <Film :size="28" aria-hidden="true" />
      <span v-if="failed">封面暂不可用</span>
      <span v-else-if="loading">正在加载封面</span>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, watch, onMounted, onScopeDispose } from "vue";
import { Film } from "lucide-vue-next";
import { loadVideoCover } from "./video-cover";
const props = defineProps<{ url?: string; title: string; image?: boolean }>();
const host = ref<HTMLElement>(),
  visible = ref(false),
  poster = ref(""),
  loading = ref(false),
  failed = ref(false);
let observer: IntersectionObserver | undefined;
let request: AbortController | undefined;
watch([visible, () => props.url, () => props.image], async ([shown, url, image], old) => {
  request?.abort();
  request = undefined;
  loading.value = false;
  if (url !== old?.[1] || image !== old?.[2]) {
    poster.value = "";
    failed.value = false;
  }
  if (!shown || !url || poster.value || failed.value) return;
  if (image) {
    poster.value = url;
    return;
  }
  const own = (request = new AbortController());
  loading.value = true;
  try {
    const value = await loadVideoCover(url, own.signal);
    if (!own.signal.aborted) poster.value = value;
  } catch {
    if (!own.signal.aborted) failed.value = true;
  } finally {
    if (request === own) loading.value = false;
  }
});
onMounted(() => {
  if (typeof IntersectionObserver === "undefined") {
    visible.value = true;
    return;
  }
  observer = new IntersectionObserver(
    ([entry]) => {
      visible.value = entry.isIntersecting;
    },
    { rootMargin: "100px" }
  );
  observer.observe(host.value!);
});
onScopeDispose(() => {
  observer?.disconnect();
  request?.abort();
});
</script>
<style scoped>
.source-cover {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  background: #303236;
  color: #cfdee6;
  aspect-ratio: 3 / 2;
  border-radius: 8px;
}
.source-cover img {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
}
.cover-placeholder {
  display: grid;
  justify-items: center;
  gap: 6px;
  font-size: 12px;
}
</style>
