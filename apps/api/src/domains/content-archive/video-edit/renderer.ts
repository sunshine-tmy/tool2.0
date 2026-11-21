import path from "node:path";
import { studioAudio, writeStudioSubtitles } from "./studio-render";
/** 有界 FFmpeg 子进程：仅处理本地受控文件，音量/混音只由数值参数生成。 */
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import type {
  ArchiveAudioSettings,
  ArchiveWatermarkSettings,
  ArchiveCutClip,
  ArchiveFrame,
  ArchiveStudio
} from "@toolbox/shared";
import {
  archiveWatermarkSize,
  watermarkTimingError,
  archiveFrameGeometry,
  archiveClipDuration,
  archiveVisibleSubtitles,
  archiveCutStarts,
  archiveProjectDuration
} from "@toolbox/shared";
import { prepareClipEffects } from "./clip-effects";
import { watermarkFilter } from "./watermark-filter";
import { terminateChildProcess } from "../../../lifecycle/child-process";

export class VideoEditError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode = 400
  ) {
    super(message);
  }
}
export type MediaTools = { ffmpeg: string; ffprobe: string };
type Probe = { duration: number; codec: string; hasAudio: boolean; width: number; height: number; fps?: number };
const inputOptions = [
  "-protocol_whitelist",
  "file,pipe",
  "-format_whitelist",
  "mov,mp4,m4a,3gp,3g2,mj2,matroska,webm,avi,mp3,wav,flac,aac,ogg"
];
export async function runMediaProcess(
  executable: string,
  args: string[],
  signal: AbortSignal,
  options: {
    cwd?: string;
    onDiagnostic?: (chunk: string) => void;
    timeoutMs?: number;
    onOutput?: (chunk: string) => void;
    output?: string;
    maxBytes?: number;
  } = {}
) {
  signal.throwIfAborted();
  return new Promise<string>((resolve, reject) => {
    const child = spawn(executable, args, {
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      cwd: options.cwd
    });
    let stdout = "",
      failure: Error | undefined,
      checking = false;
    const stop = (error: Error) => {
      if (failure) return;
      failure = error;
      void terminateChildProcess(child).catch((error: Error) => {
        failure = error;
      });
    };
    const abort = () => stop(new VideoEditError("ARCHIVE_EDIT_CANCELLED", "配乐任务已停止", 409));
    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(
      () => stop(new VideoEditError("ARCHIVE_EDIT_TIMEOUT", "媒体处理超时，原成品已保留", 503)),
      options.timeoutMs ?? 600_000
    );
    const sizeTimer =
      options.output && options.maxBytes
        ? setInterval(() => {
            if (checking) return;
            checking = true;
            void fs
              .stat(options.output!)
              .then((stat) => {
                if (stat.size > options.maxBytes!)
                  stop(new VideoEditError("ARCHIVE_EDIT_OUTPUT_TOO_LARGE", "生成文件超过可用空间，已停止处理", 413));
              })
              .catch(() => undefined)
              .finally(() => {
                checking = false;
              });
          }, 250)
        : undefined;
    child.stdout.on("data", (chunk: Buffer) => {
      if (failure) return;
      const value = chunk.toString();
      try {
        options.onOutput?.(value);
      } catch (error) {
        stop(error instanceof Error ? error : new Error("MEDIA_PROGRESS_FAILED"));
        return;
      }
      stdout += value;
      if (stdout.length > 1024 * 1024) stop(new VideoEditError("ARCHIVE_EDIT_PROCESS_OUTPUT", "媒体信息超出处理上限"));
    });
    // 排空诊断流，不把本机路径或不受信任的媒体文本作为 API 错误直接返回。
    child.stderr.on("data", (chunk: Buffer) => {
      if (failure) return;
      try {
        options.onDiagnostic?.(chunk.toString());
      } catch (error) {
        stop(error instanceof Error ? error : new Error("MEDIA_DIAGNOSTIC_FAILED"));
      }
    });
    child.once("error", () => {
      failure ??= new VideoEditError(
        "ARCHIVE_EDIT_RUNTIME_UNAVAILABLE",
        "FFmpeg/FFprobe 不可用，请检查共享媒体运行时",
        503
      );
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (sizeTimer) clearInterval(sizeTimer);
      signal.removeEventListener("abort", abort);
      if (failure) reject(failure);
      else if (signal.aborted) reject(new VideoEditError("ARCHIVE_EDIT_CANCELLED", "配乐任务已停止", 409));
      else if (code !== 0)
        reject(
          new VideoEditError(
            "ARCHIVE_EDIT_RENDER_FAILED",
            "媒体处理失败，请检查文件编码及共享媒体运行时；原成品已保留",
            415
          )
        );
      else resolve(stdout);
    });
    if (signal.aborted) abort();
  });
}

