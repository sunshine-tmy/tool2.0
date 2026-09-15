/**
 * 中文模块说明：AI 图片处理领域，负责 Worker 任务、输入校验和结果文件
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { ImageAiOperation, ImageAiResult, ImageAiTask } from "@toolbox/shared";
import sharp from "sharp";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { FileMetadataRepository } from "../../database/file-metadata";
import type { Task, TaskStore } from "../../tasks/task-store";
import { createImageAiWorkerClient } from "./worker-client";
import { commitStagedFile } from "../../storage/file-commit-gateway";

export type StoredInput = {
  path: string;
  originalName: string;
  mimetype: string;
  size: number;
  width: number;
  height: number;
};

type StoredResult = ImageAiResult & { outputPath: string };

type StoredImageAiTask = Omit<ImageAiTask, "results"> & {
  inputs: StoredInput[];
  maskPath?: string;
  results: StoredResult[];
  cancelRequested?: boolean;
};

export function createImageAiTaskManager(
  config: AppConfig,
  database: ToolboxDatabase,
  taskStore: TaskStore,
  fileMetadata?: FileMetadataRepository
) {
  const worker = createImageAiWorkerClient(config);
  const tasks = new Map<string, StoredImageAiTask>();
  const queue: string[] = [];
  let processing = false;
  let reservations = 0;
  let cleanupTimer: NodeJS.Timeout | undefined;
  let drainPromise: Promise<void> | undefined;
  let stopped = false;
  const shutdownController = new AbortController();

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
    queue.length = 0;
    shutdownController.abort();
    if (cleanupTimer) clearInterval(cleanupTimer);
    await drainPromise;
  }

  function activeCount() {
    return Array.from(tasks.values()).filter((task) => task.status === "pending" || task.status === "running").length;
  }

  function tryReserveSlot() {
    // reservation 将“即将入队”的任务也计入额度，防止并发请求同时通过检查后突破队列上限。
    if (activeCount() + reservations >= config.imageAiQueueLimit) return undefined;
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
      maskPath: input.maskPath
    };
    tasks.set(task.id, task);
    queue.push(task.id);
    refreshQueuePositions();
    try {
      await persist(task);
      await Promise.all(
        task.inputs.map((input, index) =>
          fileMetadata
            ?.registerIfExists({
              entityKind: "image-ai-input",
              entityId: `${task.id}-${index + 1}`,
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
    } catch (error) {
      tasks.delete(task.id);
      const queueIndex = queue.indexOf(task.id);
      if (queueIndex >= 0) queue.splice(queueIndex, 1);
      refreshQueuePositions();
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
    // 过期任务、关联元数据和结果目录一起回收；运行中的任务永不在定时清理中删除。
    for (const task of Array.from(tasks.values())) {
      if (Date.parse(task.expiresAt) > now || task.status === "running") continue;
      const queueIndex = queue.indexOf(task.id);
      if (queueIndex >= 0) queue.splice(queueIndex, 1);
      tasks.delete(task.id);
      database.remove("image-ai-task", task.id);
      fileMetadata?.removeForEntity("image-ai-input", task.id);
      fileMetadata?.removeForEntity("image-ai-mask", task.id);
      fileMetadata?.removeForEntity("image-ai-result", task.id);
      taskStore.remove(task.id);
      await Promise.all([
        fs.rm(path.join(config.imageAiInputsDir, task.id), { recursive: true, force: true }),
        fs.rm(path.join(config.imageAiOutputsDir, task.id), { recursive: true, force: true })
      ]);
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

  async function processTask(task: StoredImageAiTask) {
    // 每张图片独立记录结果和警告，部分失败仍可完成任务；服务关闭则显式标记为可重试的中断。
    patchTask(task, { status: "running", progress: 5, queuePosition: null });
    await persist(task);
    const outputDir = path.join(config.imageAiOutputsDir, task.id);
    await fs.mkdir(outputDir, { recursive: true });
    let failures = 0;

    for (let index = 0; index < task.inputs.length; index += 1) {
      if (task.cancelRequested) break;
      const input = task.inputs[index];
      const outputName = outputFileName(input.originalName, task.operation, index);
      const outputPath = path.join(outputDir, outputName);

      try {
        const inference = await worker.process({
          operation: task.operation,
          inputPath: input.path,
          outputPath,
          maskPath: task.maskPath,
          scale: task.scale,
          signal: shutdownController.signal
        });
        await sanitizePng(outputPath);
        const metadata = await sharp(outputPath).metadata();
        if (!metadata.width || !metadata.height) throw new Error("AI 输出图片尺寸无效");
        task.results.push({
          id: `${task.id}-${index + 1}`,
          originalName: input.originalName,
          outputName,
          outputPath,
          downloadUrl: `/api/v1/tools/image-ai/tasks/${task.id}/files/${task.id}-${index + 1}`,
          width: metadata.width,
          height: metadata.height,
          provider: inference.provider,
          model: inference.model,
          warnings: inference.warnings ?? []
        });
        task.warnings = unique([...task.warnings, ...(inference.warnings ?? [])]);
        await fileMetadata
          ?.registerIfExists({
            entityKind: "image-ai-result",
            entityId: task.id,
            filePath: outputPath,
            mediaType: "image/png",
            owner: "local",
            id: `${task.id}-${index + 1}`
          })
          .catch(() => undefined);
      } catch (error) {
        if (shutdownController.signal.aborted) {
          patchTask(task, {
            status: "failed",
            progress: 100,
            error: "任务因服务关闭而中断，请手动重试"
          });
          await persist(task);
          return;
        }
        failures += 1;
        task.warnings = unique([
          ...task.warnings,
          `${input.originalName}：${error instanceof Error ? error.message : "处理失败"}`
        ]);
      }

      patchTask(task, {
        progress: Math.min(95, Math.round(10 + ((index + 1) / task.inputs.length) * 85))
      });
      await persist(task);
    }

    if (task.cancelRequested) {
      patchTask(task, { status: "canceled", progress: 100 });
    } else if (failures === task.inputs.length) {
      patchTask(task, {
        status: "failed",
        progress: 100,
        error: "所有图片均处理失败，请检查本地模型与推理服务状态"
      });
    } else {
      if (failures > 0) task.warnings = unique([...task.warnings, `${failures} 张图片处理失败`]);
      patchTask(task, { status: "completed", progress: 100 });
    }
    await persist(task);
  }

  async function loadTasks() {
    if (!database.isDomainInitialized("image-ai-task")) {
      const files = await fs.readdir(config.imageAiTasksDir).catch(() => [] as string[]);
      for (const file of files.filter((name) => name.endsWith(".json"))) {
        try {
          const task = JSON.parse(
            await fs.readFile(path.join(config.imageAiTasksDir, file), "utf8")
          ) as StoredImageAiTask;
          if (!task.id || !task.operation) continue;
          database.upsert(toEntity(task));
        } catch {
          // Invalid legacy manifests stay untouched for manual recovery.
        }
      }
      database.markDomainInitialized("image-ai-task");
    }
    for (const entity of database.list("image-ai-task")) {
      const task = entity.payload as StoredImageAiTask;
      if (!task.id || !task.operation) continue;
      if (task.status === "pending" || task.status === "running") {
        patchTask(task, {
          status: "failed",
          progress: 100,
          queuePosition: null,
          error: "任务因服务重启而中断，请手动重试"
        });
        database.upsert(toEntity(task));
      }
      tasks.set(task.id, task);
      taskStore.upsert(toUnifiedTask(task));
    }
    refreshQueuePositions();
  }

  function refreshQueuePositions() {
    queue.forEach((taskId, index) => {
      const task = tasks.get(taskId);
      if (task) task.queuePosition = index + 1;
    });
  }

  async function persist(task: StoredImageAiTask) {
    database.upsert(toEntity(task));
    taskStore.upsert(toUnifiedTask(task));
  }

  return {
    initialize,
    close,
    activeCount,
    tryReserveSlot,
    create,
    get,
    getStored,
    cancel,
    cleanupExpired
  };
}

function toUnifiedTask(task: StoredImageAiTask): Task {
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

function toEntity(task: StoredImageAiTask) {
  return {
    id: task.id,
    kind: "image-ai-task",
    status: task.status,
    payload: task,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

function toPublicTask(task: StoredImageAiTask): ImageAiTask {
  return {
    id: task.id,
    operation: task.operation,
    status: task.status,
    progress: task.progress,
    queuePosition: task.queuePosition,
    scale: task.scale,
    results: task.results.map(({ outputPath: _outputPath, ...result }) => result),
    warnings: [...task.warnings],
    error: task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    expiresAt: task.expiresAt
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

function outputFileName(originalName: string, operation: ImageAiOperation, index: number) {
  const stem =
    path
      .parse(path.basename(originalName))
      .name.replace(/[^\p{L}\p{N}._-]+/gu, "-")
      .slice(0, 80) || `image-${index + 1}`;
  const suffix: Record<ImageAiOperation, string> = {
    watermark_remove: "clean",
    enhance: "enhanced",
    background_remove: "cutout"
  };
  return `${stem}-${index + 1}-${suffix[operation]}.png`;
}

async function sanitizePng(outputPath: string) {
  const temporary = `${outputPath}.sanitized.png`;
  await sharp(outputPath, { limitInputPixels: 100_000_000 }).rotate().png({ compressionLevel: 9 }).toFile(temporary);
  await fs.rm(outputPath, { force: true });
  await commitStagedFile(temporary, outputPath);
}
