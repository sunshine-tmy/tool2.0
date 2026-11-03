/** Bounded local audio processing. Never pass user text as FFmpeg options or shell commands. */
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { terminateChildProcess } from "../../lifecycle/child-process";
import type { AppConfig } from "../../config";
import type { ComponentManager } from "../../modules/components/component-manager";
import { AudioConvertError } from "./errors";
import { qmcPayload, qmcTransform } from "./qmc";
import { resolveFfmpegTools } from "../../core/media/runtime";
export type AudioTools = { ffmpeg: string; ffprobe: string };
type AudioProbe = { format: string; duration: number; channels: number; rate: number };
const inputOptions = [
  "-protocol_whitelist",
  "file,pipe",
  "-format_whitelist",
  "ogg,flac,mp3,wav,mov,mp4,m4a,3gp,3g2,mj2"
];
async function audioProcess(
  executable: string,
  args: string[],
  signal: AbortSignal,
  progress?: (value: string) => void
) {
  signal.throwIfAborted();
  return new Promise<string>((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let output = "",
      failure: Error | undefined;
    const stop = (error: Error) => {
      if (failure) return;
      failure = error;
      void terminateChildProcess(child).catch(() => undefined);
    };
    const abort = () => stop(new AudioConvertError("AUDIO_CONVERT_CANCELED", "转换已取消", 409));
    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(
      () => stop(new AudioConvertError("AUDIO_CONVERT_TIMEOUT", "转换超时，请检查媒体文件", 503)),
      1800000
    );
    child.stdout.on("data", (chunk: Buffer) => {
      if (failure) return;
      output += chunk.toString();
      if (output.length > 1024 * 1024) stop(new AudioConvertError("AUDIO_CONVERT_PROCESS_LIMIT", "媒体信息超过上限"));
      try {
        progress?.(chunk.toString());
      } catch {
        stop(new AudioConvertError("AUDIO_CONVERT_STORAGE_FAILED", "无法保存转换进度", 500));
      }
    });
    child.stderr.resume();
    child.once("error", () => {
      failure ??= new AudioConvertError(
        "AUDIO_CONVERT_RUNTIME_UNAVAILABLE",
        "FFmpeg 运行时不可用，请检查能力管理",
        503
      );
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (failure) reject(failure);
      else if (signal.aborted) reject(new AudioConvertError("AUDIO_CONVERT_CANCELED", "转换已取消", 409));
      else if (code)
        reject(new AudioConvertError("AUDIO_CONVERT_MEDIA_INVALID", "媒体编码无效、密钥不匹配或文件已损坏", 415));
      else resolve(output);
    });
    if (signal.aborted) abort();
  });
}
export async function resolveAudioTools(config: AppConfig, components: ComponentManager): Promise<AudioTools> {
  try {
    return await resolveFfmpegTools({
      managed: config.desktopManagedCapabilities,
      fallback: { ffmpeg: config.chatterboxFfmpegPath, ffprobe: config.chatterboxFfprobePath },
      asset: async (relative) => (await components.resolveInstalledAsset("ffmpeg", relative)).path
    });
  } catch {
    throw new AudioConvertError("AUDIO_CONVERT_RUNTIME_UNAVAILABLE", "请先安装 FFmpeg 共享媒体运行时", 503);
  }
}
export async function probeAudio(file: string, tools: AudioTools, signal: AbortSignal): Promise<AudioProbe> {
  const raw = JSON.parse(
    await audioProcess(
      tools.ffprobe,
      [
        "-v",
        "error",
        ...inputOptions,
        "-show_entries",
        "format=format_name,duration:stream=codec_type,codec_name,channels,sample_rate",
        "-of",
        "json",
        file
      ],
      signal
    )
  ) as {
    format?: { duration?: string; format_name?: string };
    streams?: Array<{ codec_type?: string; codec_name?: string; channels?: number; sample_rate?: string }>;
  };
  const audio = raw.streams?.find((s) => s.codec_type === "audio"),
    duration = Number(raw.format?.duration);
  if (
    !audio ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > 7200 ||
    !audio.channels ||
    audio.channels > 64
  )
    throw new AudioConvertError("AUDIO_CONVERT_MEDIA_INVALID", "请选择有效音频（最长 2 小时）", 415);
  return { format: audio.codec_name ?? "", duration, channels: audio.channels, rate: Number(audio.sample_rate) };
}
export async function prepareAudio(file: string, decrypted: string, name: string, signal: AbortSignal, ekey?: string) {
  const handle = await fs.open(file, "r");
  try {
    const stat = await handle.stat(),
      head = Buffer.alloc(12);
    await handle.read(head, 0, 12, 0);
    if (["OggS", "fLaC"].includes(head.subarray(0, 4).toString())) return file;
    if (!/\.(mgg|mflac)$/i.test(name))
      throw new AudioConvertError("AUDIO_CONVERT_FORMAT_UNSUPPORTED", "文件内容不是 OGG 或 FLAC", 415);
    const tail = Buffer.alloc(Math.min(stat.size, 24000));
    await handle.read(tail, 0, tail.length, stat.size - tail.length);
    const { end, key } = qmcPayload(tail, stat.size, ekey);
    const out = await fs.open(decrypted, "wx");
    try {
      for (let offset = 0; offset < end;) {
        signal.throwIfAborted();
        const chunk = Buffer.alloc(Math.min(256 * 1024, end - offset));
        const { bytesRead } = await handle.read(chunk, 0, chunk.length, offset);
        if (bytesRead !== chunk.length) throw new AudioConvertError("AUDIO_CONVERT_CORRUPT", "音频文件不完整", 415);
        qmcTransform(chunk, key, offset);
        if (!offset && !["OggS", "fLaC"].includes(chunk.subarray(0, 4).toString()))
          throw new AudioConvertError("AUDIO_CONVERT_KEY_MISMATCH", "密钥与文件不匹配，未生成转换结果", 415);
        await out.writeFile(chunk);
        offset += bytesRead;
      }
      await out.sync();
    } finally {
      key.fill(0);
      await out.close();
    }
    return decrypted;
  } finally {
    await handle.close();
  }
}
export async function convertAudio(
  input: string,
  output: string,
  tools: AudioTools,
  probe: AudioProbe,
  bitrate: number,
  signal: AbortSignal,
  progress: (n: number) => void
) {
  let pending = "";
  await audioProcess(
    tools.ffmpeg,
    [
      "-v",
      "error",
      "-nostdin",
      ...inputOptions,
      "-i",
      input,
      "-map",
      "0:a:0",
      "-vn",
      "-map_metadata",
      "0",
      "-c:a",
      "libmp3lame",
      "-b:a",
      `${bitrate}k`,
      "-ac",
      String(Math.min(2, probe.channels)),
      "-ar",
      String([32000, 44100, 48000].includes(probe.rate) ? probe.rate : 44100),
      "-id3v2_version",
      "3",
      "-t",
      "7200",
      "-fs",
      String(300 * 1024 * 1024),
      "-progress",
      "pipe:1",
      "-n",
      output
    ],
    signal,
    (value) => {
      pending += value;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines)
        if (line.startsWith("out_time_us="))
          progress(Math.min(95, Math.max(1, (Number(line.slice(12)) / 1000000 / probe.duration) * 95)));
    }
  );
  const verified = await probeAudio(output, tools, signal);
  if (verified.format !== "mp3" || Math.abs(verified.duration - probe.duration) > Math.max(1, probe.duration * 0.01))
    throw new AudioConvertError("AUDIO_CONVERT_OUTPUT_INVALID", "输出音频完整性验证失败", 500);
}
