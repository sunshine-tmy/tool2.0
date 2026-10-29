/** 有界 FFmpeg 子进程：仅处理本地受控文件，音量/混音只由数值参数生成。 */
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import type { ArchiveAudioSettings } from "@toolbox/shared";
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
type Probe = { duration: number; codec: string; hasAudio: boolean; width: number; height: number };
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
  options: { timeoutMs?: number; onOutput?: (chunk: string) => void; output?: string; maxBytes?: number } = {}
) {
  signal.throwIfAborted();
  return new Promise<string>((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
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
    child.stderr.resume();
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

async function probeMedia(tools: MediaTools, file: string, signal: AbortSignal, requireVideo = true): Promise<Probe> {
  const text = await runMediaProcess(
    tools.ffprobe,
    [
      "-v",
      "error",
      ...inputOptions,
      "-show_entries",
      "stream=codec_type,codec_name,width,height,duration:format=duration",
      "-of",
      "json",
      file
    ],
    signal,
    { timeoutMs: 30_000 }
  );
  let data: {
    streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; duration?: string }>;
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
  return {
    duration,
    codec: video?.codec_name ?? "",
    hasAudio: Boolean(data.streams?.some((stream) => stream.codec_type === "audio")),
    width: video?.width ?? 0,
    height: video?.height ?? 0
  };
}

export function audioMixFilter(settings: ArchiveAudioSettings, duration: number, hasAudio: boolean, hasMusic: boolean) {
  const original = hasAudio
    ? `[0:a:0]aresample=48000:async=1:first_pts=0,volume=${settings.originalVolume / 100},apad,atrim=duration=${duration}[original]`
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
  output: string;
  settings: ArchiveAudioSettings;
  signal: AbortSignal;
  maxBytes: number;
  previewStartSeconds?: number;
  preview?: boolean;
  onProgress: (value: number) => void;
};
export async function renderArchiveVideo(options: RenderVideoOptions) {
  const source = await probeMedia(options.tools, options.source, options.signal);
  const args = ["-hide_banner", "-v", "error", "-nostdin", "-y", ...inputOptions, "-i", options.source];
  if (options.music) {
    const music = await probeMedia(options.tools, options.music, options.signal, false);
    if (!music.hasAudio || options.settings.musicStartSeconds >= music.duration)
      throw new VideoEditError("ARCHIVE_EDIT_MUSIC_RANGE", "音乐起点必须早于音乐结束时间");
    if (options.settings.loop) args.push("-stream_loop", "-1");
    args.push("-ss", String(options.settings.musicStartSeconds), ...inputOptions, "-i", options.music);
  }
  const start = options.preview ? Math.min(options.previewStartSeconds ?? 0, Math.max(0, source.duration - 0.1)) : 0;
  const duration = options.preview ? Math.min(15, source.duration - start) : source.duration;
  args.push(
    "-filter_complex",
    audioMixFilter(options.settings, source.duration, source.hasAudio, Boolean(options.music)),
    "-map",
    "0:v:0",
    "-map",
    "[mix]",
    "-map_metadata",
    "0"
  );
  if (!options.preview && ["h264", "hevc"].includes(source.codec)) args.push("-c:v", "copy");
  else args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p");
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
  await runMediaProcess(options.tools.ffmpeg, args, options.signal, {
    output: options.output,
    maxBytes: options.maxBytes,
    onOutput: (chunk) => {
      const match = /out_time_us=(\d+)/g;
      for (const entry of chunk.matchAll(match))
        options.onProgress(Math.min(95, (Number(entry[1]) / (duration * 1_000_000)) * 95));
    }
  });
  const rendered = await probeMedia(options.tools, options.output, options.signal);
  if (!rendered.hasAudio || Math.abs(rendered.duration - duration) > Math.max(0.25, Math.min(0.5, duration * 0.002)))
    throw new VideoEditError("ARCHIVE_EDIT_OUTPUT_INVALID", "生成结果时长或音轨校验失败，原成品已保留", 415);
  return rendered;
}
