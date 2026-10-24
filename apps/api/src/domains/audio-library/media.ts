/** 成品音频校验只使用 Node 解析器，不依赖模型、Python 或 FFmpeg。 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import crypto from "node:crypto";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { parseFile } from "music-metadata";
import { AUDIO_LIBRARY_MAX_FILE_BYTES } from "@toolbox/shared/audio-library";
import { reject } from "./errors";

export async function hashAudio(file: string) {
  const hash = crypto.createHash("sha256");
  await pipeline(
    fs.createReadStream(file),
    new Writable({
      write(chunk, _encoding, callback) {
        hash.update(chunk);
        callback();
      }
    })
  );
  return hash.digest("hex");
}
export async function inspectAudio(file: string) {
  const stat = await fsp.stat(file);
  if (!stat.isFile() || stat.size <= 0 || stat.size > AUDIO_LIBRARY_MAX_FILE_BYTES)
    reject("AUDIO_LIBRARY_FILE_SIZE", "音频须为 1 B–100 MiB", 413);
  const metadata = await parseFile(file, { duration: true, skipCovers: true }).catch(() =>
    reject("AUDIO_LIBRARY_FORMAT_INVALID", "无法读取音频，请上传有效 MP3、PCM WAV、AAC M4A 或 FLAC", 415)
  );
  const { container = "", codec = "", duration = 0, numberOfChannels = 0 } = metadata.format;
  let extension: "mp3" | "wav" | "m4a" | "flac";
  if (/MPEG/i.test(container) && /layer\s*3|L3/i.test(codec)) extension = "mp3";
  else if (/WAVE|WAV/i.test(container) && /PCM/i.test(codec)) extension = "wav";
  else if (/M4A|MP4|MPEG-4/i.test(container) && /AAC/i.test(codec)) extension = "m4a";
  else if (/FLAC/i.test(container) && /FLAC/i.test(codec)) extension = "flac";
  else reject("AUDIO_LIBRARY_FORMAT_INVALID", "仅支持 MP3、PCM WAV、AAC M4A 和 FLAC", 415);
  if (!Number.isFinite(duration) || duration <= 0 || !numberOfChannels)
    reject("AUDIO_LIBRARY_FORMAT_INVALID", "音频时长或音轨无效", 415);
  const mimeType = { mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", flac: "audio/flac" }[extension];
  return { fileName: `audio.${extension}`, mimeType, bytes: stat.size, duration, sha256: await hashAudio(file) };
}
