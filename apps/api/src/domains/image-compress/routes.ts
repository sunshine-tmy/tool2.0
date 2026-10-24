/**
 * 中文模块说明：后端应用层，负责 后端公共服务、配置或基础设施能力
 */
import { registerImageCompressHandlers } from "./compression-routes";
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
  registerImageCompressHandlers({
    app,
    config,
    taskStore,
    fileMetadata,
    toolId: "image-compress"
  });
}
