import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import archiver from "archiver";
import type { FastifyInstance, FastifyReply } from "fastify";
import { nanoid } from "nanoid";
import {
  CHATTERBOX_LANGUAGES,
  CHATTERBOX_MAX_BATCH_SEGMENTS,
  CHATTERBOX_MAX_BATCH_TEXT_LENGTH,
  CHATTERBOX_MAX_REFERENCE_BYTES,
  CHATTERBOX_MAX_REFERENCE_TRANSLATION_LENGTH,
  CHATTERBOX_MAX_TEXT_LENGTH,
  fail,
  ok,
  type ChatterboxBatch,
  type ChatterboxBatchItem,
  type ChatterboxBatchList,
  type ChatterboxBatchStatus,
  type ChatterboxLanguage,
  type ChatterboxSavedVoice,
  type ChatterboxSavedVoiceList,
  type ChatterboxSubtitleMode,
  type ChatterboxTaskStatus,
  type ChatterboxVoiceAuthorization
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { createChatterboxWorkerClient } from "./worker-client";

type WorkerClient = ReturnType<typeof createChatterboxWorkerClient>;
type MediaTools = {
  normalizeReference(inputPath: string, outputPath: string): Promise<number>;
  toMp3(inputPath: string, outputPath: string): Promise<void>;
  concatMp3(inputPaths: string[], outputPath: string): Promise<void>;
  duration(filePath: string): Promise<number>;
};

type TimingSegment = { text: string; startSeconds: number; endSeconds: number };
type BatchSegmentInput = { text: string; referenceTranslation?: string; fileName?: string };
type BatchCreateInput = Pick<
  ChatterboxBatch,
  | "name"
  | "language"
  | "referenceFileName"
  | "referenceDurationSeconds"
  | "referenceRetained"
  | "authorization"
  | "consentConfirmed"
  | "exaggeration"
  | "cfgWeight"
  | "temperature"
  | "seed"
  | "includeSubtitles"
  | "subtitleMode"
> & { segments: BatchSegmentInput[] };

type BatchPaths = {
  dir: string;
  meta: string;
  referenceUpload: string;
  reference: string;
  combinedAudio: string;
  subtitle: string;
  translationSubtitle: string;
  bilingualSubtitle: string;
};

export async function registerChatterboxBatchRoutes(options: {
  app: FastifyInstance;
  config: AppConfig;
  worker: WorkerClient;
  media: MediaTools;
  externalQueueStats?: () => { active: number; queued: number };
}) {
  const { app, config, worker, media } = options;
  const store = new ChatterboxBatchStore(path.join(config.chatterboxDir, "batches"));
  const voiceStore = new ChatterboxVoiceStore(path.join(config.chatterboxDir, "voices"));
  await store.initialize();
  await voiceStore.initialize();
  await store.cleanupExpired();
  const queue = new ChatterboxBatchQueue({ config, store, worker, media });
  const queueLoad = () => {
    const own = queue.stats();
    const external = options.externalQueueStats?.() || { active: 0, queued: 0 };
    return own.active + own.queued + external.active + external.queued;
  };
  for (const batch of store.list()) {
    for (const item of batch.items) if (item.status === "queued") queue.enqueue(batch.id, item.id);
  }

  app.get("/api/tools/edge-tts/chatterbox/voices", async () => {
    const data: ChatterboxSavedVoiceList = { voices: voiceStore.list().map(toPublicVoice) };
    return ok(data);
  });

  app.post("/api/tools/edge-tts/chatterbox/voices", async (request, reply) => {
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
  });

  app.get("/api/tools/edge-tts/chatterbox/voices/:voiceId/audio", async (request, reply) => {
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
  });

  app.delete("/api/tools/edge-tts/chatterbox/voices/:voiceId", async (request, reply) => {
    const voiceId = voiceIdFrom(request.params);
    if (!voiceStore.get(voiceId)) {
      return reply.code(404).send(fail("CHATTERBOX_VOICE_NOT_FOUND", "保存的参考音色不存在"));
    }
    await voiceStore.remove(voiceId);
    return ok({ removed: true });
  });

  app.post("/api/tools/edge-tts/chatterbox/batches", async (request, reply) => {
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
  });

  app.get("/api/tools/edge-tts/chatterbox/batches", async (request) => {
    const query = request.query as { page?: string; pageSize?: string };
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
  });

  app.get("/api/tools/edge-tts/chatterbox/batches/:batchId", async (request, reply) => {
    const batch = store.get(batchIdFrom(request.params));
    if (!batch) return reply.code(404).send(fail("CHATTERBOX_BATCH_NOT_FOUND", "声音克隆批次不存在"));
    return ok(toPublicBatch(batch));
  });

  app.get("/api/tools/edge-tts/chatterbox/batches/:batchId/items/:itemId/audio", async (request, reply) => {
    return sendBatchAudio(store, idsFrom(request.params), reply, false);
  });

  app.get("/api/tools/edge-tts/chatterbox/batches/:batchId/items/:itemId/download", async (request, reply) => {
    return sendBatchAudio(store, idsFrom(request.params), reply, true);
  });

  app.get("/api/tools/edge-tts/chatterbox/batches/:batchId/combined-audio", async (request, reply) => {
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
  });

  app.get("/api/tools/edge-tts/chatterbox/batches/:batchId/subtitle", async (request, reply) => {
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
  });

  app.get("/api/tools/edge-tts/chatterbox/batches/:batchId/subtitle.zh-CN", async (request, reply) => {
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
  });

  app.get("/api/tools/edge-tts/chatterbox/batches/:batchId/subtitle.bilingual", async (request, reply) => {
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
  });

  app.get("/api/tools/edge-tts/chatterbox/batches/:batchId/download.zip", async (request, reply) => {
    const batchId = batchIdFrom(request.params);
    const batch = store.get(batchId);
    if (!batch) return reply.code(404).send(fail("CHATTERBOX_BATCH_NOT_FOUND", "声音克隆批次不存在"));
    const completed = orderedItems(batch).filter((item) => item.audioBytes);
    if (!completed.length) return reply.code(409).send(fail("CHATTERBOX_BATCH_NOT_READY", "批次中还没有可下载的音频"));
    if (batch.status === "completed" && batch.items.length > 1) await ensureBatchAudio(store, batch, media);
    if (batch.status === "completed" && batch.includeSubtitles) await rebuildBatchSubtitles(store, batch);
    const archive = archiver("zip", { zlib: { level: 6 } });
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
  });

  app.post("/api/tools/edge-tts/chatterbox/batches/:batchId/items/:itemId/regenerate", async (request, reply) => {
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
  });

  app.patch("/api/tools/edge-tts/chatterbox/batches/:batchId/order", async (request, reply) => {
    const batchId = batchIdFrom(request.params);
    const batch = store.get(batchId);
    if (!batch) return reply.code(404).send(fail("CHATTERBOX_BATCH_NOT_FOUND", "声音克隆批次不存在"));
    if (queue.hasActiveBatch(batchId)) {
      return reply.code(409).send(fail("CHATTERBOX_BATCH_ACTIVE", "批次生成过程中不能调整顺序"));
    }
    const itemIds = isRecord(request.body) && Array.isArray(request.body.itemIds) ? request.body.itemIds : [];
    if (!itemIds.every((value): value is string => typeof value === "string")) {
      return reply.code(400).send(fail("CHATTERBOX_ORDER_INVALID", "文案段顺序无效"));
    }
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
  });

  app.delete("/api/tools/edge-tts/chatterbox/batches/:batchId/items/:itemId", async (request, reply) => {
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
  });

  app.post("/api/tools/edge-tts/chatterbox/batches/:batchId/cancel", async (request, reply) => {
    const batchId = batchIdFrom(request.params);
    const batch = store.get(batchId);
    if (!batch) return reply.code(404).send(fail("CHATTERBOX_BATCH_NOT_FOUND", "声音克隆批次不存在"));
    queue.cancelPendingBatch(batchId);
    for (const item of batch.items) {
      if (item.status === "queued") {
        await store.updateItem(batchId, item.id, { status: "cancelled", progress: 100 }, { deferTerminalStatus: true });
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
  });

  app.delete("/api/tools/edge-tts/chatterbox/batches/:batchId/reference", async (request, reply) => {
    const batchId = batchIdFrom(request.params);
    const batch = store.get(batchId);
    if (!batch) return reply.code(404).send(fail("CHATTERBOX_BATCH_NOT_FOUND", "声音克隆批次不存在"));
    if (queue.hasActiveBatch(batchId)) {
      return reply.code(409).send(fail("CHATTERBOX_BATCH_ACTIVE", "批次生成结束后才能删除参考音色"));
    }
    await fsp.rm(store.paths(batchId).reference, { force: true });
    await store.updateBatch(batchId, { referenceAvailable: false, referenceRetained: false });
    return ok({ removed: true });
  });

  app.delete("/api/tools/edge-tts/chatterbox/batches/:batchId", async (request, reply) => {
    const batchId = batchIdFrom(request.params);
    if (!store.get(batchId)) return reply.code(404).send(fail("CHATTERBOX_BATCH_NOT_FOUND", "声音克隆批次不存在"));
    if (queue.hasActiveBatch(batchId)) {
      return reply.code(409).send(fail("CHATTERBOX_BATCH_ACTIVE", "本地模型正在生成，完成后即可删除"));
    }
    queue.cancelPendingBatch(batchId);
    await store.remove(batchId);
    return ok({ removed: true });
  });

  const cleanupTimer = setInterval(
    () => void store.cleanupExpired((batchId) => queue.hasActiveBatch(batchId)),
    15 * 60 * 1000
  );
  cleanupTimer.unref();
  app.addHook("onClose", async () => clearInterval(cleanupTimer));
  return queue;
}

class ChatterboxBatchQueue {
  private readonly pending: Array<{ batchId: string; itemId: string }> = [];
  private active: { batchId: string; itemId: string } | undefined;

  constructor(
    private readonly options: {
      config: AppConfig;
      store: ChatterboxBatchStore;
      worker: WorkerClient;
      media: MediaTools;
    }
  ) {}

  enqueue(batchId: string, itemId: string) {
    if (
      this.isActive(batchId, itemId) ||
      this.pending.some((entry) => entry.batchId === batchId && entry.itemId === itemId)
    ) {
      return;
    }
    this.pending.push({ batchId, itemId });
    this.pump();
  }

  stats() {
    return { active: this.active ? 1 : 0, queued: this.pending.length };
  }

  isActive(batchId: string, itemId: string) {
    return this.active?.batchId === batchId && this.active.itemId === itemId;
  }

  hasActiveBatch(batchId: string) {
    return this.active?.batchId === batchId;
  }

  removePending(batchId: string, itemId: string) {
    const index = this.pending.findIndex((entry) => entry.batchId === batchId && entry.itemId === itemId);
    if (index >= 0) this.pending.splice(index, 1);
  }

  cancelPendingBatch(batchId: string) {
    for (let index = this.pending.length - 1; index >= 0; index -= 1) {
      if (this.pending[index].batchId === batchId) this.pending.splice(index, 1);
    }
  }

  private pump() {
    if (this.active || !this.pending.length) return;
    const next = this.pending.shift();
    if (!next) return;
    this.active = next;
    void this.process(next.batchId, next.itemId).then(
      () => this.finish(next),
      () => this.finish(next)
    );
  }

  private finish(entry: { batchId: string; itemId: string }) {
    if (this.active?.batchId === entry.batchId && this.active.itemId === entry.itemId) {
      this.active = undefined;
    }
    void this.options.store.recalculate(entry.batchId).then(
      () => this.pump(),
      () => this.pump()
    );
  }

  private async process(batchId: string, itemId: string) {
    const batch = this.options.store.get(batchId);
    const item = batch?.items.find((entry) => entry.id === itemId);
    if (!batch || !item || item.status !== "queued") return;
    const batchPaths = this.options.store.paths(batchId);
    const itemPaths = this.options.store.itemPaths(batchId, itemId);
    const hadAudio = Boolean(item.audioBytes && (await fileExists(itemPaths.audio)));
    await fsp.mkdir(itemPaths.dir, { recursive: true });
    await this.options.store.updateItem(batchId, itemId, { status: "processing", progress: 10, error: undefined });
    try {
      if (!(await fileExists(batchPaths.reference))) {
        throw new BatchInputError("CHATTERBOX_REFERENCE_REQUIRED", "参考音色已删除，请重新上传后再生成", 409);
      }
      const result = await this.options.worker.generate({
        text: item.text,
        language: batch.language,
        referencePath: batchPaths.reference,
        outputPath: itemPaths.outputWav,
        exaggeration: item.exaggeration ?? batch.exaggeration,
        cfgWeight: item.cfgWeight ?? batch.cfgWeight,
        temperature: item.temperature ?? batch.temperature,
        seed: item.seed ?? batch.seed
      });
      await this.options.store.updateItem(batchId, itemId, { progress: 82 });
      await this.options.media.toMp3(itemPaths.outputWav, itemPaths.candidateAudio);
      const audioBytes = (await fsp.stat(itemPaths.candidateAudio)).size;
      const audioDurationSeconds = await this.options.media.duration(itemPaths.candidateAudio);
      await replaceFile(itemPaths.candidateAudio, itemPaths.audio);
      await writeJsonAtomic(itemPaths.timing, result.segments);
      const preparedBatch = await this.options.store.updateItem(batchId, itemId, {
        status: "processing",
        progress: 99,
        audioBytes,
        audioDurationSeconds,
        error: undefined
      });
      const completedSnapshot = preparedBatch
        ? {
            ...preparedBatch,
            items: preparedBatch.items.map((entry) =>
              entry.id === itemId ? { ...entry, status: "completed" as const, progress: 100 } : entry
            )
          }
        : undefined;
      if (completedSnapshot?.items.every((entry) => entry.status === "completed")) {
        if (completedSnapshot.items.length > 1) {
          await rebuildBatchAudio(this.options.store, completedSnapshot, this.options.media);
        }
        if (completedSnapshot.includeSubtitles) {
          await rebuildBatchSubtitles(this.options.store, completedSnapshot);
        }
      }
      await this.options.store.updateItem(
        batchId,
        itemId,
        { status: "completed", progress: 100 },
        { deferTerminalStatus: true }
      );
    } catch (error) {
      await this.options.store.updateItem(
        batchId,
        itemId,
        hadAudio
          ? { status: "completed", progress: 100, error: `重新生成失败：${readableError(error)}` }
          : { status: "failed", progress: 100, error: readableError(error) },
        { deferTerminalStatus: true }
      );
    } finally {
      await Promise.all([
        fsp.rm(itemPaths.outputWav, { force: true }),
        fsp.rm(itemPaths.candidateAudio, { force: true })
      ]);
      const snapshot = this.options.store.get(batchId);
      if (snapshot && !snapshot.items.some((entry) => entry.status === "queued" || entry.status === "processing")) {
        if (!snapshot.referenceRetained) {
          await fsp.rm(batchPaths.reference, { force: true });
          await this.options.store.updateBatch(batchId, { referenceAvailable: false });
        }
      }
    }
  }
}

type StoredVoice = Omit<ChatterboxSavedVoice, "audioUrl">;

class ChatterboxVoiceStore {
  private readonly voices = new Map<string, StoredVoice>();

  constructor(private readonly root: string) {}

  async initialize() {
    await fsp.mkdir(this.root, { recursive: true });
    for (const entry of await fsp.readdir(this.root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !isSafeId(entry.name)) continue;
      try {
        const voice = JSON.parse(await fsp.readFile(this.paths(entry.name).meta, "utf8")) as StoredVoice;
        if (!isStoredVoice(voice) || voice.id !== entry.name || !(await fileExists(this.paths(entry.name).audio)))
          continue;
        this.voices.set(voice.id, voice);
      } catch {
        // Ignore incomplete saved voice directories.
      }
    }
  }

  async create(input: Omit<StoredVoice, "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const voice: StoredVoice = { ...input, createdAt: now, updatedAt: now };
    await writeJsonAtomic(this.paths(voice.id).meta, voice);
    this.voices.set(voice.id, voice);
    return { ...voice };
  }

  get(id: string) {
    const voice = this.voices.get(id);
    return voice ? { ...voice } : undefined;
  }

  list() {
    return [...this.voices.values()]
      .map((voice) => ({ ...voice }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async remove(id: string) {
    if (!isSafeId(id)) return false;
    this.voices.delete(id);
    await fsp.rm(this.paths(id).dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    return true;
  }

  paths(id: string) {
    if (!isSafeId(id)) throw new Error("Invalid Chatterbox voice id");
    const dir = path.join(this.root, id);
    return {
      dir,
      meta: path.join(dir, "meta.json"),
      upload: path.join(dir, "reference-upload"),
      audio: path.join(dir, "reference.wav")
    };
  }
}

class ChatterboxBatchStore {
  private readonly batches = new Map<string, ChatterboxBatch>();

  constructor(private readonly root: string) {}

  async initialize() {
    await fsp.mkdir(this.root, { recursive: true });
    for (const entry of await fsp.readdir(this.root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !isSafeId(entry.name)) continue;
      try {
        const batch = JSON.parse(await fsp.readFile(this.paths(entry.name).meta, "utf8")) as ChatterboxBatch;
        if (!isStoredBatch(batch) || batch.id !== entry.name) continue;
        for (const item of batch.items) {
          if (item.status === "processing") {
            item.status = "failed";
            item.progress = 100;
            item.error = "服务重启导致生成中断，可在详情中重新生成";
            item.updatedAt = new Date().toISOString();
          }
        }
        batch.referenceAvailable = await fileExists(this.paths(batch.id).reference);
        this.applyAggregate(batch);
        await this.write(batch);
        this.batches.set(batch.id, batch);
      } catch {
        // Ignore incomplete batch directories.
      }
    }
  }

  async create(id: string, input: BatchCreateInput, retentionDays: number) {
    const now = new Date();
    const batch: ChatterboxBatch = {
      id,
      engine: "chatterbox-multilingual-v3",
      status: "queued",
      progress: 0,
      name: input.name,
      language: input.language,
      referenceFileName: input.referenceFileName,
      referenceDurationSeconds: input.referenceDurationSeconds,
      referenceRetained: input.referenceRetained,
      referenceAvailable: true,
      authorization: input.authorization,
      consentConfirmed: true,
      exaggeration: input.exaggeration,
      cfgWeight: input.cfgWeight,
      temperature: input.temperature,
      seed: input.seed,
      includeSubtitles: input.includeSubtitles,
      subtitleMode: input.subtitleMode,
      items: input.segments.map((segment, index) => ({
        id: nanoid(10),
        order: index + 1,
        text: segment.text,
        referenceTranslation: segment.referenceTranslation,
        fileName: segment.fileName,
        status: "queued" as const,
        progress: 0,
        attempt: 1,
        characterCount: segment.text.length,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      })),
      totalCharacters: input.segments.reduce((sum, segment) => sum + segment.text.length, 0),
      completedItems: 0,
      failedItems: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + retentionDays * 86_400_000).toISOString()
    };
    await this.write(batch);
    this.batches.set(id, batch);
    return cloneBatch(batch);
  }

  get(id: string) {
    const batch = this.batches.get(id);
    return batch ? cloneBatch(batch) : undefined;
  }

  list() {
    return [...this.batches.values()].map(cloneBatch).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateItem(
    batchId: string,
    itemId: string,
    patch: Partial<ChatterboxBatchItem>,
    options: { deferTerminalStatus?: boolean } = {}
  ) {
    const batch = this.batches.get(batchId);
    const index = batch?.items.findIndex((item) => item.id === itemId) ?? -1;
    if (!batch || index < 0) return undefined;
    const current = batch.items[index];
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    if (patch.error === undefined && (patch.status === "processing" || patch.status === "completed")) delete next.error;
    batch.items[index] = next;
    this.applyAggregate(batch);
    if (
      options.deferTerminalStatus &&
      !batch.items.some((item) => item.status === "queued" || item.status === "processing")
    ) {
      batch.status = "processing";
      batch.progress = 99;
    }
    await this.write(batch);
    return cloneBatch(batch);
  }

  async updateBatch(batchId: string, patch: Partial<ChatterboxBatch>) {
    const batch = this.batches.get(batchId);
    if (!batch) return undefined;
    Object.assign(batch, patch, { updatedAt: new Date().toISOString() });
    await this.write(batch);
    return cloneBatch(batch);
  }

  async recalculate(batchId: string) {
    const batch = this.batches.get(batchId);
    if (!batch) return undefined;
    this.applyAggregate(batch);
    batch.updatedAt = new Date().toISOString();
    await this.write(batch);
    return cloneBatch(batch);
  }

  async reorder(batchId: string, itemIds: string[]) {
    const batch = this.batches.get(batchId);
    if (!batch) throw new Error("批次不存在");
    if (itemIds.length !== batch.items.length || new Set(itemIds).size !== itemIds.length)
      throw new Error("顺序不完整");
    const byId = new Map(batch.items.map((item) => [item.id, item]));
    if (itemIds.some((id) => !byId.has(id))) throw new Error("包含未知文案段");
    batch.items = itemIds.map((id, index) => ({ ...byId.get(id)!, order: index + 1 }));
    batch.updatedAt = new Date().toISOString();
    await this.write(batch);
    return cloneBatch(batch);
  }

  async removeItem(batchId: string, itemId: string) {
    const batch = this.batches.get(batchId);
    if (!batch) return undefined;
    batch.items = batch.items
      .filter((item) => item.id !== itemId)
      .sort((a, b) => a.order - b.order)
      .map((item, index) => ({ ...item, order: index + 1 }));
    await fsp.rm(this.itemPaths(batchId, itemId).dir, { recursive: true, force: true });
    this.applyAggregate(batch);
    batch.updatedAt = new Date().toISOString();
    await this.write(batch);
    return cloneBatch(batch);
  }

  async extendExpiry(batchId: string, retentionDays: number) {
    return this.updateBatch(batchId, { expiresAt: new Date(Date.now() + retentionDays * 86_400_000).toISOString() });
  }

  async remove(id: string) {
    if (!isSafeId(id)) return false;
    this.batches.delete(id);
    await fsp.rm(this.paths(id).dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    return true;
  }

  async cleanupExpired(isActive: (id: string) => boolean = () => false, now = Date.now()) {
    const expired = [...this.batches.values()].filter(
      (batch) => !isActive(batch.id) && Date.parse(batch.expiresAt) <= now
    );
    await Promise.all(expired.map((batch) => this.remove(batch.id)));
    return expired.length;
  }

  paths(id: string): BatchPaths {
    if (!isSafeId(id)) throw new Error("Invalid Chatterbox batch id");
    const dir = path.join(this.root, id);
    return {
      dir,
      meta: path.join(dir, "meta.json"),
      referenceUpload: path.join(dir, "reference-upload"),
      reference: path.join(dir, "reference.wav"),
      combinedAudio: path.join(dir, "combined.mp3"),
      subtitle: path.join(dir, "subtitle.srt"),
      translationSubtitle: path.join(dir, "subtitle.zh-CN.srt"),
      bilingualSubtitle: path.join(dir, "subtitle.bilingual.srt")
    };
  }

  itemPaths(batchId: string, itemId: string) {
    if (!isSafeId(itemId)) throw new Error("Invalid Chatterbox item id");
    const dir = path.join(this.paths(batchId).dir, "items", itemId);
    return {
      dir,
      outputWav: path.join(dir, "output.wav"),
      candidateAudio: path.join(dir, "candidate.mp3"),
      audio: path.join(dir, "audio.mp3"),
      timing: path.join(dir, "timing.json")
    };
  }

  private applyAggregate(batch: ChatterboxBatch) {
    batch.completedItems = batch.items.filter((item) => item.status === "completed").length;
    batch.failedItems = batch.items.filter((item) => item.status === "failed").length;
    batch.totalCharacters = batch.items.reduce((sum, item) => sum + item.characterCount, 0);
    batch.totalAudioBytes = batch.items.reduce((sum, item) => sum + (item.audioBytes || 0), 0) || undefined;
    batch.totalAudioDurationSeconds =
      batch.items.reduce((sum, item) => sum + (item.audioDurationSeconds || 0), 0) || undefined;
    batch.progress = Math.round(
      batch.items.reduce(
        (sum, item) =>
          sum +
          (item.status === "completed" || item.status === "failed" || item.status === "cancelled"
            ? 100
            : item.progress),
        0
      ) / batch.items.length
    );
    batch.status = batchStatus(batch.items);
  }

  private async write(batch: ChatterboxBatch) {
    await writeJsonAtomic(this.paths(batch.id).meta, batch);
  }
}

function batchStatus(items: ChatterboxBatchItem[]): ChatterboxBatchStatus {
  if (items.some((item) => item.status === "processing")) return "processing";
  if (items.some((item) => item.status === "queued"))
    return items.some((item) => item.status === "completed") ? "processing" : "queued";
  if (items.every((item) => item.status === "completed")) return "completed";
  if (items.some((item) => item.status === "failed")) return "partial_failed";
  return "cancelled";
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

async function receiveBatchMultipart(
  parts: AsyncIterableIterator<import("@fastify/multipart").Multipart>,
  targetPath: string,
  requireFile: boolean
) {
  const fields: Record<string, string> = {};
  let referenceFileName = "";
  let receivedFile = false;
  for await (const part of parts) {
    if (part.type === "file") {
      if (part.fieldname !== "reference" || receivedFile) {
        part.file.resume();
        throw new BatchInputError("CHATTERBOX_REFERENCE_REQUIRED", "请只上传一个参考音频", 400);
      }
      receivedFile = true;
      referenceFileName = sanitizeDisplayName(part.filename || "reference-audio");
      let bytes = 0;
      const limiter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          bytes += chunk.length;
          callback(
            bytes > CHATTERBOX_MAX_REFERENCE_BYTES
              ? new BatchInputError("CHATTERBOX_REFERENCE_TOO_LARGE", "参考音频不能超过 20 MB", 413)
              : null,
            chunk
          );
        }
      });
      await pipeline(part.file, limiter, fs.createWriteStream(targetPath));
      if (part.file.truncated) throw new BatchInputError("CHATTERBOX_REFERENCE_TOO_LARGE", "参考音频过大", 413);
    } else if (
      typeof part.value === "string" &&
      part.value.length <=
        CHATTERBOX_MAX_BATCH_TEXT_LENGTH +
          CHATTERBOX_MAX_BATCH_SEGMENTS * CHATTERBOX_MAX_REFERENCE_TRANSLATION_LENGTH +
          20_000
    ) {
      fields[part.fieldname] = part.value;
    }
  }
  if (requireFile && !receivedFile) throw new BatchInputError("CHATTERBOX_REFERENCE_REQUIRED", "请上传参考音频", 400);
  return { fields, referenceFileName, receivedFile };
}

function parseBatchFields(
  fields: Record<string, string>,
  referenceFileName: string
):
  | { success: true; value: Omit<BatchCreateInput, "referenceDurationSeconds"> }
  | { success: false; statusCode: number; code: string; message: string } {
  let rawSegments: unknown;
  try {
    rawSegments = JSON.parse(fields.segments || "[]");
  } catch {
    return invalid("CHATTERBOX_BATCH_SEGMENTS_INVALID", "多段文案格式无效");
  }
  if (!Array.isArray(rawSegments) || !rawSegments.length || rawSegments.length > CHATTERBOX_MAX_BATCH_SEGMENTS) {
    return invalid("CHATTERBOX_BATCH_SEGMENTS_INVALID", `批次需要 1–${CHATTERBOX_MAX_BATCH_SEGMENTS} 段文案`);
  }
  const segments: BatchSegmentInput[] = [];
  for (const raw of rawSegments) {
    if (!isRecord(raw) || typeof raw.text !== "string")
      return invalid("CHATTERBOX_BATCH_SEGMENTS_INVALID", "文案段格式无效");
    const text = raw.text.trim();
    if (!text || text.length > CHATTERBOX_MAX_TEXT_LENGTH) {
      return invalid("CHATTERBOX_TEXT_TOO_LONG", `每段文案必须为 1–${CHATTERBOX_MAX_TEXT_LENGTH} 个字符`, 413);
    }
    if (raw.referenceTranslation !== undefined && typeof raw.referenceTranslation !== "string") {
      return invalid("CHATTERBOX_BATCH_SEGMENTS_INVALID", "中文参考翻译格式无效");
    }
    const referenceTranslation =
      typeof raw.referenceTranslation === "string" ? raw.referenceTranslation.trim() : undefined;
    if (referenceTranslation && referenceTranslation.length > CHATTERBOX_MAX_REFERENCE_TRANSLATION_LENGTH) {
      return invalid(
        "CHATTERBOX_REFERENCE_TRANSLATION_TOO_LONG",
        `中文参考翻译不能超过 ${CHATTERBOX_MAX_REFERENCE_TRANSLATION_LENGTH} 个字符`,
        413
      );
    }
    segments.push({
      text,
      referenceTranslation: referenceTranslation || undefined,
      fileName: typeof raw.fileName === "string" && raw.fileName.trim() ? sanitizeFileName(raw.fileName) : undefined
    });
  }
  if (segments.reduce((sum, segment) => sum + segment.text.length, 0) > CHATTERBOX_MAX_BATCH_TEXT_LENGTH) {
    return invalid(
      "CHATTERBOX_BATCH_TEXT_TOO_LONG",
      `整个批次不能超过 ${CHATTERBOX_MAX_BATCH_TEXT_LENGTH} 个字符`,
      413
    );
  }
  if (!isLanguage(fields.language)) return invalid("CHATTERBOX_LANGUAGE_INVALID", "仅支持马来语、英语或巴西葡萄牙语");
  if (!isAuthorization(fields.authorization)) return invalid("CHATTERBOX_AUTHORIZATION_REQUIRED", "请选择声音授权来源");
  if (fields.consentConfirmed !== "true")
    return invalid("CHATTERBOX_CONSENT_REQUIRED", "必须确认已获得参考声音的合法授权");
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
      segments,
      name: fields.name ? sanitizeFileName(fields.name) : undefined,
      language: fields.language,
      referenceFileName,
      referenceRetained: fields.referenceRetained === "true",
      authorization: fields.authorization,
      consentConfirmed: true,
      exaggeration,
      cfgWeight,
      temperature,
      seed,
      includeSubtitles: fields.includeSubtitles === "true",
      subtitleMode: isSubtitleMode(fields.subtitleMode) ? fields.subtitleMode : "sentences"
    }
  };
}

function toPublicBatch(batch: ChatterboxBatch): ChatterboxBatch {
  const result = cloneBatch(batch);
  result.items = result.items.map((item) => {
    if (item.audioBytes) {
      item.audioUrl = `/api/tools/edge-tts/chatterbox/batches/${batch.id}/items/${item.id}/audio`;
      item.downloadUrl = `/api/tools/edge-tts/chatterbox/batches/${batch.id}/items/${item.id}/download`;
    }
    return item;
  });
  if (result.completedItems) result.archiveUrl = `/api/tools/edge-tts/chatterbox/batches/${batch.id}/download.zip`;
  if (result.status === "completed" && result.items.length > 1) {
    result.combinedAudioUrl = `/api/tools/edge-tts/chatterbox/batches/${batch.id}/combined-audio`;
  }
  if (result.status === "completed" && result.includeSubtitles) {
    result.subtitleUrl = `/api/tools/edge-tts/chatterbox/batches/${batch.id}/subtitle`;
    if (hasReferenceTranslation(result)) {
      result.translationSubtitleUrl = `/api/tools/edge-tts/chatterbox/batches/${batch.id}/subtitle.zh-CN`;
      if (result.items.length > 1) {
        result.bilingualSubtitleUrl = `/api/tools/edge-tts/chatterbox/batches/${batch.id}/subtitle.bilingual`;
      }
    }
  }
  return result;
}

function hasReferenceTranslation(batch: ChatterboxBatch) {
  return batch.items.some((item) => Boolean(item.referenceTranslation?.trim()));
}

function toPublicVoice(voice: StoredVoice): ChatterboxSavedVoice {
  return { ...voice, audioUrl: `/api/tools/edge-tts/chatterbox/voices/${voice.id}/audio` };
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

async function writeJsonAtomic(filePath: string, value: unknown) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(temp, JSON.stringify(value, null, 2), "utf8");
  await fsp.rename(temp, filePath);
}

function cloneBatch(batch: ChatterboxBatch): ChatterboxBatch {
  return { ...batch, items: batch.items.map((item) => ({ ...item })) };
}

function isStoredBatch(value: unknown): value is ChatterboxBatch {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.engine === "chatterbox-multilingual-v3" &&
    Array.isArray(value.items) &&
    value.items.every(
      (item) =>
        isRecord(item) && typeof item.id === "string" && typeof item.text === "string" && isTaskStatus(item.status)
    )
  );
}

function isStoredVoice(value: unknown): value is StoredVoice {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isLanguage(value.language) &&
    typeof value.durationSeconds === "number" &&
    typeof value.audioBytes === "number" &&
    isAuthorization(value.authorization) &&
    value.consentConfirmed === true &&
    typeof value.createdAt === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function isSubtitleMode(value: unknown): value is ChatterboxSubtitleMode {
  return value === "sentences" || value === "segments";
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
  return { success: false as const, code, message, statusCode };
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

function isSafeId(value: string) {
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

function readableError(error: unknown) {
  return error instanceof Error ? error.message : "声音克隆生成失败";
}

function mapBatchError(error: unknown) {
  if (error instanceof BatchInputError) {
    return { code: error.code, message: error.message, statusCode: error.statusCode };
  }
  return {
    code: "CHATTERBOX_BATCH_FAILED",
    message: error instanceof Error ? error.message : "声音克隆批次处理失败",
    statusCode: 400
  };
}

class BatchInputError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode: number
  ) {
    super(message);
  }
}
