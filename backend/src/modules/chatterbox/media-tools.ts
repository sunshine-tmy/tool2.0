import fsp from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CHATTERBOX_MAX_REFERENCE_SECONDS, CHATTERBOX_MIN_REFERENCE_SECONDS } from "@toolbox/shared";
import type { AppConfig } from "../../config";

const execFileAsync = promisify(execFile);

export type ChatterboxUploadErrorStatus = 400 | 413 | 415 | 422;

export class ChatterboxInputError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: ChatterboxUploadErrorStatus
  ) {
    super(message);
  }
}

export class ChatterboxMediaTools {
  constructor(private readonly config: AppConfig) {}

  async normalizeReference(inputPath: string, outputPath: string) {
    const sourceDuration = await this.duration(inputPath);
    if (sourceDuration < CHATTERBOX_MIN_REFERENCE_SECONDS || sourceDuration > CHATTERBOX_MAX_REFERENCE_SECONDS) {
      throw new ChatterboxInputError(
        "CHATTERBOX_REFERENCE_DURATION_INVALID",
        `参考音频应为 ${CHATTERBOX_MIN_REFERENCE_SECONDS}–${CHATTERBOX_MAX_REFERENCE_SECONDS} 秒`,
        400
      );
    }
    await execFileAsync(
      this.config.chatterboxFfmpegPath,
      ["-y", "-v", "error", "-i", inputPath, "-vn", "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", outputPath],
      { timeout: 120_000, windowsHide: true, maxBuffer: 1024 * 1024 }
    );
    await fsp.rm(inputPath, { force: true });
    return Number(sourceDuration.toFixed(3));
  }

  async toMp3(inputPath: string, outputPath: string) {
    const tempPath = `${outputPath}.tmp.mp3`;
    await execFileAsync(
      this.config.chatterboxFfmpegPath,
      ["-y", "-v", "error", "-i", inputPath, "-codec:a", "libmp3lame", "-b:a", "192k", tempPath],
      { timeout: 120_000, windowsHide: true, maxBuffer: 1024 * 1024 }
    );
    const stat = await fsp.stat(tempPath);
    if (stat.size <= 0 || !(await isMp3File(tempPath))) throw new Error("Chatterbox MP3 输出无效");
    await fsp.rename(tempPath, outputPath);
  }

  async concatMp3(inputPaths: string[], outputPath: string) {
    if (!inputPaths.length) throw new Error("没有可合并的 Chatterbox 音频");
    const tempPath = `${outputPath}.tmp.mp3`;
    if (inputPaths.length === 1) {
      await fsp.copyFile(inputPaths[0], tempPath);
    } else {
      const inputs = inputPaths.flatMap((inputPath) => ["-i", inputPath]);
      const streams = inputPaths.map((_, index) => `[${index}:a:0]`).join("");
      await execFileAsync(
        this.config.chatterboxFfmpegPath,
        [
          "-y",
          "-v",
          "error",
          ...inputs,
          "-filter_complex",
          `${streams}concat=n=${inputPaths.length}:v=0:a=1[out]`,
          "-map",
          "[out]",
          "-codec:a",
          "libmp3lame",
          "-b:a",
          "192k",
          tempPath
        ],
        { timeout: 300_000, windowsHide: true, maxBuffer: 1024 * 1024 }
      );
    }
    const stat = await fsp.stat(tempPath);
    if (stat.size <= 0 || !(await isMp3File(tempPath))) throw new Error("Chatterbox 合并 MP3 输出无效");
    await replaceFile(tempPath, outputPath);
  }

  async duration(filePath: string) {
    try {
      const result = await execFileAsync(
        this.config.chatterboxFfprobePath,
        ["-v", "error", "-show_entries", "format=duration", "-of", "json", filePath],
        { timeout: 30_000, windowsHide: true, maxBuffer: 1024 * 1024, encoding: "utf8" }
      );
      const parsed = JSON.parse(String(result.stdout)) as { format?: { duration?: string } };
      const duration = Number(parsed.format?.duration);
      if (!Number.isFinite(duration) || duration <= 0) throw new Error("duration unavailable");
      return duration;
    } catch {
      throw new ChatterboxInputError(
        "CHATTERBOX_REFERENCE_INVALID",
        "无法读取音频，请上传有效的 WAV、MP3、M4A 或 FLAC",
        415
      );
    }
  }
}

async function isMp3File(filePath: string) {
  const handle = await fsp.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(3);
    const { bytesRead } = await handle.read(buffer, 0, 3, 0);
    return (
      bytesRead >= 2 && (buffer.toString("ascii") === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0))
    );
  } finally {
    await handle.close();
  }
}

async function replaceFile(source: string, target: string) {
  const backup = `${target}.backup`;
  await fsp.rm(backup, { force: true });
  const targetExists = await fsp.stat(target).then(
    (stat) => stat.isFile(),
    () => false
  );
  if (targetExists) await fsp.rename(target, backup);
  try {
    await fsp.rename(source, target);
    await fsp.rm(backup, { force: true });
  } catch (error) {
    if (targetExists) await fsp.rename(backup, target);
    throw error;
  }
}
