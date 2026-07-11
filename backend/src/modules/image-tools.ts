import fs from "node:fs/promises";
import path from "node:path";
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
  app.post(`/api/tools/${toolId}`, async (request, reply) => {
    return processImageRequest(toolId, request, reply, config, taskStore);
  });
}

async function processImageRequest(
  toolId: "image-compress",
  request: FastifyRequest,
  reply: FastifyReply,
  config: AppConfig,
  taskStore: TaskStore
) {
  const file = await request.file({ limits: { fileSize: IMAGE_COMPRESS_MAX_FILE_BYTES } });
  if (!file) {
    return reply.code(400).send(fail("FILE_REQUIRED", "Please upload an image file"));
  }
  if (!supportedImageMimeTypes.has(file.mimetype)) {
    file.file.resume();
    return reply.code(415).send(fail("UNSUPPORTED_IMAGE_TYPE", "Only JPEG, PNG and WebP images are supported"));
  }

  const task = taskStore.create(toolId);
  taskStore.update(task.id, { status: "running", progress: 15 });

  try {
    await fs.mkdir(config.outputDir, { recursive: true });
    const fields = file.fields as Record<string, { value?: unknown } | undefined>;
    const options = normalizeImageOptions({
      quality: Number(fields.quality?.value ?? 78),
      outputFormat: String(fields.outputFormat?.value ?? "webp"),
      width: fields.width?.value ? Number(fields.width.value) : undefined
    });

    const input = await file.toBuffer();
    if (file.file.truncated || input.length > IMAGE_COMPRESS_MAX_FILE_BYTES) {
      taskStore.update(task.id, { status: "failed", progress: 100, error: "Image exceeds the 20MB limit" });
      return reply.code(413).send(fail("IMAGE_TOO_LARGE", "Image exceeds the 20MB limit"));
    }
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
      downloadUrl: `/api/files/${outputName}`,
      originalName: path.basename(file.filename || "image"),
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
