import { registerSingleImageToolRoute } from "../image-tools";
import type { AppConfig } from "../../config";
import type { TaskStore } from "../../tasks/task-store";
import type { FastifyInstance } from "fastify";
import type { FileMetadataRepository } from "../../database/file-metadata";

export function registerImageCompressRoutes(
  app: FastifyInstance,
  config: AppConfig,
  taskStore: TaskStore,
  fileMetadata?: FileMetadataRepository
) {
  registerSingleImageToolRoute({
    app,
    config,
    taskStore,
    fileMetadata,
    toolId: "image-compress"
  });
}
