import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../../../config";
import type { ToolboxDatabase } from "../../../database/toolbox-database";
import type { FileMetadataRepository } from "../../../database/file-metadata";
import type { TaskStore } from "../../../tasks/task-store";
import type { StoredImageAiTask } from "../types";

// Only the manager validates/locks the identity and owns the task map. Forgetting runs synchronously after the transaction.
export function createImageAiHistoryRemoval(
  config: Pick<AppConfig, "imageAiInputsDir" | "imageAiOutputsDir" | "imageAiTasksDir">,
  database: ToolboxDatabase,
  taskStore: TaskStore,
  forgetTask: (taskId: string) => void,
  fileMetadata?: FileMetadataRepository
) {
  return async function removeStoredTask(taskId: string, task: StoredImageAiTask) {
    // Only fixed, application-owned task directories are removed, never paths from payloads.
    // Keep the record if any file removal fails so the user can retry without losing its identity.
    const fileRemovals = await Promise.allSettled([
      fs.rm(path.join(config.imageAiInputsDir, taskId), { recursive: true, force: true }),
      fs.rm(path.join(config.imageAiOutputsDir, taskId), { recursive: true, force: true }),
      fs.rm(path.join(config.imageAiTasksDir, `${taskId}.json`), { force: true })
    ]);
    // Wait for every filesystem operation before permitting retry; on Windows
    // an early rejection must not leave another removal racing the next request.
    const failedRemoval = fileRemovals.find((result) => result.status === "rejected");
    if (failedRemoval?.status === "rejected") throw failedRemoval.reason;
    database.transaction(() => {
      database.remove("image-ai-task", taskId);
      for (const kind of ["image-ai-input", "image-ai-mask", "image-ai-result"])
        fileMetadata?.removeForEntity(kind, taskId);
      // Older versions registered inputs against per-image entity ids.
      task.inputs.forEach((_input, index) => fileMetadata?.removeForEntity("image-ai-input", `${taskId}-${index + 1}`));
      taskStore.remove(taskId);
    });
    forgetTask(taskId);
    return true;
  };
}
