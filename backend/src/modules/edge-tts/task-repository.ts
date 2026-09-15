/**
 * 中文模块说明：Edge-TTS 配音领域，负责任务、Worker 网关、文件和队列
 */
import fsp from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import {
  EDGE_TTS_LANGUAGES,
  type EdgeTtsCreateTaskInput,
  type EdgeTtsTask,
  type EdgeTtsTaskStatus
} from "@toolbox/shared";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { FileMetadataRepository } from "../../database/file-metadata";
import type { Task, TaskStore } from "../../tasks/task-store";
import { WORKER_PROTOCOL_VERSION } from "@toolbox/shared";
import type { TaskPaths } from "./types";

const TASK_KIND = "edge-tts-task";

export class EdgeTtsTaskRepository {
  private readonly tasks = new Map<string, EdgeTtsTask>();

  constructor(
    private readonly root: string,
    private readonly database: ToolboxDatabase,
    private readonly taskStore: TaskStore,
    private readonly fileMetadata?: FileMetadataRepository
  ) {}

  async initialize() {
    await fsp.mkdir(this.root, { recursive: true });
    const stored = this.database.list(TASK_KIND);
    if (stored.length) {
      for (const entity of stored) {
        const task = entity.payload as EdgeTtsTask;
        if (!isStoredTask(task)) continue;
        if (task.status === "queued" || task.status === "processing") {
          task.status = "failed";
          task.progress = 100;
          task.error = "INTERRUPTED";
          task.updatedAt = new Date().toISOString();
          await this.write(task);
        } else {
          this.taskStore.upsert(toUnifiedEdgeTask(task));
        }
        this.tasks.set(task.id, task);
      }
      return;
    }
    const entries = await fsp.readdir(this.root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !isSafeTaskId(entry.name)) continue;
      try {
        const task = JSON.parse(await fsp.readFile(this.paths(entry.name).meta, "utf8")) as EdgeTtsTask;
        if (!isStoredTask(task) || task.id !== entry.name) continue;
        if (task.status === "queued" || task.status === "processing") {
          task.status = "failed";
          task.progress = 100;
          task.error = "INTERRUPTED";
          task.updatedAt = new Date().toISOString();
          await this.write(task);
        }
        this.tasks.set(task.id, task);
        await this.write(task);
      } catch {
        // Ignore incomplete or manually modified task folders.
      }
    }
  }

  async create(input: EdgeTtsCreateTaskInput, retentionDays: number) {
    const now = new Date();
    const task: EdgeTtsTask = {
      ...input,
      id: nanoid(12),
      status: "queued",
      progress: 0,
      characterCount: input.text.length,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000).toISOString()
    };
    const paths = this.paths(task.id);
    await fsp.mkdir(paths.dir, { recursive: true });
    await writeJsonAtomic(paths.request, { protocolVersion: WORKER_PROTOCOL_VERSION, ...input });
    await this.write(task);
    this.tasks.set(task.id, task);
    return cloneTask(task);
  }

  get(id: string) {
    const task = this.tasks.get(id);
    return task ? cloneTask(task) : undefined;
  }

  list() {
    return [...this.tasks.values()].map(cloneTask).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async update(id: string, patch: Partial<Pick<EdgeTtsTask, "status" | "progress" | "audioBytes" | "error">>) {
    const current = this.tasks.get(id);
    if (!current) return undefined;
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    if (patch.error === undefined && (patch.status === "processing" || patch.status === "completed")) delete next.error;
    await this.write(next);
    this.tasks.set(id, next);
    return cloneTask(next);
  }

  async remove(id: string) {
    if (!isSafeTaskId(id)) return false;
    this.tasks.delete(id);
    this.database.remove(TASK_KIND, id);
    this.fileMetadata?.removeForEntity(TASK_KIND, id);
    this.taskStore.remove(id);
    await fsp.rm(this.paths(id).dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    return true;
  }

  async cleanupExpired(now = Date.now()) {
    const expired = [...this.tasks.values()].filter((task) => Date.parse(task.expiresAt) <= now);
    await Promise.all(expired.map((task) => this.remove(task.id)));
    return expired.length;
  }

  paths(id: string): TaskPaths {
    if (!isSafeTaskId(id)) throw new Error("Invalid Edge-TTS task id");
    const dir = path.join(this.root, id);
    return {
      dir,
      meta: path.join(dir, "meta.json"),
      request: path.join(dir, "request.json"),
      audio: path.join(dir, "audio.mp3"),
      audioTemp: path.join(dir, "audio.tmp.mp3"),
      subtitle: path.join(dir, "subtitle.srt"),
      subtitleTemp: path.join(dir, "subtitle.tmp.srt")
    };
  }

  private async write(task: EdgeTtsTask) {
    await writeJsonAtomic(this.paths(task.id).meta, task);
    this.database.upsert({
      id: task.id,
      kind: TASK_KIND,
      status: task.status,
      payload: task,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    });
    this.taskStore.upsert(toUnifiedEdgeTask(task));
    if (task.status === "completed") {
      const paths = this.paths(task.id);
      await Promise.all([
        this.fileMetadata
          ?.registerIfExists({
            entityKind: TASK_KIND,
            entityId: task.id,
            filePath: paths.audio,
            mediaType: "audio/mpeg",
            owner: "local"
          })
          .catch(() => undefined),
        task.includeSubtitles
          ? this.fileMetadata
              ?.registerIfExists({
                entityKind: TASK_KIND,
                entityId: task.id,
                filePath: paths.subtitle,
                mediaType: "text/plain",
                owner: "local"
              })
              .catch(() => undefined)
          : undefined
      ]);
    }
  }
}

function toUnifiedEdgeTask(task: EdgeTtsTask): Task {
  const status: Task["status"] =
    task.status === "queued"
      ? "pending"
      : task.status === "processing"
        ? "running"
        : task.status === "cancelled"
          ? "failed"
          : task.status;
  return {
    id: task.id,
    toolId: "edge-tts",
    status,
    progress: task.progress,
    outputPath: task.status === "completed" ? "audio.mp3" : undefined,
    error: task.status === "cancelled" ? "CANCELLED" : task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

export function cloneTask(task: EdgeTtsTask): EdgeTtsTask {
  return { ...task };
}

function isStoredTask(value: unknown): value is EdgeTtsTask {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    isTaskStatus(value.status) &&
    typeof value.text === "string" &&
    isSupportedLanguage(value.language) &&
    typeof value.voice === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.expiresAt === "string"
  );
}

function isTaskStatus(value: unknown): value is EdgeTtsTaskStatus {
  return (
    value === "queued" || value === "processing" || value === "completed" || value === "failed" || value === "cancelled"
  );
}

function isSupportedLanguage(value: unknown): value is EdgeTtsTask["language"] {
  return typeof value === "string" && (EDGE_TTS_LANGUAGES as readonly string[]).includes(value);
}

function isSafeTaskId(value: string) {
  return /^[A-Za-z0-9_-]{6,64}$/.test(value);
}

function writeJsonAtomic(filePath: string, value: unknown) {
  return (async () => {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fsp.writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
    await fsp.rename(tempPath, filePath);
  })();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
