import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { FastifyInstance, FastifyReply } from "fastify";
import { nanoid } from "nanoid";
import {
  EDGE_TTS_LANGUAGES,
  EDGE_TTS_MAX_TEXT_LENGTH,
  EDGE_TTS_RECOMMENDED_VOICES,
  fail,
  ok,
  type EdgeTtsCreateTaskInput,
  type EdgeTtsHealth,
  type EdgeTtsLanguage,
  type EdgeTtsTask,
  type EdgeTtsTaskList,
  type EdgeTtsTaskStatus,
  type EdgeTtsTaskSummary,
  type EdgeTtsVoice
} from "@toolbox/shared";
import type { AppConfig } from "../config";
import type { ToolboxDatabase } from "../database/toolbox-database";

const execFileAsync = promisify(execFile);
const VOICE_CACHE_MS = 24 * 60 * 60 * 1000;
const HEALTH_CACHE_MS = 60 * 1000;

type RegisterEdgeTtsRoutesOptions = {
  app: FastifyInstance;
  config: AppConfig;
  database: ToolboxDatabase;
};

type RuntimeInfo = { available: boolean; version?: string; message: string };
type VoiceCache = { voices: EdgeTtsVoice[]; expiresAt: number };

type TaskPaths = {
  dir: string;
  meta: string;
  request: string;
  audio: string;
  audioTemp: string;
  subtitle: string;
  subtitleTemp: string;
};

