import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { ZipArchive } from "archiver";
import type { FastifyInstance, FastifyReply } from "fastify";
import { nanoid } from "nanoid";
import {
  ApiFailureSchema,
  CHATTERBOX_LANGUAGES,
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
  ChatterboxSavedVoiceListSchema,
  ChatterboxSavedVoiceSchema,
  ChatterboxVoiceIdParamsSchema,
  apiSuccessSchema,
  fail,
  ok,
  type ChatterboxBatch,
  type ChatterboxBatchIdParams,
  type ChatterboxBatchItemParams,
  type ChatterboxBatchItem,
  type ChatterboxBatchList,
  type ChatterboxBatchOrder,
  type ChatterboxLanguage,
  type ChatterboxListQuery,
  type ChatterboxSavedVoice,
  type ChatterboxSavedVoiceList,
  type ChatterboxVoiceAuthorization,
  type ChatterboxVoiceIdParams
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { TaskStore } from "../../tasks/task-store";
import { parseBatchFields, receiveBatchMultipart } from "./batch-input";
import { ChatterboxBatchQueue, type ChatterboxMediaTools as MediaTools } from "./batch-queue";
import { BatchInputError, mapBatchError } from "./errors";
import { ChatterboxBatchStore, ChatterboxVoiceStore, type StoredVoice } from "./stores";
import type { createChatterboxWorkerClient } from "./worker-client";

type WorkerClient = ReturnType<typeof createChatterboxWorkerClient>;

type TimingSegment = { text: string; startSeconds: number; endSeconds: number };

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

  app.get(
    "/api/v1/tools/edge-tts/chatterbox/voices",
    { schema: { response: { 200: apiSuccessSchema(ChatterboxSavedVoiceListSchema) } } },
    async () => {
      const data: ChatterboxSavedVoiceList = { voices: voiceStore.list().map(toPublicVoice) };
      return ok(data);
    }
  );

  app.post(
    "/api/v1/tools/edge-tts/chatterbox/voices",
    {
      schema: {
        response: {
          201: apiSuccessSchema(ChatterboxSavedVoiceSchema),
          400: ApiFailureSchema,
          404: ApiFailureSchema,
          409: ApiFailureSchema,
          413: ApiFailureSchema,
          429: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      const voiceId = nanoid(12);
      const paths = voiceStore.paths(voiceId);
      await fsp.mkdir(paths.dir, { recursive: true });
      try {
        const uploaded = await receiveBatchMultipart(request.parts(), paths.upload, true);
        const name = uploaded.fields.name?.trim();
        if (!name) throw new BatchInputError("CHATTERBOX_VOICE_NAME_REQUIRED", "请输入音色名称", 400);
        if (!isLanguage(uploaded.fields.language)) {
          throw new BatchInputError("CHATTERBOX_LANGUAGE_INVALID", "仅支持马来语、英语或巴西葡萄牙语", 400);
        }
        if (!isAuthorization(uploaded.fields.authorization)) {
          throw new BatchInputError("CHATTERBOX_AUTHORIZATION_REQUIRED", "请选择声音授权来源", 400);
        }
        if (uploaded.fields.consentConfirmed !== "true") {
          throw new BatchInputError("CHATTERBOX_CONSENT_REQUIRED", "必须确认已获得参考声音的合法授权", 400);
        }
        const durationSeconds = await media.normalizeReference(paths.upload, paths.audio);
        const audioBytes = (await fsp.stat(paths.audio)).size;
        const voice = await voiceStore.create({
          id: voiceId,
          name: sanitizeFileName(name),
          language: uploaded.fields.language,
          originalFileName: uploaded.referenceFileName,
          durationSeconds,
          audioBytes,
          authorization: uploaded.fields.authorization,
          consentConfirmed: true
        });
        return reply.code(201).send(ok(toPublicVoice(voice)));
      } catch (error) {
        await fsp.rm(paths.dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        const mapped = mapBatchError(error);
        return reply.code(mapped.statusCode).send(fail(mapped.code, mapped.message));
      }
    }
  );

  app.get<{ Params: ChatterboxVoiceIdParams }>(
    "/api/v1/tools/edge-tts/chatterbox/voices/:voiceId/audio",
    { schema: { params: ChatterboxVoiceIdParamsSchema } },
    async (request, reply) => {
      const voiceId = voiceIdFrom(request.params);
      const voice = voiceStore.get(voiceId);
      if (!voice) return reply.code(404).send(fail("CHATTERBOX_VOICE_NOT_FOUND", "保存的参考音色不存在"));
      try {
        const stat = await fsp.stat(voiceStore.paths(voiceId).audio);
        reply.header("content-type", "audio/wav");
        reply.header("content-length", String(stat.size));
        reply.header("cache-control", "private, max-age=3600");
        reply.header("x-content-type-options", "nosniff");
        return reply.send(fs.createReadStream(voiceStore.paths(voiceId).audio));
      } catch {
        return reply.code(404).send(fail("CHATTERBOX_FILE_NOT_FOUND", "参考音色文件不存在"));
      }
    }
  );

  app.delete<{ Params: ChatterboxVoiceIdParams }>(
    "/api/v1/tools/edge-tts/chatterbox/voices/:voiceId",
    {
      schema: {
        params: ChatterboxVoiceIdParamsSchema,
        response: { 200: apiSuccessSchema(ChatterboxRemovalSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const voiceId = voiceIdFrom(request.params);
      if (!voiceStore.get(voiceId)) {
        return reply.code(404).send(fail("CHATTERBOX_VOICE_NOT_FOUND", "保存的参考音色不存在"));
      }
      await voiceStore.remove(voiceId);
      return ok({ removed: true });
    }
  );

  app.post(
    "/api/v1/tools/edge-tts/chatterbox/batches",
    {
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

async function rebuildBatchAudio(store: ChatterboxBatchStore, batch: ChatterboxBatch, media: MediaTools) {
  const audioPaths = orderedItems(batch).map((item) => store.itemPaths(batch.id, item.id).audio);
  await media.concatMp3(audioPaths, store.paths(batch.id).combinedAudio);
}

async function ensureBatchAudio(store: ChatterboxBatchStore, batch: ChatterboxBatch, media: MediaTools) {
  if (!(await fileExists(store.paths(batch.id).combinedAudio))) await rebuildBatchAudio(store, batch, media);
}

async function rebuildBatchSubtitles(store: ChatterboxBatchStore, batch: ChatterboxBatch) {
  const sourceCues: TimingSegment[] = [];
  const translationCues: TimingSegment[] = [];
  const bilingualCues: TimingSegment[] = [];
  let offset = 0;
  for (const item of orderedItems(batch)) {
    const duration = item.audioDurationSeconds || 0;
    const timing = await readTiming(store.itemPaths(batch.id, item.id).timing);
    const localCues =
      batch.subtitleMode === "segments"
        ? [{ text: item.text, startSeconds: 0, endSeconds: duration }]
        : buildSentenceCues(item.text, duration, timing);
    sourceCues.push(
      ...localCues.map((cue) => ({
        ...cue,
        startSeconds: cue.startSeconds + offset,
        endSeconds: cue.endSeconds + offset
      }))
    );
    translationCues.push(
      ...buildTranslationCues(localCues, item.referenceTranslation, duration).map((cue) => ({
        ...cue,
        startSeconds: cue.startSeconds + offset,
        endSeconds: cue.endSeconds + offset
      }))
    );
    bilingualCues.push(
      ...buildBilingualCues(localCues, item.text, item.referenceTranslation, duration).map((cue) => ({
        ...cue,
        startSeconds: cue.startSeconds + offset,
        endSeconds: cue.endSeconds + offset
      }))
    );
    offset += duration;
  }
  await writeSrt(store.paths(batch.id).subtitle, sourceCues);
  if (translationCues.length) {
    await Promise.all([
      writeSrt(store.paths(batch.id).translationSubtitle, translationCues),
      writeSrt(store.paths(batch.id).bilingualSubtitle, bilingualCues)
    ]);
  } else {
    await Promise.all([
      fsp.rm(store.paths(batch.id).translationSubtitle, { force: true }),
      fsp.rm(store.paths(batch.id).bilingualSubtitle, { force: true })
    ]);
  }
}

async function writeSrt(filePath: string, cues: TimingSegment[]) {
  const content = cues
    .map(
      (cue, index) =>
        `${index + 1}\n${srtTimestamp(cue.startSeconds)} --> ${srtTimestamp(cue.endSeconds)}\n${formatSubtitleCueText(cue.text)}`
    )
    .join("\n\n");
  await fsp.writeFile(filePath, `${content}\n`, "utf8");
}

function buildBilingualCues(
  cues: TimingSegment[],
  sourceText: string,
  referenceTranslation: string | undefined,
  duration: number
): TimingSegment[] {
  const translation = referenceTranslation?.replace(/\s+/g, " ").trim();
  if (!translation) return cues;
  const translatedSentences = splitSentences(translation);
  if (translatedSentences.length !== cues.length) {
    return [{ text: `${sourceText}\n${translation}`, startSeconds: 0, endSeconds: duration }];
  }
  return cues.map((cue, index) => ({ ...cue, text: `${cue.text}\n${translatedSentences[index]}` }));
}

function formatSubtitleCueText(text: string) {
  return text
    .split("\n")
    .map((line) => wrapSubtitleLines(line))
    .join("\n");
}

function buildTranslationCues(
  cues: TimingSegment[],
  referenceTranslation: string | undefined,
  duration: number
): TimingSegment[] {
  const translation = referenceTranslation?.replace(/\s+/g, " ").trim();
  if (!translation) return [];
  const translatedSentences = splitSentences(translation);
  if (translatedSentences.length !== cues.length) {
    return [{ text: translation, startSeconds: 0, endSeconds: duration }];
  }
  return cues.map((cue, index) => ({ ...cue, text: translatedSentences[index] }));
}

function buildSentenceCues(text: string, durationSeconds: number, segments?: TimingSegment[]): TimingSegment[] {
  const sentences = splitSentences(text);
  const sentenceWeights = sentences.map(textWeight);
  const totalSentenceWeight = sentenceWeights.reduce((sum, weight) => sum + weight, 0);
  const validSegments = validTimingSegments(segments, durationSeconds) ? segments : undefined;
  if (!validSegments) {
    let elapsed = 0;
    return sentences.map((sentence, index) => {
      const startSeconds = (elapsed / totalSentenceWeight) * durationSeconds;
      elapsed += sentenceWeights[index];
      return { text: sentence, startSeconds, endSeconds: (elapsed / totalSentenceWeight) * durationSeconds };
    });
  }
  const segmentWeights = validSegments.map((segment) => textWeight(segment.text));
  const totalSegmentWeight = segmentWeights.reduce((sum, weight) => sum + weight, 0);
  let elapsed = 0;
  return sentences.map((sentence, index) => {
    const startWeight = (elapsed / totalSentenceWeight) * totalSegmentWeight;
    elapsed += sentenceWeights[index];
    const endWeight = (elapsed / totalSentenceWeight) * totalSegmentWeight;
    return {
      text: sentence,
      startSeconds: timingAtWeight(startWeight, "start", validSegments, segmentWeights),
      endSeconds: timingAtWeight(endWeight, "end", validSegments, segmentWeights)
    };
  });
}

function timingAtWeight(target: number, edge: "start" | "end", segments: TimingSegment[], weights: number[]) {
  let elapsed = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const next = elapsed + weights[index];
    if (target < next || (edge === "end" && target <= next)) {
      const ratio = Math.max(0, Math.min(1, (target - elapsed) / weights[index]));
      return segments[index].startSeconds + (segments[index].endSeconds - segments[index].startSeconds) * ratio;
    }
    elapsed = next;
  }
  return segments.at(-1)!.endSeconds;
}

function validTimingSegments(segments: TimingSegment[] | undefined, duration: number): segments is TimingSegment[] {
  return Boolean(
    segments?.length &&
    segments.every(
      (segment) =>
        segment.text.trim() &&
        Number.isFinite(segment.startSeconds) &&
        Number.isFinite(segment.endSeconds) &&
        segment.startSeconds >= 0 &&
        segment.endSeconds > segment.startSeconds &&
        segment.endSeconds <= duration + 0.25
    )
  );
}

async function readTiming(filePath: string) {
  try {
    return JSON.parse(await fsp.readFile(filePath, "utf8")) as TimingSegment[];
  } catch {
    return undefined;
  }
}

async function sendBatchAudio(
  store: ChatterboxBatchStore,
  ids: { batchId: string; itemId: string },
  reply: FastifyReply,
  download: boolean
) {
  const batch = store.get(ids.batchId);
  const item = batch?.items.find((entry) => entry.id === ids.itemId);
  if (!batch || !item) return reply.code(404).send(fail("CHATTERBOX_BATCH_ITEM_NOT_FOUND", "文案段不存在"));
  if (!item.audioBytes) return reply.code(409).send(fail("CHATTERBOX_BATCH_ITEM_NOT_READY", "该文案段还没有可用音频"));
  try {
    const filePath = store.itemPaths(ids.batchId, ids.itemId).audio;
    const stat = await fsp.stat(filePath);
    reply.header("content-type", "audio/mpeg");
    reply.header("content-length", String(stat.size));
    reply.header("x-content-type-options", "nosniff");
    if (download) reply.header("content-disposition", contentDisposition(`${itemDownloadName(item)}.mp3`));
    else reply.header("cache-control", "private, max-age=3600");
    return reply.send(fs.createReadStream(filePath));
  } catch {
    return reply.code(404).send(fail("CHATTERBOX_FILE_NOT_FOUND", "音频不存在或已过期"));
  }
}

function toPublicBatch(batch: ChatterboxBatch): ChatterboxBatch {
  const result = cloneBatch(batch);
  result.items = result.items.map((item) => {
    if (item.audioBytes) {
      item.audioUrl = `/api/v1/tools/edge-tts/chatterbox/batches/${batch.id}/items/${item.id}/audio`;
      item.downloadUrl = `/api/v1/tools/edge-tts/chatterbox/batches/${batch.id}/items/${item.id}/download`;
    }
    return item;
  });
  if (result.completedItems) result.archiveUrl = `/api/v1/tools/edge-tts/chatterbox/batches/${batch.id}/download.zip`;
  if (result.status === "completed" && result.items.length > 1) {
    result.combinedAudioUrl = `/api/v1/tools/edge-tts/chatterbox/batches/${batch.id}/combined-audio`;
  }
  if (result.status === "completed" && result.includeSubtitles) {
    result.subtitleUrl = `/api/v1/tools/edge-tts/chatterbox/batches/${batch.id}/subtitle`;
    if (hasReferenceTranslation(result)) {
      result.translationSubtitleUrl = `/api/v1/tools/edge-tts/chatterbox/batches/${batch.id}/subtitle.zh-CN`;
      if (result.items.length > 1) {
        result.bilingualSubtitleUrl = `/api/v1/tools/edge-tts/chatterbox/batches/${batch.id}/subtitle.bilingual`;
      }
    }
  }
  return result;
}

function hasReferenceTranslation(batch: ChatterboxBatch) {
  return batch.items.some((item) => Boolean(item.referenceTranslation?.trim()));
}

function toPublicVoice(voice: StoredVoice): ChatterboxSavedVoice {
  return { ...voice, audioUrl: `/api/v1/tools/edge-tts/chatterbox/voices/${voice.id}/audio` };
}

function toBatchSummary(batch: ChatterboxBatch) {
  const { items, ...summary } = toPublicBatch(batch);
  return {
    ...summary,
    itemPreviews: items.map(({ text, ...item }) => {
      delete item.referenceTranslation;
      return {
        ...item,
        textPreview: text.length > 120 ? `${text.slice(0, 120)}…` : text
      };
    })
  };
}

function orderedItems(batch: ChatterboxBatch) {
  return [...batch.items].sort((a, b) => a.order - b.order);
}

function itemDownloadName(item: ChatterboxBatchItem) {
  return `${String(item.order).padStart(3, "0")}-${sanitizeFileName(item.fileName || `segment-${item.order}`)}`;
}

function batchFileName(batch: ChatterboxBatch) {
  return sanitizeFileName(batch.name || `chatterbox-batch-${batch.id}`);
}

function sourceSubtitleFileName(batch: ChatterboxBatch) {
  const languageName: Record<ChatterboxLanguage, string> = {
    ms: "马来语",
    en: "英语",
    "pt-BR": "巴西葡语"
  };
  return `${languageName[batch.language]}-${subtitleHash(batch)}.srt`;
}

function translationSubtitleFileName(batch: ChatterboxBatch) {
  return `中文字幕-${subtitleHash(batch)}.srt`;
}

function bilingualSubtitleFileName(batch: ChatterboxBatch) {
  return `双语字幕-${subtitleHash(batch)}.srt`;
}

function combinedAudioFileName(batch: ChatterboxBatch) {
  return `总音频-${subtitleHash(batch)}.mp3`;
}

function subtitleHash(batch: ChatterboxBatch) {
  return batch.id.slice(0, 8);
}

function buildManifest(batch: ChatterboxBatch) {
  const lines = [
    `批次：${batch.name || batch.id}`,
    `语言：${batch.language}`,
    `状态：${batch.status}`,
    `总时长：${(batch.totalAudioDurationSeconds || 0).toFixed(3)} 秒`,
    ""
  ];
  for (const item of orderedItems(batch)) {
    lines.push(
      `${String(item.order).padStart(3, "0")} | ${item.fileName || `segment-${item.order}`} | ${item.status} | ${(item.audioDurationSeconds || 0).toFixed(3)} 秒`,
      item.text,
      ""
    );
  }
  return `${lines.join("\n")}\n`;
}

function splitSentences(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [""];
  return normalized.match(/[^.!?。！？;；]+(?:[.!?。！？;；]+|$)/g)?.map((value) => value.trim()) ?? [normalized];
}

function wrapSubtitleLines(text: string, maxCharacters = 38) {
  if (!text.includes(" ")) {
    return text.match(new RegExp(`.{1,${maxCharacters}}`, "gu"))?.join("\n") ?? text;
  }
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) current = word;
    else if (current.length + 1 + word.length <= maxCharacters) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.join("\n");
}

function textWeight(text: string) {
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

async function replaceFile(source: string, target: string) {
  const backup = `${target}.backup`;
  await fsp.rm(backup, { force: true });
  const hadTarget = await fileExists(target);
  if (hadTarget) await fsp.rename(target, backup);
  try {
    await fsp.rename(source, target);
    await fsp.rm(backup, { force: true });
  } catch (error) {
    if (hadTarget && (await fileExists(backup))) await fsp.rename(backup, target);
    throw error;
  }
}

async function fileExists(filePath: string) {
  return fsp.stat(filePath).then(
    (stat) => stat.isFile(),
    () => false
  );
}

function cloneBatch(batch: ChatterboxBatch): ChatterboxBatch {
  return { ...batch, items: batch.items.map((item) => ({ ...item })) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function batchIdFrom(params: unknown) {
  return isRecord(params) && typeof params.batchId === "string" ? params.batchId : "";
}

function voiceIdFrom(params: unknown) {
  return isRecord(params) && typeof params.voiceId === "string" ? params.voiceId : "";
}

function idsFrom(params: unknown) {
  return {
    batchId: batchIdFrom(params),
    itemId: isRecord(params) && typeof params.itemId === "string" ? params.itemId : ""
  };
}

function sanitizeFileName(value: string) {
  const base = value.trim().replace(/\.(mp3|srt|zip)$/i, "");
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
