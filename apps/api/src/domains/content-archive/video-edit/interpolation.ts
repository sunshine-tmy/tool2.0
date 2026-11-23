import fs from "node:fs/promises";
import type { ArchiveInterpolation } from "@toolbox/shared";
import { runMediaProcess, VideoEditError, type RenderVideoOptions } from "./renderer";
import { renderRifeInterpolation } from "./interpolation-rife";
import { cachedInterpolation } from "./interpolation-cache";
import { renderFlowScenes } from "./interpolation-scenes";

export function flowInterpolationFilter(settings: ArchiveInterpolation, fps: number, duration: number) {
  const quality =
    settings.quality === "fast"
      ? "mc_mode=obmc:me_mode=bilat:me=hexbs:vsbmc=0"
      : settings.quality === "high"
        ? "mc_mode=aobmc:me_mode=bidir:me=umh:vsbmc=1"
        : "mc_mode=aobmc:me_mode=bidir:me=hexbs:vsbmc=1";
  return `tpad=stop_mode=clone:stop_duration=1,minterpolate=fps=${fps}:mi_mode=mci:${quality}:scd=${settings.sceneProtection ? "fdiff" : "none"}:scd_threshold=10,fps=${fps},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop=${Math.ceil(duration * fps)},trim=duration=${duration},setpts=PTS-STARTPTS`;
}

/** 所有引擎都先处理源画面；文本、水印和空间变换在后续统一合成。 */
export async function renderInterpolation(
  options: RenderVideoOptions,
  input: string,
  output: string,
  settings: ArchiveInterpolation,
  fps: number,
  duration: number,
  nativeFps: number,
  remaining: number,
  cacheKey?: string
) {
  const used = await cachedInterpolation(options, input, output, duration, cacheKey, remaining, () =>
    generateInterpolation(options, input, output, settings, fps, duration, nativeFps, remaining)
  );
  if (settings.engine === "rife" && used === "flow") options.onWarning?.("AI 引擎不可用，已按设置使用兼容补帧。");
  return used;
}
async function generateInterpolation(
  options: RenderVideoOptions,
  input: string,
  output: string,
  settings: ArchiveInterpolation,
  fps: number,
  duration: number,
  nativeFps: number,
  remaining: number
) {
  const status = (message: string) => options.onStatus?.(message);
  let used = settings.engine;
  if (settings.engine === "rife") {
    if (!options.tools.rife && !settings.allowFallback)
      throw new VideoEditError(
        "ARCHIVE_INTERPOLATION_NOT_INSTALLED",
        "请在能力管理中安装智能补帧，或选择兼容补帧",
        503
      );
    if (options.tools.rife) {
      try {
        await renderRifeInterpolation(options, input, output, settings, fps, duration, nativeFps, remaining);
        return "rife" as const;
      } catch (error) {
        options.signal.throwIfAborted();
        if (
          error instanceof VideoEditError &&
          !error.code.startsWith("ARCHIVE_INTERPOLATION") &&
          error.code !== "ARCHIVE_EDIT_RENDER_FAILED"
        )
          throw error;
        if (!settings.allowFallback) throw error;
        await fs.rm(output, { force: true });
      }
    }
    used = "flow";
    status("AI 补帧不可用，按设置使用兼容补帧");
  }
  status(
    `兼容补帧 · ${settings.quality === "high" ? "高质量" : settings.quality === "fast" ? "快速" : "均衡"} · ${fps} FPS`
  );
  if (settings.sceneProtection) {
    await renderFlowScenes(options, input, output, fps, duration, remaining, (length) =>
      flowInterpolationFilter({ ...settings, sceneProtection: false }, fps, length)
    );
    return used;
  }
  await runMediaProcess(
    options.tools.ffmpeg,
    [
      "-hide_banner",
      "-v",
      "error",
      "-nostdin",
      "-y",
      "-filter_threads",
      "1",
      "-i",
      input,
      "-vf",
      flowInterpolationFilter(settings, fps, duration),
      "-map",
      "0:v:0",
      "-map",
      "0:a?",
      "-t",
      String(duration),
      "-r",
      String(fps),
      "-c:v",
      "ffv1",
      "-level",
      "3",
      "-c:a",
      "copy",
      output
    ],
    options.signal,
    { output, maxBytes: remaining }
  );
  const info = await fs.stat(output);
  if (info.size > remaining)
    throw new VideoEditError("ARCHIVE_EDIT_DISK_FULL", "补帧结果超过可用空间，原视频保留", 507);
  return used;
}