export async function registerEdgeTtsRoutes({ app, config, database }: RegisterEdgeTtsRoutesOptions) {
  const store = new EdgeTtsTaskStore(config.edgeTtsTasksDir, database);
  const runner = new EdgeTtsRunner(config);
  await store.initialize();
  await store.cleanupExpired();

  let runtimeCache: { value: RuntimeInfo; expiresAt: number } | undefined;
  let voiceCache: VoiceCache | undefined;
  const allowedVoiceNames = new Set(EDGE_TTS_RECOMMENDED_VOICES.map((voice) => voice.shortName));

  const getRuntimeInfo = async (force = false) => {
    if (!force && runtimeCache && runtimeCache.expiresAt > Date.now()) return runtimeCache.value;
    const value = await runner.check();
    runtimeCache = { value, expiresAt: Date.now() + HEALTH_CACHE_MS };
    return value;
  };

  const getVoices = async () => {
    if (voiceCache && voiceCache.expiresAt > Date.now()) return voiceCache.voices;
    const runtime = await getRuntimeInfo();
    if (!runtime.available) return EDGE_TTS_RECOMMENDED_VOICES.map((voice) => ({ ...voice }));
    try {
      const live = await runner.listVoices();
      const recommended = new Set(EDGE_TTS_RECOMMENDED_VOICES.map((voice) => voice.shortName));
      const voices = live.map((voice) => ({ ...voice, suggested: recommended.has(voice.shortName) }));
      for (const voice of voices) allowedVoiceNames.add(voice.shortName);
      voiceCache = { voices, expiresAt: Date.now() + VOICE_CACHE_MS };
      return voices;
    } catch {
      return EDGE_TTS_RECOMMENDED_VOICES.map((voice) => ({ ...voice }));
    }
  };

  const queue = new EdgeTtsQueue({ config, store, runner });
  for (const task of store.listInternal()) {
    if (task.status === "queued") queue.enqueue(task.id);
  }

  app.addHook("onClose", async () => {
    queue.close();
  });

  app.get("/api/v1/tools/edge-tts/health", async () => {
    const runtime = await getRuntimeInfo();
    const stats = queue.stats();
    const data: EdgeTtsHealth = {
      ...runtime,
      queue: {
        ...stats,
        concurrency: config.edgeTtsConcurrency,
        limit: config.edgeTtsQueueLimit
      },
      retentionDays: config.edgeTtsRetentionDays,
      maxTextLength: EDGE_TTS_MAX_TEXT_LENGTH,
      onlineService: true
    };
    return ok(data);
  });

  app.get("/api/v1/tools/edge-tts/voices", async (request, reply) => {
    const query = request.query as { language?: string };
    if (query.language && !isSupportedLanguage(query.language)) {
      return reply.code(400).send(fail("EDGE_TTS_LANGUAGE_INVALID", "不支持该语言"));
    }
    const voices = (await getVoices()).filter((voice) => !query.language || voice.locale === query.language);
    return ok({ voices, source: voiceCache ? "live" : "fallback" });
  });

  app.post("/api/v1/tools/edge-tts/tasks", async (request, reply) => {
    const parsed = parseCreateInput(request.body, allowedVoiceNames);
    if (!parsed.success) return reply.code(parsed.statusCode).send(fail(parsed.code, parsed.message));

    const runtime = await getRuntimeInfo();
    if (!runtime.available) {
      return reply.code(409).send(fail("EDGE_TTS_NOT_INSTALLED", runtime.message));
    }
    if (queue.stats().active + queue.stats().queued >= config.edgeTtsQueueLimit) {
      return reply.code(429).send(fail("EDGE_TTS_QUEUE_FULL", "语音生成队列已满，请稍后重试"));
    }

    const task = await store.create(parsed.value, config.edgeTtsRetentionDays);
    queue.enqueue(task.id);
    return reply.code(202).send(ok(toPublicTask(task)));
  });

  app.get("/api/v1/tools/edge-tts/tasks", async (request) => {
    const query = request.query as { page?: string; pageSize?: string };
    const page = positiveInteger(query.page, 1);
    const pageSize = Math.min(50, positiveInteger(query.pageSize, 10));
    const tasks = store.listInternal();
    const total = tasks.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const data: EdgeTtsTaskList = {
      tasks: tasks.slice(start, start + pageSize).map(toTaskSummary),
      pagination: { page: safePage, pageSize, total, totalPages }
    };
    return ok(data);
  });

  app.get("/api/v1/tools/edge-tts/tasks/:taskId", async (request, reply) => {
    const task = store.get(taskIdFrom(request.params));
    if (!task) return reply.code(404).send(fail("EDGE_TTS_TASK_NOT_FOUND", "语音任务不存在"));
    return ok(toPublicTask(task));
  });

  app.get("/api/v1/tools/edge-tts/tasks/:taskId/audio", async (request, reply) => {
    return sendTaskFile(store, taskIdFrom(request.params), "audio", reply, false);
  });

  app.get("/api/v1/tools/edge-tts/tasks/:taskId/download", async (request, reply) => {
    return sendTaskFile(store, taskIdFrom(request.params), "audio", reply, true);
  });

  app.get("/api/v1/tools/edge-tts/tasks/:taskId/subtitle", async (request, reply) => {
    return sendTaskFile(store, taskIdFrom(request.params), "subtitle", reply, true);
  });

  app.delete("/api/v1/tools/edge-tts/tasks/:taskId", async (request, reply) => {
    const taskId = taskIdFrom(request.params);
    if (!store.get(taskId)) return reply.code(404).send(fail("EDGE_TTS_TASK_NOT_FOUND", "语音任务不存在"));
    await queue.cancel(taskId);
    await store.remove(taskId);
    return ok({ removed: true });
  });

  const cleanupTimer = setInterval(
    () => {
      void store.cleanupExpired();
    },
    15 * 60 * 1000
  );
  cleanupTimer.unref();
  app.addHook("onClose", async () => clearInterval(cleanupTimer));
}

class EdgeTtsTaskStore {
  private readonly tasks = new Map<string, EdgeTtsTask>();

  constructor(
    private readonly root: string,
    private readonly database: ToolboxDatabase
  ) {}

