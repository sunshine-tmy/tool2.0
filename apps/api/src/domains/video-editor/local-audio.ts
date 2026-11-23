/** Local editor audio belongs to the project asset registry, never the shared audio library. */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { nanoid } from "nanoid";
import {
  AUDIO_LIBRARY_MAX_FILE_BYTES,
  VideoEditorLocalAudioSchema,
  apiSuccessSchema,
  ok,
  fail,
  type VideoEditorDraftAssets,
  type VideoEditorLocalAudio
} from "@toolbox/shared";
import { inspectAudio } from "../audio-library/media";
import { AudioLibraryError } from "../audio-library/errors";
import { VideoEditError } from "../content-archive/video-edit/renderer";
import { ContentArchiveStoreError } from "../content-archive/core/store";
import { FileMetadataRepository } from "../../database/file-metadata";
import { REQUEST_QUOTAS } from "../../security/request-quotas";
import type { VideoEditorProjects } from "./projects";
import type { AudioLibraryStore } from "../audio-library/store";
import { audioLibraryPurpose } from "@toolbox/shared";
import type { ArchiveVideoEditService } from "../content-archive/video-edit/service";

export function registerEditorLocalAudio(
  app: FastifyInstance,
  projects: VideoEditorProjects,
  editor: ArchiveVideoEditService,
  library?: AudioLibraryStore
) {
  const root = "/api/v1/tools/video-editor/materials/:id/:mediaId/audio";
  const params = Type.Object({
    id: Type.String({ pattern: "^editor_[A-Za-z0-9_-]{1,80}$" }),
    mediaId: Type.String({ pattern: "^[A-Za-z0-9_-]{1,80}$" })
  });
  const read = (id: string, mediaId: string) =>
    (projects.database.get("video-editor-draft-assets", `${id}:${mediaId}`)?.payload ?? {}) as VideoEditorDraftAssets;
  const retainAudio = (
    id: string,
    mediaId: string,
    file: string,
    filename: string,
    info: Awaited<ReturnType<typeof inspectAudio>>,
    signal: AbortSignal,
    source?: VideoEditorLocalAudio["source"]
  ) =>
    projects.withAudioOwner(id, mediaId, (directory) =>
      editor.withDraftAssetWrite(id, mediaId, async () => {
        signal.throwIfAborted();
        const previous = read(id, mediaId);
        const existing =
          source &&
          previous.localAudio?.find(
            (asset) => asset.source?.id === source.id && asset.source.revision === source.revision
          );
        if (existing) return existing;
        const total = new Map(
          [...(previous.studioSources ?? []), ...(previous.studioMusic ?? [])].map((entry) => [
            entry.file.fileName,
            entry.file.size
          ])
        );
        const space = await fsp.statfs(directory);
        if (
          [...total.values()].reduce((sum, size) => sum + size, info.bytes) >
            projects.config.xhsArchiveMaxStorageBytes ||
          info.bytes + 64 * 1024 * 1024 > Number(space.bavail) * Number(space.bsize)
        )
          throw new VideoEditError("EDITOR_AUDIO_STORAGE", "工程素材空间不足", 507);
        const assetId = `local_audio_${nanoid(16)}`;
        const fileName = `draft-${nanoid(16)}${path.extname(info.fileName)}`;
        const target = path.join(directory, fileName);
        await fsp.copyFile(file, target, fs.constants.COPYFILE_EXCL);
        try {
          const asset: VideoEditorLocalAudio = {
            id: assetId,
            title: (source ? filename : filename.replace(/\.[^.]+$/, "")).slice(0, 500) || "本地音频",
            duration: info.duration,
            ...(source ? { source } : {}),
            file: { fileName, mimeType: info.mimeType, size: info.bytes, checksum: info.sha256 }
          };
          const metadata = await new FileMetadataRepository(projects.database, projects.config.storageRoot).inspect({
            entityKind: "video-editor-draft-assets",
            entityId: id,
            filePath: target,
            mediaType: info.mimeType,
            owner: "local"
          });
          signal.throwIfAborted();
          const now = new Date().toISOString();
          projects.database.transaction(() => {
            projects.database.upsert({
              id: `${id}:${mediaId}`,
              kind: "video-editor-draft-assets",
              status: id,
              payload: {
                ...previous,
                localAudio: [...(previous.localAudio ?? []), asset],
                studioMusic: [
                  ...(previous.studioMusic ?? []),
                  { trackId: assetId, libraryItemId: assetId, libraryRevision: 1, file: asset.file }
                ]
              },
              createdAt: now,
              updatedAt: now
            });
            projects.database.upsertFile(metadata);
          });
          return asset;
        } catch (error) {
          await fsp.rm(target, { force: true });
          throw error;
        }
      })
    );
  const failure = (reply: import("fastify").FastifyReply, error: unknown) => {
    if (error instanceof AudioLibraryError) return reply.code(error.status).send(fail(error.code, error.message));
    if (error instanceof VideoEditError || error instanceof ContentArchiveStoreError)
      return reply.code(error.statusCode).send(fail(error.code, error.message));
    if ((error as { code?: string })?.code === "FST_REQ_FILE_TOO_LARGE")
      return reply.code(413).send(fail("EDITOR_AUDIO_SIZE", "音频不能超过 100 MiB"));
    throw error;
  };
  app.get<{ Params: { id: string; mediaId: string } }>(
    root,
    { schema: { params, response: { 200: apiSuccessSchema(Type.Array(VideoEditorLocalAudioSchema)) } } },
    async (req, reply) => {
      try {
        await projects.audioOwner(req.params.id, req.params.mediaId);
        return ok(read(req.params.id, req.params.mediaId).localAudio ?? []);
      } catch (error) {
        return failure(reply, error);
      }
    }
  );
  app.post<{ Params: { id: string; mediaId: string }; Body: { id: string; revision: number } }>(
    `${root}/import`,
    {
      config: REQUEST_QUOTAS.audioExtractLibrary,
      schema: {
        params,
        body: Type.Object(
          { id: Type.String({ pattern: "^[A-Za-z0-9_-]{1,80}$" }), revision: Type.Integer({ minimum: 1 }) },
          { additionalProperties: false }
        ),
        response: { 200: apiSuccessSchema(VideoEditorLocalAudioSchema) }
      }
    },
    async (req, reply) => {
      const controller = new AbortController();
      const abort = () => {
        if (!reply.raw.writableFinished) controller.abort();
      };
      reply.raw.once("close", abort);
      let release: (() => void) | undefined;
      try {
        await projects.audioOwner(req.params.id, req.params.mediaId);
        if (!library) throw new VideoEditError("EDITOR_AUDIO_LIBRARY_UNAVAILABLE", "音频素材库不可用", 503);
        const item = await library.item(req.body.id);
        if (item.deletedAt) throw new VideoEditError("EDITOR_AUDIO_MISSING", "音频已删除，请重新选择", 404);
        if (item.revision !== req.body.revision)
          throw new VideoEditError("EDITOR_AUDIO_CHANGED", "音频已更新，请重新查询后选择", 409);
        release = library.pin([item.id]);
        const file = library.file(item),
          info = await inspectAudio(file);
        if (info.sha256 !== item.sha256)
          throw new VideoEditError("EDITOR_AUDIO_CHANGED", "音频文件已变化，请重新选择", 409);
        const asset = await retainAudio(req.params.id, req.params.mediaId, file, item.title, info, controller.signal, {
          id: item.id,
          revision: item.revision,
          purpose: audioLibraryPurpose(item)
        });
        return ok(asset);
      } catch (error) {
        if (controller.signal.aborted) return reply.code(499).send(fail("EDITOR_AUDIO_CANCELLED", "导入已取消"));
        return failure(reply, error);
      } finally {
        reply.raw.removeListener("close", abort);
        release?.();
      }
    }
  );
  app.post<{ Params: { id: string; mediaId: string } }>(
    root,
    {
      config: REQUEST_QUOTAS.audioExtractUpload,
      schema: { params, response: { 201: apiSuccessSchema(VideoEditorLocalAudioSchema) } }
    },
    async (req, reply) => {
      let staging: string | undefined;
      const controller = new AbortController();
      const abort = () => {
        if (!reply.raw.writableFinished) controller.abort();
      };
      req.raw.once("aborted", abort);
      reply.raw.once("close", abort);
      try {
        const { id, mediaId } = req.params;
        await projects.audioOwner(id, mediaId);
        staging = await projects.assets.createStaging(`editor_audio_${nanoid(12)}`);
        const temporary = path.join(staging, "upload.audio");
        let filename = "",
          uploaded = false;
        const free = await fsp.statfs(staging);
        let bytes = 0;
        const byteLimit = Math.min(
          AUDIO_LIBRARY_MAX_FILE_BYTES,
          projects.config.xhsArchiveMaxStorageBytes,
          Math.max(0, Number(free.bavail) * Number(free.bsize) - 64 * 1024 * 1024)
        );
        for await (const part of req.parts({
          limits: { files: 1, fields: 0, parts: 1, fileSize: AUDIO_LIBRARY_MAX_FILE_BYTES }
        })) {
          if (part.type !== "file" || part.fieldname !== "file")
            throw new VideoEditError("EDITOR_AUDIO_INPUT", "请选择音频文件");
          filename = path.basename(part.filename.replace(/\\/g, "/"));
          if (!/\.(mp3|wav|m4a|flac)$/i.test(filename))
            throw new VideoEditError("EDITOR_AUDIO_FORMAT", "支持 MP3、WAV、M4A、FLAC", 415);
          await pipeline(
            part.file,
            new Transform({
              transform(chunk, _encoding, done) {
                bytes += chunk.length;
                done(
                  bytes > byteLimit
                    ? new VideoEditError("EDITOR_AUDIO_STORAGE", "音频超过大小或可用空间限制", 413)
                    : null,
                  chunk
                );
              }
            }),
            fs.createWriteStream(temporary, { flags: "wx" }),
            { signal: controller.signal }
          );
          if (part.file.truncated) throw new VideoEditError("EDITOR_AUDIO_SIZE", "音频不能超过 100 MiB", 413);
          uploaded = true;
        }
        if (!uploaded) throw new VideoEditError("EDITOR_AUDIO_INPUT", "请选择音频文件");
        const info = await inspectAudio(temporary);
        const result = await retainAudio(id, mediaId, temporary, filename, info, controller.signal);
        return reply.code(201).send(ok(result));
      } catch (error) {
        if (controller.signal.aborted) return reply.code(499).send(fail("EDITOR_AUDIO_CANCELLED", "上传已取消"));
        return failure(reply, error);
      } finally {
        req.raw.removeListener("aborted", abort);
        reply.raw.removeListener("close", abort);
        if (staging) {
          const resolved = path.resolve(staging),
            root = path.resolve(projects.config.xhsArchiveStagingDir) + path.sep;
          if (resolved.startsWith(root)) await fsp.rm(resolved, { recursive: true, force: true });
        }
      }
    }
  );
}
