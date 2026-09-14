import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance, FastifyReply } from "fastify";
import { nanoid } from "nanoid";
import {
  ApiFailureSchema,
  CHATTERBOX_LANGUAGES,
  ChatterboxHealthSchema,
  ChatterboxListQuerySchema,
  CHATTERBOX_MAX_REFERENCE_BYTES,
  CHATTERBOX_MAX_REFERENCE_SECONDS,
  CHATTERBOX_MAX_TEXT_LENGTH,
  CHATTERBOX_MIN_REFERENCE_SECONDS,
  ChatterboxRemovalSchema,
  ChatterboxTaskListSchema,
  ChatterboxTaskSchema,
  ChatterboxTaskIdParamsSchema,
  apiSuccessSchema,
  fail,
  ok,
  type ChatterboxHealth,
  type ChatterboxLanguage,
  type ChatterboxListQuery,
  type ChatterboxTask,
  type ChatterboxTaskIdParams,
  type ChatterboxTaskList,
  type ChatterboxTaskSummary,
  type ChatterboxVoiceAuthorization
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import { REQUEST_QUOTAS } from "../../security/request-quotas";
import type { TaskStore } from "../../tasks/task-store";
import { registerChatterboxBatchRoutes } from "./batch-routes";
import { ChatterboxInputError, ChatterboxMediaTools, type ChatterboxUploadErrorStatus } from "./media-tools";
import { repairLegacySubtitle } from "./subtitle";
import { ChatterboxQueue } from "./task-queue";
import { ChatterboxTaskStore, type ChatterboxCreateInput } from "./task-store";
import { createChatterboxWorkerClient } from "./worker-client";

const HEALTH_CACHE_MS = 10_000;

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

  const queue = new ChatterboxQueue({ store, worker, media });
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

  app.addHook("onClose", async () => {
    await Promise.allSettled([queue.close(), batchQueue.close()]);
  });

  app.get(
    "/api/v1/tools/edge-tts/chatterbox/health",
    { schema: { response: { 200: apiSuccessSchema(ChatterboxHealthSchema) } } },
    async () => {
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
    }
  );

  app.post(
    "/api/v1/tools/edge-tts/chatterbox/tasks",
    {
      config: REQUEST_QUOTAS.voice,
      schema: {
        response: {
          202: apiSuccessSchema(ChatterboxTaskSchema),
          400: ApiFailureSchema,
          409: ApiFailureSchema,
          413: ApiFailureSchema,
          415: ApiFailureSchema,
          422: ApiFailureSchema,
          429: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
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
    }
  );

  app.get<{ Querystring: ChatterboxListQuery }>(
    "/api/v1/tools/edge-tts/chatterbox/tasks",
    {
      schema: {
        querystring: ChatterboxListQuerySchema,
        response: { 200: apiSuccessSchema(ChatterboxTaskListSchema) }
      }
    },
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
    {
      schema: {
        params: ChatterboxTaskIdParamsSchema,
        response: { 200: apiSuccessSchema(ChatterboxTaskSchema), 404: ApiFailureSchema }
      }
    },
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
    {
      schema: {
        params: ChatterboxTaskIdParamsSchema,
        response: { 200: apiSuccessSchema(ChatterboxRemovalSchema), 404: ApiFailureSchema, 409: ApiFailureSchema }
      }
    },
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
  | { success: false; statusCode: ChatterboxUploadErrorStatus; code: string; message: string } {
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

function invalid(code: string, message: string, statusCode: ChatterboxUploadErrorStatus = 400) {
  return { success: false as const, statusCode, code, message };
}

function taskIdFrom(params: unknown) {
  return isRecord(params) && typeof params.taskId === "string" ? params.taskId : "";
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

function mapUploadError(error: unknown): {
  code: string;
  message: string;
  statusCode: ChatterboxUploadErrorStatus;
} {
  if (error instanceof ChatterboxInputError) {
    return { code: error.code, message: error.message, statusCode: error.statusCode };
  }
  return {
    code: "CHATTERBOX_REFERENCE_INVALID",
    message: error instanceof Error ? `参考音频处理失败：${error.message}` : "参考音频处理失败",
    statusCode: 422
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
