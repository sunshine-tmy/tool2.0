import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance } from "fastify";
import { ZipArchive } from "archiver";
import { nanoid } from "nanoid";
import {
  LanAccessInputSchema,
  LanChunkParamsSchema,
  LanExpiryInputSchema,
  LanFileListQuerySchema,
  LanIdParamsSchema,
  LanIdsInputSchema,
  LanNoteImageParamsSchema,
  LanPaginationQuerySchema,
  LanUploadParamsSchema,
  LanUploadSessionInputSchema,
  classifyLanFile,
  fail,
  getLanFileExtension,
  isLanFilePreviewable,
  lanNoteLimits,
  normalizeLanFileQuery,
  ok,
  type LanFileRecord,
  type LanAccessInput,
  type LanChunkParams,
  type LanExpiryInput,
  type LanFileListQuery,
  type LanIdParams,
  type LanIdsInput,
  type LanNoteImageRecord,
  type LanNoteImageParams,
  type LanNoteRecord,
  type LanPaginationQuery,
  type LanUploadParams,
  type LanUploadSessionInput
} from "@toolbox/shared";
import type { AppConfig } from "../config";
import type { ToolboxDatabase } from "../database/toolbox-database";
import {
  createLanAccessController,
  createLanAuditLog,
  getLanWebUrls,
  type LanAccessController
} from "./lan-transfer/access";
import {
  extensionForLanNoteImage,
  getFileOr404,
  hasLanNoteImageSignature,
  hasPdfSignature,
  isAllowedLanNoteImageMime,
  sendFile,
  sendLanNoteImage,
  withNoteUrls,
  withUrls
} from "./lan-transfer/files";
import { createLanFileStore, createLanNoteStore } from "./lan-transfer/repositories";
import {
  checkMergeHeadroom,
  createLanUploadStore,
  getExpectedChunkSize,
  getMissingChunks,
  isNoSpaceError,
  mergeChunks,
  parseUploadSessionBody,
  toUploadStatus
} from "./lan-transfer/uploads";

type RegisterLanTransferRoutesOptions = {
  app: FastifyInstance;
  config: AppConfig;
  database: ToolboxDatabase;
};

type ListResponse = {
  files: Array<LanFileRecord & { previewUrl: string; downloadUrl: string }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
};

class LanNoteInputError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export async function registerLanTransferRoutes({ app, config, database }: RegisterLanTransferRoutesOptions) {
  const store = createLanFileStore(config, database);
  const noteStore = createLanNoteStore(config, database);
  const uploadStore = createLanUploadStore(config, database);
  const finalizingUploads = new Set<string>();
  const access = createLanAccessController(config);
  const audit = createLanAuditLog(path.join(config.lanTransferDir, "audit.jsonl"));
  await store.ensure();
  await noteStore.ensure();
  await uploadStore.ensure();
  await store.cleanupExpired();
  await noteStore.cleanupExpired();
  await uploadStore.cleanupStale(config.lanTransferUploadRetentionHours);

  registerLanTransferNamespace(
    app,
    config,
    store,
    noteStore,
    uploadStore,
    finalizingUploads,
    access,
    audit,
    "/api/v1/tools/lan-transfer"
  );

  const cleanupTimer = setInterval(
    () => {
      Promise.all([
        store.cleanupExpired(),
        noteStore.cleanupExpired(),
        uploadStore.cleanupStale(config.lanTransferUploadRetentionHours, finalizingUploads)
      ]).catch(() => undefined);
    },
    config.lanTransferCleanupIntervalMinutes * 60 * 1000
  );
  cleanupTimer.unref();
  app.addHook("onClose", async () => clearInterval(cleanupTimer));
}

