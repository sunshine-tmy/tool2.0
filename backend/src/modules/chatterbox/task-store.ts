import fsp from "node:fs/promises";
import path from "node:path";
import { CHATTERBOX_LANGUAGES, type ChatterboxTask, type ChatterboxTaskStatus } from "@toolbox/shared";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { FileMetadataRepository } from "../../database/file-metadata";
import type { Task, TaskStore } from "../../tasks/task-store";

type ChatterboxTaskPaths = {
  dir: string;
  meta: string;
  referenceUpload: string;
  reference: string;
  outputWav: string;
  audio: string;
  subtitle: string;
};

export type ChatterboxCreateInput = Pick<
  ChatterboxTask,
  | "text"
  | "language"
  | "referenceFileName"
  | "referenceDurationSeconds"
  | "authorization"
  | "consentConfirmed"
  | "exaggeration"
  | "cfgWeight"
  | "temperature"
  | "seed"
  | "includeSubtitles"
  | "fileName"
>;

export class ChatterboxTaskStore {
  private readonly tasks = new Map<string, ChatterboxTask>();

  constructor(
    private readonly root: string,
    private readonly database: ToolboxDatabase,
    private readonly taskStore: TaskStore,
    private readonly fileMetadata?: FileMetadataRepository
  ) {}

  async initialize() {
    await fsp.mkdir(this.root, { recursive: true });
    if (!this.database.isDomainInitialized("chatterbox-task")) {
      for (const entry of await fsp.readdir(this.root, { withFileTypes: true })) {
        if (!entry.isDirectory() || !isSafeTaskId(entry.name)) continue;
        try {
          const task = JSON.parse(await fsp.readFile(this.paths(entry.name).meta, "utf8")) as ChatterboxTask;
          if (!isStoredTask(task) || task.id !== entry.name) continue;
          await this.write(task);
        } catch {
          // Invalid legacy metadata stays untouched for manual recovery.
        }
      }
      this.database.markDomainInitialized("chatterbox-task");
    }
    for (const entity of this.database.list("chatterbox-task")) {
      const task = entity.payload as ChatterboxTask;
      if (!isStoredTask(task)) continue;
      if (task.status === "queued" || task.status === "processing") {
        task.status = "failed";
        task.progress = 100;
        task.error = "INTERRUPTED";
        task.updatedAt = new Date().toISOString();
        await this.write(task);
      }
      this.tasks.set(task.id, task);
    }
  }

  async create(id: string, input: ChatterboxCreateInput, retentionDays: number) {
    const now = new Date();
    const task: ChatterboxTask = {
      ...input,
      id,
      engine: "chatterbox-multilingual-v3",
      status: "queued",
      progress: 0,
      characterCount: input.text.length,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000).toISOString()
    };
    await this.write(task);
    this.tasks.set(id, task);
    return cloneTask(task);
  }

  get(id: string) {
    const task = this.tasks.get(id);
    return task ? cloneTask(task) : undefined;
  }

  list() {
    return [...this.tasks.values()].map(cloneTask).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async update(
    id: string,
    patch: Partial<Pick<ChatterboxTask, "status" | "progress" | "audioBytes" | "audioDurationSeconds" | "error">>
  ) {
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
    this.database.remove("chatterbox-task", id);
    this.fileMetadata?.removeForEntity("chatterbox-task", id);
    this.taskStore.remove(id);
    await fsp.rm(this.paths(id).dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    return true;
  }

  async cleanupExpired(isActive: (id: string) => boolean = () => false, now = Date.now()) {
    const expired = [...this.tasks.values()].filter((task) => !isActive(task.id) && Date.parse(task.expiresAt) <= now);
    await Promise.all(expired.map((task) => this.remove(task.id)));
    return expired.length;
  }

  paths(id: string): ChatterboxTaskPaths {
    if (!isSafeTaskId(id)) throw new Error("Invalid Chatterbox task id");
    const dir = path.join(this.root, id);
    return {
      dir,
      meta: path.join(dir, "meta.json"),
      referenceUpload: path.join(dir, "reference-upload"),
      reference: path.join(dir, "reference.wav"),
      outputWav: path.join(dir, "output.wav"),
      audio: path.join(dir, "audio.mp3"),
      subtitle: path.join(dir, "subtitle.srt")
    };
  }

  private async write(task: ChatterboxTask) {
    this.database.upsert({
      id: task.id,
      kind: "chatterbox-task",
      status: task.status,
      payload: task,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    });
    this.taskStore.upsert(toUnifiedChatterboxTask(task));
    if (task.status === "completed") {
      const paths = this.paths(task.id);
      await Promise.all([
        this.fileMetadata
          ?.registerIfExists({
            entityKind: "chatterbox-task",
            entityId: task.id,
            filePath: paths.audio,
            mediaType: "audio/mpeg",
            owner: "local"
          })
          .catch(() => undefined),
        task.includeSubtitles
          ? this.fileMetadata
              ?.registerIfExists({
                entityKind: "chatterbox-task",
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

function toUnifiedChatterboxTask(task: ChatterboxTask): Task {
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
    toolId: "chatterbox",
    status,
    progress: task.progress,
    outputPath: task.status === "completed" ? "audio.mp3" : undefined,
    error: task.status === "cancelled" ? "CANCELLED" : task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

function cloneTask(task: ChatterboxTask): ChatterboxTask {
  return { ...task };
}

function isStoredTask(value: unknown): value is ChatterboxTask {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.engine === "chatterbox-multilingual-v3" &&
    isTaskStatus(value.status) &&
    typeof value.text === "string" &&
    typeof value.language === "string" &&
    (CHATTERBOX_LANGUAGES as readonly string[]).includes(value.language) &&
    typeof value.createdAt === "string" &&
    typeof value.expiresAt === "string"
  );
}

function isTaskStatus(value: unknown): value is ChatterboxTaskStatus {
  return (
    value === "queued" || value === "processing" || value === "completed" || value === "failed" || value === "cancelled"
  );
}

function isSafeTaskId(value: string) {
  return /^[A-Za-z0-9_-]{6,64}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
