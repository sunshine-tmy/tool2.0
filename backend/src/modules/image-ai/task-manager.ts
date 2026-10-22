/**
 * 中文模块说明：AI 图片处理领域，负责 Worker 任务、输入校验和结果文件
 */
import fs from "node:fs/promises";
import path from "node:path";
import type {
  ImageAiHistory,
  ImageAiHistoryQuery,
  ImageAiOperation,
  ImageAiResult,
  ImageAiTask,
  ProductImageRecipe
} from "@toolbox/shared";
import sharp from "sharp";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { FileMetadataRepository } from "../../database/file-metadata";
import type { Task, TaskStore } from "../../tasks/task-store";
import { createImageAiWorkerClient } from "./worker-client";
import { commitStagedFile } from "../../storage/file-commit-gateway";
import { renderProductImage, type ProductImageAssets } from "./product-image-renderer";
import { ownedImageFile, requireProductSpace } from "./product-image-files";

export type StoredInput = {
  path: string;
  originalName: string;
  mimetype: string;
  size: number;
  width: number;
  height: number;
};

type StoredResult = ImageAiResult & { outputPath: string };

export type StoredImageAiTask = Omit<ImageAiTask, "results" | "inputs"> & {
  inputs: StoredInput[];
  maskPath?: string;
  results: StoredResult[];
  cancelRequested?: boolean;
  assets?: ProductImageAssets;
  submissionKey?: string;
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
  const removals = new Map<string, Promise<boolean>>();
  const sourceLeases = new Map<string, number>();
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
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const keyword = query.keyword?.trim().toLocaleLowerCase() ?? "";
    const matching = Array.from(tasks.values())
      .filter(
        (task) =>
          (!query.operation || task.operation === query.operation) &&
          (!query.status || task.status === query.status) &&
          (!keyword ||
            task.id.toLocaleLowerCase().includes(keyword) ||
            task.inputs.some((input) => input.originalName.toLocaleLowerCase().includes(keyword)))
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    return {
      items: matching.slice((page - 1) * pageSize, page * pageSize).map(toPublicTask),
      total: matching.length,
      page,
      pageSize
    };
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
    const operation = (async () => {
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
        task.inputs.forEach((_input, index) =>
          fileMetadata?.removeForEntity("image-ai-input", `${taskId}-${index + 1}`)
        );
        taskStore.remove(taskId);
      });
      tasks.delete(taskId);
      return true;
    })().finally(() => removals.delete(taskId));
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

  async function processTask(task: StoredImageAiTask) {
    if (task.operation === "product_image") return processComposition(task);
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

  async function processComposition(task: StoredImageAiTask) {
    const outputDir = path.join(config.imageAiOutputsDir, task.id);
    const staging = path.join(outputDir, ".product.staging.png");
    const outputPath = path.join(outputDir, "product.png");
    let terminal: Partial<StoredImageAiTask> = { status: "failed", phase: "保存失败" };
    patchTask(task, { status: "running", phase: "准备素材", progress: 0, queuePosition: null });
    await persist(task);
    try {
      if (!task.recipe || !task.assets) throw new Error("商品图配方或素材缺失");
      for (const file of Object.values(task.assets))
        if (file) await ownedImageFile(config.imageAiInputsDir, task.id, file);
      await requireProductSpace(config.imageAiOutputsDir, task.recipe.canvas.width * task.recipe.canvas.height);
      await fs.mkdir(outputDir, { recursive: true });
      const rendered = await renderProductImage(task.assets, task.recipe, staging, (phase) => {
        patchTask(task, { phase });
        void persist(task).catch(() => undefined);
      });
      if (task.cancelRequested || shutdownController.signal.aborted) {
        terminal = { status: "canceled", phase: "已取消" };
      } else {
        patchTask(task, { phase: "保存记录" });
        await commitStagedFile(staging, outputPath);
        await fileMetadata?.registerIfExists({
          entityKind: "image-ai-result",
          entityId: task.id,
          id: `${task.id}-1`,
          filePath: outputPath,
          mediaType: "image/png",
          owner: "local"
        });
        task.results = [
          {
            id: `${task.id}-1`,
            originalName: task.inputs[0].originalName,
            outputName: "product.png",
            outputPath,
            downloadUrl: `/api/v1/tools/image-ai/tasks/${task.id}/files/${task.id}-1`,
            width: task.recipe.canvas.width,
            height: task.recipe.canvas.height,
            provider: "sharp",
            model: "商品图渲染器 v1",
            warnings: rendered.enlarged ? ["商品经过普通插值放大，不等同于 AI 清晰度增强"] : []
          }
        ];
        terminal = { status: "completed", progress: 100, phase: "已留档" };
      }
    } catch (error) {
      task.results = [];
      fileMetadata?.removeForEntity("image-ai-result", task.id);
      const code = error instanceof Error && "code" in error ? error.code : undefined;
      terminal = {
        status: "failed",
        phase: "保存失败",
        error:
          code === "ENOSPC"
            ? "磁盘空间不足，请先释放空间"
            : error instanceof Error &&
                /^(没有可见商品主体|原图缺失|原图与抠图|请选择背景图片|可用磁盘空间不足)/.test(error.message)
              ? error.message
              : "商品图保存失败，请检查素材是否完整、磁盘空间及目录访问权限"
      };
      await fs.rm(outputPath, { force: true }).catch(() => {
        task.warnings.push("临时输出清理失败，稍后可删除此失败记录");
      });
    } finally {
      await fs.rm(staging, { force: true }).catch(() => {
        task.warnings.push("临时渲染文件清理失败，稍后可删除此记录");
      });
    }
    if ((task.cancelRequested || shutdownController.signal.aborted) && terminal.status === "completed") {
      task.results = [];
      fileMetadata?.removeForEntity("image-ai-result", task.id);
      await fs.rm(outputPath, { force: true }).catch(() => {
        task.warnings.push("取消后的输出清理失败，稍后可删除此记录");
      });
      terminal = { status: "canceled", phase: "已取消" };
    }
    // Publish terminal status only after all file operations finish. Persist synchronously
    // in the same turn so readers/deletion cannot observe a success with the old TTL.
    const previousExpiry = task.expiresAt;
    patchTask(task, terminal);
    try {
      await persist(task);
    } catch {
      // Do not claim success if the archive transaction could not be persisted.
      patchTask(task, { status: "running", phase: "回收未留档输出" });
      task.results = [];
      task.expiresAt = previousExpiry;
      await fs.rm(outputPath, { force: true }).catch(() => {
        task.warnings.push("未留档输出清理失败，稍后可删除此失败记录");
      });
      fileMetadata?.removeForEntity("image-ai-result", task.id);
      patchTask(task, { status: "failed", phase: "保存失败", error: "写入留档记录失败，请检查数据库及磁盘空间后重试" });
      await persist(task).catch(() => undefined);
    }
  }

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
    if (task.results.length && task.status !== "pending" && task.status !== "running") task.expiresAt = null;
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
    leaseSource,
    findSubmission,
    listHistory,
    remove,
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
    background_remove: "cutout",
    product_image: "product"
  };
  return `${stem}-${index + 1}-${suffix[operation]}.png`;
}

async function sanitizePng(outputPath: string) {
  const temporary = `${outputPath}.sanitized.png`;
  await sharp(outputPath, { limitInputPixels: 100_000_000 }).rotate().png({ compressionLevel: 9 }).toFile(temporary);
  await fs.rm(outputPath, { force: true });
  await commitStagedFile(temporary, outputPath);
}