export async function probeMedia(
  tools: MediaTools,
  file: string,
  signal: AbortSignal,
  requireVideo = true,
  displayDimensions = false
): Promise<Probe> {
  const text = await runMediaProcess(
    tools.ffprobe,
    [
      "-v",
      "error",
      ...inputOptions,
      "-show_entries",
      "stream=codec_type,codec_name,width,height,duration,avg_frame_rate,r_frame_rate,sample_aspect_ratio:stream_tags=rotate:stream_side_data=rotation:format=duration",
      "-of",
      "json",
      file
    ],
    signal,
    { timeoutMs: 30_000 }
  );
  let data: {
    streams?: Array<{
      codec_type?: string;
      codec_name?: string;
      width?: number;
      height?: number;
      duration?: string;
      avg_frame_rate?: string;
      r_frame_rate?: string;
      sample_aspect_ratio?: string;
      tags?: { rotate?: string };
      side_data_list?: Array<{ rotation?: number }>;
    }>;
    format?: { duration?: string };
  };
  try {
    data = JSON.parse(text);
  } catch {
    throw new VideoEditError("ARCHIVE_EDIT_MEDIA_INVALID", "无法读取有效媒体信息", 415);
  }
  const video = data.streams?.find((stream) => stream.codec_type === "video");
  const duration =
    [data.format?.duration, video?.duration].map(Number).find((value) => Number.isFinite(value) && value > 0) ??
    Number.NaN;
  if (!Number.isFinite(duration) || duration <= 0 || duration > 7200 || (requireVideo && !video))
    throw new VideoEditError("ARCHIVE_EDIT_MEDIA_INVALID", "媒体须具有有效时长，视频最长支持 2 小时", 415);
  const rotation = Number(
    video?.side_data_list?.find((entry) => entry.rotation !== undefined)?.rotation ?? video?.tags?.rotate ?? 0
  );
  const [num, den] = (video?.sample_aspect_ratio ?? "1:1").split(":").map(Number);
  const sar = num > 0 && den > 0 ? num / den : 1;
  const rotated = Math.abs(rotation % 180) === 90;
  const displayWidth = (video?.width ?? 0) * sar;
  const fps =
    [video?.avg_frame_rate, video?.r_frame_rate]
      .map((rate) => {
        const [num, den] = (rate ?? "0/0").split("/").map(Number);
        return num > 0 && den > 0 ? num / den : 0;
      })
      .find((rate) => Number.isFinite(rate) && rate > 0) ?? 30;
  return {
    duration,
    fps,
    codec: video?.codec_name ?? "",
    hasAudio: Boolean(data.streams?.some((stream) => stream.codec_type === "audio")),
    width: displayDimensions ? Math.round(rotated ? (video?.height ?? 0) : displayWidth) : (video?.width ?? 0),
    height: displayDimensions ? Math.round(rotated ? displayWidth : (video?.height ?? 0)) : (video?.height ?? 0)
  };
}

export function audioMixFilter(
  settings: ArchiveAudioSettings,
  duration: number,
  hasAudio: boolean,
  hasMusic: boolean,
  audioSource = "0:a:0"
) {
  const original = hasAudio
    ? `[${audioSource}]aresample=48000:async=1:first_pts=0,volume=${settings.originalVolume / 100},apad,atrim=duration=${duration}[original]`
    : `anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=${duration}[original]`;
  if (!hasMusic) return `${original};[original]alimiter=limit=0.95:level=0:latency=1[mix]`;
  const fadeIn = Math.min(settings.fadeInSeconds, duration / 2),
    fadeOut = Math.min(settings.fadeOutSeconds, duration / 2);
  const fades = `${fadeIn ? `,afade=t=in:st=0:d=${fadeIn}` : ""}${fadeOut ? `,afade=t=out:st=${duration - fadeOut}:d=${fadeOut}` : ""}`;
  return `${original};[1:a:0]aresample=48000,asetpts=PTS-STARTPTS,volume=${settings.musicVolume / 100},apad,atrim=duration=${duration}${fades}[music];[original][music]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95:level=0:latency=1[mix]`;
}

