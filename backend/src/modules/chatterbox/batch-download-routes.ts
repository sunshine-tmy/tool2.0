/**
 * 中文模块说明：Chatterbox 配音领域，负责批次、音色、任务队列和音频产物
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import { ZipArchive } from "archiver";
import type { FastifyInstance } from "fastify";
import {
  ApiFailureSchema,
  ChatterboxBatchIdParamsSchema,
  ChatterboxBatchItemParamsSchema,
  fail,
  type ChatterboxBatchIdParams,
  type ChatterboxBatchItemParams
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import {
  batchFileName,
  bilingualSubtitleFileName,
  buildManifest,
  combinedAudioFileName,
  contentDisposition,
  ensureBatchAudio,
  hasReferenceTranslation,
  itemDownloadName,
  orderedItems,
  rebuildBatchSubtitles,
  sendBatchAudio,
  sourceSubtitleFileName,
  translationSubtitleFileName
} from "./batch-artifacts";
import { ChatterboxBatchStore } from "./stores";
import type { ChatterboxBatchQueue } from "./batch-queue";
import type { ChatterboxMediaTools } from "./batch-queue";

export function registerChatterboxBatchDownloadRoutes(options: {
  app: FastifyInstance;
  config: AppConfig;
  store: ChatterboxBatchStore;
  queue: ChatterboxBatchQueue;
  media: ChatterboxMediaTools;
}) {
  const { app, store, media } = options;

  app.get<{ Params: ChatterboxBatchIdParams }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId/combined-audio",
    { schema: { params: ChatterboxBatchIdParamsSchema, response: { 404: ApiFailureSchema, 409: ApiFailureSchema } } },
    async (request, reply) => {
      const batchId = request.params.batchId;
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
    { schema: { params: ChatterboxBatchIdParamsSchema, response: { 404: ApiFailureSchema, 409: ApiFailureSchema } } },
    async (request, reply) => {
      const batchId = request.params.batchId;
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
    { schema: { params: ChatterboxBatchIdParamsSchema, response: { 404: ApiFailureSchema, 409: ApiFailureSchema } } },
    async (request, reply) => {
      const batchId = request.params.batchId;
      const batch = store.get(batchId);
      if (!batch) return reply.code(404).send(fail("CHATTERBOX_BATCH_NOT_FOUND", "声音克隆批次不存在"));
      if (!batch.includeSubtitles || batch.status !== "completed") {
        return reply.code(409).send(fail("CHATTERBOX_SUBTITLE_NOT_READY", "所有文案段完成后才能下载中文字幕"));
      }
      if (!hasReferenceTranslation(batch)) {
        return reply.code(404).send(fail("CHATTERBOX_TRANSLATION_SUBTITLE_NOT_FOUND", "该批次没有填写中文翻译"));
      }
      try {
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
    { schema: { params: ChatterboxBatchIdParamsSchema, response: { 404: ApiFailureSchema, 409: ApiFailureSchema } } },
    async (request, reply) => {
      const batchId = request.params.batchId;
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
    { schema: { params: ChatterboxBatchIdParamsSchema, response: { 404: ApiFailureSchema, 409: ApiFailureSchema } } },
    async (request, reply) => {
      const batchId = request.params.batchId;
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

  app.get<{ Params: ChatterboxBatchItemParams }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId/items/:itemId/audio",
    { schema: { params: ChatterboxBatchItemParamsSchema, response: { 404: ApiFailureSchema, 409: ApiFailureSchema } } },
    async (request, reply) => sendBatchAudio(store, request.params, reply, false)
  );

  app.get<{ Params: ChatterboxBatchItemParams }>(
    "/api/v1/tools/edge-tts/chatterbox/batches/:batchId/items/:itemId/download",
    { schema: { params: ChatterboxBatchItemParamsSchema, response: { 404: ApiFailureSchema, 409: ApiFailureSchema } } },
    async (request, reply) => sendBatchAudio(store, request.params, reply, true)
  );
}
