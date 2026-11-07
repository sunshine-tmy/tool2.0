/** Probe local containers with network protocols disabled before handing files to the signed Worker. */
import type { AppConfig } from "../../config";
import { runMediaCommand } from "../../core/media/process";
export async function probeVideo(config: AppConfig, file: string, signal: AbortSignal) {
  const error = (reason: string) =>
    Object.assign(new Error("无法读取视频信息，请确认文件完整且共享 FFmpeg 可用"), {
      code: reason === "unavailable" ? "FFMPEG_UNAVAILABLE" : "INVALID_VIDEO",
      status: 422
    });
  const raw = await runMediaCommand(
    config.videoAiFfprobePath || config.chatterboxFfprobePath,
    [
      "-v",
      "error",
      "-protocol_whitelist",
      "file,pipe",
      "-format_whitelist",
      "mov,mp4,m4a,3gp,3g2,mj2,matroska,webm,avi",
      "-show_entries",
      "format=duration:stream=codec_type,width,height,duration,avg_frame_rate,nb_frames:stream_disposition=attached_pic",
      "-of",
      "json",
      file
    ],
    signal,
    { timeoutMs: 30000, error }
  );
  try {
    const info = JSON.parse(raw);
    const stream = info.streams?.find(
      (s: { codec_type?: string; disposition?: { attached_pic?: number } }) =>
        s.codec_type === "video" && !s.disposition?.attached_pic
    );
    const duration = Number(info.format?.duration ?? stream?.duration);
    const [numerator, denominator = "1"] = String(stream?.avg_frame_rate || "0/1").split("/");
    const fps = Number(numerator) / Number(denominator);
    if (
      !stream ||
      !Number.isInteger(stream.width) ||
      stream.width < 1 ||
      !Number.isInteger(stream.height) ||
      stream.height < 1 ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > 6 * 3600 ||
      !Number.isFinite(fps) ||
      fps <= 0
    )
      throw new Error("invalid metadata");
    return {
      width: stream.width as number,
      height: stream.height as number,
      fps,
      audioStreams: info.streams.filter((item: { codec_type?: string }) => item.codec_type === "audio")
        .length as number,
      durationMs: Math.round(duration * 1000),
      frameCount: Math.max(
        1,
        Math.round(
          Number.isSafeInteger(Number(stream.nb_frames)) && Number(stream.nb_frames) > 0
            ? Number(stream.nb_frames)
            : duration * fps
        )
      )
    };
  } catch {
    throw Object.assign(new Error("视频参数无效或时长超过 6 小时"), { code: "INVALID_VIDEO", status: 422 });
  }
}
