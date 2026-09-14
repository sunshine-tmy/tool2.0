import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { ZipArchive } from "archiver";
import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import {
  ApiFailureSchema,
  ChatterboxBatchItemRemovalSchema,
  ChatterboxBatchIdParamsSchema,
  ChatterboxBatchItemParamsSchema,
  ChatterboxBatchListSchema,
  ChatterboxBatchOrderSchema,
  ChatterboxBatchSchema,
  ChatterboxListQuerySchema,
  CHATTERBOX_MAX_BATCH_TEXT_LENGTH,
  CHATTERBOX_MAX_REFERENCE_TRANSLATION_LENGTH,
  CHATTERBOX_MAX_TEXT_LENGTH,
  ChatterboxRemovalSchema,
  apiSuccessSchema,
  fail,
  ok,
  type ChatterboxBatchIdParams,
  type ChatterboxBatchItemParams,
  type ChatterboxBatchList,
  type ChatterboxBatchOrder,
  type ChatterboxListQuery
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import { REQUEST_QUOTAS } from "../../security/request-quotas";
import type { TaskStore } from "../../tasks/task-store";
import {
  batchFileName,
  bilingualSubtitleFileName,
  buildManifest,
  combinedAudioFileName,
  contentDisposition,
  ensureBatchAudio,
  fileExists,
  hasReferenceTranslation,
  itemDownloadName,
  orderedItems,
  rebuildBatchAudio,
  rebuildBatchSubtitles,
  replaceFile,
  sanitizeFileName,
  sendBatchAudio,
  sourceSubtitleFileName,
  toBatchSummary,
  toPublicBatch,
  translationSubtitleFileName
} from "./batch-artifacts";
import { parseBatchFields, receiveBatchMultipart } from "./batch-input";
import { ChatterboxBatchQueue, type ChatterboxMediaTools as MediaTools } from "./batch-queue";
import { BatchInputError, mapBatchError } from "./errors";
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
  externalQueueStats?: () => { active: number; queued: number };
}) {
  const { app, config, worker, media, database, taskStore } = options;
  const store = new ChatterboxBatchStore(path.join(config.chatterboxDir, "batches"), database, taskStore);
  const voiceStore = new ChatterboxVoiceStore(path.join(config.chatterboxDir, "voices"), database);
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
        if (!health.available) {
          return reply.code(409).send(fail("CHATTERBOX_NOT_AVAILABLE", "Chatterbox Worker 尚未就绪"));
        }
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
          if (!savedVoice) {
            throw new BatchInputError("CHATTERBOX_REFERENCE_REQUIRED", "请上传参考音频或选择已保存音色", 400);
          }
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
      const query = request.query;
      const page = positiveInteger(query.page, 1);
      const pageSize = Math.min(50, positiveInteger(query.pageSize, 10));
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

  app.get<{ Params: ChatterboxBatchIdParams }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId",
    {
      schema: {
        params: ChatterboxBatchIdParamsSchema,
        response: { 200: apiSuccessSchema(ChatterboxBatchSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const batch = store.get(batchIdFrom(request.params));
      if (!batch) return reply.code(404).send(fail("CHATTERBOX_BATCH_NOT_FOUND", "声音克隆批次不存在"));
      return ok(toPublicBatch(batch));
    }
  );

  app.get<{ Params: ChatterboxBatchItemParams }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId/items/:itemId/audio",
    { schema: { params: ChatterboxBatchItemParamsSchema } },
    async (request, reply) => sendBatchAudio(store, request.params, reply, false)
  );

  app.get<{ Params: ChatterboxBatchItemParams }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId/items/:itemId/download",
    { schema: { params: ChatterboxBatchItemParamsSchema } },
    async (request, reply) => sendBatchAudio(store, request.params, reply, true)
  );

  app.get<{ Params: ChatterboxBatchIdParams }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId/combined-audio",
    { schema: { params: ChatterboxBatchIdParamsSchema } },
    async (request, reply) => {
      const batchId = batchIdFrom(request.params);
      const batch = store.get(batchId);
      if (!batch) return reply.code(404).send(fail("CHATTERBOX_BATCH_NOT_FOUND", "声音克隆批次不存在"));
      if (batch.status !== "completed" || batch.items.length < 2) {
        return reply.code(409).send(fail("CHATTERBOX_COMBINED_AUDIO_NOT_READY", "至少两个文案段完成后才能下载总音频"));
      }
      try {
        await ensureBatchAudio(store, batch, media);
        const filePath = store.paths(batchId).combinedAudio;
        const stat = await fsp.stat(filePath);
        reply.header("content-type", "audio/mpeg");
        reply.header("content-length", String(stat.size));
        reply.header("content-disposition", contentDisposition(combinedAudioFileName(batch)));
        reply.header("x-content-type-options", "nosniff");
        return reply.send(fs.createReadStream(filePath));
      } catch {
        return reply.code(404).send(fail("CHATTERBOX_FILE_NOT_FOUND", "总音频不存在或生成失败"));
      }
    }
  );

  app.get<{ Params: ChatterboxBatchIdParams }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId/subtitle",
    { schema: { params: ChatterboxBatchIdParamsSchema } },
    async (request, reply) => {
      const batchId = batchIdFrom(request.params);
      const batch = store.get(batchId);
      if (!batch) return reply.code(404).send(fail("CHATTERBOX_BATCH_NOT_FOUND", "声音克隆批次不存在"));
      if (!batch.includeSubtitles || batch.status !== "completed") {
        return reply.code(409).send(fail("CHATTERBOX_SUBTITLE_NOT_READY", "所有文案段完成后才能下载总 SRT"));
      }
      try {
        await rebuildBatchSubtitles(store, batch);
        const filePath = store.paths(batchId).subtitle;
        const stat = await fsp.stat(filePath);
        reply.header("content-type", "application/x-subrip; charset=utf-8");
        reply.header("content-length", String(stat.size));
        reply.header("content-disposition", contentDisposition(sourceSubtitleFileName(batch)));
        reply.header("x-content-type-options", "nosniff");
        return reply.send(fs.createReadStream(filePath));
      } catch {
        return reply.code(404).send(fail("CHATTERBOX_FILE_NOT_FOUND", "总字幕不存在或已过期"));
      }
    }
  );

  app.get<{ Params: ChatterboxBatchIdParams }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId/subtitle.zh-CN",
    { schema: { params: ChatterboxBatchIdParamsSchema } },
    async (request, reply) => {
      const batchId = batchIdFrom(request.params);
      const batch = store.get(batchId);
      if (!batch) return reply.code(404).send(fail("CHATTERBOX_BATCH_NOT_FOUND", "声音克隆批次不存在"));
      if (!batch.includeSubtitles || batch.status !== "completed") {
        return reply.code(409).send(fail("CHATTERBOX_SUBTITLE_NOT_READY", "所有文案段完成后才能下载中文字幕"));
      }
      if (!hasReferenceTranslation(batch)) {
        return reply.code(404).send(fail("CHATTERBOX_TRANSLATION_SUBTITLE_NOT_FOUND", "该批次没有填写中文翻译"));
      }
      try {
        // Rebuild on download so older completed batches can gain the separate
        // Chinese subtitle without regenerating any audio.
        await rebuildBatchSubtitles(store, batch);
        const filePath = store.paths(batchId).translationSubtitle;
        const stat = await fsp.stat(filePath);
        reply.header("content-type", "application/x-subrip; charset=utf-8");
        reply.header("content-length", String(stat.size));
        reply.header("content-disposition", contentDisposition(translationSubtitleFileName(batch)));
        reply.header("x-content-type-options", "nosniff");
        return reply.send(fs.createReadStream(filePath));
      } catch {
        return reply.code(404).send(fail("CHATTERBOX_FILE_NOT_FOUND", "中文字幕不存在或已过期"));
      }
    }
  );

  app.get<{ Params: ChatterboxBatchIdParams }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId/subtitle.bilingual",
    { schema: { params: ChatterboxBatchIdParamsSchema } },
    async (request, reply) => {
      const batchId = batchIdFrom(request.params);
      const batch = store.get(batchId);
      if (!batch) return reply.code(404).send(fail("CHATTERBOX_BATCH_NOT_FOUND", "声音克隆批次不存在"));
      if (!batch.includeSubtitles || batch.status !== "completed" || batch.items.length < 2) {
        return reply.code(409).send(fail("CHATTERBOX_SUBTITLE_NOT_READY", "至少两个文案段完成后才能下载双语字幕"));
      }
      if (!hasReferenceTranslation(batch)) {
        return reply.code(404).send(fail("CHATTERBOX_TRANSLATION_SUBTITLE_NOT_FOUND", "该批次没有填写中文翻译"));
      }
      try {
        await rebuildBatchSubtitles(store, batch);
        const filePath = store.paths(batchId).bilingualSubtitle;
        const stat = await fsp.stat(filePath);
        reply.header("content-type", "application/x-subrip; charset=utf-8");
        reply.header("content-length", String(stat.size));
        reply.header("content-disposition", contentDisposition(bilingualSubtitleFileName(batch)));
        reply.header("x-content-type-options", "nosniff");
        return reply.send(fs.createReadStream(filePath));
      } catch {
        return reply.code(404).send(fail("CHATTERBOX_FILE_NOT_FOUND", "双语字幕不存在或已过期"));
      }
    }
  );

  app.get<{ Params: ChatterboxBatchIdParams }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId/download.zip",
    { schema: { params: ChatterboxBatchIdParamsSchema } },
    async (request, reply) => {
      const batchId = batchIdFrom(request.params);
      const batch = store.get(batchId);
      if (!batch) return reply.code(404).send(fail("CHATTERBOX_BATCH_NOT_FOUND", "声音克隆批次不存在"));
      const completed = orderedItems(batch).filter((item) => item.audioBytes);
      if (!completed.length)
        return reply.code(409).send(fail("CHATTERBOX_BATCH_NOT_READY", "批次中还没有可下载的音频"));
      if (batch.status === "completed" && batch.items.length > 1) await ensureBatchAudio(store, batch, media);
      if (batch.status === "completed" && batch.includeSubtitles) await rebuildBatchSubtitles(store, batch);
      const archive = new ZipArchive({ zlib: { level: 6 } });
      archive.on("warning", (error) => app.log.warn(error));
      archive.on("error", (error) => reply.raw.destroy(error));
      reply.header("content-type", "application/zip");
      reply.header("content-disposition", contentDisposition(`${batchFileName(batch)}.zip`));
      reply.send(archive);
      for (const item of completed) {
        archive.file(store.itemPaths(batchId, item.id).audio, { name: `audio/${itemDownloadName(item)}.mp3` });
      }
      if (batch.status === "completed" && batch.items.length > 1) {
        archive.file(store.paths(batchId).combinedAudio, { name: combinedAudioFileName(batch) });
      }
      if (batch.status === "completed" && batch.includeSubtitles) {
        archive.file(store.paths(batchId).subtitle, { name: sourceSubtitleFileName(batch) });
        if (hasReferenceTranslation(batch)) {
          archive.file(store.paths(batchId).translationSubtitle, { name: translationSubtitleFileName(batch) });
          if (batch.items.length > 1) {
            archive.file(store.paths(batchId).bilingualSubtitle, { name: bilingualSubtitleFileName(batch) });
          }
        }
      }
      archive.append(buildManifest(batch), { name: "manifest.txt" });
      void archive.finalize();
      return reply;
    }
  );

  app.post<{ Params: ChatterboxBatchItemParams }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId/items/:itemId/regenerate",
    {
      schema: {
        params: ChatterboxBatchItemParamsSchema,
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
      const ids = idsFrom(request.params);
      const batch = store.get(ids.batchId);
      const item = batch?.items.find((entry) => entry.id === ids.itemId);
      if (!batch || !item) return reply.code(404).send(fail("CHATTERBOX_BATCH_ITEM_NOT_FOUND", "文案段不存在"));
      if (queue.isActive(ids.batchId, ids.itemId) || item.status === "queued" || item.status === "processing") {
        return reply.code(409).send(fail("CHATTERBOX_BATCH_ITEM_ACTIVE", "该文案段正在生成"));
      }
      const paths = store.paths(ids.batchId);
      try {
        if (queueLoad() >= config.chatterboxQueueLimit) {
          throw new BatchInputError("CHATTERBOX_QUEUE_FULL", "声音克隆队列已满，请稍后重试", 429);
        }
        const uploaded = await receiveBatchMultipart(request.parts(), `${paths.referenceUpload}.retry`, false);
        const text = (uploaded.fields.text || item.text).trim();
        if (!text || text.length > CHATTERBOX_MAX_TEXT_LENGTH) {
          throw new BatchInputError(
            "CHATTERBOX_TEXT_TOO_LONG",
            `每段文案必须为 1–${CHATTERBOX_MAX_TEXT_LENGTH} 个字符`,
            413
          );
        }
        const referenceTranslation =
          uploaded.fields.referenceTranslation === undefined
            ? item.referenceTranslation
            : uploaded.fields.referenceTranslation.trim() || undefined;
        if (referenceTranslation && referenceTranslation.length > CHATTERBOX_MAX_REFERENCE_TRANSLATION_LENGTH) {
          throw new BatchInputError(
            "CHATTERBOX_REFERENCE_TRANSLATION_TOO_LONG",
            `中文参考翻译不能超过 ${CHATTERBOX_MAX_REFERENCE_TRANSLATION_LENGTH} 个字符`,
            413
          );
        }
        const totalCharacters = batch.items.reduce(
          (sum, entry) => sum + (entry.id === ids.itemId ? text.length : entry.characterCount),
          0
        );
        if (totalCharacters > CHATTERBOX_MAX_BATCH_TEXT_LENGTH) {
          throw new BatchInputError(
            "CHATTERBOX_BATCH_TEXT_TOO_LONG",
            `整个批次不能超过 ${CHATTERBOX_MAX_BATCH_TEXT_LENGTH} 个字符`,
            413
          );
        }
        const seed =
          uploaded.fields.seed === undefined ? item.seed : boundedInteger(uploaded.fields.seed, 0, 2_147_483_647);
        if (uploaded.fields.seed !== undefined && seed === undefined) {
          throw new BatchInputError("CHATTERBOX_PARAMETER_INVALID", "随机种子超出允许范围", 400);
        }
        const exaggeration =
          uploaded.fields.exaggeration === undefined
            ? item.exaggeration
            : boundedNumber(uploaded.fields.exaggeration, 0.25, 1.5);
        const cfgWeight =
          uploaded.fields.cfgWeight === undefined ? item.cfgWeight : boundedNumber(uploaded.fields.cfgWeight, 0, 1);
        const temperature =
          uploaded.fields.temperature === undefined
            ? item.temperature
            : boundedNumber(uploaded.fields.temperature, 0.1, 1.5);
        if (
          (uploaded.fields.exaggeration !== undefined && exaggeration === undefined) ||
          (uploaded.fields.cfgWeight !== undefined && cfgWeight === undefined) ||
          (uploaded.fields.temperature !== undefined && temperature === undefined)
        ) {
          throw new BatchInputError("CHATTERBOX_PARAMETER_INVALID", "声音克隆参数超出允许范围", 400);
        }
        if (uploaded.receivedFile) {
          const retryReference = path.join(paths.dir, "reference-retry.wav");
          const duration = await media.normalizeReference(`${paths.referenceUpload}.retry`, retryReference);
          if (Math.abs(duration - batch.referenceDurationSeconds) > 0.001) {
            await store.updateBatch(ids.batchId, { referenceDurationSeconds: duration });
          }
          await replaceFile(retryReference, paths.reference);
          await store.updateBatch(ids.batchId, { referenceAvailable: true });
        } else if (uploaded.fields.voiceId) {
          const savedVoice = voiceStore.get(uploaded.fields.voiceId);
          if (!savedVoice) {
            throw new BatchInputError("CHATTERBOX_VOICE_NOT_FOUND", "保存的参考音色不存在", 404);
          }
          if (savedVoice.language !== batch.language) {
            throw new BatchInputError("CHATTERBOX_VOICE_LANGUAGE_MISMATCH", "保存音色的语言与当前目标语言不一致", 400);
          }
          const retryReference = path.join(paths.dir, "reference-retry.wav");
          await fsp.copyFile(voiceStore.paths(savedVoice.id).audio, retryReference);
          await replaceFile(retryReference, paths.reference);
          await store.updateBatch(ids.batchId, {
            referenceDurationSeconds: savedVoice.durationSeconds,
            referenceFileName: savedVoice.name,
            referenceAvailable: true
          });
        } else if (!batch.referenceAvailable || !(await fileExists(paths.reference))) {
          throw new BatchInputError("CHATTERBOX_REFERENCE_REQUIRED", "参考音色已删除，请重新上传或选择已保存音色", 409);
        }
        await store.updateItem(ids.batchId, ids.itemId, {
          text,
          referenceTranslation,
          fileName: uploaded.fields.fileName ? sanitizeFileName(uploaded.fields.fileName) : item.fileName,
          seed,
          exaggeration,
          cfgWeight,
          temperature,
          characterCount: text.length,
          status: "queued",
          progress: 0,
          attempt: item.attempt + 1,
          error: undefined
        });
        await store.extendExpiry(ids.batchId, config.chatterboxRetentionDays);
        queue.enqueue(ids.batchId, ids.itemId);
        return reply.code(202).send(ok(toPublicBatch(store.get(ids.batchId)!)));
      } catch (error) {
        await fsp.rm(`${paths.referenceUpload}.retry`, { force: true });
        const mapped = mapBatchError(error);
        return reply.code(mapped.statusCode).send(fail(mapped.code, mapped.message));
      }
    }
  );

  app.patch<{ Params: ChatterboxBatchIdParams; Body: ChatterboxBatchOrder }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId/order",
    {
      schema: {
        params: ChatterboxBatchIdParamsSchema,
        body: ChatterboxBatchOrderSchema,
        response: {
          200: apiSuccessSchema(ChatterboxBatchSchema),
          400: ApiFailureSchema,
          404: ApiFailureSchema,
          409: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      const batchId = batchIdFrom(request.params);
      const batch = store.get(batchId);
      if (!batch) return reply.code(404).send(fail("CHATTERBOX_BATCH_NOT_FOUND", "声音克隆批次不存在"));
      if (queue.hasActiveBatch(batchId)) {
        return reply.code(409).send(fail("CHATTERBOX_BATCH_ACTIVE", "批次生成过程中不能调整顺序"));
      }
      const { itemIds } = request.body;
      try {
        const updated = await store.reorder(batchId, itemIds);
        if (updated.status === "completed") {
          if (updated.items.length > 1) await rebuildBatchAudio(store, updated, media);
          if (updated.includeSubtitles) await rebuildBatchSubtitles(store, updated);
        }
        return ok(toPublicBatch(updated));
      } catch (error) {
        return reply
          .code(400)
          .send(fail("CHATTERBOX_ORDER_INVALID", error instanceof Error ? error.message : "顺序无效"));
      }
    }
  );

  app.delete<{ Params: ChatterboxBatchItemParams }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId/items/:itemId",
    {
      schema: {
        params: ChatterboxBatchItemParamsSchema,
        response: {
          200: apiSuccessSchema(ChatterboxBatchItemRemovalSchema),
          404: ApiFailureSchema,
          409: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      const ids = idsFrom(request.params);
      const batch = store.get(ids.batchId);
      if (!batch?.items.some((item) => item.id === ids.itemId)) {
        return reply.code(404).send(fail("CHATTERBOX_BATCH_ITEM_NOT_FOUND", "文案段不存在"));
      }
      if (batch.items.length <= 1) {
        return reply.code(409).send(fail("CHATTERBOX_BATCH_ITEM_REQUIRED", "批次至少需要保留一个文案段"));
      }
      if (queue.isActive(ids.batchId, ids.itemId)) {
        return reply.code(409).send(fail("CHATTERBOX_BATCH_ITEM_ACTIVE", "正在生成的文案段不能删除"));
      }
      queue.removePending(ids.batchId, ids.itemId);
      const updated = await store.removeItem(ids.batchId, ids.itemId);
      if (updated?.status === "completed") {
        if (updated.items.length > 1) await rebuildBatchAudio(store, updated, media);
        else await fsp.rm(store.paths(updated.id).combinedAudio, { force: true });
        if (updated.includeSubtitles) await rebuildBatchSubtitles(store, updated);
      }
      return ok({ removed: true, batch: updated ? toPublicBatch(updated) : undefined });
    }
  );

  app.post<{ Params: ChatterboxBatchIdParams }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId/cancel",
    {
      schema: {
        params: ChatterboxBatchIdParamsSchema,
        response: { 200: apiSuccessSchema(ChatterboxBatchSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const batchId = batchIdFrom(request.params);
      const batch = store.get(batchId);
      if (!batch) return reply.code(404).send(fail("CHATTERBOX_BATCH_NOT_FOUND", "声音克隆批次不存在"));
      queue.cancelPendingBatch(batchId);
      for (const item of batch.items) {
        if (item.status === "queued") {
          await store.updateItem(
            batchId,
            item.id,
            { status: "cancelled", progress: 100 },
            { deferTerminalStatus: true }
          );
        }
      }
      const snapshot = store.get(batchId);
      if (
        snapshot &&
        !snapshot.referenceRetained &&
        !snapshot.items.some((item) => item.status === "queued" || item.status === "processing")
      ) {
        await fsp.rm(store.paths(batchId).reference, { force: true });
        await store.updateBatch(batchId, { referenceAvailable: false });
      }
      const updated = await store.recalculate(batchId);
      return ok(toPublicBatch(updated!));
    }
  );

  app.delete<{ Params: ChatterboxBatchIdParams }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId/reference",
    {
      schema: {
        params: ChatterboxBatchIdParamsSchema,
        response: { 200: apiSuccessSchema(ChatterboxRemovalSchema), 404: ApiFailureSchema, 409: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const batchId = batchIdFrom(request.params);
      const batch = store.get(batchId);
      if (!batch) return reply.code(404).send(fail("CHATTERBOX_BATCH_NOT_FOUND", "声音克隆批次不存在"));
      if (queue.hasActiveBatch(batchId)) {
        return reply.code(409).send(fail("CHATTERBOX_BATCH_ACTIVE", "批次生成结束后才能删除参考音色"));
      }
      await fsp.rm(store.paths(batchId).reference, { force: true });
      await store.updateBatch(batchId, { referenceAvailable: false, referenceRetained: false });
      return ok({ removed: true });
    }
  );

  app.delete<{ Params: ChatterboxBatchIdParams }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId",
    {
      schema: {
        params: ChatterboxBatchIdParamsSchema,
        response: { 200: apiSuccessSchema(ChatterboxRemovalSchema), 404: ApiFailureSchema, 409: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const batchId = batchIdFrom(request.params);
      if (!store.get(batchId)) return reply.code(404).send(fail("CHATTERBOX_BATCH_NOT_FOUND", "声音克隆批次不存在"));
      if (queue.hasActiveBatch(batchId)) {
        return reply.code(409).send(fail("CHATTERBOX_BATCH_ACTIVE", "本地模型正在生成，完成后即可删除"));
      }
      queue.cancelPendingBatch(batchId);
      await store.remove(batchId);
      return ok({ removed: true });
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function batchIdFrom(params: unknown) {
  return isRecord(params) && typeof params.batchId === "string" ? params.batchId : "";
}

function idsFrom(params: unknown) {
  return {
    batchId: batchIdFrom(params),
    itemId: isRecord(params) && typeof params.itemId === "string" ? params.itemId : ""
  };
}
