import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance, FastifyReply } from "fastify";
import { nanoid } from "nanoid";
import {
  CHATTERBOX_LANGUAGES,
  ChatterboxListQuerySchema,
  CHATTERBOX_MAX_REFERENCE_BYTES,
  CHATTERBOX_MAX_REFERENCE_SECONDS,
  CHATTERBOX_MAX_TEXT_LENGTH,
  CHATTERBOX_MIN_REFERENCE_SECONDS,
  ChatterboxTaskIdParamsSchema,
  fail,
  ok,
  type ChatterboxHealth,
  type ChatterboxLanguage,
  type ChatterboxListQuery,
  type ChatterboxTask,
  type ChatterboxTaskIdParams,
  type ChatterboxTaskList,
  type ChatterboxTaskStatus,
  type ChatterboxTaskSummary,
  type ChatterboxVoiceAuthorization
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { Task, TaskStore } from "../../tasks/task-store";
import { registerChatterboxBatchRoutes } from "./batch-routes";
import { ChatterboxWorkerError, createChatterboxWorkerClient } from "./worker-client";

const execFileAsync = promisify(execFile);
const HEALTH_CACHE_MS = 10_000;

type TaskPaths = {
  dir: string;
  meta: string;
  referenceUpload: string;
  reference: string;
  outputWav: string;
  audio: string;
  subtitle: string;
};

type ChatterboxCreateInput = Pick<
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

export async function registerChatterboxRoutes(
  app: FastifyInstance,
  config: AppConfig,
  database: ToolboxDatabase,
  taskStore: TaskStore
) {
  const store = new ChatterboxTaskStore(config.chatterboxTasksDir, database, taskStore);
  const worker = createChatterboxWorkerClient(config);
  const media = new ChatterboxMediaTools(config);
  await store.initialize();
  await store.cleanupExpired();

  let healthCache: { value: Awaited<ReturnType<typeof worker.health>>; expiresAt: number } | undefined;
  const workerHealth = async (force = false) => {
    if (!force && healthCache && healthCache.expiresAt > Date.now()) return healthCache.value;
    const value = await worker.health();
    healthCache = { value, expiresAt: Date.now() + HEALTH_CACHE_MS };
    return value;
  };

  const queue = new ChatterboxQueue({ config, store, worker, media });
  const batchQueue = await registerChatterboxBatchRoutes({
    app,
    config,
    worker,
    media,
    database,
    taskStore,
    externalQueueStats: () => queue.stats()
  });
  for (const task of store.list()) {
    if (task.status === "queued") queue.enqueue(task.id);
  }

  app.get("/api/v1/tools/edge-tts/chatterbox/health", async () => {
    let status: Awaited<ReturnType<typeof worker.health>> | undefined;
    try {
      status = await workerHealth();
    } catch {
      status = undefined;
    }
    const legacyStats = queue.stats();
    const batchStats = batchQueue.stats();
    const stats = {
      active: legacyStats.active + batchStats.active,
      queued: legacyStats.queued + batchStats.queued
    };
    const data: ChatterboxHealth = {
      protocolVersion: status?.protocolVersion ?? 1,
      available: status?.available === true,
      workerAvailable: status?.available === true,
      packageVersion: status?.packageVersion,
      model: "multilingual-v3",
      modelLoaded: status?.modelLoaded === true,
      device: status?.device,
      gpuName: status?.gpuName,
      message:
        status?.available === true
          ? status.modelLoaded
            ? "Chatterbox Multilingual V3 已加载"
            : "运行环境已就绪，首次生成会下载并加载模型"
          : "Chatterbox Worker 未启动，请先安装并重新一键启动",
      reference: {
        maxBytes: CHATTERBOX_MAX_REFERENCE_BYTES,
        minSeconds: CHATTERBOX_MIN_REFERENCE_SECONDS,
        maxSeconds: CHATTERBOX_MAX_REFERENCE_SECONDS
      },
      maxTextLength: CHATTERBOX_MAX_TEXT_LENGTH,
      retentionDays: config.chatterboxRetentionDays,
      queue: { ...stats, concurrency: 1, limit: config.chatterboxQueueLimit },
      watermarked: true
    };
    return ok(data);
  });

  app.post("/api/v1/tools/edge-tts/chatterbox/tasks", async (request, reply) => {
    const batchStats = batchQueue.stats();
    if (
      queue.stats().active + queue.stats().queued + batchStats.active + batchStats.queued >=
      config.chatterboxQueueLimit
    ) {
      return reply.code(429).send(fail("CHATTERBOX_QUEUE_FULL", "声音克隆队列已满，请稍后重试"));
    }
    try {
      const health = await workerHealth();
      if (!health.available) {
        return reply.code(409).send(fail("CHATTERBOX_NOT_AVAILABLE", "Chatterbox Worker 尚未就绪"));
      }
    } catch {
      return reply.code(409).send(fail("CHATTERBOX_NOT_AVAILABLE", "Chatterbox Worker 未启动"));
    }

    const taskId = nanoid(12);
    const paths = store.paths(taskId);
    await fsp.mkdir(paths.dir, { recursive: true });
    try {
      const uploaded = await receiveMultipartTask(request.parts(), paths.referenceUpload);
      const parsed = parseFields(uploaded.fields, uploaded.referenceFileName);
      if (!parsed.success) {
        await fsp.rm(paths.dir, { recursive: true, force: true });
        return reply.code(parsed.statusCode).send(fail(parsed.code, parsed.message));
      }
      const duration = await media.normalizeReference(paths.referenceUpload, paths.reference);
      const task = await store.create(
        taskId,
        { ...parsed.value, referenceDurationSeconds: duration },
        config.chatterboxRetentionDays
      );
      queue.enqueue(task.id);
      return reply.code(202).send(ok(toPublicTask(task)));
    } catch (error) {
      await fsp.rm(paths.dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      const mapped = mapUploadError(error);
      return reply.code(mapped.statusCode).send(fail(mapped.code, mapped.message));
    }
  });

  app.get<{ Querystring: ChatterboxListQuery }>(
    "/api/v1/tools/edge-tts/chatterbox/tasks",
    { schema: { querystring: ChatterboxListQuerySchema } },
    async (request) => {
      const query = request.query;
      const page = positiveInteger(query.page, 1);
      const pageSize = Math.min(50, positiveInteger(query.pageSize, 10));
      const tasks = store.list();
      const total = tasks.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const start = (safePage - 1) * pageSize;
      const data: ChatterboxTaskList = {
        tasks: tasks.slice(start, start + pageSize).map(toTaskSummary),
        pagination: { page: safePage, pageSize, total, totalPages }
      };
      return ok(data);
    }
  );

  app.get<{ Params: ChatterboxTaskIdParams }>(
    "/api/v1/tools/edge-tts/chatterbox/tasks/:taskId",
    { schema: { params: ChatterboxTaskIdParamsSchema } },
    async (request, reply) => {
      const task = store.get(taskIdFrom(request.params));
      if (!task) return reply.code(404).send(fail("CHATTERBOX_TASK_NOT_FOUND", "声音克隆任务不存在"));
      return ok(toPublicTask(task));
    }
  );

  app.get<{ Params: ChatterboxTaskIdParams }>(
    "/api/v1/tools/edge-tts/chatterbox/tasks/:taskId/audio",
    { schema: { params: ChatterboxTaskIdParamsSchema } },
    async (request, reply) => sendTaskFile(store, request.params.taskId, "audio", reply, false)
  );

  app.get<{ Params: ChatterboxTaskIdParams }>(
    "/api/v1/tools/edge-tts/chatterbox/tasks/:taskId/download",
    { schema: { params: ChatterboxTaskIdParamsSchema } },
    async (request, reply) => sendTaskFile(store, request.params.taskId, "audio", reply, true)
  );

  app.get<{ Params: ChatterboxTaskIdParams }>(
    "/api/v1/tools/edge-tts/chatterbox/tasks/:taskId/subtitle",
    { schema: { params: ChatterboxTaskIdParamsSchema } },
    async (request, reply) => sendTaskFile(store, request.params.taskId, "subtitle", reply, true)
  );

  app.delete<{ Params: ChatterboxTaskIdParams }>(
    "/api/v1/tools/edge-tts/chatterbox/tasks/:taskId",
    { schema: { params: ChatterboxTaskIdParamsSchema } },
    async (request, reply) => {
      const taskId = taskIdFrom(request.params);
      const task = store.get(taskId);
      if (!task) return reply.code(404).send(fail("CHATTERBOX_TASK_NOT_FOUND", "声音克隆任务不存在"));
      if (queue.isActive(taskId)) {
        return reply.code(409).send(fail("CHATTERBOX_TASK_ACTIVE", "本地模型正在生成，完成后即可删除"));
      }
      queue.removePending(taskId);
      await store.remove(taskId);
      return ok({ removed: true });
    }
  );

  const cleanupTimer = setInterval(
    () => {
      void store.cleanupExpired((taskId) => queue.isActive(taskId));
    },
    15 * 60 * 1000
  );
  cleanupTimer.unref();
  app.addHook("onClose", async () => clearInterval(cleanupTimer));
}

class ChatterboxTaskStore {
  private readonly tasks = new Map<string, ChatterboxTask>();

  constructor(
    private readonly root: string,
    private readonly database: ToolboxDatabase,
    private readonly taskStore: TaskStore
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
    this.taskStore.remove(id);
    await fsp.rm(this.paths(id).dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    return true;
  }

  async cleanupExpired(isActive: (id: string) => boolean = () => false, now = Date.now()) {
    const expired = [...this.tasks.values()].filter((task) => !isActive(task.id) && Date.parse(task.expiresAt) <= now);
    await Promise.all(expired.map((task) => this.remove(task.id)));
    return expired.length;
  }

  paths(id: string): TaskPaths {
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

class ChatterboxQueue {
  private readonly pending: string[] = [];
  private activeId: string | undefined;

  constructor(
    private readonly options: {
      config: AppConfig;
      store: ChatterboxTaskStore;
      worker: ReturnType<typeof createChatterboxWorkerClient>;
      media: ChatterboxMediaTools;
    }
  ) {}

  enqueue(id: string) {
    if (this.pending.includes(id) || this.activeId === id) return;
    this.pending.push(id);
    this.pump();
  }

  removePending(id: string) {
    const index = this.pending.indexOf(id);
    if (index >= 0) this.pending.splice(index, 1);
  }

  isActive(id: string) {
    return this.activeId === id;
  }

  stats() {
    return { active: this.activeId ? 1 : 0, queued: this.pending.length };
  }

  private pump() {
    if (this.activeId || !this.pending.length) return;
    const id = this.pending.shift();
    if (!id) return;
    this.activeId = id;
    void this.process(id).finally(() => {
      this.activeId = undefined;
      this.pump();
    });
  }

  private async process(id: string) {
    const task = this.options.store.get(id);
    if (!task || task.status !== "queued") return;
    const paths = this.options.store.paths(id);
    await this.options.store.update(id, { status: "processing", progress: 10 });
    try {
      const result = await this.options.worker.generate({
        text: task.text,
        language: task.language,
        referencePath: paths.reference,
        outputPath: paths.outputWav,
        exaggeration: task.exaggeration,
        cfgWeight: task.cfgWeight,
        temperature: task.temperature,
        seed: task.seed
      });
      await this.options.store.update(id, { progress: 82 });
      await this.options.media.toMp3(paths.outputWav, paths.audio);
      const audioBytes = (await fsp.stat(paths.audio)).size;
      const duration = await this.options.media.duration(paths.audio);
      if (task.includeSubtitles) await writeSubtitle(paths.subtitle, task.text, duration, result.segments);
      await this.options.store.update(id, {
        status: "completed",
        progress: 100,
        audioBytes,
        audioDurationSeconds: result.durationSeconds || duration,
        error: undefined
      });
    } catch (error) {
      await this.options.store.update(id, {
        status: "failed",
        progress: 100,
        error: readableGenerationError(error)
      });
    } finally {
      await Promise.all([
        fsp.rm(paths.referenceUpload, { force: true }),
        fsp.rm(paths.reference, { force: true }),
        fsp.rm(paths.outputWav, { force: true })
      ]);
    }
  }
}

class ChatterboxMediaTools {
  constructor(private readonly config: AppConfig) {}

  async normalizeReference(inputPath: string, outputPath: string) {
    const sourceDuration = await this.duration(inputPath);
    if (sourceDuration < CHATTERBOX_MIN_REFERENCE_SECONDS || sourceDuration > CHATTERBOX_MAX_REFERENCE_SECONDS) {
      throw new ChatterboxInputError(
        "CHATTERBOX_REFERENCE_DURATION_INVALID",
        `参考音频应为 ${CHATTERBOX_MIN_REFERENCE_SECONDS}–${CHATTERBOX_MAX_REFERENCE_SECONDS} 秒`,
        400
      );
    }
    await execFileAsync(
      this.config.chatterboxFfmpegPath,
      ["-y", "-v", "error", "-i", inputPath, "-vn", "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", outputPath],
      { timeout: 120_000, windowsHide: true, maxBuffer: 1024 * 1024 }
    );
    await fsp.rm(inputPath, { force: true });
    return Number(sourceDuration.toFixed(3));
  }

  async toMp3(inputPath: string, outputPath: string) {
    const tempPath = `${outputPath}.tmp.mp3`;
    await execFileAsync(
      this.config.chatterboxFfmpegPath,
      ["-y", "-v", "error", "-i", inputPath, "-codec:a", "libmp3lame", "-b:a", "192k", tempPath],
      { timeout: 120_000, windowsHide: true, maxBuffer: 1024 * 1024 }
    );
    const stat = await fsp.stat(tempPath);
    if (stat.size <= 0 || !(await isMp3File(tempPath))) throw new Error("Chatterbox MP3 输出无效");
    await fsp.rename(tempPath, outputPath);
  }

  async concatMp3(inputPaths: string[], outputPath: string) {
    if (!inputPaths.length) throw new Error("没有可合并的 Chatterbox 音频");
    const tempPath = `${outputPath}.tmp.mp3`;
    if (inputPaths.length === 1) {
      await fsp.copyFile(inputPaths[0], tempPath);
    } else {
      const inputs = inputPaths.flatMap((inputPath) => ["-i", inputPath]);
      const streams = inputPaths.map((_, index) => `[${index}:a:0]`).join("");
      await execFileAsync(
        this.config.chatterboxFfmpegPath,
        [
          "-y",
          "-v",
          "error",
          ...inputs,
          "-filter_complex",
          `${streams}concat=n=${inputPaths.length}:v=0:a=1[out]`,
          "-map",
          "[out]",
          "-codec:a",
          "libmp3lame",
          "-b:a",
          "192k",
          tempPath
        ],
        { timeout: 300_000, windowsHide: true, maxBuffer: 1024 * 1024 }
      );
    }
    const stat = await fsp.stat(tempPath);
    if (stat.size <= 0 || !(await isMp3File(tempPath))) throw new Error("Chatterbox 合并 MP3 输出无效");
    await replaceFile(tempPath, outputPath);
  }

  async duration(filePath: string) {
    try {
      const result = await execFileAsync(
        this.config.chatterboxFfprobePath,
        ["-v", "error", "-show_entries", "format=duration", "-of", "json", filePath],
        { timeout: 30_000, windowsHide: true, maxBuffer: 1024 * 1024, encoding: "utf8" }
      );
      const parsed = JSON.parse(String(result.stdout)) as { format?: { duration?: string } };
      const duration = Number(parsed.format?.duration);
      if (!Number.isFinite(duration) || duration <= 0) throw new Error("duration unavailable");
      return duration;
    } catch {
      throw new ChatterboxInputError(
        "CHATTERBOX_REFERENCE_INVALID",
        "无法读取音频，请上传有效的 WAV、MP3、M4A 或 FLAC",
        415
      );
    }
  }
}

class ChatterboxInputError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}

async function receiveMultipartTask(
  parts: AsyncIterableIterator<import("@fastify/multipart").Multipart>,
  targetPath: string
) {
  const fields: Record<string, string> = {};
  let referenceFileName = "";
  let receivedFile = false;
  for await (const part of parts) {
    if (part.type === "file") {
      if (part.fieldname !== "reference" || receivedFile) {
        part.file.resume();
        throw new ChatterboxInputError("CHATTERBOX_REFERENCE_REQUIRED", "请只上传一个参考音频", 400);
      }
      receivedFile = true;
      referenceFileName = sanitizeDisplayName(part.filename || "reference-audio");
      let bytes = 0;
      const limiter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          bytes += chunk.length;
          if (bytes > CHATTERBOX_MAX_REFERENCE_BYTES) {
            callback(new ChatterboxInputError("CHATTERBOX_REFERENCE_TOO_LARGE", "参考音频不能超过 20 MB", 413));
            return;
          }
          callback(null, chunk);
        }
      });
      await pipeline(part.file, limiter, fs.createWriteStream(targetPath));
      if (part.file.truncated) throw new ChatterboxInputError("CHATTERBOX_REFERENCE_TOO_LARGE", "参考音频过大", 413);
    } else if (typeof part.value === "string" && part.value.length <= CHATTERBOX_MAX_TEXT_LENGTH + 200) {
      fields[part.fieldname] = part.value;
    }
  }
  if (!receivedFile) throw new ChatterboxInputError("CHATTERBOX_REFERENCE_REQUIRED", "请上传参考音频", 400);
  return { fields, referenceFileName };
}

function parseFields(
  fields: Record<string, string>,
  referenceFileName: string
):
  | { success: true; value: Omit<ChatterboxCreateInput, "referenceDurationSeconds"> }
  | { success: false; statusCode: number; code: string; message: string } {
  const text = fields.text?.trim() || "";
  if (!text) return invalid("CHATTERBOX_TEXT_REQUIRED", "请输入需要生成的文案");
  if (text.length > CHATTERBOX_MAX_TEXT_LENGTH) {
    return invalid("CHATTERBOX_TEXT_TOO_LONG", `声音克隆文案不能超过 ${CHATTERBOX_MAX_TEXT_LENGTH} 个字符`, 413);
  }
  if (!isLanguage(fields.language)) return invalid("CHATTERBOX_LANGUAGE_INVALID", "仅支持马来语、英语或巴西葡萄牙语");
  if (!isAuthorization(fields.authorization)) return invalid("CHATTERBOX_AUTHORIZATION_REQUIRED", "请选择声音授权来源");
  if (fields.consentConfirmed !== "true") {
    return invalid("CHATTERBOX_CONSENT_REQUIRED", "必须确认已获得参考声音的合法授权");
  }
  const exaggeration = boundedNumber(fields.exaggeration, 0.25, 1.5);
  const cfgWeight = boundedNumber(fields.cfgWeight, 0, 1);
  const temperature = boundedNumber(fields.temperature, 0.1, 1.5);
  const seed = boundedInteger(fields.seed, 0, 2_147_483_647);
  if (exaggeration === undefined || cfgWeight === undefined || temperature === undefined || seed === undefined) {
    return invalid("CHATTERBOX_PARAMETER_INVALID", "声音克隆参数超出允许范围");
  }
  return {
    success: true,
    value: {
      text,
      language: fields.language,
      referenceFileName,
      authorization: fields.authorization,
      consentConfirmed: true,
      exaggeration,
      cfgWeight,
      temperature,
      seed,
      includeSubtitles: fields.includeSubtitles === "true",
      fileName: fields.fileName ? sanitizeFileName(fields.fileName) : undefined
    }
  };
}

async function sendTaskFile(
  store: ChatterboxTaskStore,
  taskId: string,
  kind: "audio" | "subtitle",
  reply: FastifyReply,
  download: boolean
) {
  const task = store.get(taskId);
  if (!task) return reply.code(404).send(fail("CHATTERBOX_TASK_NOT_FOUND", "声音克隆任务不存在"));
  if (task.status !== "completed") {
    return reply.code(409).send(fail("CHATTERBOX_TASK_NOT_READY", "声音文件尚未生成完成"));
  }
  if (kind === "subtitle" && !task.includeSubtitles) {
    return reply.code(404).send(fail("CHATTERBOX_SUBTITLE_NOT_FOUND", "该任务没有字幕文件"));
  }
  const paths = store.paths(taskId);
  const filePath = kind === "audio" ? paths.audio : paths.subtitle;
  try {
    if (kind === "subtitle" && task.audioDurationSeconds) {
      await repairLegacySubtitle(filePath, task.text, task.audioDurationSeconds);
    }
    const stat = await fsp.stat(filePath);
    const extension = kind === "audio" ? ".mp3" : ".srt";
    const fileName = `${sanitizeFileName(task.fileName || `chatterbox-${task.id}`)}${extension}`;
    reply.header("content-type", kind === "audio" ? "audio/mpeg" : "application/x-subrip; charset=utf-8");
    reply.header("content-length", String(stat.size));
    reply.header("x-content-type-options", "nosniff");
    if (download) reply.header("content-disposition", contentDisposition(fileName));
    else reply.header("cache-control", "private, max-age=3600");
    return reply.send(fs.createReadStream(filePath));
  } catch {
    return reply.code(404).send(fail("CHATTERBOX_FILE_NOT_FOUND", "生成文件不存在或已过期"));
  }
}

function toPublicTask(task: ChatterboxTask): ChatterboxTask {
  const result = cloneTask(task);
  if (task.status === "completed") {
    result.audioUrl = `/api/v1/tools/edge-tts/chatterbox/tasks/${task.id}/audio`;
    result.downloadUrl = `/api/v1/tools/edge-tts/chatterbox/tasks/${task.id}/download`;
    if (task.includeSubtitles) result.subtitleUrl = `/api/v1/tools/edge-tts/chatterbox/tasks/${task.id}/subtitle`;
  }
  return result;
}

function toTaskSummary(task: ChatterboxTask): ChatterboxTaskSummary {
  const { text, ...summary } = toPublicTask(task);
  return { ...summary, textPreview: text.length > 120 ? `${text.slice(0, 120)}…` : text };
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
    isLanguage(value.language) &&
    typeof value.createdAt === "string" &&
    typeof value.expiresAt === "string"
  );
}

