import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { TaskStore } from "../../tasks/task-store";
import type { StoredImageAiTask } from "./types";
import { toEntity, toUnifiedTask } from "./task-projections";

// The manager owns state and timestamp updates. These callbacks run synchronously in the original restore order.
type RestoreHooks = {
  patchTask: (task: StoredImageAiTask, patch: Partial<StoredImageAiTask>) => void;
  rememberTask: (task: StoredImageAiTask) => void;
  refreshQueuePositions: () => void;
};

export function createImageAiTaskPersistence(
  config: Pick<AppConfig, "imageAiTasksDir">,
  database: ToolboxDatabase,
  taskStore: TaskStore,
  { patchTask, rememberTask, refreshQueuePositions }: RestoreHooks
) {
  async function loadTasks() {
    if (!database.isDomainInitialized("image-ai-task")) {
      const files = await fs.readdir(config.imageAiTasksDir).catch(() => [] as string[]);
      for (const file of files.filter((name) => name.endsWith(".json"))) {
        try {
          const task = JSON.parse(
            await fs.readFile(path.join(config.imageAiTasksDir, file), "utf8")
          ) as StoredImageAiTask;
          if (!isReadableStoredTask(task)) continue;
          database.upsert(toEntity(task));
        } catch {
          // Invalid legacy manifests stay untouched for manual recovery.
        }
      }
      database.markDomainInitialized("image-ai-task");
    }
    for (const entity of database.list("image-ai-task")) {
      const task = entity.payload as StoredImageAiTask;
      if (!isReadableStoredTask(task)) continue;
      let changed = false;
      if (task.status === "pending" || task.status === "running") {
        patchTask(task, {
          status: "failed",
          progress: 100,
          queuePosition: null,
          error: "任务因服务重启而中断，请手动重试"
        });
        changed = true;
      }
      // Preserve existing results before the first post-upgrade expiry sweep, even if their old TTL passed.
      if (task.results.length && task.expiresAt !== null) {
        task.expiresAt = null;
        changed = true;
      }
      if (changed) database.upsert(toEntity(task));
      rememberTask(task);
      taskStore.upsert(toUnifiedTask(task));
    }
    refreshQueuePositions();
  }

  async function persist(task: StoredImageAiTask) {
    if (task.results.length && task.status !== "pending" && task.status !== "running") task.expiresAt = null;
    database.upsert(toEntity(task));
    taskStore.upsert(toUnifiedTask(task));
  }

  function commitTerminal(
    task: StoredImageAiTask,
    terminal: Partial<StoredImageAiTask> & { status: "completed" | "failed" | "canceled" }
  ) {
    const next = { ...task };
    patchTask(next, terminal);
    if (next.results.length) next.expiresAt = null;
    taskStore.commit(
      toUnifiedTask(next),
      () => database.upsert(toEntity(next)),
      () => Object.assign(task, next)
    );
  }

  return { loadTasks, persist, commitTerminal };
}

function isReadableStoredTask(task: StoredImageAiTask) {
  return (
    task &&
    /^[A-Za-z0-9_-]{6,64}$/.test(task.id) &&
    ["watermark_remove", "enhance", "background_remove", "product_image"].includes(task.operation) &&
    ["pending", "running", "completed", "failed", "canceled"].includes(task.status) &&
    Array.isArray(task.inputs) &&
    task.inputs.every((input) => input && typeof input.originalName === "string" && typeof input.path === "string") &&
    Array.isArray(task.results) &&
    task.results.every((result) => result && typeof result.id === "string" && typeof result.outputPath === "string") &&
    Array.isArray(task.warnings) &&
    typeof task.createdAt === "string"
  );
}
