/**
 * 中文模块说明：图片工具领域，负责压缩、格式校验和输出文件
 */
import type { FastifyInstance } from "fastify";
import { ApiFailureSchema, ImageCompressResultSchema, apiSuccessSchema, fail, ok } from "@toolbox/shared";
import type { AppConfig } from "../config";
import type { FileMetadataRepository } from "../database/file-metadata";
import type { TaskStore } from "../tasks/task-store";
import { ImageArchiveError, ImageArchiveGateway } from "./image-compress-file-gateway";
import { ImageInputError, readImageMultipart } from "./image-compress-input";
import { ImageCompressionService } from "./image-compress-service";

type RegisterImageToolRoutesOptions = {
  app: FastifyInstance;
  config: AppConfig;
  taskStore: TaskStore;
  fileMetadata?: FileMetadataRepository;
};

export function registerSingleImageToolRoute({
  app,
  config,
  taskStore,
  fileMetadata,
  toolId
}: RegisterImageToolRoutesOptions & { toolId: "image-compress" }) {
  const service = new ImageCompressionService(config, taskStore, fileMetadata);
  const archive = new ImageArchiveGateway(config, taskStore);

  app.post(
    `/api/v1/tools/${toolId}`,
    {
      schema: {
        response: {
          200: apiSuccessSchema(ImageCompressResultSchema),
          400: ApiFailureSchema,
          413: ApiFailureSchema,
          415: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      const task = taskStore.create(toolId);
      taskStore.update(task.id, { status: "running", progress: 15 });
      try {
        const input = await readImageMultipart(request);
        return ok(await service.process(task, input.input, input.originalName, input.fields));
      } catch (error) {
        if (error instanceof ImageInputError) {
          service.fail(task.id, error.message);
          return reply.code(error.statusCode).send(fail(error.code, error.message));
        }
        service.fail(task.id, error instanceof Error ? error.message : "Image processing failed");
        return reply.code(400).send(fail("IMAGE_PROCESSING_FAILED", "Image processing failed"));
      }
    }
  );

  app.post(
    `/api/v1/tools/${toolId}/download.zip`,
    {
      schema: {
        response: { 400: ApiFailureSchema, 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const requestedFiles = parseBatchDownloadFiles(request.body);
      if (!requestedFiles.length)
        return reply.code(400).send(fail("FILES_REQUIRED", "Please select completed images to download"));
      try {
        const result = await archive.create(requestedFiles, toolId);
        reply.type("application/zip");
        reply.header("content-disposition", `attachment; filename="image-compress-${Date.now()}.zip"`);
        return reply.send(result);
      } catch (error) {
        if (error instanceof ImageArchiveError)
          return reply.code(error.statusCode).send(fail(error.code, error.message));
        return reply.code(400).send(fail("ARCHIVE_FAILED", "Unable to create image archive"));
      }
    }
  );
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
