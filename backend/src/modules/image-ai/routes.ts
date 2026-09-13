import fs from "node:fs/promises";
import path from "node:path";
import { ZipArchive } from "archiver";
import type { FastifyInstance } from "fastify";
import {
  ApiFailureSchema,
  ImageAiFileQuerySchema,
  ImageAiHealthSchema,
  ImageAiResultParamsSchema,
  ImageAiTaskSchema,
  TaskIdParamsSchema,
  WatermarkSuggestionResponseSchema,
  apiSuccessSchema,
  fail,
  isImageAiOperation,
  ok
} from "@toolbox/shared";
import { nanoid } from "nanoid";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { TaskStore } from "../../tasks/task-store";
import {
  IMAGE_AI_MAX_FILE_BYTES,
  IMAGE_AI_MAX_MASK_BYTES,
  validateEnhanceOutput,
  validateUploadedImage,
  validateWatermarkMask,
  validationError
} from "./image-validation";
import { createImageAiTaskManager, type StoredInput } from "./task-manager";
import { createImageAiWorkerClient, ImageAiWorkerError } from "./worker-client";

type UploadedPart = {
  path: string;
  filename: string;
  mimetype: string;
  size: number;
  fieldname: string;
};

export async function registerImageAiRoutes(
  app: FastifyInstance,
  config: AppConfig,
  database: ToolboxDatabase,
  taskStore: TaskStore
) {
  const manager = createImageAiTaskManager(config, database, taskStore);
  const worker = createImageAiWorkerClient(config);
  await manager.initialize();
  app.addHook("onClose", async () => manager.close());

  app.get(
    "/api/v1/tools/image-ai/health",
    { schema: { response: { 200: apiSuccessSchema(ImageAiHealthSchema), 503: ApiFailureSchema } } },
    async (_request, reply) => {
      try {
        return ok(await worker.health());
      } catch (error) {
        const workerError = toWorkerError(error);
        return reply.code(503).send(
          fail(workerError.code, workerError.message, {
            available: false,
            deploymentUsage: config.deploymentUsage,
            workerUrl: config.imageAiWorkerUrl,
            models: []
          })
        );
      }
    }
  );

  app.post(
    "/api/v1/tools/image-ai/watermark/suggestions",
    {
      schema: {
        response: {
          200: apiSuccessSchema(WatermarkSuggestionResponseSchema),
          400: ApiFailureSchema,
          413: ApiFailureSchema,
          422: ApiFailureSchema,
          503: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      const tempId = `suggestion-${nanoid(12)}`;
      const tempDir = path.join(config.imageAiInputsDir, tempId);
      await fs.mkdir(tempDir, { recursive: true });

      try {
        const file = await request.file();
        if (!file) return reply.code(400).send(fail("FILE_REQUIRED", "请选择一张图片"));
        const stored = await storeStream(file.file, path.join(tempDir, "input.bin"), IMAGE_AI_MAX_FILE_BYTES);
        await validateUploadedImage({
          filePath: stored.path,
          originalName: path.basename(file.filename || "image"),
          mimetype: file.mimetype,
          size: stored.size
        });
        return ok(await worker.suggestions(stored.path));
      } catch (error) {
        return sendRouteError(reply, error);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    }
  );

  app.post(
    "/api/v1/tools/image-ai/tasks",
    {
      schema: {
        response: {
          202: apiSuccessSchema(ImageAiTaskSchema),
          400: ApiFailureSchema,
          413: ApiFailureSchema,
          422: ApiFailureSchema,
          429: ApiFailureSchema,
          503: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      const releaseReservation = manager.tryReserveSlot();
      if (!releaseReservation) {
        return reply.code(429).send(fail("IMAGE_AI_QUEUE_FULL", "AI 任务队列已满，请稍后再试"));
      }

      const taskId = nanoid(12);
      const inputDir = path.join(config.imageAiInputsDir, taskId);
      const uploaded: UploadedPart[] = [];
      const fields: Record<string, string> = {};

      try {
        await fs.mkdir(inputDir, { recursive: true });
        let fileIndex = 0;
        for await (const part of request.parts()) {
          if (part.type === "field") {
            fields[part.fieldname] = String(part.value ?? "");
            continue;
          }
          const isMask = part.fieldname === "mask";
          const limit = isMask ? IMAGE_AI_MAX_MASK_BYTES : IMAGE_AI_MAX_FILE_BYTES;
          const destination = path.join(inputDir, isMask ? "mask.png" : `input-${fileIndex++}.bin`);
          const stored = await storeStream(part.file, destination, limit);
          uploaded.push({
            ...stored,
            filename: path.basename(part.filename || (isMask ? "mask.png" : "image")),
            mimetype: part.mimetype,
            fieldname: part.fieldname
          });
        }

        const operation = fields.operation;
        if (!isImageAiOperation(operation)) {
          throw validationError("INVALID_OPERATION", "不支持的图片处理操作");
        }
        const fileParts = uploaded.filter((part) => part.fieldname !== "mask");
        const maskPart = uploaded.find((part) => part.fieldname === "mask");
        const maxFiles = operation === "watermark_remove" ? 1 : 10;
        if (!fileParts.length) throw validationError("FILE_REQUIRED", "请至少选择一张图片");
        if (fileParts.length > maxFiles) {
          throw validationError("TOO_MANY_FILES", `该操作最多支持 ${maxFiles} 张图片`);
        }

        const scale = fields.scale === "4" ? 4 : 2;
        const validatedFiles: StoredInput[] = [];
        for (const part of fileParts) {
          const metadata = await validateUploadedImage({
            filePath: part.path,
            originalName: part.filename,
            mimetype: part.mimetype,
            size: part.size
          });
          if (operation === "enhance") validateEnhanceOutput(metadata.width, metadata.height, scale);
          validatedFiles.push({
            path: part.path,
            originalName: part.filename,
            mimetype: part.mimetype,
            size: part.size,
            width: metadata.width,
            height: metadata.height
          });
        }

        if (operation === "watermark_remove") {
          if (!maskPart) throw validationError("MASK_REQUIRED", "去水印必须提交用户确认的 PNG 蒙版");
          await validateWatermarkMask(maskPart.path, maskPart.size, validatedFiles[0]);
        }

        const task = await manager.create({
          id: taskId,
          operation,
          files: validatedFiles,
          maskPath: maskPart?.path,
          scale: operation === "enhance" ? scale : undefined
        });
        return reply.code(202).send(ok(task, "任务已进入本地处理队列"));
      } catch (error) {
        await fs.rm(inputDir, { recursive: true, force: true });
        return sendRouteError(reply, error);
      } finally {
        releaseReservation();
      }
    }
  );

  app.get(
    "/api/v1/tools/image-ai/tasks/:taskId",
    {
      schema: {
        params: TaskIdParamsSchema,
        response: { 200: apiSuccessSchema(ImageAiTaskSchema), 400: ApiFailureSchema, 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const { taskId } = request.params as { taskId: string };
      const task = manager.get(taskId);
      return task ? ok(task) : reply.code(404).send(fail("TASK_NOT_FOUND", "任务不存在或已过期"));
    }
  );

  app.delete(
    "/api/v1/tools/image-ai/tasks/:taskId",
    {
      schema: {
        params: TaskIdParamsSchema,
        response: { 200: apiSuccessSchema(ImageAiTaskSchema), 400: ApiFailureSchema, 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const { taskId } = request.params as { taskId: string };
      const task = await manager.cancel(taskId);
      return task ? ok(task, "取消请求已提交") : reply.code(404).send(fail("TASK_NOT_FOUND", "任务不存在或已过期"));
    }
  );

  app.get(
    "/api/v1/tools/image-ai/tasks/:taskId/files/:resultId",
    {
      schema: {
        params: ImageAiResultParamsSchema,
        querystring: ImageAiFileQuerySchema,
        response: { 400: ApiFailureSchema, 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const { taskId, resultId } = request.params as { taskId: string; resultId: string };
      const { download } = request.query as { download?: string };
      const task = manager.getStored(taskId);
      const result = task?.results.find((item) => item.id === resultId);
      if (!result) return reply.code(404).send(fail("RESULT_NOT_FOUND", "处理结果不存在或已过期"));
      try {
        reply.type("image/png");
        const disposition = download === "1" ? "attachment" : "inline";
        reply.header(
          "Content-Disposition",
          `${disposition}; filename*=UTF-8''${encodeURIComponent(result.outputName)}`
        );
        return reply.send(await fs.readFile(result.outputPath));
      } catch {
        return reply.code(404).send(fail("RESULT_FILE_NOT_FOUND", "处理结果文件已被清理"));
      }
    }
  );

  app.get(
    "/api/v1/tools/image-ai/tasks/:taskId/download.zip",
    { schema: { params: TaskIdParamsSchema, response: { 400: ApiFailureSchema, 404: ApiFailureSchema } } },
    async (request, reply) => {
      const { taskId } = request.params as { taskId: string };
      const task = manager.getStored(taskId);
      if (!task || !task.results.length) {
        return reply.code(404).send(fail("RESULT_NOT_FOUND", "当前任务没有可下载结果"));
      }
      const archive = new ZipArchive({ zlib: { level: 6 } });
      for (const result of task.results) archive.file(result.outputPath, { name: result.outputName });
      void archive.finalize();
      reply.type("application/zip");
      reply.header("Content-Disposition", `attachment; filename="image-ai-${taskId}.zip"`);
      return reply.send(archive);
    }
  );
}

async function storeStream(stream: NodeJS.ReadableStream, destination: string, limit: number) {
  const handle = await fs.open(destination, "w");
  let size = 0;
  try {
    for await (const value of stream as AsyncIterable<Buffer | Uint8Array>) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      size += chunk.length;
      if (size > limit) throw Object.assign(new Error("上传文件超过大小限制"), { code: "FILE_TOO_LARGE" });
      await handle.write(chunk);
    }
  } catch (error) {
    await handle.close();
    await fs.rm(destination, { force: true });
    throw error;
  }
  await handle.close();
  return { path: destination, size };
}

function sendRouteError(
  reply: { code: (status: 400 | 413 | 422 | 503) => { send: (payload: unknown) => unknown } },
  error: unknown
) {
  const workerError = error instanceof ImageAiWorkerError ? error : undefined;
  const code =
    workerError?.code || (error instanceof Error && "code" in error ? String(error.code) : "IMAGE_AI_REQUEST_FAILED");
  const message = error instanceof Error ? error.message : "图片处理请求失败";
  const status = workerError
    ? workerError.status && workerError.status >= 400 && workerError.status < 500
      ? 422
      : 503
    : code === "FILE_TOO_LARGE"
      ? 413
      : 400;
  return reply.code(status).send(fail(code, message));
}

function toWorkerError(error: unknown) {
  return error instanceof ImageAiWorkerError
    ? error
    : new ImageAiWorkerError("IMAGE_AI_WORKER_UNAVAILABLE", "AI 推理服务当前不可用");
}
