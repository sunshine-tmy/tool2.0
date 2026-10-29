import fs from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  ArchiveVideoEditInputSchema,
  ArchiveVideoEditJobSchema,
  XhsArchiveMediaParamsSchema,
  TaskIdParamsSchema,
  apiSuccessSchema,
  ok,
  fail,
  type XhsArchiveMediaParams,
  type TaskIdParams,
  type ArchiveVideoEditInput
} from "@toolbox/shared";
import { REQUEST_QUOTAS } from "../../../security/request-quotas";
import { ContentArchiveStoreError, type ContentArchiveStore } from "../core/store";
import { sendArchiveRange } from "../core/media-preview-routes";
import { ArchiveVideoEditService, localFile } from "./service";
import { VideoEditError } from "./renderer";

export function registerVideoEditRoutes(
  app: FastifyInstance,
  service: ArchiveVideoEditService,
  store: ContentArchiveStore
) {
  const prefix = "/api/v1/tools/media-archive";
  const failure = (error: unknown) => {
    if (error instanceof VideoEditError || error instanceof ContentArchiveStoreError) return error;
    throw error;
  };
  app.get(
    `${prefix}/video-edit-runtime`,
    { schema: { response: { 200: apiSuccessSchema(Type.Object({ ready: Type.Boolean() })) } } },
    async () => ok({ ready: await service.available() })
  );
  app.get<{ Params: XhsArchiveMediaParams }>(
    `${prefix}/items/:id/media/:mediaId/audio-edits`,
    {
      schema: {
        params: XhsArchiveMediaParamsSchema,
        response: { 200: apiSuccessSchema(Type.Array(ArchiveVideoEditJobSchema)) }
      }
    },
    async (request) => ok(service.list(request.params.id, request.params.mediaId))
  );
  app.post<{ Params: XhsArchiveMediaParams; Body: ArchiveVideoEditInput }>(
    `${prefix}/items/:id/media/:mediaId/audio-edits`,
    {
      config: REQUEST_QUOTAS.voice,
      preValidation: async (request, reply) => {
        if (!Value.Check(ArchiveVideoEditInputSchema, request.body))
          return reply.code(400).send(fail("ARCHIVE_EDIT_INPUT_INVALID", "配乐参数无效，请检查音量、版本和音乐来源"));
      },
      schema: {
        params: XhsArchiveMediaParamsSchema,
        body: ArchiveVideoEditInputSchema,
        response: { 202: apiSuccessSchema(ArchiveVideoEditJobSchema) }
      }
    },
    async (request, reply) => {
      try {
        return reply.code(202).send(ok(await service.create(request.params.id, request.params.mediaId, request.body)));
      } catch (error) {
        const known = failure(error);
        return reply.code(known.statusCode).send(fail(known.code, known.message));
      }
    }
  );
  app.get<{ Params: TaskIdParams }>(
    `${prefix}/video-edits/:taskId`,
    { schema: { params: TaskIdParamsSchema, response: { 200: apiSuccessSchema(ArchiveVideoEditJobSchema) } } },
    async (request, reply) => {
      const job = service.get(request.params.taskId);
      return job ? ok(job) : reply.code(404).send(fail("ARCHIVE_EDIT_NOT_FOUND", "配乐任务不存在"));
    }
  );
  app.delete<{ Params: TaskIdParams }>(
    `${prefix}/video-edits/:taskId`,
    { schema: { params: TaskIdParamsSchema } },
    async (request, reply) => {
      try {
        const job = await service.cancel(request.params.taskId);
        return job ? ok(job) : reply.code(404).send(fail("ARCHIVE_EDIT_NOT_FOUND", "配乐任务不存在"));
      } catch (error) {
        const known = failure(error);
        return reply.code(known.statusCode).send(fail(known.code, known.message));
      }
    }
  );
  app.get<{ Params: TaskIdParams }>(
    `${prefix}/video-edits/:taskId/preview`,
    { config: REQUEST_QUOTAS.mediaPreview, schema: { params: TaskIdParamsSchema } },
    async (request, reply) => {
      const file = service.previewPath(request.params.taskId);
      const stat = file ? await fs.stat(file).catch(() => undefined) : undefined;
      if (!file || !stat?.isFile())
        return reply.code(404).send(fail("ARCHIVE_EDIT_PREVIEW_MISSING", "试听已失效，请重新生成"));
      reply.header("content-type", "video/mp4").header("cache-control", "no-store").header("accept-ranges", "bytes");
      return sendArchiveRange(reply, file, stat.size, request.headers.range);
    }
  );
  for (const variant of ["original", "saved-music"] as const)
    app.get<{ Params: XhsArchiveMediaParams }>(
      `${prefix}/items/:id/media/:mediaId/${variant}`,
      { config: REQUEST_QUOTAS.mediaPreview, schema: { params: XhsArchiveMediaParamsSchema } },
      async (request, reply) => {
        const value = await store.mediaPath(request.params.id, request.params.mediaId);
        const asset =
          variant === "original" ? (value?.media.audioEdit?.original ?? value?.media) : value?.media.audioEdit?.music;
        if (!value || !asset) return reply.code(404).send(fail("ARCHIVE_EDIT_ASSET_MISSING", "原片或配乐不存在"));
        const file = localFile(path.dirname(value.filePath), asset.fileName);
        const release = store.pinMedia(file);
        reply.raw.once("close", release);
        const stat = await fs.stat(file).catch(() => undefined);
        if (!stat?.isFile()) {
          release();
          return reply.code(404).send(fail("ARCHIVE_EDIT_ASSET_MISSING", "原片或配乐文件缺失"));
        }
        reply
          .header("content-type", asset.mimeType)
          .header("cache-control", "no-store")
          .header("accept-ranges", "bytes")
          .header("x-content-type-options", "nosniff");
        return sendArchiveRange(reply, file, stat.size, request.headers.range, release);
      }
    );
}
