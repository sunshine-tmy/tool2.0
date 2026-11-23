/** 复用可取消的编辑任务生成倒放预览；同一源范围只生成一次，裁剪复用已有范围。 */
import { ref } from "vue";
import {
  archiveNeedsSourcePreview,
  archivePreviewClip,
  defaultArchiveFrame,
  type ArchiveCutClip,
  type ArchiveStudio,
  type ContentArchiveMedia
} from "@toolbox/shared/archive";
import { videoEditApi } from "./video-edit-api";
import { resolveBackendUrl } from "../../shared/config/runtime";

type ReverseAsset = { source: string; start: number; end: number; url: string; interpolation?: boolean; speed: number };
export function useReversePreview(
  itemId: () => string,
  media: () => ContentArchiveMedia | undefined,
  modelVersion: () => string = () => ""
) {
  const preparing = ref(false),
    progress = ref(0),
    message = ref(""),
    notice = ref("");
  const assets = ref<ReverseAsset[]>([]);
  let controller = new AbortController(),
    jobId: string | undefined;
  let pending: Promise<void> = Promise.resolve();
  const sourceKey = (clip: ArchiveCutClip, studio: ArchiveStudio, fps: number) =>
    `${media()?.checksum}:${clip.sourceId ?? "original"}:${studio.sources.find((s) => s.id === clip.sourceId)?.checksum ?? ""}:${Boolean(clip.reverse)}:${clip.interpolation ? JSON.stringify([clip.interpolation, clip.speed ?? 1, fps, clip.interpolation.engine === "rife" ? modelVersion() : "flow-v1"]) : "reverse"}`;
  const asset = (requested: ArchiveCutClip, studio: ArchiveStudio, fps = 30) => {
    const clip = archivePreviewClip(requested);
    fps = requested.freezeSample?.fps ?? fps;
    return !archiveNeedsSourcePreview(clip)
      ? undefined
      : assets.value.find(
          (entry) =>
            entry.source === sourceKey(clip, studio, fps) &&
            (clip.interpolation
              ? Math.abs(entry.start - clip.start) < 1e-7 && Math.abs(entry.end - clip.end) < 1e-7
              : entry.start <= clip.start + 1e-7 && entry.end >= clip.end - 1e-7)
        );
  };
  async function prepare(clips: ArchiveCutClip[], studio: ArchiveStudio, fps = 30) {
    const signal = controller.signal;
    if (clips.some((clip) => archiveNeedsSourcePreview(clip) && !asset(clip, studio, fps))) preparing.value = true;
    pending = pending
      .catch(() => {})
      .then(async () => {
        const current = media();
        if (!current || signal.aborted) return;
        try {
          const missing = clips.filter((clip) => archiveNeedsSourcePreview(clip) && !asset(clip, studio, fps));
          if (missing.length) notice.value = "";
          for (const [index, requested] of missing.entries()) {
            const clip = archivePreviewClip(requested),
              targetFps = requested.freezeSample?.fps ?? fps;
            if (asset(clip, studio, targetFps)) {
              progress.value = ((index + 1) / missing.length) * 100;
              continue;
            }
            signal.throwIfAborted();
            preparing.value = true;
            progress.value = 0;
            let job = await videoEditApi.create(
              itemId(),
              current.id,
              {
                mode: "preview",
                purpose: clip.interpolation ? "interpolation-source" : "reverse-source",
                checksum: current.checksum,
                revision: current.audioEdit?.revision ?? 0,
                useSavedMusic: false,
                watermark: null,
                frame: clip.interpolation
                  ? { ...defaultArchiveFrame(), fps: targetFps as 24 | 25 | 30 | 50 | 60 | 120 }
                  : null,
                previewFullLength: true,
                settings: {
                  originalVolume: 100,
                  musicVolume: 0,
                  musicStartSeconds: 0,
                  loop: false,
                  fadeInSeconds: 0,
                  fadeOutSeconds: 0
                },
                cut: [
                  {
                    id: clip.id,
                    sourceId: clip.sourceId,
                    start: clip.start,
                    end: clip.end,
                    reverse: clip.reverse,
                    ...(clip.interpolation ? { interpolation: clip.interpolation, speed: clip.speed ?? 1 } : {})
                  }
                ],
                studio: { sources: studio.sources, musicTracks: [], subtitles: [] }
              },
              signal
            );
            jobId = job.id;
            message.value = `片段 ${index + 1}/${missing.length} · ${clip.interpolation ? "正在补帧" : "正在倒放"}`;
            // POST 可能已在服务端创建任务，页面关闭时仍需主动取消。
            if (signal.aborted) {
              void videoEditApi.cancel(job.id).catch(() => {});
              return;
            }
            while (job.status === "pending" || job.status === "running") {
              await delay(signal);
              job = await videoEditApi.get(job.id, signal);
              progress.value = ((index + job.progress / 100) / missing.length) * 100;
              message.value = `片段 ${index + 1}/${missing.length} · ${job.message}`;
            }
            jobId = undefined;
            if (job.warnings?.length)
              notice.value = [...new Set([notice.value, ...job.warnings].filter(Boolean))].join(" ");
            if (job.status !== "completed" || !job.previewUrl) throw new Error(job.message || "视频处理预览生成失败");
            assets.value.push({
              source: sourceKey(clip, studio, targetFps),
              start: clip.start,
              end: clip.end,
              url: resolveBackendUrl(job.previewUrl),
              interpolation: Boolean(clip.interpolation),
              speed: clip.speed ?? 1
            });
          }
          progress.value = 100;
        } catch (error) {
          if (!signal.aborted && jobId) {
            void videoEditApi.cancel(jobId).catch(() => {});
            jobId = undefined;
          }
          throw error;
        } finally {
          if (!signal.aborted) preparing.value = false;
        }
      });
    await pending;
    signal.throwIfAborted();
  }
  function reset(clearAssets = true) {
    controller.abort();
    if (jobId) void videoEditApi.cancel(jobId).catch(() => {});
    jobId = undefined;
    controller = new AbortController();
    if (clearAssets) {
      assets.value = [];
      notice.value = "";
    }
    preparing.value = false;
  }
  return { preparing, progress, message, notice, asset, prepare, reset };
}
function delay(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, 500);
    signal.addEventListener("abort", abort, { once: true });
  });
}
