<template><span hidden aria-hidden="true" /></template>
<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch } from "vue";
import { EmptyResultSchema } from "@toolbox/shared";
import { audioLibraryPlayer } from "../modules/audio-library/player";
import { httpClient } from "../services/http";
import { localDiagnosticsAvailable } from "../services/diagnostics";
import { resolveApiUrl } from "../config/runtime";
import { createLocalId } from "../utils/local-id";
let timer: ReturnType<typeof setInterval> | undefined;
let disposed = false,
  posting = false,
  changed = false;
const clientId = (() => {
  try {
    const old = sessionStorage.getItem("diagnostic-client-id");
    if (old) return old;
    const id = createLocalId("playback");
    sessionStorage.setItem("diagnostic-client-id", id);
    return id;
  } catch {
    return `client-${Date.now()}`;
  }
})();
function active() {
  return (
    ["playing", "loading", "waiting"].includes(audioLibraryPlayer.phase) ||
    [...document.querySelectorAll("audio,video")].some(
      (node) => node instanceof HTMLMediaElement && !node.paused && !node.ended
    )
  );
}
async function report() {
  if (disposed) return;
  if (posting) {
    changed = true;
    return;
  }
  posting = true;
  const isActive = active();
  try {
    await window.toolboxDesktop?.setAudioPlaybackActive?.(isActive);
  } catch {
    /* 后端状态仍独立汇报。 */
  }
  try {
    await httpClient.post(
      localDiagnosticsAvailable ? "/diagnostics/playback" : "/lan-access/playback",
      EmptyResultSchema,
      { clientId, active: isActive },
      { timeout: 4000 }
    );
  } catch (e) {
    // 维护期间不允许新的播放与模型自检竞争；不把网络失败误当成维护。
    const status =
      (e as { response?: { status?: number }; status?: number }).response?.status ?? (e as { status?: number }).status;
    if (isActive && status === 409) {
      audioLibraryPlayer.pause();
      document.querySelectorAll("audio,video").forEach((node) => {
        if (node instanceof HTMLMediaElement) node.pause();
      });
    }
  } finally {
    posting = false;
    if (changed && !disposed) {
      changed = false;
      void report();
    }
  }
}
watch(() => audioLibraryPlayer.phase, report);
const events = ["play", "pause", "ended", "emptied"];
function releaseRemotePlayback() {
  if (localDiagnosticsAvailable) return;
  // 页面确实离开时释放当前访客；异常断网仍保留原有保守保护策略。
  void fetch(resolveApiUrl("/lan-access/playback"), {
    method: "POST",
    credentials: "same-origin",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientId, active: false })
  }).catch(() => undefined);
}
onMounted(() => {
  window.addEventListener("pagehide", releaseRemotePlayback);
  events.forEach((event) => document.addEventListener(event, report, true));
  timer = setInterval(report, 5000);
  void report();
});
onBeforeUnmount(() => {
  releaseRemotePlayback();
  window.removeEventListener("pagehide", releaseRemotePlayback);
  disposed = true;
  clearInterval(timer);
  events.forEach((event) => document.removeEventListener(event, report, true));
});
</script>
