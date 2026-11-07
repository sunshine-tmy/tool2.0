/**
 * 中文模块说明：视频去字幕领域，负责任务队列、Worker 调用和本机结果文件
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { TaskStore } from "../../tasks/task-store";
import type { StoredVideoAiTask } from "./types";
import { toEntity, toUnifiedTask } from "./task-projections";

type RestoreHooks = {
  patchTask: (task: StoredVideoAiTask, patch: Partial<StoredVideoAiTask>) => void;
  rememberTask: (task: StoredVideoAiTask) => void;
  refreshQueuePositions: () => void;
};

export function createVideoAiTaskPersistence(
  config: Pick<AppConfig, "videoAiTasksDir" | "videoAiInputsDir" | "videoAiOutputsDir">,
  database: ToolboxDatabase,
  taskStore: TaskStore,
  { patchTask, rememberTask, refreshQueuePositions }: RestoreHooks
) {
  async function loadTasks() {
    if (!database.isDomainInitialized("video-ai-task")) {
      // Legacy JSON manifests are migrated once, then the database is authoritative.
      const files = await fs.readdir(config.videoAiTasksDir).catch(() => [] as string[]);
      for (const file of files.filter((name) => name.endsWith(".json"))) {
        try {
          const task = JSON.parse(
            await fs.readFile(path.join(config.videoAiTasksDir, file), "utf8")
          ) as StoredVideoAiTask;
          if (isReadableStoredTask(task) && hasOwnedPaths(task)) database.upsert(toEntity(task));
        } catch {
          // Invalid legacy manifests stay untouched for manual recovery.
        }
      }
      database.markDomainInitialized("video-ai-task");
    }
    for (const entity of database.list("video-ai-task")) {
      const task = entity.payload as StoredVideoAiTask;
      if (!isReadableStoredTask(task) || task.id !== entity.id || !hasOwnedPaths(task)) continue;
      let changed = false;
      if (task.status === "pending" || task.status === "running") {
        patchTask(task, {
          status: "failed",
          progress: 100,
          queuePosition: null,
          error: "任务因服务重启而中断，请重新提交"
        });
        changed = true;
      }
      if (task.outputPath && task.expiresAt !== null) {
        task.expiresAt = null;
        changed = true;
      }
      if (changed) database.upsert(toEntity(task));
      rememberTask(task);
      taskStore.upsert(toUnifiedTask(task));
    }
    refreshQueuePositions();
  }

  async function persist(task: StoredVideoAiTask) {
    if (task.outputPath && task.status !== "pending" && task.status !== "running") task.expiresAt = null;
    database.upsert(toEntity(task));
    taskStore.upsert(toUnifiedTask(task));
  }

  function commitTerminal(
    task: StoredVideoAiTask,
    terminal: Partial<StoredVideoAiTask> & { status: "completed" | "failed" | "canceled" }
  ) {
    const next = { ...task };
    patchTask(next, terminal);
    if (next.outputPath) next.expiresAt = null;
    taskStore.commit(
      toUnifiedTask(next),
      () => database.upsert(toEntity(next)),
      () => Object.assign(task, next)
    );
  }

  function hasOwnedPaths(task: StoredVideoAiTask) {
    const matches = (actual: unknown, root: string, ...parts: string[]) =>
      typeof actual === "string" && path.resolve(actual) === path.resolve(root, ...parts);
    return (
      matches(task.inputPath, config.videoAiInputsDir, task.id, "input.bin") &&
      (!task.outputPath || matches(task.outputPath, config.videoAiOutputsDir, `${task.id}.mp4`)) &&
      (!task.progressPath || matches(task.progressPath, config.videoAiTasksDir, task.id, "progress.json")) &&
      (!task.cancelFlagPath || matches(task.cancelFlagPath, config.videoAiTasksDir, task.id, "cancel.flag"))
    );
  }

  return { loadTasks, persist, commitTerminal };
}

function isReadableStoredTask(task: StoredVideoAiTask) {
  return (
    task &&
    /^[A-Za-z0-9_-]{6,64}$/.test(task.id) &&
    ["fast", "balanced", "extreme", "delogo"].includes(task.mode) &&
    ["pending", "running", "completed", "failed", "canceled"].includes(task.status) &&
    typeof task.inputPath === "string" &&
    typeof task.inputName === "string" &&
    Number.isFinite(task.inputBytes) &&
    Array.isArray(task.segments) &&
    Array.isArray(task.warnings) &&
    typeof task.createdAt === "string"
  );
}
