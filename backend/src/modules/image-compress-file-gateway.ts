/**
 * 中文模块说明：后端应用层，负责 后端公共服务、配置或基础设施能力
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ZipArchive } from "archiver";
import { nanoid } from "nanoid";
import type { AppConfig } from "../config";
import { commitStagedFile, createStagingPath } from "../storage/file-commit-gateway";
import type { TaskStore } from "../tasks/task-store";
import { IMAGE_COMPRESS_MAX_PIXELS, SUPPORTED_IMAGE_MIME_TYPES } from "./image-compress-input";

export class ImageFileGateway {
  constructor(private readonly config: AppConfig) {}

  async compress(
    input: Buffer,
    outputPath: string,
    options: { quality: number; outputFormat: string; width?: number }
  ) {
    await fs.mkdir(this.config.outputDir, { recursive: true });
    const image = sharp(input, { limitInputPixels: IMAGE_COMPRESS_MAX_PIXELS }).rotate();
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || !SUPPORTED_IMAGE_MIME_TYPES.has(`image/${metadata.format}`)) {
      throw new Error("Invalid or unsupported image content");
    }
    let pipeline = image.clone();
    if (options.width) pipeline = pipeline.resize({ width: options.width, withoutEnlargement: true });
    if (options.outputFormat === "jpeg") pipeline = pipeline.jpeg({ quality: options.quality });
    else if (options.outputFormat === "png") pipeline = pipeline.png({ quality: options.quality });
    else pipeline = pipeline.webp({ quality: options.quality });

    const stagingPath = createStagingPath(outputPath, nanoid(8));
    try {
      await pipeline.toFile(stagingPath);
      const outputStat = await fs.stat(stagingPath);
      await commitStagedFile(stagingPath, outputPath);
      return { outputSize: outputStat.size, width: metadata.width, height: metadata.height };
    } finally {
      await fs.rm(stagingPath, { force: true }).catch(() => undefined);
    }
  }
}

export class ImageArchiveGateway {
  constructor(
    private readonly config: AppConfig,
    private readonly taskStore: TaskStore
  ) {}

  async create(files: Array<{ taskId: string; fileName: string }>, toolId: string) {
    const archiveFiles: Array<{ filePath: string; archiveName: string }> = [];
    const usedNames = new Set<string>();
    for (const requested of files) {
      const task = this.taskStore.get(requested.taskId);
      if (task?.toolId !== toolId || task.status !== "completed" || !task.outputPath) {
        throw new ImageArchiveError(404, "RESULT_NOT_FOUND", "One or more compressed images are unavailable");
      }
      const outputName = path.basename(task.outputPath);
      const filePath = path.join(this.config.outputDir, outputName);
      try {
        const stat = await fs.stat(filePath);
        if (!stat.isFile()) throw new Error("Not a file");
      } catch {
        throw new ImageArchiveError(404, "RESULT_FILE_NOT_FOUND", "One or more compressed images were cleaned up");
      }
      archiveFiles.push({
        filePath,
        archiveName: uniqueArchiveName(requested.fileName, path.extname(outputName), usedNames)
      });
    }

    const archive = new ZipArchive({ zlib: { level: 6 } });
    for (const file of archiveFiles) archive.file(file.filePath, { name: file.archiveName });
    void archive.finalize();
    return archive;
  }
}

export class ImageArchiveError extends Error {
  constructor(
    readonly statusCode: 400 | 404,
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

function uniqueArchiveName(requestedName: string, extension: string, usedNames: Set<string>) {
  const safeBase =
    path
      .basename(requestedName || "image", path.extname(requestedName || "image"))
      .replace(/[<>:"/\\|?*]/g, "_")
      .split("")
      .map((character) => (character.charCodeAt(0) < 32 ? "_" : character))
      .join("")
      .trim()
      .slice(0, 120) || "image";
  let candidate = `${safeBase}${extension}`;
  let suffix = 2;
  while (usedNames.has(candidate.toLowerCase())) candidate = `${safeBase} (${suffix++})${extension}`;
  usedNames.add(candidate.toLowerCase());
  return candidate;
}
