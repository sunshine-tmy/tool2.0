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

export async function registerImageToolRoutes({ app, config, taskStore }: RegisterImageToolRoutesOptions) {
  registerSingleImageToolRoute({ app, config, taskStore, toolId: "image-compress" });
  registerSingleImageToolRoute({ app, config, taskStore, toolId: "format-convert" });
}

export function registerSingleImageToolRoute({
  app,
  config,
  taskStore,
  toolId
}: RegisterImageToolRoutesOptions & { toolId: "image-compress" | "format-convert" }) {
  app.post(`/api/tools/${toolId}`, async (request, reply) => {
    return processImageRequest(toolId, request, reply, config, taskStore);
  });
}

async function processImageRequest(
  toolId: "image-compress" | "format-convert",
  request: FastifyRequest,
  reply: FastifyReply,
  config: AppConfig,
  taskStore: TaskStore
) {
  const file = await request.file();
  if (!file) {
    return reply.code(400).send(fail("FILE_REQUIRED", "Please upload an image file"));
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
    const originalSize = input.length;
    const outputName = `${task.id}.${options.outputFormat}`;
    const outputPath = path.join(config.outputDir, outputName);

    let pipeline = sharp(input).rotate();
    const metadata = await sharp(input).metadata();
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
      outputPath
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
