import fs from "node:fs/promises";
import path from "node:path";
import { archiveCutStarts, archiveClipDuration, defaultArchiveFrame } from "@toolbox/shared";
import { renderArchiveVideo, probeMedia, runMediaProcess, VideoEditError, type RenderVideoOptions } from "./renderer";
import { renderInterpolation } from "./interpolation";
import { interpolationCacheKey } from "./interpolation-cache";
import { preparedComposition } from "./composition-cache";

/** 完成所有剪辑、字幕、水印与混音后，才对最终画面执行一次补帧。 */
export async function renderFinalOutput(options: RenderVideoOptions): Promise<Awaited<ReturnType<typeof probeMedia>>> {
  const outputSettings = options.outputSettings!,
    fps = outputSettings.fps;
  const clean = { ...options, outputSettings: undefined };
  if (!outputSettings.interpolation) {
    options.onStatus?.("合成视频 · 正在生成成片");
    return renderArchiveVideo({
      ...clean,
      frame: fps ? { ...defaultArchiveFrame(), ...options.frame, fps } : options.frame
    });
  }
  if (!fps) throw new VideoEditError("ARCHIVE_INTERPOLATION_FPS_REQUIRED", "开启补帧时请选择目标帧率");
  const directory = await fs.mkdtemp(`${options.output}.final-`);
  try {
    options.onStatus?.("合成视频 · 正在合成剪辑、字幕、水印及声音");
    const base = await preparedComposition(
      options.compositionCacheRoot,
      options.compositionKey,
      path.join(directory, "composed.mkv"),
      options.maxBytes,
      options.signal,
      () =>
        renderArchiveVideo({
          ...clean,
          output: path.join(directory, "composed.mkv"),
          lossless: true,
          onProgress: (value) => options.onProgress(value * 0.42),
          onStatus: (message) => options.onStatus?.(`合成视频 · ${message}`)
        })
    );
    const info = await probeMedia(options.tools, base, options.signal);
    const occupied = (await fs.stat(base)).size;
    if (options.maxBytes - occupied < 1024 * 1024)
      throw new VideoEditError("ARCHIVE_EDIT_DISK_FULL", "成片补帧空间不足，原成品保留", 507);
    const interpolated = path.join(directory, "interpolated.mkv");
    const starts = archiveCutStarts(options.cut ?? []);
    const boundaries = [
      ...(options.cut ?? []).flatMap((clip, i) => [starts[i], starts[i] + archiveClipDuration(clip)]),
      ...(options.studio?.subtitles ?? []).flatMap((cue) => [cue.start, cue.end]),
      ...(options.studio?.watermarks ?? []).flatMap((mark) => [mark.start, mark.followEnd ? info.duration : mark.end])
    ];
    const interpolation = outputSettings.interpolation;
    const key = options.compositionKey
      ? interpolationCacheKey(
          options.compositionKey,
          { id: "final_output", start: 0, end: info.duration, interpolation },
          fps,
          interpolation.engine === "rife" ? (options.tools.rife?.version ?? "rife-unavailable") : "flow-v1"
        )
      : undefined;
    options.onProgress(43);
    await renderInterpolation(
      {
        ...clean,
        interpolationBoundaries: boundaries,
        onProgress: (value) => options.onProgress(43 + value * 0.4),
        onStatus: (message) => options.onStatus?.(`智能补帧 · ${message}`)
      },
      base,
      interpolated,
      interpolation,
      fps,
      info.duration,
      info.fps ?? 30,
      options.maxBytes - occupied,
      key
    );
    const remaining = options.maxBytes - occupied - (await fs.stat(interpolated)).size;
    if (remaining < 1024 * 1024)
      throw new VideoEditError("ARCHIVE_EDIT_DISK_FULL", "最终编码空间不足，原成品保留", 507);
    options.onStatus?.("最终编码 · 正在生成视频文件");
    await runMediaProcess(
      options.tools.ffmpeg,
      [
        "-v",
        "error",
        "-nostdin",
        "-y",
        "-i",
        interpolated,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0",
        "-r",
        String(fps),
        "-fps_mode",
        "cfr",
        "-t",
        String(info.duration),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-movflags",
        "+faststart",
        "-progress",
        "pipe:1",
        options.output
      ],
      options.signal,
      {
        output: options.output,
        maxBytes: remaining,
        onOutput: (chunk) => {
          for (const match of chunk.matchAll(/out_time_us=(\d+)/g))
            options.onProgress(84 + Math.min(12, (Number(match[1]) / (info.duration * 1_000_000)) * 12));
        }
      }
    );
    const result = await probeMedia(options.tools, options.output, options.signal);
    if (
      Math.abs((result.fps ?? 0) - fps) > 0.01 ||
      !result.hasAudio ||
      Math.abs(result.duration - info.duration) > 1 / fps + 0.025 ||
      Math.abs((result.videoDuration ?? result.duration) - (result.audioDuration ?? result.duration)) > 1 / fps + 0.001
    )
      throw new VideoEditError(
        "ARCHIVE_INTERPOLATION_OUTPUT_INVALID",
        "最终补帧结果的帧率或音画同步校验失败，原成品保留",
        415
      );
    return result;
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