function registerLanTransferNamespace(
  app: FastifyInstance,
  config: AppConfig,
  store: ReturnType<typeof createLanFileStore>,
  noteStore: ReturnType<typeof createLanNoteStore>,
  uploadStore: ReturnType<typeof createLanUploadStore>,
  finalizingUploads: Set<string>,
  access: LanAccessController,
  audit: ReturnType<typeof createLanAuditLog>,
  basePath: string
) {
  app.get(`${basePath}/info`, async (request) => {
    const fileBytes = await store.totalSize();
    const noteBytes = await noteStore.totalSize();
    const reservedUploadBytes = await uploadStore.totalDeclaredSize();
    return ok({
      lanUrls: getLanWebUrls(config.lanTransferWebPort),
      retentionDays: config.lanTransferRetentionDays,
      maxFileBytes: config.lanTransferMaxFileBytes,
      maxStorageBytes: config.lanTransferMaxStorageBytes,
      usedBytes: fileBytes + noteBytes,
      noteCount: await noteStore.count(),
      reservedUploadBytes,
      pinRequired: Boolean(config.lanTransferPin),
      guestMode: config.lanTransferGuestMode,
      authenticated: access.isAuthenticated(request)
    });
  });

  app.post<{ Body: LanAccessInput }>(
    `${basePath}/access`,
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: { body: LanAccessInputSchema }
    },
    async (request, reply) => {
      const token = access.login(request.body.pin);
      if (!token) {
        await audit.write("access.denied", request);
        return reply.code(401).send(fail("INVALID_LAN_PIN", "访问 PIN 不正确"));
      }
      await audit.write("access.granted", request);
      reply.header("set-cookie", access.sessionCookie(token));
      return ok({ authenticated: true });
    }
  );

  app.delete(`${basePath}/access`, async (request, reply) => {
    access.logout(request);
    reply.header("set-cookie", access.expiredSessionCookie());
    return ok({ authenticated: false });
  });

  app.post(`${basePath}/notes`, async (request, reply) => {
    if (!access.authorize(request, reply, "upload")) return reply;
    const noteId = nanoid(12);
    const writtenNames: string[] = [];
    const images: LanNoteImageRecord[] = [];
    let title = "";
    let content = "";

    try {
      await noteStore.ensure();
      const parts = request.parts({
        limits: {
          files: lanNoteLimits.maxImages,
          fields: 4,
          fileSize: lanNoteLimits.maxImageBytes
        }
      });
      for await (const part of parts) {
        if (part.type === "field") {
          if (part.fieldname === "title") title = String(part.value ?? "").trim();
          if (part.fieldname === "content") content = String(part.value ?? "").trim();
          continue;
        }

        if (part.fieldname !== "images") {
          part.file.resume();
          continue;
        }
        if (!isAllowedLanNoteImageMime(part.mimetype)) {
          part.file.resume();
          throw new LanNoteInputError(
            "LAN_NOTE_IMAGE_TYPE_UNSUPPORTED",
            415,
            "仅支持 JPG、PNG、GIF、WebP 和 AVIF 图片"
          );
        }
        const imageId = nanoid(10);
        const extension = extensionForLanNoteImage(part.mimetype);
        const storedName = `${noteId}-${imageId}.${extension}`;
        const targetPath = noteStore.imagePath(storedName);
        writtenNames.push(storedName);
        await pipeline(part.file, fs.createWriteStream(targetPath));
        const stat = await fsp.stat(targetPath);
        if (part.file.truncated || stat.size > lanNoteLimits.maxImageBytes) {
          throw new LanNoteInputError("LAN_NOTE_IMAGE_TOO_LARGE", 413, "单张图片不能超过 10 MB");
        }
        if (!(await hasLanNoteImageSignature(targetPath, part.mimetype))) {
          throw new LanNoteInputError("LAN_NOTE_IMAGE_INVALID", 415, "图片内容与文件类型不匹配");
        }
        images.push({
          id: imageId,
          originalName: path.basename(part.filename || `image.${extension}`),
          storedName,
          mimeType: part.mimetype,
          extension,
          size: stat.size
        });
      }

      if (title.length > lanNoteLimits.titleCharacters) {
        throw new LanNoteInputError("LAN_NOTE_TITLE_TOO_LONG", 400, "标题不能超过 100 个字符");
      }
      if (content.length > lanNoteLimits.contentCharacters) {
        throw new LanNoteInputError("LAN_NOTE_CONTENT_TOO_LONG", 400, "文字不能超过 20,000 个字符");
      }
      if (!content && !images.length) {
        throw new LanNoteInputError("LAN_NOTE_CONTENT_REQUIRED", 400, "请输入文字或至少选择一张图片");
      }
      const imageBytes = images.reduce((total, image) => total + image.size, 0);
      if (imageBytes > lanNoteLimits.maxTotalImageBytes) {
        throw new LanNoteInputError("LAN_NOTE_IMAGES_TOO_LARGE", 413, "图文中的图片总大小不能超过 30 MB");
      }
      const reservedBytes =
        (await store.totalSize()) + (await noteStore.totalSize()) + (await uploadStore.totalDeclaredSize());
      if (reservedBytes + imageBytes > config.lanTransferMaxStorageBytes) {
        throw new LanNoteInputError("LAN_STORAGE_QUOTA_EXCEEDED", 507, "局域网存储配额不足");
      }

      const now = new Date();
      const note: LanNoteRecord = {
        id: noteId,
        title: title || undefined,
        content,
        images,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + config.lanTransferRetentionDays * 24 * 60 * 60 * 1000).toISOString()
      };
      await noteStore.add(note);
      await audit.write("note.created", request, {
        noteId,
        characters: content.length,
        imageCount: images.length,
        imageBytes
      });
      return ok(withNoteUrls(note, basePath));
    } catch (error) {
      await Promise.all(writtenNames.map((storedName) => fsp.rm(noteStore.imagePath(storedName), { force: true })));
      if (error instanceof LanNoteInputError) {
        return reply.code(error.statusCode).send(fail(error.code, error.message));
      }
      const multipartError = lanNoteMultipartError(error);
      if (multipartError) {
        return reply.code(multipartError.statusCode).send(fail(multipartError.code, multipartError.message));
      }
      const message = error instanceof Error ? error.message : "图文发布失败";
      return reply.code(500).send(fail("LAN_NOTE_CREATE_FAILED", message));
    }
  });

  app.get<{ Querystring: LanPaginationQuery }>(
    `${basePath}/notes`,
    { schema: { querystring: LanPaginationQuerySchema } },
    async (request, reply) => {
      if (!access.authorize(request, reply, "read")) return reply;
      const pageSize = request.query.pageSize ?? 20;
      const requestedPage = request.query.page ?? 1;
      const notes = await noteStore.list();
      const total = notes.length;
      const pageCount = Math.max(1, Math.ceil(total / pageSize));
      const page = Math.min(requestedPage, pageCount);
      const start = (page - 1) * pageSize;
      return ok({
        notes: notes.slice(start, start + pageSize).map((note) => withNoteUrls(note, basePath)),
        pagination: { page, pageSize, total, pageCount }
      });
    }
  );

  app.post<{ Body: LanIdsInput }>(
    `${basePath}/notes/batch-delete`,
    { schema: { body: LanIdsInputSchema } },
    async (request, reply) => {
      if (!access.authorize(request, reply, "manage")) return reply;
      const ids = parseLanFileIds(request.body);
      if (!ids.length) {
        return reply.code(400).send(fail("NOTE_IDS_REQUIRED", "请至少选择一条图文"));
      }
      const result = await noteStore.removeMany(ids);
      await audit.write("notes.batch-deleted", request, result);
      return ok(result);
    }
  );

  app.get<{ Params: LanNoteImageParams }>(
    `${basePath}/notes/:id/images/:imageId/preview`,
    { schema: { params: LanNoteImageParamsSchema } },
    async (request, reply) => {
      if (!access.authorize(request, reply, "read")) return reply;
      return sendLanNoteImage(noteStore, request, reply, "inline");
    }
  );

  app.get<{ Params: LanNoteImageParams }>(
    `${basePath}/notes/:id/images/:imageId/download`,
    { schema: { params: LanNoteImageParamsSchema } },
    async (request, reply) => {
      if (!access.authorize(request, reply, "read")) return reply;
      return sendLanNoteImage(noteStore, request, reply, "attachment");
    }
  );

  app.patch<{ Params: LanIdParams; Body: LanExpiryInput }>(
    `${basePath}/notes/:id/expiry`,
    { schema: { params: LanIdParamsSchema, body: LanExpiryInputSchema } },
    async (request, reply) => {
      if (!access.authorize(request, reply, "manage")) return reply;
      const { id } = request.params;
      const { days } = request.body;
      const updated = await noteStore.updateExpiry(id, days);
      if (!updated) return reply.code(404).send(fail("LAN_NOTE_NOT_FOUND", "图文不存在或已过期"));
      await audit.write("note.expiry-updated", request, { noteId: id, days });
      return ok(withNoteUrls(updated, basePath));
    }
  );

  app.delete<{ Params: LanIdParams }>(
    `${basePath}/notes/:id`,
    { schema: { params: LanIdParamsSchema } },
    async (request, reply) => {
      if (!access.authorize(request, reply, "manage")) return reply;
      const { id } = request.params;
      if (!(await noteStore.remove(id))) {
        return reply.code(404).send(fail("LAN_NOTE_NOT_FOUND", "图文不存在或已过期"));
      }
      await audit.write("note.deleted", request, { noteId: id });
      return ok({ removed: true });
    }
  );

  app.post(`${basePath}/files`, async (request, reply) => {
    if (!access.authorize(request, reply, "upload")) return reply;
    const file = await request.file({
      limits: {
        fileSize: config.lanTransferMaxFileBytes
      }
    });

    if (!file) {
      return reply.code(400).send(fail("FILE_REQUIRED", "Please upload a file"));
    }

    const originalName = path.basename(file.filename || "upload.bin");
    const extension = getLanFileExtension(originalName);
    const id = nanoid(12);
    const storedName = extension ? `${id}.${extension}` : id;
    const targetPath = path.join(config.lanTransferFilesDir, storedName);

    try {
      await fsp.mkdir(config.lanTransferFilesDir, { recursive: true });
      await pipeline(file.file, fs.createWriteStream(targetPath));

      const stat = await fsp.stat(targetPath);
      if (file.file.truncated || stat.size > config.lanTransferMaxFileBytes) {
        await fsp.rm(targetPath, { force: true });
        return reply.code(413).send(fail("FILE_TOO_LARGE", "Uploaded file exceeds the configured limit"));
      }
      if (
        (await store.totalSize()) +
          (await noteStore.totalSize()) +
          (await uploadStore.totalDeclaredSize()) +
          stat.size >
        config.lanTransferMaxStorageBytes
      ) {
        await fsp.rm(targetPath, { force: true });
        return reply.code(507).send(fail("LAN_STORAGE_QUOTA_EXCEEDED", "局域网文件存储配额不足"));
      }

      const classifiedCategory = classifyLanFile(originalName, file.mimetype);
      const category =
        classifiedCategory === "pdf" && !(await hasPdfSignature(targetPath)) ? "other" : classifiedCategory;
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + config.lanTransferRetentionDays * 24 * 60 * 60 * 1000).toISOString();
      const record: LanFileRecord = {
        id,
        originalName,
        storedName,
        mimeType: file.mimetype || "application/octet-stream",
        extension,
        size: stat.size,
        category,
        createdAt,
        expiresAt,
        downloadCount: 0,
        previewable: isLanFilePreviewable(category)
      };

      await store.add(record);
      await audit.write("file.uploaded", request, { fileId: record.id, name: record.originalName, size: record.size });

      return ok({
        file: record,
        previewUrl: `${basePath}/files/${record.id}/preview`,
        downloadUrl: `${basePath}/files/${record.id}/download`
      });
    } catch (error) {
      await fsp.rm(targetPath, { force: true });
      const message = error instanceof Error ? error.message : "File upload failed";
      return reply.code(500).send(fail("UPLOAD_FAILED", message));
    }
  });

  app.get<{ Querystring: LanFileListQuery }>(
    `${basePath}/files`,
    { schema: { querystring: LanFileListQuerySchema } },
    async (request, reply) => {
      if (!access.authorize(request, reply, "read")) return reply;
      const query = normalizeLanFileQuery(request.query);
      const files = await store.list(query);
      const total = files.length;
      const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
      const page = Math.min(query.page, pageCount);
      const start = (page - 1) * query.pageSize;
      const pageFiles = files.slice(start, start + query.pageSize);
      return ok<ListResponse>({
        files: pageFiles.map((file) => withUrls(file, basePath)),
        pagination: {
          page,
          pageSize: query.pageSize,
          total,
          pageCount
        }
      });
    }
  );

  app.post<{ Body: LanIdsInput }>(
    `${basePath}/files/batch-download`,
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: { body: LanIdsInputSchema }
    },
    async (request, reply) => {
      if (!access.authorize(request, reply, "read")) return reply;
      const ids = parseLanFileIds(request.body);
      if (!ids.length) {
        return reply.code(400).send(fail("FILE_IDS_REQUIRED", "请至少选择一个文件"));
      }
      const files = await store.getMany(ids);
      if (!files.length) {
        return reply.code(404).send(fail("LAN_FILE_NOT_FOUND", "File not found"));
      }
      await store.incrementDownloadCounts(files.map((file) => file.id));
      await audit.write("files.batch-downloaded", request, { fileIds: files.map((file) => file.id) });
      const archive = new ZipArchive({ zlib: { level: 1 } });
      const usedNames = new Set<string>();
      for (const file of files) {
        archive.file(path.join(config.lanTransferFilesDir, file.storedName), {
          name: uniqueArchiveName(file.originalName, usedNames)
        });
      }
      reply.header("content-type", "application/zip");
      reply.header("content-disposition", `attachment; filename="lan-files-${Date.now()}.zip"`);
      void archive.finalize();
      return reply.send(archive);
    }
  );

  app.post<{ Body: LanIdsInput }>(
    `${basePath}/files/batch-delete`,
    { schema: { body: LanIdsInputSchema } },
    async (request, reply) => {
      if (!access.authorize(request, reply, "manage")) return reply;
      const ids = parseLanFileIds(request.body);
      if (!ids.length) {
        return reply.code(400).send(fail("FILE_IDS_REQUIRED", "请至少选择一个文件"));
      }
      const result = await store.removeMany(ids);
      await audit.write("files.batch-deleted", request, result);
      return ok(result);
    }
  );

  app.get<{ Params: LanIdParams }>(
    `${basePath}/files/:id/preview`,
    { schema: { params: LanIdParamsSchema } },
    async (request, reply) => {
      if (!access.authorize(request, reply, "read")) return reply;
      const file = await getFileOr404(store, request, reply);
      if (!file) return reply;

      if (!file.previewable) {
        return reply.code(415).send(fail("PREVIEW_UNSUPPORTED", "This file type cannot be previewed"));
      }

      return sendFile(reply, config, file, "inline", request.headers.range);
    }
  );

  app.get<{ Params: LanIdParams }>(
    `${basePath}/files/:id/download`,
    { schema: { params: LanIdParamsSchema } },
    async (request, reply) => {
      if (!access.authorize(request, reply, "read")) return reply;
      const file = await getFileOr404(store, request, reply);
      if (!file) return reply;

      if (!request.headers.range || /^bytes=0-/i.test(request.headers.range)) {
        await store.incrementDownloadCount(file.id);
      }
      return sendFile(reply, config, file, "attachment", request.headers.range);
    }
  );

  app.delete<{ Params: LanIdParams }>(
    `${basePath}/files/:id`,
    { schema: { params: LanIdParamsSchema } },
    async (request, reply) => {
      if (!access.authorize(request, reply, "manage")) return reply;
      const { id } = request.params;
      const removed = await store.remove(id);
      if (!removed) {
        return reply.code(404).send(fail("LAN_FILE_NOT_FOUND", "File not found"));
      }
      await audit.write("file.deleted", request, { fileId: id });
      return ok({ removed: true });
    }
  );

  app.patch<{ Params: LanIdParams; Body: LanExpiryInput }>(
    `${basePath}/files/:id/expiry`,
    { schema: { params: LanIdParamsSchema, body: LanExpiryInputSchema } },
    async (request, reply) => {
      if (!access.authorize(request, reply, "manage")) return reply;
      const { id } = request.params;
      const { days } = request.body;
      const updated = await store.updateExpiry(id, days);
      if (!updated) {
        return reply.code(404).send(fail("LAN_FILE_NOT_FOUND", "File not found"));
      }
      await audit.write("file.expiry-updated", request, { fileId: id, days });
      return ok(withUrls(updated, basePath));
    }
  );

  app.post(`${basePath}/cleanup`, async (request, reply) => {
    if (!access.authorize(request, reply, "manage")) return reply;
    // Kept for backwards compatibility; scheduled cleanup runs automatically.
    const [files, notes] = await Promise.all([store.cleanupExpired(), noteStore.cleanupExpired()]);
    return ok({ removed: files.removed + notes.removed, filesRemoved: files.removed, notesRemoved: notes.removed });
  });

  app.post<{ Body: LanUploadSessionInput }>(
    `${basePath}/uploads`,
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: { body: LanUploadSessionInputSchema }
    },
    async (request, reply) => {
      if (!access.authorize(request, reply, "upload")) return reply;
      const parsed = parseUploadSessionBody(request.body);
      if (!parsed.ok) {
        return reply.code(400).send(fail(parsed.code, parsed.message));
      }

      if (parsed.value.size > config.lanTransferMaxFileBytes) {
        return reply.code(413).send(fail("FILE_TOO_LARGE", "Uploaded file exceeds the configured limit"));
      }

      const reservedBytes =
        (await store.totalSize()) + (await noteStore.totalSize()) + (await uploadStore.totalDeclaredSize());
      if (reservedBytes + parsed.value.size > config.lanTransferMaxStorageBytes) {
        return reply.code(507).send(
          fail("LAN_STORAGE_QUOTA_EXCEEDED", "局域网文件存储配额不足", {
            maxStorageBytes: config.lanTransferMaxStorageBytes,
            reservedBytes,
            requestedBytes: parsed.value.size
          })
        );
      }

      const session = await uploadStore.create(parsed.value);
      return ok(toUploadStatus(session));
    }
  );

  app.get<{ Params: LanUploadParams }>(
    `${basePath}/uploads/:uploadId`,
    { schema: { params: LanUploadParamsSchema } },
    async (request, reply) => {
      if (!access.authorize(request, reply, "upload")) return reply;
      const { uploadId } = request.params;
      const session = await uploadStore.get(uploadId);
      if (!session) {
        return reply.code(404).send(fail("UPLOAD_NOT_FOUND", "Upload session not found"));
      }

      return ok(toUploadStatus(session));
    }
  );

  app.put<{ Params: LanChunkParams }>(
    `${basePath}/uploads/:uploadId/chunks/:index`,
    { config: { rateLimit: { max: 120, timeWindow: "1 minute" } }, schema: { params: LanChunkParamsSchema } },
    async (request, reply) => {
      if (!access.authorize(request, reply, "upload")) return reply;
      const { uploadId, index } = request.params;
      if (finalizingUploads.has(uploadId)) {
        return reply.code(409).send(fail("UPLOAD_FINALIZING", "Upload is being finalized"));
      }
      const session = await uploadStore.get(uploadId);
      if (!session) {
        return reply.code(404).send(fail("UPLOAD_NOT_FOUND", "Upload session not found"));
      }

      const chunkIndex = Number(index);
      if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= session.totalChunks) {
        return reply.code(400).send(fail("INVALID_CHUNK_INDEX", "Invalid chunk index"));
      }

      const chunk = await request.file({
        limits: {
          fileSize: session.chunkSize
        }
      });

      if (!chunk) {
        return reply.code(400).send(fail("CHUNK_REQUIRED", "Please upload a chunk"));
      }

      const expectedSize = getExpectedChunkSize(session, chunkIndex);
      const chunkPath = uploadStore.chunkPath(session.uploadId, chunkIndex);
      const temporaryPath = `${chunkPath}.tmp-${nanoid(6)}`;

      try {
        await fsp.mkdir(path.dirname(chunkPath), { recursive: true });
        await pipeline(chunk.file, fs.createWriteStream(temporaryPath));
        const stat = await fsp.stat(temporaryPath);

        if (chunk.file.truncated || stat.size > expectedSize) {
          await fsp.rm(temporaryPath, { force: true });
          return reply.code(413).send(fail("CHUNK_TOO_LARGE", "Uploaded chunk exceeds the expected size"));
        }

        if (stat.size !== expectedSize) {
          await fsp.rm(temporaryPath, { force: true });
          return reply.code(400).send(
            fail("INVALID_CHUNK_SIZE", "Uploaded chunk size does not match the expected size", {
              expectedSize,
              actualSize: stat.size
            })
          );
        }

        await fsp.rename(temporaryPath, chunkPath);
        const updated = await uploadStore.markChunkUploaded(session.uploadId, chunkIndex);
        if (!updated) {
          return reply.code(404).send(fail("UPLOAD_NOT_FOUND", "Upload session not found"));
        }

        return ok(toUploadStatus(updated));
      } catch (error) {
        await fsp.rm(temporaryPath, { force: true });
        const message = error instanceof Error ? error.message : "Chunk upload failed";
        return reply.code(500).send(fail("CHUNK_UPLOAD_FAILED", message));
      }
    }
  );

  app.post<{ Params: LanUploadParams }>(
    `${basePath}/uploads/:uploadId/complete`,
    { schema: { params: LanUploadParamsSchema } },
    async (request, reply) => {
      if (!access.authorize(request, reply, "upload")) return reply;
      const { uploadId } = request.params;
      if (finalizingUploads.has(uploadId)) {
        return reply.code(409).send(fail("UPLOAD_FINALIZING", "Upload is already being finalized"));
      }
      finalizingUploads.add(uploadId);

      try {
        const session = await uploadStore.get(uploadId);
        if (!session) {
          return reply.code(404).send(fail("UPLOAD_NOT_FOUND", "Upload session not found"));
        }

        const missingChunks = getMissingChunks(session);
        if (missingChunks.length) {
          return reply.code(409).send(fail("UPLOAD_INCOMPLETE", "Upload has missing chunks", { missingChunks }));
        }

        const extension = getLanFileExtension(session.originalName);
        const id = nanoid(12);
        const storedName = extension ? `${id}.${extension}` : id;
        const targetPath = path.join(config.lanTransferFilesDir, storedName);

        try {
          await fsp.mkdir(config.lanTransferFilesDir, { recursive: true });
          const storageCheck = await checkMergeHeadroom(path.dirname(targetPath), session);
          if (!storageCheck.ok) {
            return reply.code(507).send(
              fail("INSUFFICIENT_STORAGE", "Not enough free disk space to merge uploaded chunks", {
                requiredBytes: storageCheck.requiredBytes,
                availableBytes: storageCheck.availableBytes
              })
            );
          }

          await mergeChunks(session, uploadStore, targetPath);
          const stat = await fsp.stat(targetPath);

          if (stat.size !== session.size || stat.size > config.lanTransferMaxFileBytes) {
            await fsp.rm(targetPath, { force: true });
            return reply.code(500).send(
              fail("MERGE_FAILED", "Merged file size does not match the upload session", {
                expectedSize: session.size,
                actualSize: stat.size
              })
            );
          }

          const classifiedCategory = classifyLanFile(session.originalName, session.mimeType);
          const category =
            classifiedCategory === "pdf" && !(await hasPdfSignature(targetPath)) ? "other" : classifiedCategory;
          const createdAt = new Date().toISOString();
          const expiresAt = new Date(Date.now() + config.lanTransferRetentionDays * 24 * 60 * 60 * 1000).toISOString();
          const record: LanFileRecord = {
            id,
            originalName: session.originalName,
            storedName,
            mimeType: session.mimeType,
            extension,
            size: stat.size,
            category,
            createdAt,
            expiresAt,
            downloadCount: 0,
            previewable: isLanFilePreviewable(category)
          };

          await store.add(record);
          await uploadStore.remove(uploadId);
          await audit.write("file.uploaded", request, {
            fileId: record.id,
            name: record.originalName,
            size: record.size
          });

          return ok({
            file: record,
            previewUrl: `${basePath}/files/${record.id}/preview`,
            downloadUrl: `${basePath}/files/${record.id}/download`
          });
        } catch (error) {
          await fsp.rm(targetPath, { force: true });
          const message = error instanceof Error ? error.message : "Chunk merge failed";
          if (isNoSpaceError(error)) {
            return reply.code(507).send(fail("INSUFFICIENT_STORAGE", message));
          }
          return reply.code(500).send(fail("MERGE_FAILED", message));
        }
      } finally {
        finalizingUploads.delete(uploadId);
      }
    }
  );

  app.delete<{ Params: LanUploadParams }>(
    `${basePath}/uploads/:uploadId`,
    { schema: { params: LanUploadParamsSchema } },
    async (request, reply) => {
      if (!access.authorize(request, reply, "upload")) return reply;
      const { uploadId } = request.params;
      if (finalizingUploads.has(uploadId)) {
        return reply.code(409).send(fail("UPLOAD_FINALIZING", "Upload is being finalized"));
      }
      const removed = await uploadStore.remove(uploadId);
      if (!removed) {
        return reply.code(404).send(fail("UPLOAD_NOT_FOUND", "Upload session not found"));
      }

      return ok({ removed: true });
    }
  );
}

