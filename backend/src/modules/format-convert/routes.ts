import { registerSingleImageToolRoute } from "../image-tools";
import type { AppConfig } from "../../config";
import type { TaskStore } from "../../tasks/task-store";
import type { FastifyInstance } from "fastify";

export function registerFormatConvertRoutes(app: FastifyInstance, config: AppConfig, taskStore: TaskStore) {
  registerSingleImageToolRoute({
    app,
    config,
    taskStore,
    toolId: "format-convert"
  });
}