  async initialize() {
    await fsp.mkdir(this.root, { recursive: true });
    const stored = this.database.list("edge-tts-task");
    if (stored.length) {
      for (const entity of stored) {
        const task = entity.payload as EdgeTtsTask;
        if (isStoredTask(task)) this.tasks.set(task.id, task);
      }
      return;
    }
    const entries = await fsp.readdir(this.root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !isSafeTaskId(entry.name)) continue;
      try {
        const task = JSON.parse(await fsp.readFile(this.paths(entry.name).meta, "utf8")) as EdgeTtsTask;
        if (!isStoredTask(task) || task.id !== entry.name) continue;
        if (task.status === "processing") {
          task.status = "failed";
          task.error = "服务重启导致任务中断，请重新生成";
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
    await writeJsonAtomic(paths.request, input);
    await this.write(task);
    this.tasks.set(task.id, task);
    return cloneTask(task);
  }

  get(id: string) {
    const task = this.tasks.get(id);
    return task ? cloneTask(task) : undefined;
  }

  listInternal() {
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
    this.database.remove("edge-tts-task", id);
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
      kind: "edge-tts-task",
      status: task.status,
      payload: task,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    });
  }
}

class EdgeTtsRunner {
  constructor(private readonly config: AppConfig) {}

  async check(): Promise<RuntimeInfo> {
    try {
      await Promise.all([fsp.access(this.config.edgeTtsPythonPath), fsp.access(this.config.edgeTtsScriptPath)]);
      const result = await this.execute([this.config.edgeTtsScriptPath, "check"], 15_000);
      return {
        available: result.available === true,
        version: typeof result.version === "string" ? result.version : undefined,
        message: result.available === true ? "Edge-TTS 已就绪" : "Edge-TTS 运行环境不可用"
      };
    } catch {
      return {
        available: false,
        message: "Edge-TTS 尚未安装，请运行 scripts/setup-edge-tts.ps1"
      };
    }
  }

  async listVoices(): Promise<EdgeTtsVoice[]> {
    const result = await this.execute([this.config.edgeTtsScriptPath, "voices"], 30_000);
    if (!Array.isArray(result.voices)) throw new Error("Invalid voice list response");
    return result.voices.filter(isVoice).map((voice) => ({ ...voice, suggested: false }));
  }

  async generate(task: EdgeTtsTask, paths: TaskPaths, signal: AbortSignal) {
    await Promise.all([
      fsp.rm(paths.audioTemp, { force: true }),
      fsp.rm(paths.subtitleTemp, { force: true }),
      fsp.rm(paths.audio, { force: true }),
      fsp.rm(paths.subtitle, { force: true })
    ]);
    const args = [this.config.edgeTtsScriptPath, "generate", "--input", paths.request, "--audio", paths.audioTemp];
    if (task.includeSubtitles) args.push("--subtitle", paths.subtitleTemp);
    const result = await this.execute(args, this.config.edgeTtsTimeoutMs, signal);
    const stat = await fsp.stat(paths.audioTemp);
    if (!stat.isFile() || stat.size <= 0 || !(await isMp3File(paths.audioTemp))) {
      throw new Error("生成结果不是有效的 MP3 文件");
    }
    await fsp.rename(paths.audioTemp, paths.audio);
    if (task.includeSubtitles) {
      await fsp.access(paths.subtitleTemp);
      await fsp.rename(paths.subtitleTemp, paths.subtitle);
    }
    return {
      audioBytes: typeof result.audioBytes === "number" ? result.audioBytes : stat.size
    };
  }

  private async execute(args: string[], timeout: number, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const result = await execFileAsync(this.config.edgeTtsPythonPath, args, {
      timeout,
      signal,
      windowsHide: true,
      maxBuffer: 5 * 1024 * 1024,
      encoding: "utf8"
    });
    const stdout = String(result.stdout).trim();
    if (!stdout) throw new Error("Edge-TTS returned an empty response");
    return JSON.parse(stdout) as Record<string, unknown>;
  }
}

class EdgeTtsQueue {
  private readonly pending: string[] = [];
  private readonly active = new Map<string, { controller: AbortController; done: Promise<void> }>();
  private stopped = false;

  constructor(
    private readonly options: {
      config: AppConfig;
      store: EdgeTtsTaskStore;
      runner: EdgeTtsRunner;
    }
  ) {}

