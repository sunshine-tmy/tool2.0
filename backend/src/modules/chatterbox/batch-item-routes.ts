/**
 * 中文模块说明：Chatterbox 配音领域，负责批次、音色、任务队列和音频产物
 */
import fsp from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import {
  ApiFailureSchema,
  ChatterboxBatchIdParamsSchema,
  ChatterboxBatchItemRemovalSchema,
  ChatterboxBatchItemParamsSchema,
  ChatterboxBatchOrderSchema,
  ChatterboxBatchSchema,
  CHATTERBOX_MAX_BATCH_TEXT_LENGTH,
  CHATTERBOX_MAX_REFERENCE_TRANSLATION_LENGTH,
  CHATTERBOX_MAX_TEXT_LENGTH,
  ChatterboxRemovalSchema,
  apiSuccessSchema,
  fail,
  ok,
  type ChatterboxBatchOrder
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import {
  fileExists,
  rebuildBatchAudio,
  rebuildBatchSubtitles,
  replaceFile,
  sanitizeFileName,
  toPublicBatch
} from "./batch-artifacts";
import { receiveBatchMultipart } from "./batch-input";
import type { ChatterboxBatchQueue, ChatterboxMediaTools } from "./batch-queue";
import { BatchInputError, mapBatchError } from "./errors";
import { ChatterboxBatchStore, ChatterboxVoiceStore } from "./stores";

export function registerChatterboxBatchItemRoutes(options: {
  app: FastifyInstance;
  config: AppConfig;
  store: ChatterboxBatchStore;
  voiceStore: ChatterboxVoiceStore;
  queue: ChatterboxBatchQueue;
  media: ChatterboxMediaTools;
  queueLoad: () => number;
}) {
  const { app, config, store, voiceStore, queue, media, queueLoad } = options;

  app.post(
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
      const { batchId, itemId } = request.params as { batchId: string; itemId: string };
      const batch = store.get(batchId);
      const item = batch?.items.find((entry) => entry.id === itemId);
      if (!batch || !item) return reply.code(404).send(fail("CHATTERBOX_BATCH_ITEM_NOT_FOUND", "文案段不存在"));
      if (queue.isActive(batchId, itemId) || item.status === "queued" || item.status === "processing") {
        return reply.code(409).send(fail("CHATTERBOX_BATCH_ITEM_ACTIVE", "该文案段正在生成"));
      }
      const paths = store.paths(batchId);
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
          (sum, entry) => sum + (entry.id === itemId ? text.length : entry.characterCount),
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
            await store.updateBatch(batchId, { referenceDurationSeconds: duration });
          }
          await replaceFile(retryReference, paths.reference);
          await store.updateBatch(batchId, { referenceAvailable: true });
        } else if (uploaded.fields.voiceId) {
          const savedVoice = voiceStore.get(uploaded.fields.voiceId);
          if (!savedVoice) throw new BatchInputError("CHATTERBOX_VOICE_NOT_FOUND", "保存的参考音色不存在", 404);
          if (savedVoice.language !== batch.language) {
            throw new BatchInputError("CHATTERBOX_VOICE_LANGUAGE_MISMATCH", "保存音色的语言与当前目标语言不一致", 400);
          }
          const retryReference = path.join(paths.dir, "reference-retry.wav");
          await fsp.copyFile(voiceStore.paths(savedVoice.id).audio, retryReference);
          await replaceFile(retryReference, paths.reference);
          await store.updateBatch(batchId, {
            referenceDurationSeconds: savedVoice.durationSeconds,
            referenceFileName: savedVoice.name,
            referenceAvailable: true
          });
        } else if (!batch.referenceAvailable || !(await fileExists(paths.reference))) {
          throw new BatchInputError("CHATTERBOX_REFERENCE_REQUIRED", "参考音色已删除，请重新上传或选择已保存音色", 409);
        }
        await store.updateItem(batchId, itemId, {
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
        await store.extendExpiry(batchId, config.chatterboxRetentionDays);
        queue.enqueue(batchId, itemId);
        return reply.code(202).send(ok(toPublicBatch(store.get(batchId)!)));
      } catch (error) {
        await fsp.rm(`${paths.referenceUpload}.retry`, { force: true });
        const mapped = mapBatchError(error);
        return reply.code(mapped.statusCode).send(fail(mapped.code, mapped.message));
      }
    }
  );

  app.patch<{ Params: { batchId: string }; Body: ChatterboxBatchOrder }>(
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
      const batchId = request.params.batchId;
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

  app.delete<{ Params: { batchId: string; itemId: string } }>(
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
      const { batchId, itemId } = request.params;
      const batch = store.get(batchId);
      if (!batch?.items.some((item) => item.id === itemId)) {
        return reply.code(404).send(fail("CHATTERBOX_BATCH_ITEM_NOT_FOUND", "文案段不存在"));
      }
      if (batch.items.length <= 1) {
        return reply.code(409).send(fail("CHATTERBOX_BATCH_ITEM_REQUIRED", "批次至少需要保留一个文案段"));
      }
      if (queue.isActive(batchId, itemId)) {
        return reply.code(409).send(fail("CHATTERBOX_BATCH_ITEM_ACTIVE", "正在生成的文案段不能删除"));
      }
      queue.removePending(batchId, itemId);
      const updated = await store.removeItem(batchId, itemId);
      if (updated?.status === "completed") {
        if (updated.items.length > 1) await rebuildBatchAudio(store, updated, media);
        else await fsp.rm(store.paths(updated.id).combinedAudio, { force: true });
        if (updated.includeSubtitles) await rebuildBatchSubtitles(store, updated);
      }
      return ok({ removed: true, batch: updated ? toPublicBatch(updated) : undefined });
    }
  );

  app.post<{ Params: { batchId: string } }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId/cancel",
    {
      schema: {
        params: ChatterboxBatchIdParamsSchema,
        response: { 200: apiSuccessSchema(ChatterboxBatchSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const batchId = request.params.batchId;
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

  app.delete<{ Params: { batchId: string } }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId/reference",
    {
      schema: {
        params: ChatterboxBatchIdParamsSchema,
        response: { 200: apiSuccessSchema(ChatterboxRemovalSchema), 404: ApiFailureSchema, 409: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const batchId = request.params.batchId;
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

  app.delete<{ Params: { batchId: string } }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId",
    {
      schema: {
        params: ChatterboxBatchIdParamsSchema,
        response: { 200: apiSuccessSchema(ChatterboxRemovalSchema), 404: ApiFailureSchema, 409: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const batchId = request.params.batchId;
      if (!store.get(batchId)) return reply.code(404).send(fail("CHATTERBOX_BATCH_NOT_FOUND", "声音克隆批次不存在"));
      if (queue.hasActiveBatch(batchId)) {
        return reply.code(409).send(fail("CHATTERBOX_BATCH_ACTIVE", "本地模型正在生成，完成后即可删除"));
      }
      queue.cancelPendingBatch(batchId);
      await store.remove(batchId);
      return ok({ removed: true });
    }
  );
}

function boundedNumber(value: string | undefined, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}

function boundedInteger(value: string | undefined, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}