function parseLanFileIds(body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.ids)) return [];
  return Array.from(
    new Set(body.ids.filter((value): value is string => typeof value === "string" && value.length > 0).slice(0, 100))
  );
}

function uniqueArchiveName(originalName: string, usedNames: Set<string>) {
  let candidate = originalName || "file";
  let counter = 2;
  const extension = path.extname(candidate);
  const stem = extension ? candidate.slice(0, -extension.length) : candidate;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${stem} (${counter})${extension}`;
    counter += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function lanNoteMultipartError(error: unknown) {
  if (!isRecord(error)) return undefined;
  const code = String(error.code ?? "");
  if (code.includes("FILES_LIMIT")) {
    return new LanNoteInputError("LAN_NOTE_TOO_MANY_IMAGES", 413, `每条图文最多上传 ${lanNoteLimits.maxImages} 张图片`);
  }
  if (code.includes("FILE_TOO_LARGE")) {
    return new LanNoteInputError("LAN_NOTE_IMAGE_TOO_LARGE", 413, "单张图片不能超过 10 MB");
  }
  if (code.includes("FIELDS_LIMIT") || code.includes("PARTS_LIMIT")) {
    return new LanNoteInputError("LAN_NOTE_MULTIPART_INVALID", 400, "图文表单字段过多");
  }
  return undefined;
}
