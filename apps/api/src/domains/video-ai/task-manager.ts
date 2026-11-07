/**
 * 中文模块说明：视频去字幕领域，负责任务队列、Worker 调用和本机结果文件
 */
import fs from "node:fs/promises";
import path from "node:path";
import type {
  VideoAiHistory,
  VideoAiHistoryQuery,
  VideoAiMode,
  VideoAiRect,
  VideoAiSegment,
  VideoAiTask,
  VideoAiTimedRegion
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { TaskStore } from "../../tasks/task-store";
import { createVideoAiTaskPersistence } from "./task-persistence";
import { createVideoAiWorkerClient, VideoAiWorkerError } from "./worker-client";
import { toPublicTask } from "./task-projections";
import type { StoredVideoAiTask } from "./types";
import { probeVideo } from "./media";
import { VIDEO_AI_MAX_STORAGE_BYTES } from "@toolbox/shared";

const PROGRESS_POLL_MS = 500;
const PROGRESS_PERSIST_MS = 2000;

export function createVideoAiTaskManager(config: AppConfig, database: ToolboxDatabase, taskStore: TaskStore) {
  const worker = createVideoAiWorkerClient(config);
  const tasks = new Map<string, StoredVideoAiTask>();
  const queue: string[] = [];
  const removals = new Map<string, Promise<boolean>>();
  const shutdown = new AbortController();
  let processing = false;
  let reservations = 0;
  let stopped = false;
  let cleanupTimer: NodeJS.Timeout | undefined;
  let drainPromise: Promise<void> | undefined;

  const { loadTasks, persist, commitTerminal } = createVideoAiTaskPersistence(config, database, taskStore, {
    patchTask,
    rememberTask: (task) => tasks.set(task.id, task),
    refreshQueuePositions
  });

  async function initialize() {
    await Promise.all([
      fs.mkdir(config.videoAiInputsDir, { recursive: true }),
      fs.mkdir(config.videoAiOutputsDir, { recursive: true }),
      fs.mkdir(config.videoAiTasksDir, { recursive: true })
    ]);
    await loadTasks();
    await cleanupExpired();
    cleanupTimer = setInterval(() => void cleanupExpired().catch(() => undefined), 60 * 60 * 1000);
    cleanupTimer.unref();
    scheduleDrain();
  }

  async function close() {
    stopped = true;
    const pending = queue.splice(0);
    for (const task of tasks.values())
      if (task.status === "running" && task.cancelFlagPath)
        await fs.writeFile(task.cancelFlagPath, "1").catch(() => undefined);
    shutdown.abort();
    if (cleanupTimer) clearInterval(cleanupTimer);
    for (const id of pending) {
      const task = tasks.get(id);
      if (!task) continue;
      patchTask(task, {
        status: "failed",
        progress: 100,
        queuePosition: null,
        error: "应用退出，任务尚未执行，请重新提交"
      });
      await persist(task);
      await fs.rm(task.inputPath, { force: true }).catch(() => undefined);
    }
    await drainPromise;
    await Promise.allSettled(removals.values());
  }

  function activeCount() {
    return Array.from(tasks.values()).filter((task) => task.status === "pending" || task.status === "running").length;
  }

  function tryReserveSlot() {
    if (stopped || activeCount() + reservations >= config.videoAiQueueLimit) return undefined;
    reservations += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      reservations = Math.max(0, reservations - 1);
    };
  }

  function outputBytesTotal() {
    return Array.from(tasks.values()).reduce((total, task) => total + (task.outputBytes ?? 0), 0);
  }
  function storageBytesTotal() {
    return (
      outputBytesTotal() +
      Array.from(tasks.values()).reduce((total, task) => total + (task.inputRetained ? task.inputBytes : 0), 0)
    );
  }

  async function ensureStorageCapacity(inputBytes: number) {
    const pendingBytes = Array.from(tasks.values()).reduce(
      (total, task) => total + (task.status === "pending" || task.status === "running" ? task.inputBytes * 2 : 0),
      0
    );
    if (storageBytesTotal() + pendingBytes + inputBytes * 2 > VIDEO_AI_MAX_STORAGE_BYTES)
      throw Object.assign(new Error("留档原视频、结果和排队任务的预计空间超过 20 GiB，请删除旧记录或缩短视频"), {
        code: "VIDEO_AI_STORAGE_FULL"
      });
    const disk = await fs.statfs(config.videoAiDir);
    if (disk.bavail * disk.bsize < pendingBytes + inputBytes * 2 + 256 * 1024 ** 2)
      throw Object.assign(new Error("磁盘可用空间不足以保存中间文件和结果，请释放空间后重试"), {
        code: "VIDEO_AI_STORAGE_FULL"
      });
  }

  async function create(input: {
    id: string;
    mode: VideoAiMode;
    inputPath: string;
    inputName: string;
    inputBytes: number;
    manualArea?: VideoAiRect;
    segments?: VideoAiSegment[];
    manualRanges?: VideoAiTimedRegion[];
    inputMetadata?: VideoAiTask["inputMetadata"];
  }) {
    const now = new Date();
    const taskDir = path.join(config.videoAiTasksDir, input.id);
    const segments = (input.segments ?? []).map((segment) => ({
      rect: { ...segment.rect },
      startFrame: segment.startFrame,
      endFrame: segment.endFrame
    }));
    const task: StoredVideoAiTask = {
      id: input.id,
      mode: input.mode,
      status: "pending",
      progress: 0,
      queuePosition: queue.length + 1,
      inputName: input.inputName,
      inputBytes: input.inputBytes,
      inputPath: input.inputPath,
      segments,
      manualArea: input.manualArea,
      manualRanges: input.manualRanges?.map((range) => ({ ...range, rects: range.rects.map((rect) => ({ ...rect })) })),
      inputMetadata: input.inputMetadata,
      inputRetained: false,
      warnings: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + config.videoAiRetentionHours * 60 * 60 * 1000).toISOString(),
      progressPath: path.join(taskDir, "progress.json"),
      cancelFlagPath: path.join(taskDir, "cancel.flag")
    };
    tasks.set(task.id, task);
    queue.push(task.id);
    refreshQueuePositions();
    try {
      await fs.mkdir(taskDir, { recursive: true });
      await persist(task);
    } catch (error) {
      tasks.delete(task.id);
      const index = queue.indexOf(task.id);
      if (index >= 0) queue.splice(index, 1);
      refreshQueuePositions();
      database.transaction(() => {
        database.remove("video-ai-task", task.id);
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

  function listHistory(query: VideoAiHistoryQuery): VideoAiHistory {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const filtered = Array.from(tasks.values())
      .filter((task) => !query.status || task.status === query.status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      items: filtered.slice((page - 1) * pageSize, page * pageSize).map(toPublicTask),
      total: filtered.length,
      page,
      pageSize
    };
  }

  async function cancel(taskId: string) {
    const task = tasks.get(taskId);
    if (!task) return undefined;
    if (task.status === "pending") {
      const index = queue.indexOf(taskId);
      if (index >= 0) queue.splice(index, 1);
      patchTask(task, {
        status: "canceled",
        progress: 100,
        queuePosition: null,
        error: "已取消",
        warnings: unique([...task.warnings, "任务已取消，未生成输出"])
      });
      refreshQueuePositions();
      await persist(task);
      await fs.rm(task.inputPath, { force: true }).catch(() => undefined);
    } else if (task.status === "running") {
      // The worker polls the flag between frame chunks, so cancellation stops at
      // the next chunk boundary instead of leaving a partial output behind.
      task.cancelRequested = true;
      if (task.cancelFlagPath) await fs.writeFile(task.cancelFlagPath, "1").catch(() => undefined);
      patchTask(task, { warnings: unique([...task.warnings, "已请求取消，将在当前分块处理完成后停止"]) });
      await persist(task);
    }
    return toPublicTask(task);
  }

  function remove(taskId: string): Promise<boolean> {
    const existing = removals.get(taskId);
    if (existing) return existing;
    const task = tasks.get(taskId);
    if (!task) return Promise.resolve(false);
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(taskId)) return Promise.reject(new Error("记录 ID 无效"));
    if (task.status === "pending" || task.status === "running") {
      return Promise.reject(
        Object.assign(new Error("任务尚在等待或处理中，请先取消并等待结束后再删除"), { code: "VIDEO_AI_TASK_BUSY" })
      );
    }
    const operation = (async () => {
      await fs.rm(path.join(config.videoAiTasksDir, taskId), { recursive: true, force: true });
      if (task.outputPath) await fs.rm(task.outputPath, { force: true });
      if (task.inputPath) await fs.rm(task.inputPath, { force: true });
      await fs.rm(path.join(config.videoAiTasksDir, `${taskId}.json`), { force: true });
      database.transaction(() => {
        database.remove("video-ai-task", taskId);
        taskStore.remove(taskId);
      });
      tasks.delete(taskId);
      return true;
    })().finally(() => removals.delete(taskId));
    removals.set(taskId, operation);
    return operation;
  }

  async function cleanupExpired(now = Date.now()) {
    for (const task of Array.from(tasks.values())) {
      if (
        task.outputPath ||
        task.expiresAt === null ||
        !Number.isFinite(Date.parse(task.expiresAt)) ||
        Date.parse(task.expiresAt) > now ||
        task.status === "running" ||
        task.status === "pending"
      )
        continue;
      await remove(task.id).catch(() => undefined);
    }
    refreshQueuePositions();
  }

  function scheduleDrain() {
    if (stopped || drainPromise) return;
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
      // Video inference saturates VRAM: exactly one task runs at a time.
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

  async function processTask(task: StoredVideoAiTask) {
    const outputPath = path.join(config.videoAiOutputsDir, `${task.id}.mp4`);
    const progressPath = task.progressPath!;
    const cancelFlagPath = task.cancelFlagPath!;
    let lastPersisted = Date.now();
    const polling = setInterval(() => {
      void fs
        .readFile(progressPath, "utf8")
        .then((raw) => {
          if (task.status !== "running") return;
          const parsed = JSON.parse(raw) as {
            stage?: string;
            percent?: number;
            processedFrames?: number;
            totalFrames?: number;
          };
          if (typeof parsed.percent !== "number" || !Number.isFinite(parsed.percent)) return;
          patchTask(task, {
            progress: Math.max(task.progress, Math.min(99, parsed.percent)),
            phase: phaseLabel(parsed.stage)
          });
          if (
            Number.isSafeInteger(parsed.totalFrames) &&
            parsed.totalFrames! > 0 &&
            Number.isSafeInteger(parsed.processedFrames) &&
            parsed.processedFrames! >= 0
          )
            patchTask(task, {
              processedFrames: Math.min(parsed.processedFrames!, parsed.totalFrames!),
              totalFrames: parsed.totalFrames
            });
          // UI updates ride the TaskStore broadcast; database writes are throttled
          // so a 6-hour job cannot hammer SQLite with two writes per second.
          if (Date.now() - lastPersisted >= PROGRESS_PERSIST_MS) {
            lastPersisted = Date.now();
            return persist(task);
          }
          return undefined;
        })
        .catch(() => undefined);
    }, PROGRESS_POLL_MS);
    polling.unref();

    try {
      await fs.rm(cancelFlagPath, { force: true });
      patchTask(task, { status: "running", progress: 1, queuePosition: null, phase: "detecting" });
      await persist(task);
      const explicit = task.manualArea ? undefined : task.segments.length ? task.segments : undefined;
      const metadata = await probeVideo(config, task.inputPath, shutdown.signal);
      const result = await worker.process({
        mode: task.mode,
        inputPath: task.inputPath,
        outputPath,
        progressPath,
        cancelFlagPath,
        segments: explicit,
        manualArea: task.manualArea,
        signal: shutdown.signal
      });
      if (task.cancelRequested) throw new VideoAiWorkerError("TASK_CANCELLED", "任务已取消");
      const stat = await fs.stat(outputPath);
      if (
        !stat.isFile() ||
        !stat.size ||
        storageBytesTotal() + task.inputBytes + stat.size > VIDEO_AI_MAX_STORAGE_BYTES
      )
        throw new Error("输出为空或原视频及结果留档超过 20 GiB，请检查视频或清理历史记录");
      const outputInfo = await probeVideo(config, outputPath, shutdown.signal);
      if (
        outputInfo.width !== metadata.width ||
        outputInfo.height !== metadata.height ||
        outputInfo.audioStreams !== metadata.audioStreams ||
        Math.abs(outputInfo.fps - metadata.fps) > metadata.fps * 0.01 ||
        Math.abs(outputInfo.durationMs - metadata.durationMs) >
          Math.max(500, (2 * metadata.durationMs) / metadata.frameCount)
      )
        throw new Error("输出视频的分辨率或时长与原视频不一致，未提交该结果");
      commitTerminal(task, {
        status: "completed",
        progress: 100,
        phase: "done",
        outputPath,
        outputBytes: stat.size,
        outputWidth: outputInfo.width,
        outputHeight: outputInfo.height,
        outputDurationMs: outputInfo.durationMs,
        inputRetained: true,
        inputMetadata: {
          width: metadata.width,
          height: metadata.height,
          fps: metadata.fps,
          frameCount: metadata.frameCount,
          durationMs: metadata.durationMs
        },
        processedFrames: result.frameCount,
        totalFrames: result.frameCount,
        segments: task.segments.length
          ? task.segments
          : result.segments.map((rect) => ({ rect, startFrame: 0, endFrame: metadata.frameCount - 1 })),
        warnings: unique([...task.warnings, ...result.warnings])
      });
    } catch (error) {
      if (task.cancelRequested || (error instanceof VideoAiWorkerError && error.code === "TASK_CANCELLED")) {
        commitTerminal(task, {
          status: "canceled",
          progress: 100,
          phase: "canceled",
          error: "已取消",
          warnings: unique([...task.warnings, "任务已取消，未生成输出"])
        });
        await fs.rm(outputPath, { force: true });
      } else {
        const message = error instanceof Error ? error.message : "视频处理失败";
        commitTerminal(task, {
          status: "failed",
          // A terminal failure is not 100% processed; keep the last real snapshot.
          progress: task.progress,
          phase: "failed",
          error: message,
          warnings: unique([...task.warnings, message])
        });
        await fs.rm(outputPath, { force: true });
      }
    } finally {
      clearInterval(polling);
      await fs.rm(progressPath, { force: true }).catch(() => undefined);
      await fs.rm(cancelFlagPath, { force: true }).catch(() => undefined);
      if (!task.inputRetained) await fs.rm(task.inputPath, { force: true }).catch(() => undefined);
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
    outputBytesTotal,
    storageBytesTotal,
    ensureStorageCapacity,
    create,
    get,
    getStored,
    listHistory,
    cancel,
    remove,
    cleanupExpired,
    worker,
    detect: (inputPath: string) => worker.detect(inputPath, shutdown.signal)
  };
}

function phaseLabel(stage: string | undefined) {
  if (stage === "load") return "loading";
  if (stage === "flow") return "estimating-flow";
  if (stage === "propagate") return "propagating";
  if (stage === "detect") return "detecting";
  if (stage === "repair") return "repairing";
  if (stage === "mux") return "muxing";
  return undefined;
}

function patchTask(task: StoredVideoAiTask, patch: Partial<StoredVideoAiTask>) {
  Object.assign(task, patch);
  task.updatedAt = new Date().toISOString();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
