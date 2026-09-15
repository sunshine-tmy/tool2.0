import {
  EDGE_TTS_MAX_TEXT_LENGTH,
  EDGE_TTS_RECOMMENDED_VOICES,
  type EdgeTtsCreateTaskInput,
  type EdgeTtsHealth,
  type EdgeTtsTask,
  type EdgeTtsTaskList,
  type EdgeTtsTaskSummary,
  type EdgeTtsVoice
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { FileMetadataRepository } from "../../database/file-metadata";
import type { TaskStore } from "../../tasks/task-store";
import { EdgeTtsQueue } from "./queue";
import { cloneTask, EdgeTtsTaskRepository } from "./task-repository";
import { EdgeTtsWorkerGateway } from "./worker-gateway";
import type { RuntimeInfo, TaskPaths, VoiceCache } from "./types";

const VOICE_CACHE_MS = 24 * 60 * 60 * 1000;
const HEALTH_CACHE_MS = 60 * 1000;

type EdgeTtsCreateResult =
  { success: true; task: EdgeTtsTask } | { success: false; statusCode: 409 | 429; code: string; message: string };

export class EdgeTtsTaskService {
  readonly repository: EdgeTtsTaskRepository;
  readonly queue: EdgeTtsQueue;
  private readonly runner: EdgeTtsWorkerGateway;
  private readonly allowedVoiceNames = new Set(EDGE_TTS_RECOMMENDED_VOICES.map((voice) => voice.shortName));
  private runtimeCache: { value: RuntimeInfo; expiresAt: number } | undefined;
  private voiceCache: VoiceCache | undefined;
  private cleanupTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly config: AppConfig,
    database: ToolboxDatabase,
    taskStore: TaskStore,
    fileMetadata?: FileMetadataRepository
  ) {
    this.repository = new EdgeTtsTaskRepository(config.edgeTtsTasksDir, database, taskStore, fileMetadata);
    this.runner = new EdgeTtsWorkerGateway(config);
    this.queue = new EdgeTtsQueue({ config, store: this.repository, runner: this.runner });
  }

  async initialize() {
    await this.repository.initialize();
    await this.repository.cleanupExpired();
    for (const task of this.repository.list()) {
      if (task.status === "queued") this.queue.enqueue(task.id);
    }
    this.cleanupTimer = setInterval(() => void this.repository.cleanupExpired(), 15 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  async close() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    await this.queue.close();
  }

  async health(): Promise<EdgeTtsHealth> {
    const runtime = await this.getRuntimeInfo();
    return {
      ...runtime,
      queue: {
        ...this.queue.stats(),
        concurrency: this.config.edgeTtsConcurrency,
        limit: this.config.edgeTtsQueueLimit
      },
      retentionDays: this.config.edgeTtsRetentionDays,
      maxTextLength: EDGE_TTS_MAX_TEXT_LENGTH,
      onlineService: true
    };
  }

  async getRuntimeInfo(force = false) {
    if (!force && this.runtimeCache && this.runtimeCache.expiresAt > Date.now()) return this.runtimeCache.value;
    const value = await this.runner.check();
    this.runtimeCache = { value, expiresAt: Date.now() + HEALTH_CACHE_MS };
    return value;
  }

  async getVoices() {
    if (this.voiceCache && this.voiceCache.expiresAt > Date.now()) {
      return { voices: this.voiceCache.voices, source: "live" as const };
    }
    const runtime = await this.getRuntimeInfo();
    if (!runtime.available) return { voices: fallbackVoices(), source: "fallback" as const };
    try {
      const live = await this.runner.listVoices();
      const recommended = new Set(EDGE_TTS_RECOMMENDED_VOICES.map((voice) => voice.shortName));
      const voices = live.map((voice) => ({ ...voice, suggested: recommended.has(voice.shortName) }));
      for (const voice of voices) this.allowedVoiceNames.add(voice.shortName);
      this.voiceCache = { voices, expiresAt: Date.now() + VOICE_CACHE_MS };
      return { voices, source: "live" as const };
    } catch {
      return { voices: fallbackVoices(), source: "fallback" as const };
    }
  }

  getAllowedVoiceNames() {
    return this.allowedVoiceNames;
  }

  async create(input: EdgeTtsCreateTaskInput): Promise<EdgeTtsCreateResult> {
    const runtime = await this.getRuntimeInfo();
    if (!runtime.available)
      return { success: false, statusCode: 409, code: "EDGE_TTS_NOT_INSTALLED", message: runtime.message };
    const stats = this.queue.stats();
    if (stats.active + stats.queued >= this.config.edgeTtsQueueLimit) {
      return { success: false, statusCode: 429, code: "EDGE_TTS_QUEUE_FULL", message: "语音生成队列已满，请稍后重试" };
    }
    const task = await this.repository.create(input, this.config.edgeTtsRetentionDays);
    this.queue.enqueue(task.id);
    return { success: true, task };
  }

  get(id: string) {
    const task = this.repository.get(id);
    return task ? toPublicTask(task) : undefined;
  }

  list(page: number, pageSize: number): EdgeTtsTaskList {
    const tasks = this.repository.list();
    const total = tasks.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return {
      tasks: tasks.slice(start, start + pageSize).map(toTaskSummary),
      pagination: { page: safePage, pageSize, total, totalPages }
    };
  }

  async remove(id: string) {
    if (!this.repository.get(id)) return false;
    await this.queue.cancel(id);
    await this.repository.remove(id);
    return true;
  }

  paths(id: string): TaskPaths {
    return this.repository.paths(id);
  }
}

export function toPublicTask(task: EdgeTtsTask): EdgeTtsTask {
  const publicTask = cloneTask(task);
  if (task.status === "completed") {
    publicTask.audioUrl = `/api/v1/tools/edge-tts/tasks/${task.id}/audio`;
    publicTask.downloadUrl = `/api/v1/tools/edge-tts/tasks/${task.id}/download`;
    if (task.includeSubtitles) publicTask.subtitleUrl = `/api/v1/tools/edge-tts/tasks/${task.id}/subtitle`;
  }
  return publicTask;
}

function toTaskSummary(task: EdgeTtsTask): EdgeTtsTaskSummary {
  const { text, ...summary } = toPublicTask(task);
  return { ...summary, textPreview: text.length > 120 ? `${text.slice(0, 120)}…` : text };
}

function fallbackVoices(): EdgeTtsVoice[] {
  return EDGE_TTS_RECOMMENDED_VOICES.map((voice) => ({ ...voice }));
}
