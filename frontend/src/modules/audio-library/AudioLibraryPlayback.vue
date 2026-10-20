<!-- 仅承载音频与客户端状态，无可见布局；控件由音频库页面在文档流中展示。 -->
<template><audio ref="audio" data-audio-library-queue preload="metadata" /></template>
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { audioLibraryPlayer as player } from "./player";
import { audioLibraryApi } from "./api";
import { apiBaseUrl } from "../../config/runtime";
const audio = ref<HTMLAudioElement>();
const storageKey = `toolbox-audio-player:${apiBaseUrl}`;
let restoringQueue = true,
  keepPreviousQueue = false;
function persist() {
  if (restoringQueue || (keepPreviousQueue && !player.queue.length)) return;
  keepPreviousQueue = false;
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        queue: player.queue.map((x) => ({ entryId: x.entryId, itemId: x.item.id })),
        currentId: player.currentId,
        position: player.savedPosition,
        mode: player.mode,
        gap: player.gap,
        volume: player.volume
      })
    );
  } catch {
    /* 本机存储不可用时仍可播放。 */
  }
}
function audioFocus(event: Event) {
  const target = event.target;
  // 分组内播放与队列相互独立，两者的播放事件不参与对方的音频焦点互斥。
  if (target instanceof HTMLMediaElement && target.hasAttribute("data-audio-library-inline")) return;
  if (target instanceof HTMLMediaElement && target !== audio.value && !target.muted && target.volume > 0)
    player.pause();
  else if (target === audio.value)
    document.querySelectorAll("audio,video").forEach((node) => {
      if (
        node !== target &&
        node instanceof HTMLMediaElement &&
        !node.muted &&
        !node.hasAttribute("data-audio-library-inline")
      )
        node.pause();
    });
}
watch(
  () => [
    player.queue.map((x) => x.entryId).join(","),
    player.currentId,
    player.phase,
    player.mode,
    player.gap,
    player.volume
  ],
  persist
);
watch(
  () => player.phase,
  (phase) => {
    void window.toolboxDesktop
      ?.setAudioPlaybackActive?.(["playing", "loading", "waiting"].includes(phase))
      .catch(() => undefined);
  }
);
let saveTimer: ReturnType<typeof setInterval> | undefined,
  disposed = false;
onMounted(async () => {
  if (audio.value) player.attach(audio.value);
  document.addEventListener("play", audioFocus, true);
  saveTimer = setInterval(persist, 5000);
  try {
    if (player.queue.length || player.preview) return;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved.queue)) return;
    const entries = saved.queue
      .slice(0, 200)
      .filter(
        (x: { itemId?: unknown; entryId?: unknown }) => typeof x.itemId === "string" && typeof x.entryId === "string"
      );
    const initialQueue = player.queue;
    const items = await audioLibraryApi.resolve([...new Set<string>(entries.map((x: { itemId: string }) => x.itemId))]);
    // 加载期间用户主动加入或加载了新队列时，以用户的新操作为准。
    if (disposed || player.queue !== initialQueue || player.queue.length || player.preview) return;
    player.queue = entries.flatMap((entry: { entryId: string; itemId: string }) => {
      const item = items.find((x) => x.id === entry.itemId);
      return item ? [{ entryId: entry.entryId, item }] : [];
    });
    player.currentId = player.queue.some((x) => x.entryId === saved.currentId)
      ? saved.currentId
      : player.queue[0]?.entryId || "";
    player.position = Number.isFinite(saved.position)
      ? Math.max(0, Math.min(saved.position, player.current?.duration || 0))
      : 0;
    player.mode = ["sequence", "list", "single"].includes(saved.mode) ? saved.mode : "sequence";
    player.gap = Number.isFinite(saved.gap) ? Math.max(0, Math.min(300, saved.gap)) : 1;
    player.setVolume(Number.isFinite(saved.volume) ? saved.volume : 1);
    player.phase = "paused";
  } catch {
    keepPreviousQueue = true;
  } finally {
    restoringQueue = false;
  }
});
onBeforeUnmount(() => {
  disposed = true;
  persist();
  player.dispose();
  document.removeEventListener("play", audioFocus, true);
  if (saveTimer) clearInterval(saveTimer);
});
</script>
