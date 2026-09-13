import fs from "node:fs/promises";
import path from "node:path";
import { ZipArchive } from "archiver";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import sharp from "sharp";
import { fail, normalizeImageOptions, ok } from "@toolbox/shared";
import type { AppConfig } from "../config";
import type { TaskStore } from "../tasks/task-store";

type RegisterImageToolRoutesOptions = {
  app: FastifyInstance;
  config: AppConfig;
  taskStore: TaskStore;
};

const IMAGE_COMPRESS_MAX_FILE_BYTES = 20 * 1024 * 1024;
const IMAGE_COMPRESS_MAX_PIXELS = 40_000_000;
const supportedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function registerSingleImageToolRoute({
  app,
  config,
  taskStore,
  toolId
}: RegisterImageToolRoutesOptions & { toolId: "image-compress" }) {
  app.post(`/api/v1/tools/${toolId}`, async (request, reply) => {
    return processImageRequest(toolId, request, reply, config, taskStore);
  });

  app.post(`/api/v1/tools/${toolId}/download.zip`, async (request, reply) => {
    const requestedFiles = parseBatchDownloadFiles(request.body);
    if (!requestedFiles.length) {
      return reply.code(400).send(fail("FILES_REQUIRED", "Please select completed images to download"));
    }

    const archiveFiles: Array<{ filePath: string; archiveName: string }> = [];
    const usedNames = new Set<string>();
    for (const requested of requestedFiles) {
      const task = taskStore.get(requested.taskId);
      if (task?.toolId !== toolId || task.status !== "completed" || !task.outputPath) {
        return reply.code(404).send(fail("RESULT_NOT_FOUND", "One or more compressed images are unavailable"));
      }
      const outputName = path.basename(task.outputPath);
      const filePath = path.join(config.outputDir, outputName);
      try {
        const stat = await fs.stat(filePath);
        if (!stat.isFile()) throw new Error("Not a file");
      } catch {
        return reply.code(404).send(fail("RESULT_FILE_NOT_FOUND", "One or more compressed images were cleaned up"));
      }
      archiveFiles.push({
        filePath,
        archiveName: uniqueArchiveName(requested.fileName, path.extname(outputName), usedNames)
      });
    }

    const archive = new ZipArchive({ zlib: { level: 6 } });
    for (const file of archiveFiles) archive.file(file.filePath, { name: file.archiveName });
    void archive.finalize();
    reply.type("application/zip");
    reply.header("content-disposition", `attachment; filename="image-compress-${Date.now()}.zip"`);
    return reply.send(archive);
  });
}

function parseBatchDownloadFiles(body: unknown) {
  if (!body || typeof body !== "object" || !("files" in body) || !Array.isArray(body.files)) return [];
  const files: Array<{ taskId: string; fileName: string }> = [];
  const seenTaskIds = new Set<string>();
  for (const value of body.files.slice(0, 30)) {
    if (!value || typeof value !== "object") continue;
    const taskId = "taskId" in value && typeof value.taskId === "string" ? value.taskId.trim() : "";
    const fileName = "fileName" in value && typeof value.fileName === "string" ? value.fileName.trim() : "";
    if (!taskId || seenTaskIds.has(taskId)) continue;
    seenTaskIds.add(taskId);
    files.push({ taskId, fileName });
  }
  return files;
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

async function processImageRequest(
  toolId: "image-compress",
  request: FastifyRequest,
  reply: FastifyReply,
  config: AppConfig,
  taskStore: TaskStore
) {
  const task = taskStore.create(toolId);
  taskStore.update(task.id, { status: "running", progress: 15 });
  const rejectInput = (status: number, code: string, message: string) => {
    taskStore.update(task.id, { status: "failed", progress: 100, error: message });
    return reply.code(status).send(fail(code, message));
  };

  try {
    let input: Buffer | undefined;
    let originalName = "image";
    const fields: Record<string, unknown> = {};
    // Consume the whole multipart request: settings may arrive after the file stream.
    for await (const part of request.parts({ limits: { fileSize: IMAGE_COMPRESS_MAX_FILE_BYTES, files: 1 } })) {
      if (part.type === "field") {
        fields[part.fieldname] = part.value;
        continue;
      }
      if (!supportedImageMimeTypes.has(part.mimetype)) {
        part.file.resume();
        return rejectInput(415, "UNSUPPORTED_IMAGE_TYPE", "Only JPEG, PNG and WebP images are supported");
      }
      input = await part.toBuffer();
      originalName = path.basename(part.filename || "image");
      if (part.file.truncated || input.length > IMAGE_COMPRESS_MAX_FILE_BYTES) {
        return rejectInput(413, "IMAGE_TOO_LARGE", "Image exceeds the 20MB limit");
      }
    }
    if (!input) return rejectInput(400, "FILE_REQUIRED", "Please upload an image file");

    await fs.mkdir(config.outputDir, { recursive: true });
    const options = normalizeImageOptions({
      quality: Number(fields.quality ?? 78),
      outputFormat: String(fields.outputFormat ?? "webp"),
      width: fields.width ? Number(fields.width) : undefined
    });

    const originalSize = input.length;
    const outputName = `${task.id}.${options.outputFormat}`;
    const outputPath = path.join(config.outputDir, outputName);

    const image = sharp(input, { limitInputPixels: IMAGE_COMPRESS_MAX_PIXELS }).rotate();
    const metadata = await image.metadata();
    let pipeline = image.clone();
    if (!metadata.width || !metadata.height || !supportedImageMimeTypes.has(`image/${metadata.format}`)) {
      throw new Error("Invalid or unsupported image content");
    }
    if (options.width) {
      pipeline = pipeline.resize({ width: options.width, withoutEnlargement: true });
    }

    if (options.outputFormat === "jpeg") {
      pipeline = pipeline.jpeg({ quality: options.quality });
    } else if (options.outputFormat === "png") {
      pipeline = pipeline.png({ quality: options.quality });
    } else {
      pipeline = pipeline.webp({ quality: options.quality });
    }

    await pipeline.toFile(outputPath);
    const outputStat = await fs.stat(outputPath);
    const completed = taskStore.update(task.id, {
      status: "completed",
      progress: 100,
      outputPath: outputName
    });

    return ok({
      task: completed,
      downloadUrl: `/api/v1/files/${outputName}`,
      originalName,
      outputName,
      outputFormat: options.outputFormat,
      originalSize,
      outputSize: outputStat.size,
      savedBytes: originalSize - outputStat.size,
      compressionRatio: originalSize > 0 ? outputStat.size / originalSize : 1,
      width: metadata.width,
      height: metadata.height
    });
  } catch (error) {
    taskStore.update(task.id, {
      status: "failed",
      progress: 100,
      error: error instanceof Error ? error.message : "Image processing failed"
    });
    return reply.code(400).send(fail("IMAGE_PROCESSING_FAILED", "Image processing failed"));
  }
}
