/** 原配乐只使用本地音频探测，不信任 CDN 扩展名或 Content-Type，不依赖模型和 FFmpeg。 */
import { parseFile } from "music-metadata";

export const ARCHIVE_SOUNDTRACK_MAX_BYTES = 100 * 1024 * 1024;
export async function inspectArchiveSoundtrack(file: string) {
  const { format } = await parseFile(file, { duration: true, skipCovers: true });
  const { container = "", codec = "", duration = 0, numberOfChannels = 0 } = format;
  if (!Number.isFinite(duration) || duration <= 0 || duration > 7200 || !numberOfChannels)
    throw new Error("ARCHIVE_SOUNDTRACK_INVALID");
  // MP4 音频附件不能夹带视频轨；视频必须继续经过原视频校验路径。
  if (format.hasVideo || format.trackInfo?.some((track) => track.type === 1))
    throw new Error("ARCHIVE_SOUNDTRACK_VIDEO_TRACK");
  let extension: string, mimeType: string;
  if (/MPEG/i.test(container) && /layer\s*3|L3/i.test(codec)) [extension, mimeType] = ["mp3", "audio/mpeg"];
  else if (/ADTS|AAC/i.test(container) && /AAC/i.test(codec)) [extension, mimeType] = ["aac", "audio/aac"];
  else if (/M4A|MP4|MPEG-4/i.test(container) && /AAC/i.test(codec)) [extension, mimeType] = ["m4a", "audio/mp4"];
  else if (/WAVE|WAV/i.test(container) && /PCM/i.test(codec)) [extension, mimeType] = ["wav", "audio/wav"];
  else if (/FLAC/i.test(container) && /FLAC/i.test(codec)) [extension, mimeType] = ["flac", "audio/flac"];
  else if (/Ogg/i.test(container) && /Vorbis|Opus/i.test(codec)) [extension, mimeType] = ["ogg", "audio/ogg"];
  else throw new Error("ARCHIVE_SOUNDTRACK_FORMAT_UNSUPPORTED");
  return { extension, mimeType, durationMs: Math.round(duration * 1000) };
}
