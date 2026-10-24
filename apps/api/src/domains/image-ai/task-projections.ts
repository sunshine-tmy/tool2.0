import type { ImageAiTask } from "@toolbox/shared";
import type { Task } from "../../tasks/task-store";
import type { StoredImageAiTask } from "./types";

export function toUnifiedTask(task: StoredImageAiTask): Task {
  return {
    id: task.id,
    toolId: "image-ai",
    status: task.status === "canceled" ? "failed" : task.status,
    progress: task.progress,
    outputPath: task.results[0]?.outputPath,
    error: task.status === "canceled" ? "CANCELLED" : task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

export function toEntity(task: StoredImageAiTask) {
  return {
    id: task.id,
    kind: "image-ai-task",
    status: task.status,
    payload: task,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

export function toPublicTask(task: StoredImageAiTask): ImageAiTask {
  return {
    id: task.id,
    operation: task.operation,
    status: task.status,
    progress: task.progress,
    queuePosition: task.queuePosition,
    scale: task.scale,
    recipe: task.recipe,
    source: task.source,
    phase: task.phase,
    results: task.results.map(({ outputPath: _outputPath, ...result }) => result),
    inputs: task.inputs.map(({ originalName, mimetype, size, width, height }) => ({
      originalName,
      mimetype,
      size,
      width,
      height
    })),
    warnings: [...task.warnings],
    error: task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    expiresAt: task.expiresAt
  };
}