function isTaskStatus(value: unknown): value is ChatterboxTaskStatus {
  return (
    value === "queued" || value === "processing" || value === "completed" || value === "failed" || value === "cancelled"
  );
}

function isLanguage(value: unknown): value is ChatterboxLanguage {
  return typeof value === "string" && (CHATTERBOX_LANGUAGES as readonly string[]).includes(value);
}

function isAuthorization(value: unknown): value is ChatterboxVoiceAuthorization {
  return value === "self" || value === "authorized";
}

function boundedNumber(value: string | undefined, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}

function boundedInteger(value: string | undefined, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function invalid(code: string, message: string, statusCode = 400) {
  return { success: false as const, statusCode, code, message };
}

function taskIdFrom(params: unknown) {
  return isRecord(params) && typeof params.taskId === "string" ? params.taskId : "";
}

function isSafeTaskId(value: string) {
  return /^[A-Za-z0-9_-]{6,64}$/.test(value);
}

function sanitizeDisplayName(value: string) {
  return (
    path
      .basename(value)
      .replace(/[\r\n]/g, " ")
      .slice(0, 160) || "reference-audio"
  );
}

function sanitizeFileName(value: string) {
  const base = value.trim().replace(/\.(mp3|srt)$/i, "");
  const printable = Array.from(base, (character) => (character.charCodeAt(0) < 32 ? "-" : character)).join("");
  return (
    printable
      .replace(/[<>:"/\\|?*]/g, "-")
      .replace(/[. ]+$/g, "")
      .slice(0, 100) || "chatterbox-audio"
  );
}

function contentDisposition(fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replaceAll('"', "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

type SubtitleTimingSegment = {
  text: string;
  startSeconds: number;
  endSeconds: number;
};

async function writeSubtitle(
  filePath: string,
  text: string,
  durationSeconds: number,
  timingSegments?: SubtitleTimingSegment[]
) {
  const duration = Math.max(0.001, durationSeconds);
  const sentences = splitSubtitleText(text);
  const cues = buildSentenceCues(
    sentences,
    duration,
    validSubtitleSegments(timingSegments, duration) ? timingSegments : undefined
  );

  const content = cues
    .map(
      (cue, index) =>
        `${index + 1}\n${srtTimestamp(cue.startSeconds)} --> ${srtTimestamp(cue.endSeconds)}\n${wrapSubtitleLines(cue.text)}`
    )
    .join("\n\n");
  await fsp.writeFile(filePath, `${content}\n`, "utf8");
}

async function repairLegacySubtitle(filePath: string, text: string, durationSeconds: number) {
  const expectedSentences = splitSubtitleText(text);
  try {
    const current = await fsp.readFile(filePath, "utf8");
    const currentCues = parseSrtCueTexts(current);
    const alreadySentenceBased =
      currentCues.length === expectedSentences.length &&
      currentCues.every((cue, index) => normalizeSubtitleText(cue) === normalizeSubtitleText(expectedSentences[index]));
    if (alreadySentenceBased) return;
  } catch {
    return;
  }
  await writeSubtitle(filePath, text, durationSeconds);
}

function buildSentenceCues(
  sentences: string[],
  durationSeconds: number,
  timingSegments?: SubtitleTimingSegment[]
): SubtitleTimingSegment[] {
  const sentenceWeights = sentences.map(subtitleWeight);
  const totalSentenceWeight = sentenceWeights.reduce((sum, weight) => sum + weight, 0);

  if (!timingSegments?.length) {
    let elapsedWeight = 0;
    return sentences.map((sentence, index) => {
      const startSeconds = (elapsedWeight / totalSentenceWeight) * durationSeconds;
      elapsedWeight += sentenceWeights[index];
      return {
        text: sentence,
        startSeconds,
        endSeconds: (elapsedWeight / totalSentenceWeight) * durationSeconds
      };
    });
  }

  const segmentWeights = timingSegments.map((segment) => subtitleWeight(segment.text));
  const totalSegmentWeight = segmentWeights.reduce((sum, weight) => sum + weight, 0);
  let elapsedSentenceWeight = 0;
  return sentences.map((sentence, index) => {
    const scaledStartWeight = (elapsedSentenceWeight / totalSentenceWeight) * totalSegmentWeight;
    elapsedSentenceWeight += sentenceWeights[index];
    const scaledEndWeight = (elapsedSentenceWeight / totalSentenceWeight) * totalSegmentWeight;
    return {
      text: sentence,
      startSeconds: timingAtTextWeight(scaledStartWeight, "start", timingSegments, segmentWeights),
      endSeconds: timingAtTextWeight(scaledEndWeight, "end", timingSegments, segmentWeights)
    };
  });
}

function timingAtTextWeight(
  targetWeight: number,
  edge: "start" | "end",
  segments: SubtitleTimingSegment[],
  weights: number[]
) {
  let elapsedWeight = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const segmentWeight = weights[index];
    const nextWeight = elapsedWeight + segmentWeight;
    if (targetWeight < nextWeight || (edge === "end" && targetWeight <= nextWeight)) {
      const ratio = Math.max(0, Math.min(1, (targetWeight - elapsedWeight) / segmentWeight));
      return segment.startSeconds + (segment.endSeconds - segment.startSeconds) * ratio;
    }
    elapsedWeight = nextWeight;
  }
  return segments.at(-1)!.endSeconds;
}

function parseSrtCueTexts(content: string) {
  return content
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.split(/\r?\n/).slice(2).join(" ").trim())
    .filter(Boolean);
}

function validSubtitleSegments(
  segments: SubtitleTimingSegment[] | undefined,
  durationSeconds: number
): segments is SubtitleTimingSegment[] {
  return Boolean(
    segments?.length &&
    segments.every(
      (segment) =>
        segment.text.trim() &&
        Number.isFinite(segment.startSeconds) &&
        Number.isFinite(segment.endSeconds) &&
        segment.startSeconds >= 0 &&
        segment.endSeconds > segment.startSeconds &&
        segment.endSeconds <= durationSeconds + 0.25
    )
  );
}

function splitSubtitleText(text: string) {
  const normalized = normalizeSubtitleText(text);
  if (!normalized) return [""];
  return normalized.match(/[^.!?。！？;；]+(?:[.!?。！？;；]+|$)/g)?.map((value) => value.trim()) ?? [normalized];
}

function normalizeSubtitleText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function wrapSubtitleLines(text: string, maxLineCharacters = 38) {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) current = word;
    else if (current.length + 1 + word.length <= maxLineCharacters) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

function subtitleWeight(text: string) {
  return Math.max(1, text.replace(/\s+/g, "").length);
}

function srtTimestamp(seconds: number) {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)},${pad(millis, 3)}`;
}

function pad(value: number, length: number) {
  return String(value).padStart(length, "0");
}

async function isMp3File(filePath: string) {
  const handle = await fsp.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(3);
    const { bytesRead } = await handle.read(buffer, 0, 3, 0);
    return (
      bytesRead >= 2 && (buffer.toString("ascii") === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0))
    );
  } finally {
    await handle.close();
  }
}

async function replaceFile(source: string, target: string) {
  const backup = `${target}.backup`;
  await fsp.rm(backup, { force: true });
  const targetExists = await fsp.stat(target).then(
    (stat) => stat.isFile(),
    () => false
  );
  if (targetExists) await fsp.rename(target, backup);
  try {
    await fsp.rename(source, target);
    await fsp.rm(backup, { force: true });
  } catch (error) {
    if (targetExists) await fsp.rename(backup, target);
    throw error;
  }
}

function mapUploadError(error: unknown) {
  if (error instanceof ChatterboxInputError) {
    return { code: error.code, message: error.message, statusCode: error.statusCode };
  }
  return {
    code: "CHATTERBOX_REFERENCE_INVALID",
    message: error instanceof Error ? `参考音频处理失败：${error.message}` : "参考音频处理失败",
    statusCode: 422
  };
}

function readableGenerationError(error: unknown) {
  if (error instanceof ChatterboxWorkerError) return error.message;
  return `声音克隆失败：${error instanceof Error ? error.message.slice(0, 300) : "未知错误"}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