  enqueue(id: string) {
    if (this.stopped || this.pending.includes(id) || this.active.has(id)) return;
    this.pending.push(id);
    this.pump();
  }

  async cancel(id: string) {
    const index = this.pending.indexOf(id);
    if (index >= 0) this.pending.splice(index, 1);
    const job = this.active.get(id);
    if (!job) return;
    job.controller.abort();
    await job.done;
  }

  stats() {
    return { active: this.active.size, queued: this.pending.length };
  }

  close() {
    this.stopped = true;
    this.pending.length = 0;
    for (const job of this.active.values()) job.controller.abort();
  }

  private pump() {
    while (!this.stopped && this.active.size < this.options.config.edgeTtsConcurrency && this.pending.length) {
      const id = this.pending.shift();
      if (!id) break;
      const controller = new AbortController();
      const done = this.process(id, controller).finally(() => {
        this.active.delete(id);
        this.pump();
      });
      this.active.set(id, { controller, done });
    }
  }

  private async process(id: string, controller: AbortController) {
    const task = this.options.store.get(id);
    if (!task || task.status !== "queued") return;
    await this.options.store.update(id, { status: "processing", progress: 15 });
    try {
      const result = await this.options.runner.generate(task, this.options.store.paths(id), controller.signal);
      await this.options.store.update(id, {
        status: "completed",
        progress: 100,
        audioBytes: result.audioBytes,
        error: undefined
      });
    } catch (error) {
      if (!this.options.store.get(id)) return;
      const cancelled = controller.signal.aborted;
      await this.options.store.update(id, {
        status: cancelled ? "cancelled" : "failed",
        progress: cancelled ? 0 : 100,
        error: cancelled ? "任务已取消" : readableRunnerError(error)
      });
    }
  }
}

async function sendTaskFile(
  store: EdgeTtsTaskStore,
  taskId: string,
  kind: "audio" | "subtitle",
  reply: FastifyReply,
  download: boolean
) {
  const task = store.get(taskId);
  if (!task) return reply.code(404).send(fail("EDGE_TTS_TASK_NOT_FOUND", "语音任务不存在"));
  if (task.status !== "completed") {
    return reply.code(409).send(fail("EDGE_TTS_TASK_NOT_READY", "语音文件尚未生成完成"));
  }
  if (kind === "subtitle" && !task.includeSubtitles) {
    return reply.code(404).send(fail("EDGE_TTS_SUBTITLE_NOT_FOUND", "该任务没有字幕文件"));
  }
  const paths = store.paths(taskId);
  const filePath = kind === "audio" ? paths.audio : paths.subtitle;
  try {
    const stat = await fsp.stat(filePath);
    const extension = kind === "audio" ? ".mp3" : ".srt";
    const baseName = sanitizeFileName(task.fileName || `edge-tts-${task.id}`);
    reply.header("content-type", kind === "audio" ? "audio/mpeg" : "application/x-subrip; charset=utf-8");
    reply.header("content-length", String(stat.size));
    reply.header("x-content-type-options", "nosniff");
    if (download) {
      reply.header("content-disposition", contentDisposition(`${baseName}${extension}`));
    } else {
      reply.header("cache-control", "private, max-age=3600");
    }
    return reply.send(fs.createReadStream(filePath));
  } catch {
    return reply.code(404).send(fail("EDGE_TTS_FILE_NOT_FOUND", "生成文件不存在或已被清理"));
  }
}

