/** Whitelisted local container probing and audio-only output. No video decoding or source writes. */
import fs from "node:fs/promises";
import {
  AUDIO_EXTRACT_MAX_BYTES,
  AUDIO_EXTRACT_MAX_SECONDS,
  type AudioExtractTrack,
  type AudioExtractJob
} from "@toolbox/shared/audio-extract";
import { runMediaCommand } from "../../core/media/process";
import type { FfmpegTools } from "../../core/media/runtime";
import { AudioExtractError } from "./errors";
const input = [
  "-protocol_whitelist",
  "file,pipe",
  "-format_whitelist",
  "mov,mp4,m4a,3gp,3g2,mj2,matroska,webm,avi,mp3,wav,flac,ogg"
];
const error = (reason: string) =>
  new AudioExtractError(
    `AUDIO_EXTRACT_${reason.toUpperCase()}`,
    (
      {
        canceled: "提取已取消",
        timeout: "媒体处理超时，请检查视频或减少单次处理量",
        unavailable: "FFmpeg/FFprobe 不可用，请检查共享媒体运行时",
        output: "媒体信息超过上限",
        invalid: "媒体无法处理，请检查音轨编码或文件完整性",
        progress: "无法保存任务进度"
      } as Record<string, string>
    )[reason] ?? "音频提取失败",
    reason === "canceled" ? 409 : reason === "unavailable" ? 503 : 415
  );
export async function probeTracks(
  file: string,
  tools: FfmpegTools,
  signal: AbortSignal,
  requireVideo = true
): Promise<AudioExtractTrack[]> {
  const text = await runMediaCommand(
    tools.ffprobe,
    [
      "-v",
      "error",
      ...input,
      "-show_entries",
      "format=duration:stream=index,codec_type,codec_name,channels,sample_rate,duration:stream_tags=language,title:stream_disposition=default,attached_pic",
      "-of",
      "json",
      file
    ],
    signal,
    { error, timeoutMs: 30000 }
  );
  let data: {
    format?: { duration?: string };
    streams?: Array<{
      index?: number;
      codec_type?: string;
      codec_name?: string;
      channels?: number;
      sample_rate?: string;
      duration?: string;
      tags?: { language?: string; title?: string };
      disposition?: { default?: number; attached_pic?: number };
    }>;
  };
  try {
    data = JSON.parse(text);
  } catch {
    throw error("invalid");
  }
  if (
    !Array.isArray(data.streams) ||
    (requireVideo && !data.streams.some((s) => s.codec_type === "video" && !s.disposition?.attached_pic))
  )
    throw error("invalid");
  const audio = data.streams.filter((s) => s.codec_type === "audio");
  if (!audio.length) throw new AudioExtractError("AUDIO_EXTRACT_NO_AUDIO", "该视频不包含音轨", 415);
  if (audio.length > 32) throw new AudioExtractError("AUDIO_EXTRACT_TRACK_LIMIT", "单个视频最多支持 32 条音轨", 413);
  return audio.map((s) => {
    const duration =
        [s.duration, data.format?.duration].map(Number).find((n) => Number.isFinite(n) && n > 0) ?? Number.NaN,
      rate = Number(s.sample_rate);
    if (
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > AUDIO_EXTRACT_MAX_SECONDS + (requireVideo ? 0 : 1) ||
      !Number.isInteger(s.index) ||
      s.index! < 0 ||
      s.index! > 1023 ||
      !s.channels ||
      s.channels > 64 ||
      !Number.isInteger(rate) ||
      rate <= 0 ||
      rate > 768000 ||
      !s.codec_name
    )
      throw error("invalid");
    return {
      index: s.index!,
      codec: s.codec_name.slice(0, 60),
      channels: s.channels,
      sampleRate: rate,
      duration,
      language: (s.tags?.language ?? "und").replace(/\p{Cc}/gu, "").slice(0, 80),
      title: (s.tags?.title ?? "").replace(/\p{Cc}/gu, "").slice(0, 160),
      default: Boolean(s.disposition?.default)
    };
  });
}
export function outputFormat(
  codec: string,
  format: "mp3" | "original"
): Pick<AudioExtractJob, "extension" | "mimeType"> {
  if (format === "mp3" || codec === "mp3") return { extension: "mp3", mimeType: "audio/mpeg" };
  if (["aac", "alac"].includes(codec)) return { extension: "m4a", mimeType: "audio/mp4" };
  if (codec === "flac") return { extension: "flac", mimeType: "audio/flac" };
  if (["opus", "vorbis"].includes(codec)) return { extension: "ogg", mimeType: "audio/ogg" };
  if (["pcm_s16le", "pcm_s24le", "pcm_s32le", "pcm_f32le", "pcm_f64le"].includes(codec))
    return { extension: "wav", mimeType: "audio/wav" };
  if (["ac3", "eac3", "dts", "mp2"].includes(codec)) return { extension: "mka", mimeType: "audio/x-matroska" };
  throw new AudioExtractError("AUDIO_EXTRACT_COPY_UNSUPPORTED", "此音轨尚无已验证的原编码输出方式，请选择 MP3", 415);
}
export async function extractTrack(
  file: string,
  output: string,
  track: AudioExtractTrack,
  format: "mp3" | "original",
  bitrate: number,
  tools: FfmpegTools,
  signal: AbortSignal,
  progress: (n: number) => void
) {
  let pending = "";
  await runMediaCommand(
    tools.ffmpeg,
    [
      "-v",
      "error",
      "-nostdin",
      ...input,
      "-i",
      file,
      "-map",
      `0:${track.index}`,
      "-vn",
      "-sn",
      "-dn",
      "-map_metadata",
      "-1",
      ...(format === "original"
        ? ["-c:a", "copy"]
        : [
            "-c:a",
            "libmp3lame",
            "-b:a",
            `${bitrate}k`,
            "-ac",
            String(Math.min(2, track.channels)),
            "-ar",
            String([32000, 44100, 48000].includes(track.sampleRate) ? track.sampleRate : 44100)
          ]),
      "-fs",
      String(AUDIO_EXTRACT_MAX_BYTES),
      "-progress",
      "pipe:1",
      "-n",
      output
    ],
    signal,
    {
      error,
      timeoutMs: 2 * 3600000,
      captureOutput: false,
      onOutput: (value) => {
        pending += value;
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines)
          if (line.startsWith("out_time_us=")) {
            const n = Number(line.slice(12));
            if (Number.isFinite(n)) progress(Math.max(1, Math.min(95, (n / 1e6 / track.duration) * 95)));
          }
      }
    }
  );
  const tracks = await probeTracks(output, tools, signal, false),
    stat = await fs.stat(output);
  const result = tracks[0];
  if (
    tracks.length !== 1 ||
    !stat.size ||
    stat.size >= AUDIO_EXTRACT_MAX_BYTES ||
    result.codec !== (format === "mp3" ? "mp3" : track.codec) ||
    Math.abs(result.duration - track.duration) > Math.max(1, track.duration * 0.001)
  )
    throw new AudioExtractError("AUDIO_EXTRACT_OUTPUT_INVALID", "输出音轨完整性校验失败，未发布结果", 500);
  return { bytes: stat.size, duration: result.duration };
}