export type RenderVideoOptions = {
  tools: MediaTools;
  source: string;
  music?: string;
  cut?: ArchiveCutClip[];
  layoutClips?: ArchiveCutClip[];
  frame?: ArchiveFrame;
  studio?: ArchiveStudio;
  clipSources?: Record<string, string>;
  trackFiles?: Record<string, string>;
  watermark?: { file: string; width: number; height: number; settings: ArchiveWatermarkSettings };
  output: string;
  settings: ArchiveAudioSettings;
  signal: AbortSignal;
  maxBytes: number;
  previewStartSeconds?: number;
  previewFullLength?: boolean;
  preview?: boolean;
  onProgress: (value: number) => void;
};
export async function renderArchiveVideo(options: RenderVideoOptions) {
  // 已有未显式裁剪的视频在字幕/配乐延伸时同样需要黑屏尾段。
  if (!options.cut && options.studio && [...options.studio.subtitles, ...options.studio.musicTracks].length) {
    const info = await probeMedia(options.tools, options.source, options.signal);
    if (archiveProjectDuration([], options.studio) > info.duration)
      options = { ...options, cut: [{ id: "original", start: 0, end: info.duration, at: 0, lane: 1 }] };
  }
  if (
    options.cut &&
    options.studio &&
    archiveProjectDuration([], options.studio) > archiveProjectDuration(options.cut)
  ) {
    const starts = archiveCutStarts(options.cut);
    options = { ...options, cut: options.cut.map((clip, i) => ({ ...clip, at: clip.at ?? starts[i] })) };
  }
  const layoutClips = options.cut;
  // 连续的单轨排列仍走顺序管线，避免为普通剪辑增加中间文件。
  if (options.cut?.some((clip) => clip.at !== undefined)) {
    const sequential = options.cut.map(({ at: _at, ...clip }) => clip),
      positions = archiveCutStarts(sequential);
    if (
      options.cut.every(
        (clip, i) =>
          (clip.lane ?? 1) === (options.cut![0].lane ?? 1) && Math.abs((clip.at ?? positions[i]) - positions[i]) < 1e-6
      ) &&
      archiveProjectDuration(options.cut, options.studio) <= archiveProjectDuration(sequential) + 1e-6
    )
      options = { ...options, cut: sequential, layoutClips };
  }
  const enhanced = options.cut?.some(
    (clip) =>
      (clip.speed ?? 1) !== 1 ||
      (clip.volume ?? 100) !== 100 ||
      clip.fadeIn ||
      clip.fadeOut ||
      clip.sourceId ||
      clip.transition ||
      clip.at !== undefined
  );
  if (!enhanced) return renderVideoCore(options);
  const prepared = await prepareClipEffects(options);
  try {
    if (options.maxBytes - prepared.occupied < 1024 * 1024)
      throw new VideoEditError("ARCHIVE_EDIT_DISK_FULL", "剩余空间不足以保存视频成品，原成品保留", 507);
    return await renderVideoCore(
      {
        ...options,
        cut: undefined,
        layoutClips: options.layoutClips ?? options.cut,
        maxBytes: options.maxBytes - prepared.occupied,
        onProgress: (progress) => options.onProgress(60 + progress * 0.35)
      },
      prepared
    );
  } finally {
    await fs.rm(prepared.directory, { recursive: true, force: true });
  }
}
async function renderVideoCore(options: RenderVideoOptions, prepared?: Awaited<ReturnType<typeof prepareClipEffects>>) {
  const source = prepared
    ? { ...prepared.info, duration: prepared.duration, hasAudio: true, codec: "ffv1" }
    : await probeMedia(
        options.tools,
        options.source,
        options.signal,
        true,
        Boolean(options.watermark || options.frame || options.studio)
      );
  const args = ["-hide_banner", "-v", "error", "-nostdin", "-y"];
  const cut = options.cut;
  let outputDuration = source.duration;
  const filters: string[] = [];
  if (prepared) {
    args.push(
      "-copyts",
      "-protocol_whitelist",
      "file,pipe",
      "-f",
      "concat",
      "-safe",
      "1",
      "-segment_time_metadata",
      "1",
      "-i",
      prepared.list
    );
    filters.push(
      "[0:v:0]select=concatdec_select,setpts=PTS-STARTPTS[preparedvideo]",
      "[0:a:0]aselect=concatdec_select,asetpts=PTS-STARTPTS[preparedaudio]"
    );
  } else if (cut) {
    if (
      !cut.length ||
      cut.some(
        (clip) =>
          !Number.isFinite(clip.start) ||
          !Number.isFinite(clip.end) ||
          clip.start < 0 ||
          clip.end <= clip.start ||
          clip.end > source.duration + 0.001
      )
    )
      throw new VideoEditError("ARCHIVE_CUT_RANGE_INVALID", "剪辑片段超出原片范围或时长无效");
    outputDuration = cut.reduce((sum, clip) => sum + archiveClipDuration(clip), 0);
    if (outputDuration > 7200) throw new VideoEditError("ARCHIVE_CUT_TOO_LONG", "剪辑后视频最长支持 2 小时");
    // 顺序解复用并筛掉关键帧预读，避免乱序片段 split/concat 缓存大量解码帧。
    // https://ffmpeg.org/ffmpeg-filters.html#select_002c-aselect
    const escapedSource = options.source.replaceAll("\\", "/").replaceAll("'", "'\\''");
    const lines = [
      "ffconcat version 1.0",
      ...cut.flatMap((clip) => [
        `file '${escapedSource}'`,
        `inpoint ${clip.start}`,
        `outpoint ${clip.end}`,
        `duration ${clip.end - clip.start}`
      ])
    ];
    await fs.writeFile(`${options.output}.ffconcat`, lines.join("\n"), "utf8");
    args.push(
      "-copyts",
      "-protocol_whitelist",
      "file,pipe",
      "-format_whitelist",
      "concat,mov,mp4,m4a,3gp,3g2,mj2,matroska,webm,avi",
      "-f",
      "concat",
      "-safe",
      "0",
      "-segment_time_metadata",
      "1",
      "-i",
      `${options.output}.ffconcat`
    );
    filters.push("[0:v:0]select=concatdec_select,setpts=PTS-STARTPTS[cutvideo]");
    if (source.hasAudio) filters.push("[0:a:0]aselect=concatdec_select,asetpts=PTS-STARTPTS[cutaudio]");
  } else args.push(...inputOptions, "-i", options.source);
  if (options.music) {
    const music = await probeMedia(options.tools, options.music, options.signal, false);
    if (!music.hasAudio || options.settings.musicStartSeconds >= music.duration)
      throw new VideoEditError("ARCHIVE_EDIT_MUSIC_RANGE", "音乐起点必须早于音乐结束时间");
    if (options.settings.loop) args.push("-stream_loop", "-1");
    args.push("-ss", String(options.settings.musicStartSeconds), ...inputOptions, "-i", options.music);
  }
  filters.push(
    audioMixFilter(
      options.settings,
      outputDuration,
      source.hasAudio,
      Boolean(options.music),
      prepared ? "preparedaudio" : cut ? "cutaudio" : "0:a:0"
    )
  );
  let videoLabel = prepared ? "preparedvideo" : cut ? "cutvideo" : "0:v:0";
  let geometry = { width: source.width, height: source.height };
  if (options.frame) {
    const frame = options.frame;
    const size = archiveFrameGeometry(source.width, source.height, frame);
    const transforms = [
      `scale=${Math.max(2, Math.floor(source.width / 2) * 2)}:${Math.max(2, Math.floor(source.height / 2) * 2)}`,
      "setsar=1"
    ];
    if (frame.rotation === 90) transforms.push("transpose=clock");
    else if (frame.rotation === 180) transforms.push("hflip", "vflip");
    else if (frame.rotation === 270) transforms.push("transpose=cclock");
    if (frame.flipX) transforms.push("hflip");
    if (frame.flipY) transforms.push("vflip");
    transforms.push(`crop=${size.width}:${size.height}:${size.x}:${size.y}`);
    filters.push(`[${videoLabel}]${transforms.join(",")}[framed]`);
    videoLabel = "framed";
    geometry = size;
  }
  let subtitleFile: string | undefined;
  if (options.studio?.subtitles.length) {
    subtitleFile = `${options.output}.ass`;
    const visible = archiveVisibleSubtitles(
      options.studio.subtitles,
      options.layoutClips ?? options.cut ?? [{ id: "original", start: 0, end: source.duration, at: 0, lane: 1 }]
    );
    const name = await writeStudioSubtitles(subtitleFile, visible, geometry.width, geometry.height);
    filters.push(`[${videoLabel}]subtitles=filename='${name}'[subtitled]`);
    videoLabel = "subtitled";
  }
  if (options.watermark) {
    const error = watermarkTimingError(options.watermark.settings, outputDuration);
    if (error) throw new VideoEditError("ARCHIVE_WATERMARK_TIME_INVALID", error);
    if (source.width < 2 || source.height < 2)
      throw new VideoEditError("ARCHIVE_EDIT_MEDIA_INVALID", "无法确定视频画面尺寸", 415);
    const width = Math.max(2, Math.floor(geometry.width / 2) * 2),
      height = Math.max(2, Math.floor(geometry.height / 2) * 2);
    const size = archiveWatermarkSize(options.watermark.settings, options.watermark, { width, height });
    args.push(
      "-protocol_whitelist",
      "file,pipe",
      "-format_whitelist",
      "image2",
      "-f",
      "image2",
      "-pattern_type",
      "none",
      "-loop",
      "1",
      "-framerate",
      "25",
      "-i",
      options.watermark.file
    );
    filters.push(
      `[${videoLabel}]scale=${width}:${height},setsar=1,setpts=PTS-STARTPTS[base]`,
      watermarkFilter(options.watermark.settings, options.music ? 2 : 1, size.width, size.height)
    );
  }
  const audioLabel = await studioAudio(
    options,
    args,
    filters,
    outputDuration,
    1 + (options.music ? 1 : 0) + (options.watermark ? 1 : 0)
  );
  const shortPreview = options.preview && !options.previewFullLength;
  const start = shortPreview ? Math.min(options.previewStartSeconds ?? 0, Math.max(0, outputDuration - 0.1)) : 0;
  const duration = shortPreview ? Math.min(15, outputDuration - start) : outputDuration;
  const filterScript = `${options.output}.filters.txt`;
  await fs.writeFile(filterScript, filters.join(";"), "utf8");
  args.push(
    "-filter_complex_script",
    filterScript,
    "-map",
    options.watermark ? "[watermarked]" : videoLabel === "0:v:0" ? videoLabel : `[${videoLabel}]`,
    "-map",
    audioLabel,
    "-map_metadata",
    "0"
  );
  if (
    !prepared &&
    !options.studio?.subtitles.length &&
    !options.frame &&
    !cut &&
    !options.watermark &&
    !shortPreview &&
    ["h264", "hevc"].includes(source.codec)
  )
    args.push("-c:v", "copy");
  else args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p");
  if (options.watermark || options.frame || cut || prepared) args.push("-metadata:s:v:0", "rotate=0");
  if (cut) args.push("-fps_mode", "vfr");
  if (start) args.push("-ss", String(start));
  args.push(
    "-t",
    String(duration),
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
    "-nostats",
    options.output
  );
  try {
    await runMediaProcess(options.tools.ffmpeg, args, options.signal, {
      cwd: path.dirname(options.output),
      output: options.output,
      maxBytes: options.maxBytes,
      onOutput: (chunk) => {
        const match = /out_time_us=(\d+)/g;
        for (const entry of chunk.matchAll(match))
          options.onProgress(Math.min(95, (Number(entry[1]) / (duration * 1_000_000)) * 95));
      }
    });
  } finally {
    await fs.rm(filterScript, { force: true });
    if (subtitleFile) await fs.rm(subtitleFile, { force: true });
    if (cut) await fs.rm(`${options.output}.ffconcat`, { force: true });
  }
  const rendered = await probeMedia(options.tools, options.output, options.signal);
  if (!rendered.hasAudio || Math.abs(rendered.duration - duration) > Math.max(0.25, Math.min(0.5, duration * 0.002)))
    throw new VideoEditError("ARCHIVE_EDIT_OUTPUT_INVALID", "生成结果时长或音轨校验失败，原成品已保留", 415);
  return rendered;
}
