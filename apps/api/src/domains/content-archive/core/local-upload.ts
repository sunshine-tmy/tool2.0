/** Bounded local video ingestion. Files stream to owned staging and publish through the archive commit gateway. */
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { nanoid } from "nanoid";
import { Value } from "@sinclair/typebox/value";
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  LOCAL_ARCHIVE_UPLOAD_MAX_BYTES,
  ArchiveGroupIdSchema,
  LocalArchiveUploadResultSchema,
  apiSuccessSchema,
  ok,
  fail,
  type ContentArchiveItem,
  type ApiResponse
} from "@toolbox/shared";
import type { AppConfig } from "../../../config";
import type { TaskStore, Task } from "../../../tasks/task-store";
import { REQUEST_QUOTAS } from "../../../security/request-quotas";
import { ContentArchiveStore, ContentArchiveStoreError } from "./store";
import { ArchiveTaskError } from "./provider";
import { VideoEditError, probeMedia, runMediaProcess, type MediaTools } from "../video-edit/renderer";

export class LocalVideoArchiveUploads {
  private active?: { controller: AbortController; done: Promise<unknown> };
  private stopped = false;
  constructor(
    private options: {
      config: AppConfig;
      tasks: TaskStore;
      store: ContentArchiveStore;
      tools: () => Promise<MediaTools>;
      probe?: typeof probeMedia;
      run?: typeof runMediaProcess;
    }
  ) {
    // Uploads belong to the browser session and must never resume after a restart.
    for (const task of options.tasks.list()) {
      if (task.toolId === "media-archive-local-upload" && ["pending", "running"].includes(task.status))
        this.publish({
          ...task,
          status: "failed",
          error: "ARCHIVE_UPLOAD_INTERRUPTED",
          updatedAt: new Date().toISOString()
        });
    }
  }
  private publish(task: Task) {
    return this.options.tasks.commit(
      task,
      () => undefined,
      () => undefined
    );
  }
  async upload(request: FastifyRequest, requestSignal: AbortSignal) {
    if (this.stopped) throw new VideoEditError("ARCHIVE_UPLOAD_STOPPED", "服务正在退出，请稍后重试", 503);
    if (this.active) throw new VideoEditError("ARCHIVE_UPLOAD_BUSY", "另一视频正在归档，请稍后重试", 429);
    const controller = new AbortController(),
      signal = AbortSignal.any([controller.signal, requestSignal]);
    const now = new Date().toISOString();
    const task: Task = {
      id: nanoid(12),
      toolId: "media-archive-local-upload",
      status: "running",
      progress: 0,
      createdAt: now,
      updatedAt: now
    };
    this.publish(task);
    const done = (async () => {
      try {
        const result = await this.receive(request, signal);
        this.publish({ ...task, status: "completed", progress: 100, updatedAt: new Date().toISOString() });
        return result;
      } catch (error) {
        this.publish({
          ...task,
          status: "failed",
          error: signal.aborted ? "ARCHIVE_UPLOAD_CANCELLED" : "ARCHIVE_UPLOAD_FAILED",
          updatedAt: new Date().toISOString()
        });
        throw error;
      }
    })();
    this.active = { controller, done };
    try {
      return await done;
    } finally {
      this.active = undefined;
    }
  }
  async close() {
    this.stopped = true;
    this.active?.controller.abort();
    await this.active?.done.catch(() => undefined);
  }
  private async receive(request: FastifyRequest, signal: AbortSignal) {
    signal.throwIfAborted();
    const tools = await this.options.tools();
    const { store, config } = this.options;
    const staging = await store.createStaging(`local_upload_${nanoid(12)}`);
    if (path.dirname(path.resolve(staging)) !== path.resolve(config.xhsArchiveStagingDir))
      throw new Error("ARCHIVE_UPLOAD_CLEANUP_PATH");
    let committed = false;
    try {
      const free = await fs.statfs(staging);
      const available = Number(free.bavail) * Number(free.bsize) - 64 * 1024 * 1024;
      if (available < 1) throw new VideoEditError("ARCHIVE_UPLOAD_DISK_FULL", "磁盘剩余空间不足，无法上传视频", 507);
      const maxBytes = Math.min(LOCAL_ARCHIVE_UPLOAD_MAX_BYTES, config.remoteMediaMaxBytes, available);
      let video: { name: string; extension: string; size: number; checksum: string; file: string } | undefined;
      let title: string | undefined;
      let groupId: string | undefined;
      for await (const part of request.parts({
        limits: { files: 1, fields: 2, parts: 3, fieldSize: 4096, fileSize: maxBytes }
      })) {
        signal.throwIfAborted();
        if (part.type === "field") {
          if (part.fieldname === "groupId") {
            if (groupId !== undefined || part.valueTruncated || !Value.Check(ArchiveGroupIdSchema, part.value))
              throw new ArchiveTaskError("ARCHIVE_GROUP_INPUT_INVALID", "请选择有效的归档分组");
            groupId = part.value;
            store.groups.assertExists(groupId);
            continue;
          }
          if (
            part.fieldname !== "title" ||
            title !== undefined ||
            part.valueTruncated ||
            typeof part.value !== "string" ||
            part.value.length > 500
          )
            throw new VideoEditError("ARCHIVE_UPLOAD_INVALID", "仅接受视频文件、不超过 500 字的标题及有效分组");
          title = part.value.trim();
          continue;
        }
        if (part.fieldname !== "file" || video)
          throw new VideoEditError("ARCHIVE_UPLOAD_INVALID", "每次请求仅接受一个视频");
        const name = part.filename
          .replaceAll("\\", "/")
          .split("/")
          .pop()!
          .replace(/\p{Cc}/gu, "");
        const extension = path.extname(name).toLowerCase();
        if (![".mp4", ".mov", ".webm"].includes(extension))
          throw new VideoEditError("ARCHIVE_UPLOAD_FORMAT", "请选择 MP4、MOV 或 WebM 视频", 415);
        const file = path.join(staging, `video${extension}`),
          hash = createHash("sha256");
        let size = 0;
        await pipeline(
          part.file,
          new Transform({
            transform(chunk: Buffer, _encoding, callback) {
              size += chunk.length;
              if (size > maxBytes)
                return callback(new VideoEditError("ARCHIVE_UPLOAD_TOO_LARGE", "视频超过大小或可用磁盘空间限制", 413));
              hash.update(chunk);
              callback(null, chunk);
            }
          }),
          createWriteStream(file, { flags: "wx" }),
          { signal }
        );
        if (part.file.truncated || !size)
          throw new VideoEditError("ARCHIVE_UPLOAD_TOO_LARGE", "视频为空或超过上传限制", 413);
        video = { name, extension, size, file, checksum: hash.digest("hex") };
      }
      if (!video) throw new VideoEditError("ARCHIVE_UPLOAD_INVALID", "请选择本地视频");
      signal.throwIfAborted();
      const header = Buffer.alloc(16),
        handle = await fs.open(video.file, "r");
      try {
        await handle.read(header, 0, header.length, 0);
      } finally {
        await handle.close();
      }
      const atom = header.toString("ascii", 4, 8);
      const containerValid =
        video.extension === ".webm"
          ? header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
          : atom === "ftyp" || (video.extension === ".mov" && ["moov", "mdat", "wide", "free", "skip"].includes(atom));
      if (!containerValid) throw new VideoEditError("ARCHIVE_UPLOAD_FORMAT", "文件内容不是受支持的视频容器", 415);
      const existing = await store.findBySource("local", video.checksum);
      if (existing) return { item: existing, duplicate: true };
      const info = await (this.options.probe ?? probeMedia)(tools, video.file, signal, true, true);
      if (!(info.width > 0 && info.height > 0) || info.width > 16384 || info.height > 16384)
        throw new VideoEditError("ARCHIVE_UPLOAD_FORMAT", "视频尺寸无效或超过支持范围", 415);
      const coverFile = path.join(staging, "cover.jpg");
      await (this.options.run ?? runMediaProcess)(
        tools.ffmpeg,
        [
          "-v",
          "error",
          "-protocol_whitelist",
          "file,pipe",
          "-ss",
          String(Math.min(0.5, info.duration / 4)),
          "-i",
          video.file,
          "-map",
          "0:v:0",
          "-frames:v",
          "1",
          "-an",
          "-sn",
          "-dn",
          "-vf",
          "scale=720:720:force_original_aspect_ratio=decrease",
          "-q:v",
          "3",
          "-threads",
          "1",
          "-y",
          coverFile
        ],
        signal,
        { timeoutMs: 60000, output: coverFile, maxBytes: 20 * 1024 * 1024 }
      );
      const cover = await fs.readFile(coverFile);
      const id = `local_${nanoid(16)}`,
        mediaId = nanoid(16),
        coverId = nanoid(16),
        now = new Date().toISOString();
      const mediaUrl = (media: string) => `/api/v1/tools/media-archive/items/${id}/media/${media}`;
      const item: ContentArchiveItem = {
        id,
        platform: "local",
        contentId: video.checksum,
        type: "video",
        sourceUrl: `toolbox://local-video/${video.checksum}`,
        canonicalUrl: `toolbox://local-video/${video.checksum}`,
        title: title || video.name.replace(/\.[^.]+$/, "").slice(0, 500) || "本地视频",
        topics: [],
        coverMediaId: coverId,
        fetchedAt: now,
        updatedAt: now,
        status: "ready",
        warnings: [],
        media: [
          {
            id: mediaId,
            index: 0,
            kind: "video",
            fileName: path.basename(video.file),
            mimeType:
              video.extension === ".webm" ? "video/webm" : video.extension === ".mov" ? "video/quicktime" : "video/mp4",
            size: video.size,
            checksum: video.checksum,
            width: info.width,
            height: info.height,
            durationMs: Math.round(info.duration * 1000),
            previewUrl: mediaUrl(mediaId),
            downloadUrl: `${mediaUrl(mediaId)}?download=1`
          },
          {
            id: coverId,
            index: 1,
            kind: "cover",
            fileName: "cover.jpg",
            mimeType: "image/jpeg",
            size: cover.length,
            checksum: createHash("sha256").update(cover).digest("hex"),
            previewUrl: mediaUrl(coverId),
            downloadUrl: `${mediaUrl(coverId)}?download=1`
          }
        ],
        totalBytes: video.size + cover.length
      };
      signal.throwIfAborted();
      const saved = await store.commit(item, staging, { groupId });
      committed = true;
      return { item: saved, duplicate: false };
    } finally {
      if (!committed) {
        await fs.rm(staging, { recursive: true, force: true });
      }
    }
  }
}

