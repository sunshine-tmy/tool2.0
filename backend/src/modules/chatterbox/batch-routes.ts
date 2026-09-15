import fsp from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import {
  ApiFailureSchema,
  ChatterboxBatchIdParamsSchema,
  ChatterboxBatchListSchema,
  ChatterboxBatchSchema,
  ChatterboxListQuerySchema,
  apiSuccessSchema,
  fail,
  ok,
  type ChatterboxBatchList,
  type ChatterboxListQuery
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { FileMetadataRepository } from "../../database/file-metadata";
import { REQUEST_QUOTAS } from "../../security/request-quotas";
import type { TaskStore } from "../../tasks/task-store";
import { rebuildBatchAudio, rebuildBatchSubtitles, toBatchSummary, toPublicBatch } from "./batch-artifacts";
import { parseBatchFields, receiveBatchMultipart } from "./batch-input";
import { ChatterboxBatchQueue, type ChatterboxMediaTools as MediaTools } from "./batch-queue";
import { BatchInputError, mapBatchError } from "./errors";
import { registerChatterboxBatchDownloadRoutes } from "./batch-download-routes";
import { registerChatterboxBatchItemRoutes } from "./batch-item-routes";
import { ChatterboxBatchStore, ChatterboxVoiceStore } from "./stores";
import { registerChatterboxVoiceRoutes } from "./voice-routes";
import type { createChatterboxWorkerClient } from "./worker-client";

type WorkerClient = ReturnType<typeof createChatterboxWorkerClient>;

export async function registerChatterboxBatchRoutes(options: {
  app: FastifyInstance;
  config: AppConfig;
  worker: WorkerClient;
  media: MediaTools;
  database: ToolboxDatabase;
  taskStore: TaskStore;
  fileMetadata?: FileMetadataRepository;
  externalQueueStats?: () => { active: number; queued: number };
}) {
  const { app, config, worker, media, database, taskStore, fileMetadata } = options;
  const store = new ChatterboxBatchStore(path.join(config.chatterboxDir, "batches"), database, taskStore, fileMetadata);
  const voiceStore = new ChatterboxVoiceStore(path.join(config.chatterboxDir, "voices"), database, fileMetadata);
  await store.initialize();
  await voiceStore.initialize();
  await store.cleanupExpired();
  const queue = new ChatterboxBatchQueue({
    config,
    store,
    worker,
    media,
    rebuildAudio: (batch) => rebuildBatchAudio(store, batch, media),
    rebuildSubtitles: (batch) => rebuildBatchSubtitles(store, batch)
  });
  const queueLoad = () => {
    const own = queue.stats();
    const external = options.externalQueueStats?.() || { active: 0, queued: 0 };
    return own.active + own.queued + external.active + external.queued;
  };
  for (const batch of store.list()) {
    for (const item of batch.items) if (item.status === "queued") queue.enqueue(batch.id, item.id);
  }

  registerChatterboxVoiceRoutes(app, voiceStore, media);
  registerChatterboxBatchDownloadRoutes({ app, config, store, queue, media });
  registerChatterboxBatchItemRoutes({ app, config, store, voiceStore, queue, media, queueLoad });

  app.post(
    "/api/v1/tools/edge-tts/chatterbox/batches",
    {
      config: REQUEST_QUOTAS.voice,
      schema: {
        response: {
          202: apiSuccessSchema(ChatterboxBatchSchema),
          400: ApiFailureSchema,
          404: ApiFailureSchema,
          409: ApiFailureSchema,
          413: ApiFailureSchema,
          429: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      if (queueLoad() >= config.chatterboxQueueLimit) {
        return reply.code(429).send(fail("CHATTERBOX_QUEUE_FULL", "声音克隆队列已满，请稍后重试"));
      }
      try {
        const health = await worker.health();
        if (!health.available)
          return reply.code(409).send(fail("CHATTERBOX_NOT_AVAILABLE", "Chatterbox Worker 尚未就绪"));
      } catch {
        return reply.code(409).send(fail("CHATTERBOX_NOT_AVAILABLE", "Chatterbox Worker 未启动"));
      }
      const batchId = nanoid(12);
      const paths = store.paths(batchId);
      await fsp.mkdir(paths.dir, { recursive: true });
      try {
        const uploaded = await receiveBatchMultipart(request.parts(), paths.referenceUpload, false);
        const parsed = parseBatchFields(uploaded.fields, uploaded.referenceFileName);
        if (!parsed.success) throw new BatchInputError(parsed.code, parsed.message, parsed.statusCode);
        if (queueLoad() + parsed.value.segments.length > config.chatterboxQueueLimit) {
          throw new BatchInputError("CHATTERBOX_QUEUE_FULL", "本批次段数超过当前可用队列容量", 429);
        }
        let referenceDurationSeconds: number;
        let referenceFileName = uploaded.referenceFileName;
        if (uploaded.receivedFile) {
          referenceDurationSeconds = await media.normalizeReference(paths.referenceUpload, paths.reference);
        } else {
          const savedVoice = voiceStore.get(uploaded.fields.voiceId || "");
          if (!savedVoice)
            throw new BatchInputError("CHATTERBOX_REFERENCE_REQUIRED", "请上传参考音频或选择已保存音色", 400);
          if (savedVoice.language !== parsed.value.language) {
            throw new BatchInputError("CHATTERBOX_VOICE_LANGUAGE_MISMATCH", "保存音色的语言与当前目标语言不一致", 400);
          }
          await fsp.copyFile(voiceStore.paths(savedVoice.id).audio, paths.reference);
          referenceDurationSeconds = savedVoice.durationSeconds;
          referenceFileName = savedVoice.name;
        }
        const batch = await store.create(
          batchId,
          { ...parsed.value, referenceFileName, referenceDurationSeconds },
          config.chatterboxRetentionDays
        );
        for (const item of batch.items) queue.enqueue(batch.id, item.id);
        return reply.code(202).send(ok(toPublicBatch(batch)));
      } catch (error) {
        await fsp.rm(paths.dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        const mapped = mapBatchError(error);
        return reply.code(mapped.statusCode).send(fail(mapped.code, mapped.message));
      }
    }
  );

  app.get<{ Querystring: ChatterboxListQuery }>(
    "/api/v1/tools/edge-tts/chatterbox/batches",
    {
      schema: {
        querystring: ChatterboxListQuerySchema,
        response: { 200: apiSuccessSchema(ChatterboxBatchListSchema) }
      }
    },
    async (request) => {
      const page = positiveInteger(request.query.page, 1);
      const pageSize = Math.min(50, positiveInteger(request.query.pageSize, 10));
      const batches = store.list();
      const total = batches.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const start = (safePage - 1) * pageSize;
      const data: ChatterboxBatchList = {
        batches: batches.slice(start, start + pageSize).map(toBatchSummary),
        pagination: { page: safePage, pageSize, total, totalPages }
      };
      return ok(data);
    }
  );

  app.get<{ Params: { batchId: string } }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId",
    {
      schema: {
        params: ChatterboxBatchIdParamsSchema,
        response: { 200: apiSuccessSchema(ChatterboxBatchSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const batch = store.get(request.params.batchId);
      if (!batch) return reply.code(404).send(fail("CHATTERBOX_BATCH_NOT_FOUND", "声音克隆批次不存在"));
      return ok(toPublicBatch(batch));
    }
  );

  const cleanupTimer = setInterval(
    () => void store.cleanupExpired((batchId) => queue.hasActiveBatch(batchId)),
    15 * 60 * 1000
  );
  cleanupTimer.unref();
  app.addHook("onClose", async () => clearInterval(cleanupTimer));
  return queue;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
