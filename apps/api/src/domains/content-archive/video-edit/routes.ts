import fs from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  ArchiveVideoEditInputSchema,
  ArchiveInterpolationRuntimeSchema,
  ArchiveVideoWaveformSchema,
  ArchiveVideoWaveformInputSchema,
  type ArchiveVideoWaveformInput,
  ArchiveCutDraftSchema,
  ArchiveCutSourceSchema,
  type ArchiveCutDraft,
  ArchiveVideoEditJobSchema,
  ArchiveWatermarkDraftSchema,
  ArchiveWatermarkPresetSchema,
  ArchiveWatermarkPresetInputSchema,
  ArchiveWatermarkLibraryItemSchema,
  type ArchiveWatermarkLibraryItem,
  type ArchiveWatermarkPresetInput,
  type ArchiveWatermarkPreset,
  type ApiResponse,
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
import { videoWaveform } from "./video-waveform";
import { VideoEditError } from "./renderer";

export function registerVideoEditRoutes(
  app: FastifyInstance,
  service: ArchiveVideoEditService,
  store: ContentArchiveStore
) {
  const prefix = "/api/v1/tools/media-archive";
  app.get(
    `${prefix}/interpolation-runtime`,
    {
      schema: { response: { 200: apiSuccessSchema(ArchiveInterpolationRuntimeSchema) } }
    },
    async () => ok(await service.interpolationRuntime())
  );
  // Preserve strictly validated null sentinels before AJV coerces number/null unions.
  // Both legacy global watermarks and timeline watermarks use the same contract.
  const automaticWatermarkEnds = new WeakMap<FastifyRequest, Array<{ endSeconds: number | null }>>();
  function rememberAutomaticEnds(
    request: FastifyRequest,
    body: {
      watermark?: { settings: { endSeconds: number | null } } | null;
      studio?: { watermarks?: Array<{ settings: { endSeconds: number | null } }> } | null;
    }
  ) {
    const settings = [
      ...(body.watermark ? [body.watermark.settings] : []),
      ...(body.studio?.watermarks ?? []).map((mark) => mark.settings)
    ];
    automaticWatermarkEnds.set(
      request,
      settings.filter((entry) => entry.endSeconds === null)
    );
  }
  function restoreAutomaticEnds(request: FastifyRequest) {
    for (const settings of automaticWatermarkEnds.get(request) ?? []) settings.endSeconds = null;
    automaticWatermarkEnds.delete(request);
  }
  app.get<{ Params: XhsArchiveMediaParams & { assetId: string } }>(
    `${prefix}/items/:id/media/:mediaId/studio-watermarks/:assetId`,
    {
      config: REQUEST_QUOTAS.mediaPreview,
      schema: {
        params: Type.Composite([
          XhsArchiveMediaParamsSchema,
          Type.Object({ assetId: Type.String({ pattern: "^[A-Za-z0-9_-]{6,128}$" }) })
        ])
      }
    },
    async (request, reply) => {
      try {
        const value = await service.studioWatermarkPath(
          request.params.id,
          request.params.mediaId,
          request.params.assetId
        );
        reply.raw.once("close", value.release);
        reply
          .header("content-type", value.asset.mimeType)
          .header("cache-control", "no-store")
          .header("x-content-type-options", "nosniff");
        return sendArchiveRange(reply, value.file, value.asset.size, request.headers.range, value.release);
      } catch (error) {
        const known = failure(error);
        return reply.code(known.statusCode).send(fail(known.code, known.message));
      }
    }
  );
  const failure = (error: unknown) => {
    if (error instanceof VideoEditError || error instanceof ContentArchiveStoreError) return error;
    throw error;
  };
  const libraryParams = Type.Object(
    { watermarkId: Type.String({ pattern: "^[A-Za-z0-9_-]{12}$" }) },
    { additionalProperties: false }
  );
  app.get<{ Reply: ApiResponse<ArchiveWatermarkLibraryItem[]> }>(
    `${prefix}/watermark-library`,
    {
      schema: { response: { 200: apiSuccessSchema(Type.Array(ArchiveWatermarkLibraryItemSchema)) } }
    },
    async (_request, reply) => {
      try {
        return ok(await service.watermarkLibrary.list());
      } catch (error) {
        const known = failure(error);
        return reply.code(known.statusCode).send(fail(known.code, known.message));
      }
    }
  );
  app.post<{ Reply: ApiResponse<ArchiveWatermarkLibraryItem> }>(
    `${prefix}/watermark-library`,
    {
      config: REQUEST_QUOTAS.voice,
      schema: { response: { 201: apiSuccessSchema(ArchiveWatermarkLibraryItemSchema) } }
    },
    async (request, reply) => {
      try {
        const upload = await readWatermarkUpload(request);
        return reply.code(201).send(ok(await service.watermarkLibrary.upload(upload.bytes, upload.name, upload.mime)));
      } catch (error) {
        const known = failure(error);
        return reply.code(known.statusCode).send(fail(known.code, known.message));
      }
    }
  );
  app.get<{ Params: { watermarkId: string } }>(
    `${prefix}/watermark-library/:watermarkId/image`,
    {
      config: REQUEST_QUOTAS.mediaPreview,
      schema: { params: libraryParams }
    },
    async (request, reply) => {
      try {
        const { bytes } = await service.watermarkLibrary.read(request.params.watermarkId);
        return reply
          .header("content-type", "image/png")
          .header("cache-control", "no-store")
          .header("x-content-type-options", "nosniff")
          .send(bytes);
      } catch (error) {
        const known = failure(error);
        return reply.code(known.statusCode).send(fail(known.code, known.message));
      }
    }
  );
  app.delete<{ Params: { watermarkId: string }; Querystring: { revision: number } }>(
    `${prefix}/watermark-library/:watermarkId`,
    {
      config: REQUEST_QUOTAS.voice,
      schema: {
        params: libraryParams,
        querystring: Type.Object({ revision: Type.Integer({ minimum: 1 }) }, { additionalProperties: false }),
        response: { 200: apiSuccessSchema(Type.Object({ id: Type.String() })) }
      }
    },
    async (request, reply) => {
      try {
        return ok(await service.watermarkLibrary.remove(request.params.watermarkId, request.query.revision));
      } catch (error) {
        const known = failure(error);
        return reply.code(known.statusCode).send(fail(known.code, known.message));
      }
    }
  );
  app.post<{ Params: XhsArchiveMediaParams; Body: { libraryId: string } }>(
    `${prefix}/items/:id/media/:mediaId/watermarks/from-library`,
    {
      config: REQUEST_QUOTAS.voice,
      schema: {
        params: XhsArchiveMediaParamsSchema,
        body: Type.Object(
          { libraryId: Type.String({ pattern: "^[A-Za-z0-9_-]{12}$" }) },
          { additionalProperties: false }
        ),
        response: { 201: apiSuccessSchema(ArchiveWatermarkDraftSchema) }
      }
    },
    async (request, reply) => {
      try {
        return reply
          .code(201)
          .send(
            ok(await service.selectLibraryWatermark(request.params.id, request.params.mediaId, request.body.libraryId))
          );
      } catch (error) {
        const known = failure(error);
        return reply.code(known.statusCode).send(fail(known.code, known.message));
      }
    }
  );
  app.get<{ Reply: ApiResponse<ArchiveWatermarkPreset[]> }>(
    `${prefix}/watermark-presets`,
    {
      schema: { response: { 200: apiSuccessSchema(Type.Array(ArchiveWatermarkPresetSchema)) } }
    },
    async (_request, reply) => {
      try {
        return ok(service.watermarkPresets.list());
      } catch (error) {
        const known = failure(error);
        return reply.code(known.statusCode).send(fail(known.code, known.message));
      }
    }
  );
  app.post<{ Body: ArchiveWatermarkPresetInput }>(
    `${prefix}/watermark-presets`,
    {
      config: REQUEST_QUOTAS.voice,
      preValidation: async (request, reply) => {
        if (!Value.Check(ArchiveWatermarkPresetInputSchema, request.body))
          return reply.code(400).send(fail("ARCHIVE_WATERMARK_PRESET_INVALID", "轨迹预设参数无效"));
      },
      schema: {
        body: ArchiveWatermarkPresetInputSchema,
        response: { 201: apiSuccessSchema(ArchiveWatermarkPresetSchema) }
      }
    },
    async (request, reply) => {
      try {
        return reply.code(201).send(ok(service.watermarkPresets.save(request.body)));
      } catch (error) {
        const known = failure(error);
        return reply.code(known.statusCode).send(fail(known.code, known.message));
      }
    }
  );
  app.delete<{ Params: { presetId: string }; Querystring: { revision: number } }>(
    `${prefix}/watermark-presets/:presetId`,
    {
      config: REQUEST_QUOTAS.voice,
      schema: {
        params: Type.Object(
          { presetId: Type.String({ pattern: "^[A-Za-z0-9_-]{12}$" }) },
          { additionalProperties: false }
        ),
        querystring: Type.Object({ revision: Type.Integer({ minimum: 1 }) }, { additionalProperties: false }),
        response: { 200: apiSuccessSchema(Type.Object({ id: Type.String() })) }
      }
    },
    async (request, reply) => {
      try {
        return ok(service.watermarkPresets.remove(request.params.presetId, request.query.revision));
      } catch (error) {
        const known = failure(error);
        return reply.code(known.statusCode).send(fail(known.code, known.message));
      }
    }
  );
  app.get<{ Params: XhsArchiveMediaParams & { sourceId: string } }>(
    `${prefix}/items/:id/media/:mediaId/studio-sources/:sourceId`,
    {
      config: REQUEST_QUOTAS.mediaPreview,
      schema: {
        params: Type.Composite([
          XhsArchiveMediaParamsSchema,
          Type.Object({ sourceId: Type.String({ pattern: "^[A-Za-z0-9_-]{6,128}$" }) })
        ])
      }
    },
    async (request, reply) => {
      try {
        const value = await service.studioSourcePath(
          request.params.id,
          request.params.mediaId,
          request.params.sourceId
        );
        reply.raw.once("close", value.release);
        reply
          .header("content-type", value.asset.mimeType)
          .header("cache-control", "no-store")
          .header("accept-ranges", "bytes");
        return sendArchiveRange(reply, value.file, value.asset.size, request.headers.range, value.release);
      } catch (error) {
        const known = failure(error);
        return reply.code(known.statusCode).send(fail(known.code, known.message));
      }
    }
  );
  app.get<{ Params: XhsArchiveMediaParams & { trackId: string } }>(
    `${prefix}/items/:id/media/:mediaId/studio-music/:trackId`,
    {
      config: REQUEST_QUOTAS.mediaPreview,
      schema: {
        params: Type.Composite([
          XhsArchiveMediaParamsSchema,
          Type.Object({ trackId: Type.String({ pattern: "^[A-Za-z0-9_-]{6,128}$" }) })
        ])
      }
    },
    async (request, reply) => {
      try {
        const value = await service.studioMusicPath(request.params.id, request.params.mediaId, request.params.trackId);
        reply.raw.once("close", value.release);
        reply
          .header("content-type", value.asset.mimeType)
          .header("cache-control", "no-store")
          .header("accept-ranges", "bytes");
        return sendArchiveRange(reply, value.file, value.asset.size, request.headers.range, value.release);
      } catch (error) {
        const known = failure(error);
        return reply.code(known.statusCode).send(fail(known.code, known.message));
      }
    }
  );
  app.post<{ Params: XhsArchiveMediaParams; Body: ArchiveVideoWaveformInput }>(
    `${prefix}/items/:id/media/:mediaId/video-waveform`,
    {
      config: REQUEST_QUOTAS.mediaPreview,
      schema: {
        params: XhsArchiveMediaParamsSchema,
        body: ArchiveVideoWaveformInputSchema,
        response: { 200: apiSuccessSchema(ArchiveVideoWaveformSchema) }
      }
    },
    async (request, reply) => {
      const controller = new AbortController();
      const abort = () => {
        if (!reply.raw.writableFinished) controller.abort();
      };
      reply.raw.once("close", abort);
      let release: (() => void) | undefined;
      try {
        const source = await service.pinStudioSource(request.params.id, request.params.mediaId, request.body.source);
        release = source.release;
        return ok(await videoWaveform(await service.mediaTools(), source.file, controller.signal));
      } catch (error) {
        const known = failure(error);
        return reply.code(known.statusCode).send(fail(known.code, known.message));
      } finally {
        reply.raw.removeListener("close", abort);
        release?.();
      }
    }
  );
  app.get<{ Params: XhsArchiveMediaParams }>(
    `${prefix}/items/:id/media/:mediaId/cut-source`,
    {
      config: REQUEST_QUOTAS.mediaPreview,
      schema: { params: XhsArchiveMediaParamsSchema, response: { 200: apiSuccessSchema(ArchiveCutSourceSchema) } }
    },
    async (request, reply) => {
      try {
        return ok(await service.cutSource(request.params.id, request.params.mediaId));
      } catch (error) {
        const known = failure(error);
        return reply.code(known.statusCode).send(fail(known.code, known.message));
      }
    }
  );
  app.put<{ Params: XhsArchiveMediaParams; Body: ArchiveCutDraft }>(
    `${prefix}/items/:id/media/:mediaId/cut-draft`,
    {
      config: REQUEST_QUOTAS.archiveCutDraft,
      preValidation: async (request, reply) => {
        if (!Value.Check(ArchiveCutDraftSchema, request.body))
          return reply.code(400).send(fail("ARCHIVE_CUT_RANGE_INVALID", "工程草稿参数无效，请检查片段、配乐和水印"));
        rememberAutomaticEnds(request, request.body);
      },
      schema: {
        params: XhsArchiveMediaParamsSchema,
        body: ArchiveCutDraftSchema,
        response: { 200: apiSuccessSchema(ArchiveCutDraftSchema) }
      }
    },
    async (request, reply) => {
      try {
        restoreAutomaticEnds(request);
        return ok(await service.saveCutDraft(request.params.id, request.params.mediaId, request.body));
      } catch (error) {
        const known = failure(error);
        return reply.code(known.statusCode).send(fail(known.code, known.message));
      }
    }
  );
  app.get(
    `${prefix}/video-edit-runtime`,
    { schema: { response: { 200: apiSuccessSchema(Type.Object({ ready: Type.Boolean() })) } } },
    async () => ok({ ready: await service.available() })
  );
  app.post<{ Params: XhsArchiveMediaParams }>(
    `${prefix}/items/:id/media/:mediaId/watermarks`,
    {
      config: REQUEST_QUOTAS.voice,
      schema: { params: XhsArchiveMediaParamsSchema, response: { 201: apiSuccessSchema(ArchiveWatermarkDraftSchema) } }
    },
    async (request, reply) => {
      try {
        const upload = await readWatermarkUpload(request);
        return reply
          .code(201)
          .send(
            ok(
              await service.uploadWatermark(
                request.params.id,
                request.params.mediaId,
                upload.bytes,
                upload.name,
                upload.mime
              )
            )
          );
      } catch (error) {
        const known = failure(error);
        return reply.code(known.statusCode).send(fail(known.code, known.message));
      }
    }
  );
  app.get<{ Params: XhsArchiveMediaParams & { draftId: string } }>(
    `${prefix}/items/:id/media/:mediaId/watermarks/:draftId`,
    {
      config: REQUEST_QUOTAS.mediaPreview,
      schema: {
        params: Type.Composite([
          XhsArchiveMediaParamsSchema,
          Type.Object({ draftId: Type.String({ pattern: "^[A-Za-z0-9_-]{12}$" }) })
        ])
      }
    },
    async (request, reply) => {
      try {
        if (!(await store.mediaPath(request.params.id, request.params.mediaId)))
          return reply.code(404).send(fail("ARCHIVE_MEDIA_NOT_FOUND", "归档视频不存在"));
        const draft = await service.watermarks.acquire(
          request.params.id,
          request.params.mediaId,
          request.params.draftId
        );
        reply.raw.once("close", draft.release);
        reply
          .header("content-type", "image/png")
          .header("cache-control", "no-store")
          .header("x-content-type-options", "nosniff");
        return sendArchiveRange(reply, draft.path, draft.file.size, request.headers.range, draft.release);
      } catch (error) {
        const known = failure(error);
        return reply.code(known.statusCode).send(fail(known.code, known.message));
      }
    }
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
          return reply
            .code(400)
            .send(fail("ARCHIVE_EDIT_INPUT_INVALID", "视频编辑参数无效，请检查片段、配乐、水印和版本"));
        rememberAutomaticEnds(request, request.body);
      },
      schema: {
        params: XhsArchiveMediaParamsSchema,
        body: ArchiveVideoEditInputSchema,
        response: { 202: apiSuccessSchema(ArchiveVideoEditJobSchema) }
      }
    },
    async (request, reply) => {
      try {
        restoreAutomaticEnds(request);
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
      return job ? ok(job) : reply.code(404).send(fail("ARCHIVE_EDIT_NOT_FOUND", "视频编辑任务不存在"));
    }
  );
  app.delete<{ Params: TaskIdParams }>(
    `${prefix}/video-edits/:taskId`,
    { schema: { params: TaskIdParamsSchema } },
    async (request, reply) => {
      try {
        const job = await service.cancel(request.params.taskId);
        return job ? ok(job) : reply.code(404).send(fail("ARCHIVE_EDIT_NOT_FOUND", "视频编辑任务不存在"));
      } catch (error) {
        const known = failure(error);
        return reply.code(known.statusCode).send(fail(known.code, known.message));
      }
    }
  );
  app.get<{ Params: TaskIdParams; Querystring: { download?: string } }>(
    `${prefix}/video-edits/:taskId/preview`,
    {
      config: REQUEST_QUOTAS.mediaPreview,
      schema: { params: TaskIdParamsSchema, querystring: Type.Object({ download: Type.Optional(Type.Literal("1")) }) }
    },
    async (request, reply) => {
      const file = service.previewPath(request.params.taskId);
      const stat = file ? await fs.stat(file).catch(() => undefined) : undefined;
      if (!file || !stat?.isFile())
        return reply.code(404).send(fail("ARCHIVE_EDIT_PREVIEW_MISSING", "试听已失效，请重新生成"));
      if (request.query.download) reply.header("content-disposition", 'attachment; filename="archive-video.mp4"');
      reply.header("content-type", "video/mp4").header("cache-control", "no-store").header("accept-ranges", "bytes");
      return sendArchiveRange(reply, file, stat.size, request.headers.range);
    }
  );
  for (const variant of ["original", "saved-music", "saved-watermark"] as const)
    app.get<{ Params: XhsArchiveMediaParams }>(
      `${prefix}/items/:id/media/:mediaId/${variant}`,
      { config: REQUEST_QUOTAS.mediaPreview, schema: { params: XhsArchiveMediaParamsSchema } },
      async (request, reply) => {
        const value = await store.mediaPath(request.params.id, request.params.mediaId);
        const asset =
          variant === "original"
            ? (value?.media.audioEdit?.original ?? value?.media)
            : variant === "saved-music"
              ? value?.media.audioEdit?.music
              : value?.media.audioEdit?.watermark?.file;
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

async function readWatermarkUpload(request: FastifyRequest) {
  try {
    let upload: { bytes: Buffer; name: string; mime: string } | undefined;
    for await (const part of request.parts({ limits: { files: 1, fields: 0, parts: 1, fileSize: 20 * 1024 * 1024 } })) {
      if (part.type !== "file" || part.fieldname !== "file" || upload)
        throw new VideoEditError("ARCHIVE_WATERMARK_INVALID", "请上传一张水印图片");
      upload = { bytes: await part.toBuffer(), name: part.filename, mime: part.mimetype };
    }
    if (!upload) throw new VideoEditError("ARCHIVE_WATERMARK_INVALID", "请上传水印图片");
    return upload;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      ["FST_REQ_FILE_TOO_LARGE", "FST_FILES_LIMIT", "FST_PARTS_LIMIT", "FST_FIELDS_LIMIT"].includes(String(error.code))
    )
      throw new VideoEditError("ARCHIVE_WATERMARK_TOO_LARGE", "仅接受一张不超过 20 MiB 的水印图片", 413);
    throw error;
  }
}