export function registerLocalVideoUploadRoutes(app: FastifyInstance, uploads: LocalVideoArchiveUploads) {
  app.post<{ Reply: ApiResponse<{ item: ContentArchiveItem; duplicate: boolean }> }>(
    "/api/v1/tools/media-archive/local-videos",
    {
      bodyLimit: LOCAL_ARCHIVE_UPLOAD_MAX_BYTES + 64 * 1024,
      config: REQUEST_QUOTAS.localArchiveUpload,
      schema: { response: { 201: apiSuccessSchema(LocalArchiveUploadResultSchema) } }
    },
    async (request, reply) => {
      const controller = new AbortController();
      const abort = () => {
        if (!reply.raw.writableFinished) controller.abort();
      };
      request.raw.once("aborted", abort);
      reply.raw.once("close", abort);
      try {
        return reply.code(201).send(ok(await uploads.upload(request, controller.signal)));
      } catch (error) {
        if (
          error instanceof VideoEditError ||
          error instanceof ContentArchiveStoreError ||
          error instanceof ArchiveTaskError
        )
          return reply.code(error.statusCode).send(fail(error.code, error.message));
        if (
          error instanceof Error &&
          "code" in error &&
          ["FST_REQ_FILE_TOO_LARGE", "FST_FILES_LIMIT", "FST_PARTS_LIMIT", "FST_FIELDS_LIMIT"].includes(
            String(error.code)
          )
        )
          return reply.code(413).send(fail("ARCHIVE_UPLOAD_TOO_LARGE", "视频大小超限或请求包含额外文件/字段"));
        if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError"))
          return reply.code(409).send(fail("ARCHIVE_UPLOAD_CANCELLED", "上传已停止，已成功归档的内容保留"));
        throw error;
      } finally {
        request.raw.removeListener("aborted", abort);
        reply.raw.removeListener("close", abort);
      }
    }
  );
}