function parseCreateInput(
  body: unknown,
  allowedVoices: Set<string>
):
  | { success: true; value: EdgeTtsCreateTaskInput }
  | { success: false; statusCode: number; code: string; message: string } {
  if (!isRecord(body)) return invalid("EDGE_TTS_INPUT_INVALID", "请求内容格式不正确");
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const language = body.language;
  const voice = typeof body.voice === "string" ? body.voice.trim() : "";
  if (!text) return invalid("EDGE_TTS_TEXT_REQUIRED", "请输入需要生成语音的文本");
  if (text.length > EDGE_TTS_MAX_TEXT_LENGTH) {
    return invalid("EDGE_TTS_TEXT_TOO_LONG", `文本不能超过 ${EDGE_TTS_MAX_TEXT_LENGTH} 个字符`, 413);
  }
  if (!isSupportedLanguage(language)) return invalid("EDGE_TTS_LANGUAGE_INVALID", "不支持该语言");
  if (!allowedVoices.has(voice) || !voice.startsWith(`${language}-`)) {
    return invalid("EDGE_TTS_VOICE_INVALID", "请选择当前语言下可用的音色");
  }
  const rate = boundedInteger(body.rate, -50, 100);
  const volume = boundedInteger(body.volume, -50, 50);
  const pitch = boundedInteger(body.pitch, -50, 50);
  if (rate === undefined || volume === undefined || pitch === undefined) {
    return invalid("EDGE_TTS_PARAMETER_INVALID", "语速、音量或音调超出允许范围");
  }
  if (typeof body.includeSubtitles !== "boolean") {
    return invalid("EDGE_TTS_SUBTITLE_INVALID", "字幕参数格式不正确");
  }
  const fileName = typeof body.fileName === "string" ? sanitizeFileName(body.fileName) : undefined;
  return {
    success: true,
    value: { text, language, voice, rate, volume, pitch, includeSubtitles: body.includeSubtitles, fileName }
  };
}

function toPublicTask(task: EdgeTtsTask): EdgeTtsTask {
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

function taskIdFrom(params: unknown) {
  return isRecord(params) && typeof params.taskId === "string" ? params.taskId : "";
}

function cloneTask(task: EdgeTtsTask): EdgeTtsTask {
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

function isVoice(value: unknown): value is Omit<EdgeTtsVoice, "suggested"> {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.shortName === "string" &&
    typeof value.locale === "string" &&
    (value.gender === "Female" || value.gender === "Male" || value.gender === "Neutral")
  );
}

function isSupportedLanguage(value: unknown): value is EdgeTtsLanguage {
  return typeof value === "string" && (EDGE_TTS_LANGUAGES as readonly string[]).includes(value);
}

function isSafeTaskId(value: string) {
  return /^[A-Za-z0-9_-]{6,64}$/.test(value);
}

function boundedInteger(value: unknown, minimum: number, maximum: number) {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum ? Number(value) : undefined;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function invalid(code: string, message: string, statusCode = 400) {
  return { success: false as const, statusCode, code, message };
}

function sanitizeFileName(value: string) {
  const withoutExtension = value.trim().replace(/\.(mp3|srt)$/i, "");
  const printable = Array.from(withoutExtension, (character) => (character.charCodeAt(0) < 32 ? "-" : character)).join(
    ""
  );
  return (
    printable
      .replace(/[<>:"/\\|?*]/g, "-")
      .replace(/[. ]+$/g, "")
      .slice(0, 100) || "edge-tts-audio"
  );
}

function contentDisposition(fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replaceAll('"', "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

async function writeJsonAtomic(filePath: string, value: unknown) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
  await fsp.rename(tempPath, filePath);
}

async function isMp3File(filePath: string) {
  const handle = await fsp.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(3);
    const { bytesRead } = await handle.read(buffer, 0, 3, 0);
    if (bytesRead < 2) return false;
    return buffer.toString("ascii", 0, 3) === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  } finally {
    await handle.close();
  }
}

function readableRunnerError(error: unknown) {
  if (isRecord(error) && typeof error.stderr === "string" && error.stderr.trim()) {
    return `语音生成失败：${error.stderr.trim().slice(0, 300)}`;
  }
  if (error instanceof Error && error.name === "AbortError") return "任务已取消";
  if (error instanceof Error && /timed out|ETIMEDOUT/i.test(error.message)) return "语音生成超时，请缩短文本后重试";
  return `语音生成失败：${error instanceof Error ? error.message.slice(0, 300) : "未知错误"}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
