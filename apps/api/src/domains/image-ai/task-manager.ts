/**
 * 中文模块说明：AI 图片处理领域，负责 Worker 任务、输入校验和结果文件
 */
import fs from "node:fs/promises";
import type { ImageAiHistory, ImageAiHistoryQuery, ImageAiOperation, ProductImageRecipe } from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { FileMetadataRepository } from "../../database/file-metadata";
import type { TaskStore } from "../../tasks/task-store";
import { createImageAiWorkerClient } from "./worker-client";
import type { ProductImageAssets } from "./product-image-renderer";
import { createProductImageExecutor } from "./product-image-executor";
import { listImageAiHistory } from "./history/query";
import { createImageAiHistoryRemoval } from "./history/removal";

import type { StoredInput, StoredImageAiTask } from "./types";
import { toPublicTask, toUnifiedTask } from "./task-projections";
import { createImageAiTaskPersistence } from "./task-persistence";
import { createImageAiInferenceExecutor } from "./inference-executor";
export type { StoredInput, StoredImageAiTask } from "./types";

export function createImageAiTaskManager(
  config: AppConfig,
  database: ToolboxDatabase,
  taskStore: TaskStore,
  fileMetadata?: FileMetadataRepository
) {
  const worker = createImageAiWorkerClient(config);
  const tasks = new Map<string, StoredImageAiTask>();
  const queue: string[] = [];
  const removals = new Map<string, Promise<boolean>>();
  const sourceLeases = new Map<string, number>();
  let processing = false;
  let reservations = 0;
  let cleanupTimer: NodeJS.Timeout | undefined;
  let drainPromise: Promise<void> | undefined;
  let stopped = false;
  const shutdownController = new AbortController();
  const { loadTasks, persist, commitTerminal } = createImageAiTaskPersistence(config, database, taskStore, {
    patchTask,
    rememberTask(task) {
      tasks.set(task.id, task);
    },
    refreshQueuePositions
  });
  const removeStoredTask = createImageAiHistoryRemoval(
    config,
    database,
    taskStore,
    (taskId) => {
      tasks.delete(taskId);
    },
    fileMetadata
  );
  const processComposition = createProductImageExecutor(
    config,
    shutdownController,
    { patchTask, persist },
    fileMetadata
  );
  const processTask = createImageAiInferenceExecutor(
    config,
    worker,
    shutdownController,
    { patchTask, persist, unique, processComposition, finishInference },
    fileMetadata
  );

  async function initialize() {
    // 恢复任务前先确保输入、输出和清单目录存在；启动后再清理过期任务并调度等待中的任务。
    await Promise.all([
      fs.mkdir(config.imageAiInputsDir, { recursive: true }),
      fs.mkdir(config.imageAiOutputsDir, { recursive: true }),
      fs.mkdir(config.imageAiTasksDir, { recursive: true })
    ]);
    await loadTasks();
    await cleanupExpired();
    cleanupTimer = setInterval(() => void cleanupExpired().catch(() => undefined), 60 * 60 * 1000);
    cleanupTimer.unref();
    scheduleDrain();
  }

  async function close() {
    // 关闭时停止接收新任务、终止 Worker 信号并等待当前 drain 收敛，避免留下 running 状态。
    stopped = true;
    const pending = queue.splice(0);
    shutdownController.abort();
    if (cleanupTimer) clearInterval(cleanupTimer);
    for (const id of pending) {
      const task = tasks.get(id);
      if (!task) continue;
      patchTask(task, {
        status: "failed",
        progress: 0,
        queuePosition: null,
        error: "应用退出，任务尚未执行，请手动重试"
      });
      await persist(task);
    }
    await drainPromise;
    await Promise.allSettled(removals.values());
  }

  function activeCount() {
    return Array.from(tasks.values()).filter((task) => task.status === "pending" || task.status === "running").length;
  }

  function tryReserveSlot() {
    // reservation 将“即将入队”的任务也计入额度，防止并发请求同时通过检查后突破队列上限。
    if (stopped || activeCount() + reservations >= config.imageAiQueueLimit) return undefined;
    reservations += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      reservations = Math.max(0, reservations - 1);
    };
  }

  async function create(input: {
    id: string;
    operation: ImageAiOperation;
    files: StoredInput[];
    maskPath?: string;
    scale?: 2 | 4;
    recipe?: ProductImageRecipe;
    assets?: ProductImageAssets;
    source?: { taskId: string; resultId: string };
    submissionKey?: string;
  }) {
    // 任务先落库再启动 drain；持久化失败会从内存队列回滚，调用方不会拿到不可恢复的 taskId。
    const now = new Date();
    const task: StoredImageAiTask = {
      id: input.id,
      operation: input.operation,
      status: "pending",
      progress: 0,
      queuePosition: queue.length + 1,
      scale: input.scale,
      results: [],
      warnings: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + config.imageAiRetentionHours * 60 * 60 * 1000).toISOString(),
      inputs: input.files,
      maskPath: input.maskPath,
      recipe: input.recipe,
      assets: input.assets,
      source: input.source,
      submissionKey: input.submissionKey
    };
    tasks.set(task.id, task);
    queue.push(task.id);
    refreshQueuePositions();
    try {
      await persist(task);
      await Promise.all(
        task.inputs.map((input) =>
          fileMetadata
            ?.registerIfExists({
              entityKind: "image-ai-input",
              entityId: task.id,
              filePath: input.path,
              mediaType: input.mimetype,
              owner: "local"
            })
            .catch(() => undefined)
        )
      );
      if (task.maskPath) {
        await fileMetadata
          ?.registerIfExists({
            entityKind: "image-ai-mask",
            entityId: task.id,
            filePath: task.maskPath,
            mediaType: "image/png",
            owner: "local"
          })
          .catch(() => undefined);
      }
      for (const filePath of Object.values(task.assets ?? {})) {
        if (filePath)
          await fileMetadata?.registerIfExists({
            entityKind: "image-ai-input",
            entityId: task.id,
            filePath,
            mediaType: "image/png",
            owner: "local"
          });
      }
    } catch (error) {
      tasks.delete(task.id);
      const queueIndex = queue.indexOf(task.id);
      if (queueIndex >= 0) queue.splice(queueIndex, 1);
      refreshQueuePositions();
      database.transaction(() => {
        database.remove("image-ai-task", task.id);
        for (const kind of ["image-ai-input", "image-ai-mask", "image-ai-result"])
          fileMetadata?.removeForEntity(kind, task.id);
        taskStore.remove(task.id);
      });
      throw error;
    }
    scheduleDrain();
    return toPublicTask(task);
  }

  function get(taskId: string) {
    const task = tasks.get(taskId);
    return task ? toPublicTask(task) : undefined;
  }

  function getStored(taskId: string) {
    return tasks.get(taskId);
  }

  function leaseSource(taskId: string) {
    const task = tasks.get(taskId);
    if (stopped || !task || removals.has(taskId) || task.status === "pending" || task.status === "running")
      throw Object.assign(new Error("来源记录不存在、正在删除或尚未处理完成"), { code: "IMAGE_AI_TASK_BUSY" });
    sourceLeases.set(taskId, (sourceLeases.get(taskId) ?? 0) + 1);
    let released = false;
    return {
      task,
      release() {
        if (!released) {
          released = true;
          const count = (sourceLeases.get(taskId) ?? 1) - 1;
          if (count) sourceLeases.set(taskId, count);
          else sourceLeases.delete(taskId);
        }
      }
    };
  }

  function findSubmission(key: string) {
    return Array.from(tasks.values()).find((task) => task.submissionKey === key);
  }

  function listHistory(query: ImageAiHistoryQuery): ImageAiHistory {
    return listImageAiHistory(tasks.values(), query);
  }

  function remove(taskId: string): Promise<boolean> {
    const existing = removals.get(taskId);
    if (existing) return existing;
    const task = tasks.get(taskId);
    if (!task) return Promise.resolve(false);
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(taskId)) return Promise.reject(new Error("记录 ID 无效"));
    if (task.status === "pending" || task.status === "running" || sourceLeases.has(taskId)) {
      return Promise.reject(
        Object.assign(new Error("任务尚在等待或处理中，请先取消并等待结束后再删除"), { code: "IMAGE_AI_TASK_BUSY" })
      );
    }
    const operation = removeStoredTask(taskId, task).finally(() => removals.delete(taskId));
    removals.set(taskId, operation);
    return operation;
  }

  async function cancel(taskId: string) {
    const task = tasks.get(taskId);
    if (!task) return undefined;
    if (task.status === "pending") {
      // 未开始的任务可以立即从队列移除；运行中的任务只设置取消标记，等当前图片处理完成后终止。
      const index = queue.indexOf(taskId);
      if (index >= 0) queue.splice(index, 1);
      patchTask(task, { status: "canceled", progress: 100, queuePosition: null });
      refreshQueuePositions();
      await persist(task);
    } else if (task.status === "running") {
      task.cancelRequested = true;
      task.warnings = unique([...task.warnings, "已请求取消，将在当前图片处理完成后停止"]);
      touch(task);
      await persist(task);
    }
    return toPublicTask(task);
  }

  async function cleanupExpired(now = Date.now()) {
    // Successful/partial results are permanent. Only expired result-less terminal tasks are temporary.
    for (const task of Array.from(tasks.values())) {
      if (
        task.results.length ||
        task.expiresAt === null ||
        !Number.isFinite(Date.parse(task.expiresAt)) ||
        Date.parse(task.expiresAt) > now ||
        task.status === "running" ||
        task.status === "pending"
      )
        continue;
      await remove(task.id);
    }
    refreshQueuePositions();
  }

  function scheduleDrain() {
    if (stopped || drainPromise) return;
    // 使用微任务合并同一事件循环内的多次入队，保证队列只有一个消费者。
    queueMicrotask(() => {
      if (stopped || drainPromise) return;
      const operation = drain()
        .catch(() => {
          if (stopped || !queue.length) return;
          const retry = setTimeout(scheduleDrain, 1000);
          retry.unref();
        })
        .finally(() => {
          if (drainPromise === operation) drainPromise = undefined;
        });
      drainPromise = operation;
    });
  }

  async function drain() {
    if (processing) return;
    processing = true;
    try {
      // 串行处理队列，模型 Worker 通常占用大量显存；失败由 scheduleDrain 延迟重试而不阻塞关闭。
      while (queue.length) {
        const taskId = queue.shift()!;
        refreshQueuePositions();
        const task = tasks.get(taskId);
        if (!task || task.status !== "pending") continue;
        await processTask(task);
      }
    } finally {
      processing = false;
    }
  }

  function finishInference(task: StoredImageAiTask, terminal: Parameters<typeof commitTerminal>[1]) {
    try {
      commitTerminal(task, terminal);
    } catch {
      // Preserve generated images and cancellation, but never claim a failed commit succeeded.
      const failure: Parameters<typeof commitTerminal>[1] = {
        status: terminal.status === "canceled" ? "canceled" : "failed",
        progress: 100,
        error: "写入留档记录失败，请检查数据库及磁盘空间后重试"
      };
      patchTask(task, failure);
      try {
        commitTerminal(task, failure);
      } catch {
        task.warnings = unique([
          ...task.warnings,
          "无法确认留档状态写入，重启后将按最后保存的记录恢复；已有图片文件未删除"
        ]);
        if (task.results.length) task.expiresAt = null;
        // Legacy upsert updates the in-memory projection even if its database remains unavailable.
        // No success event is emitted, and a subsequent restart uses the last durable domain record.
        try {
          taskStore.upsert(toUnifiedTask(task));
        } catch {
          // The explicit failure/warning remains visible without claiming it is durable.
        }
      }
    }
  }

  function refreshQueuePositions() {
    queue.forEach((taskId, index) => {
      const task = tasks.get(taskId);
      if (task) task.queuePosition = index + 1;
    });
  }

  return {
    initialize,
    close,
    activeCount,
    tryReserveSlot,
    create,
    get,
    getStored,
    leaseSource,
    findSubmission,
    listHistory,
    remove,
    cancel,
    cleanupExpired
  };
}

function patchTask(task: StoredImageAiTask, patch: Partial<StoredImageAiTask>) {
  Object.assign(task, patch);
  touch(task);
}

function touch(task: StoredImageAiTask) {
  task.updatedAt = new Date().toISOString();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
