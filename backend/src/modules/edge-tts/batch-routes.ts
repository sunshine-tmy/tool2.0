import fs from "node:fs/promises";
import { ZipArchive } from "archiver";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  EdgeTtsBatchCreateSchema,
  EdgeTtsBatchSchema,
  EdgeTtsBatchListSchema,
  EdgeTtsBatchParamsSchema,
  EdgeTtsBatchItemParamsSchema,
  EdgeTtsBatchReorderSchema,
  EdgeTtsBatchRegenerateSchema,
  EdgeTtsTaskListQuerySchema,
  EdgeTtsRemovalSchema,
  ApiFailureSchema,
  apiSuccessSchema,
  ok,
  fail,
  type EdgeTtsBatchCreate,
  type EdgeTtsBatchRegenerate,
  type EdgeTtsTaskListQuery
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { FileMetadataRepository } from "../../database/file-metadata";
import { REQUEST_QUOTAS } from "../../security/request-quotas";
import { EdgeTtsBatchService, EdgeTtsBatchError } from "./batch-service";
import type { EdgeTtsTaskService } from "./task-service";
import { contentDisposition } from "../chatterbox/batch-artifacts";
import { sanitizeFileName } from "./input";

const root = "/api/v1/tools/edge-tts/batches";
type Params = { batchId: string; itemId: string };
const response = {
  200: apiSuccessSchema(EdgeTtsBatchSchema),
  400: ApiFailureSchema,
  404: ApiFailureSchema,
  409: ApiFailureSchema,
  413: ApiFailureSchema,
  429: ApiFailureSchema
};
export async function registerEdgeTtsBatchRoutes(
  app: FastifyInstance,
  config: AppConfig,
  database: ToolboxDatabase,
  tasks: EdgeTtsTaskService,
  metadata?: FileMetadataRepository
) {
  const batches = new EdgeTtsBatchService(config, database, tasks, metadata);
  await batches.initialize();
  const timer = setInterval(() => void batches.cleanupExpired().catch((error) => app.log.error(error)), 15 * 60 * 1000);
  timer.unref();
  app.addHook("onClose", async () => clearInterval(timer));
  const safely = async (reply: FastifyReply, action: () => Promise<unknown>) => {
    try {
      return await action();
    } catch (error) {
      if (error instanceof EdgeTtsBatchError) return reply.code(error.status).send(fail(error.code, error.message));
      app.log.error({ err: error }, "online speech batch operation failed");
      return reply.code(500).send(fail("EDGE_TTS_BATCH_FAILED", "批次操作失败，请检查音频文件及 FFmpeg 环境后重试"));
    }
  };
  app.post<{ Body: EdgeTtsBatchCreate }>(
    root,
    {
      config: REQUEST_QUOTAS.voice,
      schema: { body: EdgeTtsBatchCreateSchema, response: { ...response, 202: apiSuccessSchema(EdgeTtsBatchSchema) } }
    },
    (r, p) => safely(p, async () => p.code(202).send(ok(await batches.create(r.body))))
  );
  app.get<{ Querystring: EdgeTtsTaskListQuery }>(
    root,
    {
      schema: { querystring: EdgeTtsTaskListQuerySchema, response: { 200: apiSuccessSchema(EdgeTtsBatchListSchema) } }
    },
    (r, p) =>
      safely(p, async () =>
        ok(await batches.list(positive(r.query.page, 1), Math.min(50, positive(r.query.pageSize, 10))))
      )
  );
  app.get<{ Params: Params }>(
    `${root}/:batchId`,
    {
      schema: { params: EdgeTtsBatchParamsSchema, response }
    },
    (r, p) =>
      safely(p, () => batches.withArtifact(r.params.batchId, async () => ok(await batches.get(r.params.batchId))))
  );
  app.post<{ Params: Params }>(
    `${root}/:batchId/cancel`,
    {
      schema: { params: EdgeTtsBatchParamsSchema, response }
    },
    (r, p) =>
      safely(p, () => batches.withArtifact(r.params.batchId, async () => ok(await batches.cancel(r.params.batchId))))
  );
  app.delete<{ Params: Params }>(
    `${root}/:batchId`,
    {
      schema: {
        params: EdgeTtsBatchParamsSchema,
        response: { 200: apiSuccessSchema(EdgeTtsRemovalSchema), 404: ApiFailureSchema }
      }
    },
    (r, p) =>
      safely(p, () =>
        batches.withArtifact(r.params.batchId, async () => {
          await batches.remove(r.params.batchId);
          return ok({ removed: true });
        })
      )
  );
  app.patch<{ Params: Params; Body: { itemIds: string[] } }>(
    `${root}/:batchId/order`,
    {
      schema: { params: EdgeTtsBatchParamsSchema, body: EdgeTtsBatchReorderSchema, response }
    },
    (r, p) =>
      safely(p, () =>
        batches.withArtifact(r.params.batchId, async () => ok(await batches.reorder(r.params.batchId, r.body.itemIds)))
      )
  );
  app.post<{ Params: Params; Body: EdgeTtsBatchRegenerate }>(
    `${root}/:batchId/items/:itemId/regenerate`,
    {
      config: REQUEST_QUOTAS.voice,
      schema: { params: EdgeTtsBatchItemParamsSchema, body: EdgeTtsBatchRegenerateSchema, response }
    },
    (r, p) =>
      safely(p, () =>
        batches.withArtifact(r.params.batchId, async () =>
          ok(await batches.regenerate(r.params.batchId, r.params.itemId, r.body))
        )
      )
  );
  app.delete<{ Params: Params }>(
    `${root}/:batchId/items/:itemId`,
    {
      schema: { params: EdgeTtsBatchItemParamsSchema, response }
    },
    (r, p) =>
      safely(p, () =>
        batches.withArtifact(r.params.batchId, async () =>
          ok(await batches.removeItem(r.params.batchId, r.params.itemId))
        )
      )
  );
  for (const download of [false, true])
    app.get<{ Params: Params }>(
      `${root}/:batchId/items/:itemId/${download ? "download" : "audio"}`,
      {
        schema: { params: EdgeTtsBatchItemParamsSchema, response: { 404: ApiFailureSchema, 409: ApiFailureSchema } }
      },
      (r, p) =>
        safely(p, () =>
          batches.withArtifact(r.params.batchId, async () => {
            const batch = await batches.get(r.params.batchId),
              item = batch.items.find((item) => item.id === r.params.itemId);
            if (!item) throw new EdgeTtsBatchError("EDGE_TTS_BATCH_ITEM_NOT_FOUND", "文案段不存在", 404);
            if (item.status !== "completed")
              throw new EdgeTtsBatchError("EDGE_TTS_BATCH_ITEM_NOT_READY", "该段尚未生成成功", 409);
            if (download) p.header("content-disposition", contentDisposition(itemName(item)));
            return p.type("audio/mpeg").send(await fs.readFile(batches.itemPaths(batch.id, item.id).audio));
          })
        )
    );
  const artifacts = {
    "combined-audio": { key: "combinedAudio", name: "总音频", type: "audio/mpeg", extension: "mp3" },
    subtitle: { key: "subtitle", name: "原文字幕", type: "text/plain; charset=utf-8", extension: "srt" },
    "subtitle.zh-CN": {
      key: "translationSubtitle",
      name: "中文字幕",
      type: "text/plain; charset=utf-8",
      extension: "srt"
    },
    "subtitle.bilingual": {
      key: "bilingualSubtitle",
      name: "双语字幕",
      type: "text/plain; charset=utf-8",
      extension: "srt"
    }
  } as const;
  for (const [suffix, artifact] of Object.entries(artifacts))
    app.get<{ Params: Params }>(
      `${root}/:batchId/${suffix}`,
      {
        schema: { params: EdgeTtsBatchParamsSchema, response: { 404: ApiFailureSchema, 409: ApiFailureSchema } }
      },
      (r, p) =>
        safely(p, () =>
          batches.withArtifact(r.params.batchId, async () => {
            const batch = await batches.ensureArtifacts(r.params.batchId);
            if (
              artifact.key !== "combinedAudio" &&
              (!batch.includeSubtitles || (artifact.key !== "subtitle" && !batch.translationSubtitleUrl))
            )
              throw new EdgeTtsBatchError("EDGE_TTS_SUBTITLE_NOT_FOUND", "本批次没有该字幕", 404);
            p.header(
              "content-disposition",
              contentDisposition(`${artifact.name}-${batch.id.slice(0, 8)}.${artifact.extension}`)
            );
            return p.type(artifact.type).send(await fs.readFile(batches.paths(batch.id)[artifact.key]));
          })
        )
    );
  app.get<{ Params: Params }>(
    `${root}/:batchId/download.zip`,
    {
      schema: { params: EdgeTtsBatchParamsSchema, response: { 404: ApiFailureSchema, 409: ApiFailureSchema } }
    },
    (r, p) =>
      safely(p, () =>
        batches.withArtifact(r.params.batchId, async () => {
          const batch = await batches.ensureArtifacts(r.params.batchId),
            paths = batches.paths(batch.id);
          const archive = new ZipArchive({ zlib: { level: 6 } });
          const chunks: Buffer[] = [];
          const done = new Promise<Buffer>((resolve, reject) => {
            archive.on("data", (chunk: Buffer) => chunks.push(chunk));
            archive.once("error", reject);
            archive.once("warning", reject);
            archive.once("end", () => resolve(Buffer.concat(chunks)));
          });
          for (const item of batch.items.filter((item) => item.status === "completed"))
            archive.file(batches.itemPaths(batch.id, item.id).audio, { name: itemName(item) });
          archive.file(paths.combinedAudio, { name: "总音频.mp3" });
          if (batch.subtitleUrl) archive.file(paths.subtitle, { name: "原文字幕.srt" });
          if (batch.translationSubtitleUrl) archive.file(paths.translationSubtitle, { name: "中文字幕.srt" });
          if (batch.bilingualSubtitleUrl) archive.file(paths.bilingualSubtitle, { name: "双语字幕.srt" });
          archive.append(
            batch.items
              .map(
                (item) =>
                  `${item.order}. ${item.fileName || ""} [${item.status}]\n${item.text}\n${item.referenceTranslation || ""}`
              )
              .join("\n\n"),
            { name: "文案.txt" }
          );
          const [buffer] = await Promise.all([done, archive.finalize()]);
          p.header("content-disposition", contentDisposition(`${sanitizeFileName(batch.name || batch.id)}.zip`));
          return p.type("application/zip").send(buffer);
        })
      )
  );
  return batches;
}
function positive(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
function itemName(item: { order: number; fileName?: string }) {
  return `${String(item.order).padStart(3, "0")}-${sanitizeFileName(item.fileName || `segment-${item.order}`)}.mp3`;
}
