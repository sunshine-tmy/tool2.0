import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import archiver from "archiver";
import { nanoid } from "nanoid";
import {
  classifyLanFile,
  fail,
  getLanFileExtension,
  isLanFilePreviewable,
  lanFileCategories,
  lanNoteLimits,
  normalizeLanFileQuery,
  ok,
  type LanFileRecord,
  type LanNoteImageRecord,
  type LanNoteRecord
} from "@toolbox/shared";
import type { AppConfig } from "../config";

type RegisterLanTransferRoutesOptions = {
  app: FastifyInstance;
  config: AppConfig;
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

type LanChunkUploadSession = {
  uploadId: string;
  originalName: string;
  mimeType: string;
  size: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  createdAt: string;
  updatedAt: string;
};

type LanAccessAction = "read" | "upload" | "manage";

type LanAccessController = ReturnType<typeof createLanAccessController>;

class LanNoteInputError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

export async function registerLanTransferRoutes({ app, config }: RegisterLanTransferRoutesOptions) {
  const store = createLanFileStore(config);
  const noteStore = createLanNoteStore(config);
  const uploadStore = createLanUploadStore(config);
  const finalizingUploads = new Set<string>();
  const access = createLanAccessController(config);
  const audit = createLanAuditLog(path.join(config.lanTransferDir, "audit.jsonl"));
  await store.ensure();
  await noteStore.ensure();
  await uploadStore.ensure();
  await store.cleanupExpired();
  await noteStore.cleanupExpired();
  await uploadStore.cleanupStale(config.lanTransferUploadRetentionHours);

  for (const basePath of ["/api/tools/lan-transfer", "/api/lan"]) {
    registerLanTransferNamespace(
      app,
      config,
      store,
      noteStore,
      uploadStore,
      finalizingUploads,
      access,
      audit,
      basePath
    );
  }

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

  app.post(`${basePath}/access`, async (request, reply) => {
    const pin = isRecord(request.body) ? String(request.body.pin ?? "") : "";
    const token = access.login(pin);
    if (!token) {
      await audit.write("access.denied", request);
      return reply.code(401).send(fail("INVALID_LAN_PIN", "访问 PIN 不正确"));
    }
    await audit.write("access.granted", request);
    reply.header("set-cookie", access.sessionCookie(token));
    return ok({ authenticated: true });
  });

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

  app.get(`${basePath}/notes`, async (request, reply) => {
    if (!access.authorize(request, reply, "read")) return reply;
    const query = request.query as { page?: string; pageSize?: string };
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 100);
    const requestedPage = Math.max(Number(query.page) || 1, 1);
    const notes = await noteStore.list();
    const total = notes.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, pageCount);
    const start = (page - 1) * pageSize;
    return ok({
      notes: notes.slice(start, start + pageSize).map((note) => withNoteUrls(note, basePath)),
      pagination: { page, pageSize, total, pageCount }
    });
  });

  app.post(`${basePath}/notes/batch-delete`, async (request, reply) => {
    if (!access.authorize(request, reply, "manage")) return reply;
    const ids = parseLanFileIds(request.body);
    if (!ids.length) {
      return reply.code(400).send(fail("NOTE_IDS_REQUIRED", "请至少选择一条图文"));
    }
    const result = await noteStore.removeMany(ids);
    await audit.write("notes.batch-deleted", request, result);
    return ok(result);
  });

  app.get(`${basePath}/notes/:id/images/:imageId/preview`, async (request, reply) => {
    if (!access.authorize(request, reply, "read")) return reply;
    return sendLanNoteImage(noteStore, request, reply, "inline");
  });

  app.get(`${basePath}/notes/:id/images/:imageId/download`, async (request, reply) => {
    if (!access.authorize(request, reply, "read")) return reply;
    return sendLanNoteImage(noteStore, request, reply, "attachment");
  });

  app.patch(`${basePath}/notes/:id/expiry`, async (request, reply) => {
    if (!access.authorize(request, reply, "manage")) return reply;
    const { id } = request.params as { id: string };
    const days = isRecord(request.body) ? Number(request.body.days) : Number.NaN;
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      return reply.code(400).send(fail("INVALID_RETENTION_DAYS", "保留天数必须是 1 到 3650 的整数"));
    }
    const updated = await noteStore.updateExpiry(id, days);
    if (!updated) return reply.code(404).send(fail("LAN_NOTE_NOT_FOUND", "图文不存在或已过期"));
    await audit.write("note.expiry-updated", request, { noteId: id, days });
    return ok(withNoteUrls(updated, basePath));
  });

  app.delete(`${basePath}/notes/:id`, async (request, reply) => {
    if (!access.authorize(request, reply, "manage")) return reply;
    const { id } = request.params as { id: string };
    if (!(await noteStore.remove(id))) {
      return reply.code(404).send(fail("LAN_NOTE_NOT_FOUND", "图文不存在或已过期"));
    }
    await audit.write("note.deleted", request, { noteId: id });
    return ok({ removed: true });
  });

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

  app.get(`${basePath}/files`, async (request, reply) => {
    if (!access.authorize(request, reply, "read")) return reply;
    const query = normalizeLanFileQuery(request.query as Record<string, unknown>);
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
  });

  app.post(`${basePath}/files/batch-download`, async (request, reply) => {
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
    const archive = archiver("zip", { zlib: { level: 1 } });
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
  });

  app.post(`${basePath}/files/batch-delete`, async (request, reply) => {
    if (!access.authorize(request, reply, "manage")) return reply;
    const ids = parseLanFileIds(request.body);
    if (!ids.length) {
      return reply.code(400).send(fail("FILE_IDS_REQUIRED", "请至少选择一个文件"));
    }
    const result = await store.removeMany(ids);
    await audit.write("files.batch-deleted", request, result);
    return ok(result);
  });

  app.get(`${basePath}/files/:id/preview`, async (request, reply) => {
    if (!access.authorize(request, reply, "read")) return reply;
    const file = await getFileOr404(store, request, reply);
    if (!file) return reply;

    if (!file.previewable) {
      return reply.code(415).send(fail("PREVIEW_UNSUPPORTED", "This file type cannot be previewed"));
    }

    return sendFile(reply, config, file, "inline", request.headers.range);
  });

  app.get(`${basePath}/files/:id/download`, async (request, reply) => {
    if (!access.authorize(request, reply, "read")) return reply;
    const file = await getFileOr404(store, request, reply);
    if (!file) return reply;

    if (!request.headers.range || /^bytes=0-/i.test(request.headers.range)) {
      await store.incrementDownloadCount(file.id);
    }
    return sendFile(reply, config, file, "attachment", request.headers.range);
  });

  app.delete(`${basePath}/files/:id`, async (request, reply) => {
    if (!access.authorize(request, reply, "manage")) return reply;
    const { id } = request.params as { id: string };
    const removed = await store.remove(id);
    if (!removed) {
      return reply.code(404).send(fail("LAN_FILE_NOT_FOUND", "File not found"));
    }
    await audit.write("file.deleted", request, { fileId: id });
    return ok({ removed: true });
  });

  app.patch(`${basePath}/files/:id/expiry`, async (request, reply) => {
    if (!access.authorize(request, reply, "manage")) return reply;
    const { id } = request.params as { id: string };
    const days = isRecord(request.body) ? Number(request.body.days) : Number.NaN;
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      return reply.code(400).send(fail("INVALID_RETENTION_DAYS", "保留天数必须是 1 到 3650 的整数"));
    }
    const updated = await store.updateExpiry(id, days);
    if (!updated) {
      return reply.code(404).send(fail("LAN_FILE_NOT_FOUND", "File not found"));
    }
    await audit.write("file.expiry-updated", request, { fileId: id, days });
    return ok(withUrls(updated, basePath));
  });

  app.post(`${basePath}/cleanup`, async (request, reply) => {
    if (!access.authorize(request, reply, "manage")) return reply;
    // Kept for backwards compatibility; scheduled cleanup runs automatically.
    const [files, notes] = await Promise.all([store.cleanupExpired(), noteStore.cleanupExpired()]);
    return ok({ removed: files.removed + notes.removed, filesRemoved: files.removed, notesRemoved: notes.removed });
  });

  app.post(`${basePath}/uploads`, async (request, reply) => {
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
  });

  app.get(`${basePath}/uploads/:uploadId`, async (request, reply) => {
    if (!access.authorize(request, reply, "upload")) return reply;
    const { uploadId } = request.params as { uploadId: string };
    const session = await uploadStore.get(uploadId);
    if (!session) {
      return reply.code(404).send(fail("UPLOAD_NOT_FOUND", "Upload session not found"));
    }

    return ok(toUploadStatus(session));
  });

  app.put(`${basePath}/uploads/:uploadId/chunks/:index`, async (request, reply) => {
    if (!access.authorize(request, reply, "upload")) return reply;
    const { uploadId, index } = request.params as { uploadId: string; index: string };
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
  });

  app.post(`${basePath}/uploads/:uploadId/complete`, async (request, reply) => {
    if (!access.authorize(request, reply, "upload")) return reply;
    const { uploadId } = request.params as { uploadId: string };
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
  });

  app.delete(`${basePath}/uploads/:uploadId`, async (request, reply) => {
    if (!access.authorize(request, reply, "upload")) return reply;
    const { uploadId } = request.params as { uploadId: string };
    if (finalizingUploads.has(uploadId)) {
      return reply.code(409).send(fail("UPLOAD_FINALIZING", "Upload is being finalized"));
    }
    const removed = await uploadStore.remove(uploadId);
    if (!removed) {
      return reply.code(404).send(fail("UPLOAD_NOT_FOUND", "Upload session not found"));
    }

    return ok({ removed: true });
  });
}

function createLanFileStore(config: AppConfig) {
  let queue = Promise.resolve();

  function runExclusive<T>(operation: () => Promise<T>) {
    const current = queue.then(operation, operation);
    queue = current.then(
      () => undefined,
      () => undefined
    );
    return current;
  }

  async function ensure() {
    await fsp.mkdir(config.lanTransferFilesDir, { recursive: true });
    await ensureJsonIndex(config.lanTransferIndexPath);
  }

  async function read(): Promise<LanFileRecord[]> {
    await ensure();
    let parsed;
    try {
      parsed = parseLanFileIndex(await readJsonIndex(config.lanTransferIndexPath));
    } catch {
      parsed = parseLanFileIndex(await fsp.readFile(`${config.lanTransferIndexPath}.bak`, "utf8"));
      parsed.repaired = true;
    }
    if (parsed.repaired) {
      await write(parsed.records);
    }
    return parsed.records;
  }

  async function write(records: LanFileRecord[]) {
    await writeJsonIndex(config.lanTransferIndexPath, records);
  }

  return {
    ensure,
    async add(record: LanFileRecord) {
      return runExclusive(async () => {
        const records = await read();
        records.unshift(record);
        await write(records);
        return record;
      });
    },
    async get(id: string) {
      return runExclusive(async () => (await read()).find((record) => record.id === id));
    },
    async getMany(ids: string[]) {
      return runExclusive(async () => {
        const wanted = new Set(ids);
        return (await read()).filter((record) => wanted.has(record.id));
      });
    },
    async list(query = normalizeLanFileQuery({})) {
      return runExclusive(async () => {
        const keyword = query.keyword.toLowerCase();
        const records = (await read()).filter((record) => {
          const matchesKeyword =
            !keyword ||
            record.originalName.toLowerCase().includes(keyword) ||
            record.extension.toLowerCase().includes(keyword);
          const matchesCategory = !query.category || record.category === query.category;
          const matchesExtension = !query.extension || record.extension === query.extension;
          return matchesKeyword && matchesCategory && matchesExtension;
        });

        return records.sort((left, right) => compareLanFiles(left, right, query.sortBy, query.sortOrder));
      });
    },
    async totalSize() {
      return runExclusive(async () => (await read()).reduce((total, record) => total + record.size, 0));
    },
    async incrementDownloadCount(id: string) {
      return runExclusive(async () => {
        const records = await read();
        const next = records.map((record) =>
          record.id === id ? { ...record, downloadCount: record.downloadCount + 1 } : record
        );
        await write(next);
      });
    },
    async incrementDownloadCounts(ids: string[]) {
      return runExclusive(async () => {
        const wanted = new Set(ids);
        const records = await read();
        for (const record of records) {
          if (wanted.has(record.id)) record.downloadCount += 1;
        }
        await write(records);
      });
    },
    async remove(id: string) {
      return runExclusive(async () => {
        const records = await read();
        const target = records.find((record) => record.id === id);
        if (!target) {
          return false;
        }
        await fsp.rm(path.join(config.lanTransferFilesDir, target.storedName), { force: true });
        await write(records.filter((record) => record.id !== id));
        return true;
      });
    },
    async removeMany(ids: string[]) {
      return runExclusive(async () => {
        const wanted = new Set(ids);
        const records = await read();
        const targets = records.filter((record) => wanted.has(record.id));
        await Promise.all(
          targets.map((record) => fsp.rm(path.join(config.lanTransferFilesDir, record.storedName), { force: true }))
        );
        await write(records.filter((record) => !wanted.has(record.id)));
        return {
          removed: targets.map((record) => record.id),
          missing: ids.filter((id) => !targets.some((file) => file.id === id))
        };
      });
    },
    async updateExpiry(id: string, days: number) {
      return runExclusive(async () => {
        const records = await read();
        const target = records.find((record) => record.id === id);
        if (!target) return undefined;
        target.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        await write(records);
        return target;
      });
    },
    async cleanupExpired() {
      return runExclusive(async () => {
        const now = Date.now();
        const records = await read();
        const expired = records.filter((record) => Date.parse(record.expiresAt) <= now);
        await Promise.all(
          expired.map((record) => fsp.rm(path.join(config.lanTransferFilesDir, record.storedName), { force: true }))
        );
        if (expired.length) {
          await write(records.filter((record) => Date.parse(record.expiresAt) > now));
        }
        return { removed: expired.length };
      });
    }
  };
}

function createLanNoteStore(config: AppConfig) {
  const notesDir = path.join(config.lanTransferDir, "notes");
  const imagesDir = path.join(notesDir, "images");
  const indexPath = path.join(notesDir, "index.json");
  let queue = Promise.resolve();

  function runExclusive<T>(operation: () => Promise<T>) {
    const current = queue.then(operation, operation);
    queue = current.then(
      () => undefined,
      () => undefined
    );
    return current;
  }

  async function ensure() {
    await fsp.mkdir(imagesDir, { recursive: true });
    await ensureJsonIndex(indexPath);
  }

  async function read(): Promise<LanNoteRecord[]> {
    await ensure();
    let parsed;
    try {
      parsed = parseLanNoteIndex(await readJsonIndex(indexPath));
    } catch {
      parsed = parseLanNoteIndex(await fsp.readFile(`${indexPath}.bak`, "utf8"));
      parsed.repaired = true;
    }
    if (parsed.repaired) await write(parsed.records);
    return parsed.records;
  }

  async function write(records: LanNoteRecord[]) {
    await writeJsonIndex(indexPath, records);
  }

  async function removeImages(note: LanNoteRecord) {
    await Promise.all(note.images.map((image) => fsp.rm(path.join(imagesDir, image.storedName), { force: true })));
  }

  return {
    ensure,
    imagePath(storedName: string) {
      return path.join(imagesDir, path.basename(storedName));
    },
    async add(note: LanNoteRecord) {
      return runExclusive(async () => {
        const notes = await read();
        notes.unshift(note);
        await write(notes);
        return note;
      });
    },
    async list() {
      return runExclusive(async () => {
        const now = Date.now();
        return (await read())
          .filter((note) => Date.parse(note.expiresAt) > now)
          .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
      });
    },
    async get(id: string) {
      return runExclusive(async () =>
        (await read()).find((note) => note.id === id && Date.parse(note.expiresAt) > Date.now())
      );
    },
    async count() {
      return runExclusive(async () => {
        const now = Date.now();
        return (await read()).filter((note) => Date.parse(note.expiresAt) > now).length;
      });
    },
    async totalSize() {
      return runExclusive(async () =>
        (await read()).reduce(
          (total, note) => total + note.images.reduce((imageTotal, image) => imageTotal + image.size, 0),
          0
        )
      );
    },
    async updateExpiry(id: string, days: number) {
      return runExclusive(async () => {
        const notes = await read();
        const target = notes.find((note) => note.id === id);
        if (!target) return undefined;
        target.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        await write(notes);
        return target;
      });
    },
    async remove(id: string) {
      return runExclusive(async () => {
        const notes = await read();
        const target = notes.find((note) => note.id === id);
        if (!target) return false;
        await removeImages(target);
        await write(notes.filter((note) => note.id !== id));
        return true;
      });
    },
    async removeMany(ids: string[]) {
      return runExclusive(async () => {
        const notes = await read();
        const wanted = new Set(ids);
        const targets = notes.filter((note) => wanted.has(note.id));
        await Promise.all(targets.map(removeImages));
        if (targets.length) await write(notes.filter((note) => !wanted.has(note.id)));
        const removed = targets.map((note) => note.id);
        const removedSet = new Set(removed);
        return { removed, missing: ids.filter((id) => !removedSet.has(id)) };
      });
    },
    async cleanupExpired() {
      return runExclusive(async () => {
        const now = Date.now();
        const notes = await read();
        const expired = notes.filter((note) => Date.parse(note.expiresAt) <= now);
        await Promise.all(expired.map(removeImages));
        if (expired.length) {
          await write(notes.filter((note) => Date.parse(note.expiresAt) > now));
        }
        return { removed: expired.length };
      });
    }
  };
}

function parseLanNoteIndex(raw: string) {
  try {
    return { records: sanitizeLanNoteRecords(JSON.parse(raw)), repaired: false };
  } catch (error) {
    const recovered = extractFirstJsonArray(raw);
    if (!recovered) throw error;
    return { records: sanitizeLanNoteRecords(JSON.parse(recovered)), repaired: true };
  }
}

function sanitizeLanNoteRecords(value: unknown): LanNoteRecord[] {
  return Array.isArray(value) ? value.filter(isLanNoteRecord) : [];
}

function isLanNoteRecord(value: unknown): value is LanNoteRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.title === undefined || typeof value.title === "string") &&
    typeof value.content === "string" &&
    Array.isArray(value.images) &&
    value.images.every(isLanNoteImageRecord) &&
    typeof value.createdAt === "string" &&
    typeof value.expiresAt === "string"
  );
}

function isLanNoteImageRecord(value: unknown): value is LanNoteImageRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.originalName === "string" &&
    typeof value.storedName === "string" &&
    typeof value.mimeType === "string" &&
    typeof value.extension === "string" &&
    typeof value.size === "number"
  );
}

function parseLanFileIndex(raw: string) {
  try {
    return {
      records: sanitizeLanFileRecords(JSON.parse(raw)),
      repaired: false
    };
  } catch (error) {
    const recovered = extractFirstJsonArray(raw);
    if (!recovered) {
      throw error;
    }
    return {
      records: sanitizeLanFileRecords(JSON.parse(recovered)),
      repaired: true
    };
  }
}

function extractFirstJsonArray(raw: string) {
  const start = raw.indexOf("[");
  if (start < 0) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, index + 1);
      }
    }
  }

  return undefined;
}

function sanitizeLanFileRecords(value: unknown): LanFileRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isLanFileRecord);
}

function isLanFileRecord(value: unknown): value is LanFileRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.originalName === "string" &&
    typeof value.storedName === "string" &&
    typeof value.mimeType === "string" &&
    typeof value.extension === "string" &&
    typeof value.size === "number" &&
    lanFileCategories.includes(value.category as LanFileRecord["category"]) &&
    typeof value.createdAt === "string" &&
    typeof value.expiresAt === "string" &&
    typeof value.downloadCount === "number" &&
    typeof value.previewable === "boolean"
  );
}

function createLanUploadStore(config: AppConfig) {
  const uploadsDir = path.join(config.lanTransferDir, "uploads");
  const uploadIndexPath = path.join(uploadsDir, "index.json");
  let queue = Promise.resolve();

  function runExclusive<T>(operation: () => Promise<T>) {
    const current = queue.then(operation, operation);
    queue = current.then(
      () => undefined,
      () => undefined
    );
    return current;
  }

  async function ensure() {
    await fsp.mkdir(uploadsDir, { recursive: true });
    await ensureJsonIndex(uploadIndexPath);
  }

  async function read(): Promise<LanChunkUploadSession[]> {
    await ensure();
    let value: unknown;
    try {
      value = JSON.parse(await readJsonIndex(uploadIndexPath)) as unknown;
    } catch {
      value = JSON.parse(await fsp.readFile(`${uploadIndexPath}.bak`, "utf8")) as unknown;
    }
    return Array.isArray(value) ? (value.filter(isLanUploadSession) as LanChunkUploadSession[]) : [];
  }

  async function write(sessions: LanChunkUploadSession[]) {
    await writeJsonIndex(uploadIndexPath, sessions);
  }

  function sessionDir(uploadId: string) {
    return path.join(uploadsDir, uploadId);
  }

  function chunkPath(uploadId: string, index: number) {
    return path.join(sessionDir(uploadId), "chunks", `${index}.part`);
  }

  return {
    ensure,
    chunkPath,
    async create(input: Omit<LanChunkUploadSession, "uploadId" | "uploadedChunks" | "createdAt" | "updatedAt">) {
      return runExclusive(async () => {
        const now = new Date().toISOString();
        const session: LanChunkUploadSession = {
          uploadId: nanoid(12),
          originalName: input.originalName,
          mimeType: input.mimeType,
          size: input.size,
          chunkSize: input.chunkSize,
          totalChunks: input.totalChunks,
          uploadedChunks: [],
          createdAt: now,
          updatedAt: now
        };
        const sessions = await read();
        sessions.unshift(session);
        await write(sessions);
        await fsp.mkdir(path.dirname(chunkPath(session.uploadId, 0)), { recursive: true });
        return session;
      });
    },
    async get(uploadId: string) {
      return runExclusive(async () => (await read()).find((session) => session.uploadId === uploadId));
    },
    async totalDeclaredSize() {
      return runExclusive(async () => (await read()).reduce((total, session) => total + session.size, 0));
    },
    async markChunkUploaded(uploadId: string, chunkIndex: number) {
      return runExclusive(async () => {
        const sessions = await read();
        const target = sessions.find((session) => session.uploadId === uploadId);
        if (!target) {
          return undefined;
        }
        target.uploadedChunks = Array.from(new Set([...target.uploadedChunks, chunkIndex])).sort((a, b) => a - b);
        target.updatedAt = new Date().toISOString();
        await write(sessions);
        return target;
      });
    },
    async remove(uploadId: string) {
      return runExclusive(async () => {
        const sessions = await read();
        const exists = sessions.some((session) => session.uploadId === uploadId);
        if (!exists) {
          return false;
        }
        await fsp.rm(sessionDir(uploadId), { recursive: true, force: true });
        await write(sessions.filter((session) => session.uploadId !== uploadId));
        return true;
      });
    },
    async cleanupStale(retentionHours: number, excludedIds = new Set<string>()) {
      return runExclusive(async () => {
        const sessions = await read();
        const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;
        const stale = sessions.filter(
          (session) => Date.parse(session.updatedAt) <= cutoff && !excludedIds.has(session.uploadId)
        );
        await Promise.all(
          stale.map((session) => fsp.rm(sessionDir(session.uploadId), { recursive: true, force: true }))
        );
        if (stale.length) {
          const staleIds = new Set(stale.map((session) => session.uploadId));
          await write(sessions.filter((session) => !staleIds.has(session.uploadId)));
        }
        return { removed: stale.length };
      });
    }
  };
}

function compareLanFiles(
  left: LanFileRecord,
  right: LanFileRecord,
  sortBy: "createdAt" | "size" | "name" | "downloadCount",
  sortOrder: "asc" | "desc"
) {
  const direction = sortOrder === "asc" ? 1 : -1;
  if (sortBy === "name") {
    return left.originalName.localeCompare(right.originalName) * direction;
  }
  const leftValue = sortBy === "createdAt" ? Date.parse(left.createdAt) : left[sortBy];
  const rightValue = sortBy === "createdAt" ? Date.parse(right.createdAt) : right[sortBy];
  return (leftValue - rightValue) * direction;
}

async function getFileOr404(
  store: ReturnType<typeof createLanFileStore>,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { id } = request.params as { id: string };
  const file = await store.get(id);
  if (!file) {
    reply.code(404).send(fail("LAN_FILE_NOT_FOUND", "File not found"));
    return undefined;
  }
  return file;
}

async function sendFile(
  reply: FastifyReply,
  config: AppConfig,
  file: LanFileRecord,
  disposition: "inline" | "attachment",
  rangeHeader?: string
) {
  const filePath = path.join(config.lanTransferFilesDir, file.storedName);
  let stat;
  try {
    stat = await fsp.stat(filePath);
  } catch {
    return reply.code(404).send(fail("LAN_FILE_MISSING", "文件元数据存在，但磁盘文件已丢失"));
  }
  const encodedName = encodeURIComponent(file.originalName);
  reply.header("accept-ranges", "bytes");
  reply.header("x-content-type-options", "nosniff");
  if (disposition === "inline") {
    reply.header("content-security-policy", "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'");
  }
  reply.header("content-type", safeResponseContentType(file, disposition));
  reply.header(
    "content-disposition",
    `${disposition}; filename*=UTF-8''${encodedName}; filename="${fallbackFileName(file.originalName)}"`
  );

  if (rangeHeader) {
    const range = parseRange(rangeHeader, stat.size);
    if (!range) {
      return reply.code(416).send(fail("INVALID_RANGE", "Invalid range request"));
    }

    reply.code(206);
    reply.header("content-range", `bytes ${range.start}-${range.end}/${stat.size}`);
    reply.header("content-length", String(range.end - range.start + 1));
    return reply.send(fs.createReadStream(filePath, { start: range.start, end: range.end }));
  }

  reply.header("content-length", String(stat.size));
  return reply.send(fs.createReadStream(filePath));
}

function safeResponseContentType(file: LanFileRecord, disposition: "inline" | "attachment") {
  if (disposition === "attachment") {
    return file.mimeType || "application/octet-stream";
  }
  if (file.category === "pdf") return "application/pdf";
  if (file.category === "text") return "text/plain; charset=utf-8";
  if (file.category === "image" && file.mimeType.startsWith("image/")) return file.mimeType;
  if (file.category === "video" && file.mimeType.startsWith("video/")) return file.mimeType;
  if (file.category === "audio" && file.mimeType.startsWith("audio/")) return file.mimeType;
  return "application/octet-stream";
}

async function hasPdfSignature(filePath: string) {
  const handle = await fsp.open(filePath, "r");
  try {
    const header = Buffer.alloc(5);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return bytesRead === header.length && header.toString("ascii") === "%PDF-";
  } finally {
    await handle.close();
  }
}

const lanNoteImageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif"
};

function isAllowedLanNoteImageMime(mimeType: string) {
  return mimeType in lanNoteImageExtensions;
}

function extensionForLanNoteImage(mimeType: string) {
  return lanNoteImageExtensions[mimeType] ?? "img";
}

async function hasLanNoteImageSignature(filePath: string, mimeType: string) {
  const handle = await fsp.open(filePath, "r");
  try {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const value = header.subarray(0, bytesRead);
    if (mimeType === "image/jpeg") {
      return value.length >= 3 && value[0] === 0xff && value[1] === 0xd8 && value[2] === 0xff;
    }
    if (mimeType === "image/png") {
      return (
        value.length >= 8 && value.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      );
    }
    if (mimeType === "image/gif") {
      const signature = value.subarray(0, 6).toString("ascii");
      return signature === "GIF87a" || signature === "GIF89a";
    }
    if (mimeType === "image/webp") {
      return (
        value.length >= 12 &&
        value.subarray(0, 4).toString("ascii") === "RIFF" &&
        value.subarray(8, 12).toString("ascii") === "WEBP"
      );
    }
    if (mimeType === "image/avif") {
      const brand = value.subarray(8, 12).toString("ascii");
      return (
        value.length >= 12 &&
        value.subarray(4, 8).toString("ascii") === "ftyp" &&
        (brand === "avif" || brand === "avis")
      );
    }
    return false;
  } finally {
    await handle.close();
  }
}

function parseRange(rangeHeader: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match || (!match[1] && !match[2])) {
    return undefined;
  }

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return undefined;
    return {
      start: Math.max(0, size - suffixLength),
      end: size - 1
    };
  }

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return undefined;
  }

  return {
    start,
    end: Math.min(end, size - 1)
  };
}

function fallbackFileName(fileName: string) {
  return fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "_");
}

function withUrls(file: LanFileRecord, basePath: string) {
  return {
    ...file,
    previewUrl: `${basePath}/files/${file.id}/preview`,
    downloadUrl: `${basePath}/files/${file.id}/download`
  };
}

function withNoteUrls(note: LanNoteRecord, basePath: string) {
  return {
    ...note,
    images: note.images.map((image) => ({
      ...image,
      previewUrl: `${basePath}/notes/${note.id}/images/${image.id}/preview`,
      downloadUrl: `${basePath}/notes/${note.id}/images/${image.id}/download`
    }))
  };
}

async function sendLanNoteImage(
  noteStore: ReturnType<typeof createLanNoteStore>,
  request: FastifyRequest,
  reply: FastifyReply,
  disposition: "inline" | "attachment"
) {
  const { id, imageId } = request.params as { id: string; imageId: string };
  const note = await noteStore.get(id);
  const image = note?.images.find((item) => item.id === imageId);
  if (!note || !image) {
    return reply.code(404).send(fail("LAN_NOTE_IMAGE_NOT_FOUND", "图片不存在或已过期"));
  }
  const imagePath = noteStore.imagePath(image.storedName);
  let stat;
  try {
    stat = await fsp.stat(imagePath);
  } catch {
    return reply.code(404).send(fail("LAN_NOTE_IMAGE_MISSING", "图片元数据存在，但磁盘文件已丢失"));
  }
  reply.header("x-content-type-options", "nosniff");
  reply.header("content-type", image.mimeType);
  reply.header("content-length", String(stat.size));
  if (disposition === "inline") {
    reply.header("content-security-policy", "sandbox; default-src 'none'; img-src 'self' data:");
  }
  reply.header(
    "content-disposition",
    `${disposition}; filename*=UTF-8''${encodeURIComponent(image.originalName)}; filename="${fallbackFileName(image.originalName)}"`
  );
  return reply.send(fs.createReadStream(imagePath));
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

function parseUploadSessionBody(body: unknown):
  | {
      ok: true;
      value: Omit<LanChunkUploadSession, "uploadId" | "uploadedChunks" | "createdAt" | "updatedAt">;
    }
  | { ok: false; code: string; message: string } {
  if (!isRecord(body)) {
    return { ok: false, code: "INVALID_UPLOAD_SESSION", message: "Invalid upload session payload" };
  }

  const originalName = path.basename(String(body.originalName ?? body.fileName ?? ""));
  const mimeType = String(body.mimeType ?? "application/octet-stream");
  const size = Number(body.size);
  const chunkSize = Number(body.chunkSize);
  const totalChunks = Number(body.totalChunks);

  if (!originalName) {
    return { ok: false, code: "INVALID_FILE_NAME", message: "File name is required" };
  }

  if (!Number.isSafeInteger(size) || size < 0) {
    return { ok: false, code: "INVALID_FILE_SIZE", message: "File size must be a non-negative integer" };
  }

  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
    return { ok: false, code: "INVALID_CHUNK_SIZE", message: "Chunk size must be a positive integer" };
  }

  const expectedTotalChunks = size === 0 ? 0 : Math.ceil(size / chunkSize);
  if (!Number.isSafeInteger(totalChunks) || totalChunks < 0 || totalChunks !== expectedTotalChunks) {
    return { ok: false, code: "INVALID_CHUNK_COUNT", message: "Total chunks does not match file size and chunk size" };
  }

  return {
    ok: true,
    value: {
      originalName,
      mimeType,
      size,
      chunkSize,
      totalChunks
    }
  };
}

function toUploadStatus(session: LanChunkUploadSession) {
  return {
    uploadId: session.uploadId,
    originalName: session.originalName,
    mimeType: session.mimeType,
    size: session.size,
    chunkSize: session.chunkSize,
    totalChunks: session.totalChunks,
    uploadedChunks: session.uploadedChunks,
    uploadedBytes: session.uploadedChunks.reduce((total, index) => total + getExpectedChunkSize(session, index), 0),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

function getExpectedChunkSize(session: LanChunkUploadSession, chunkIndex: number) {
  if (chunkIndex === session.totalChunks - 1) {
    return session.size - session.chunkSize * (session.totalChunks - 1);
  }
  return session.chunkSize;
}

function getMissingChunks(session: LanChunkUploadSession) {
  const uploaded = new Set(session.uploadedChunks);
  return Array.from({ length: session.totalChunks }, (_, index) => index).filter((index) => !uploaded.has(index));
}

async function mergeChunks(
  session: LanChunkUploadSession,
  uploadStore: ReturnType<typeof createLanUploadStore>,
  targetPath: string
) {
  const temporaryPath = `${targetPath}.partial-${nanoid(6)}`;
  try {
    if (session.totalChunks === 0) {
      await fsp.writeFile(temporaryPath, "", { flag: "wx" });
    } else {
      for (let index = 0; index < session.totalChunks; index += 1) {
        const chunkPath = uploadStore.chunkPath(session.uploadId, index);
        await pipeline(
          fs.createReadStream(chunkPath),
          fs.createWriteStream(temporaryPath, { flags: index === 0 ? "wx" : "a" })
        );
      }
    }

    const stat = await fsp.stat(temporaryPath);
    if (stat.size !== session.size) {
      throw new Error(`Merged file size mismatch: expected ${session.size}, received ${stat.size}`);
    }

    const handle = await fsp.open(temporaryPath, "r+");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fsp.rename(temporaryPath, targetPath);
  } catch (error) {
    await fsp.rm(temporaryPath, { force: true });
    throw error;
  }
}

async function checkMergeHeadroom(directory: string, session: LanChunkUploadSession) {
  const requiredBytes = getMergeHeadroomBytes(session);
  if (requiredBytes === 0) {
    return {
      ok: true as const,
      requiredBytes,
      availableBytes: Number.POSITIVE_INFINITY
    };
  }

  const stats = await fsp.statfs(directory);
  const availableBytes = Number(stats.bavail) * Number(stats.bsize);
  return {
    ok: availableBytes >= requiredBytes,
    requiredBytes,
    availableBytes
  };
}

function getMergeHeadroomBytes(session: LanChunkUploadSession) {
  // Chunks remain available for retry until the merged file is safely fsynced and renamed.
  return session.size;
}

function isNoSpaceError(error: unknown) {
  return isRecord(error) && error.code === "ENOSPC";
}

function createLanAccessController(config: AppConfig) {
  const cookieName = "toolbox_lan_session";
  const sessionLifetimeSeconds = 12 * 60 * 60;
  const sessions = new Map<string, number>();

  function readToken(request: FastifyRequest) {
    const cookieHeader = request.headers.cookie ?? "";
    const token = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    return token ? decodeURIComponent(token) : undefined;
  }

  function isAuthenticated(request: FastifyRequest) {
    if (!config.lanTransferPin) return true;
    const token = readToken(request);
    if (!token) return false;
    const expiresAt = sessions.get(token);
    if (!expiresAt || expiresAt <= Date.now()) {
      sessions.delete(token);
      return false;
    }
    return true;
  }

  function can(request: FastifyRequest, action: LanAccessAction) {
    if (!config.lanTransferPin || isAuthenticated(request) || config.lanTransferGuestMode === "full") return true;
    if (config.lanTransferGuestMode === "upload-only") return action === "upload";
    if (config.lanTransferGuestMode === "download-only") return action === "read";
    return false;
  }

  return {
    isAuthenticated,
    can,
    authorize(request: FastifyRequest, reply: FastifyReply, action: LanAccessAction) {
      if (can(request, action)) return true;
      const status = config.lanTransferPin ? 401 : 403;
      reply
        .code(status)
        .send(fail(config.lanTransferPin ? "LAN_PIN_REQUIRED" : "LAN_ACCESS_DENIED", "需要管理 PIN 才能执行此操作"));
      return false;
    },
    login(pin: string) {
      if (!config.lanTransferPin || safeStringEquals(pin, config.lanTransferPin)) {
        const token = randomBytes(24).toString("base64url");
        sessions.set(token, Date.now() + sessionLifetimeSeconds * 1000);
        return token;
      }
      return undefined;
    },
    logout(request: FastifyRequest) {
      const token = readToken(request);
      if (token) sessions.delete(token);
    },
    sessionCookie(token: string) {
      return `${cookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${sessionLifetimeSeconds}`;
    },
    expiredSessionCookie() {
      return `${cookieName}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0`;
    }
  };
}

function createLanAuditLog(logPath: string) {
  let queue = Promise.resolve();
  return {
    write(event: string, request: FastifyRequest, details: unknown = undefined) {
      const entry = JSON.stringify({
        timestamp: new Date().toISOString(),
        event,
        remoteAddress: request.ip,
        details
      });
      const operation = queue.then(async () => {
        await fsp.mkdir(path.dirname(logPath), { recursive: true });
        await fsp.appendFile(logPath, `${entry}\n`, "utf8");
      });
      queue = operation.catch(() => undefined);
      return operation.catch(() => undefined);
    }
  };
}

function safeStringEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getLanWebUrls(port: number) {
  const addresses = Object.values(os.networkInterfaces())
    .flatMap((items) => items ?? [])
    .filter((item) => item.family === "IPv4" && !item.internal && !item.address.startsWith("169.254."))
    .map((item) => item.address);
  return Array.from(new Set(addresses)).map((address) => `http://${address}:${port}/tools/lan-transfer`);
}

async function ensureJsonIndex(indexPath: string) {
  const backupPath = `${indexPath}.bak`;
  try {
    await fsp.access(indexPath);
    return;
  } catch {
    try {
      await fsp.copyFile(backupPath, indexPath);
      return;
    } catch {
      await fsp.writeFile(indexPath, "[]");
    }
  }
}

async function readJsonIndex(indexPath: string) {
  await ensureJsonIndex(indexPath);
  return fsp.readFile(indexPath, "utf8");
}

async function writeJsonIndex(indexPath: string, value: unknown) {
  const temporaryPath = `${indexPath}.${process.pid}.${nanoid(6)}.tmp`;
  const backupPath = `${indexPath}.bak`;
  const handle = await fsp.open(temporaryPath, "wx");
  try {
    await handle.writeFile(JSON.stringify(value, null, 2));
    await handle.sync();
  } finally {
    await handle.close();
  }

  await fsp.rm(backupPath, { force: true });
  try {
    await fsp.rename(indexPath, backupPath);
  } catch (error) {
    if (!isRecord(error) || error.code !== "ENOENT") throw error;
  }

  try {
    await fsp.rename(temporaryPath, indexPath);
  } catch (error) {
    await fsp.rm(temporaryPath, { force: true });
    try {
      await fsp.rename(backupPath, indexPath);
    } catch {
      // The original error is more actionable; startup recovery will retry the backup.
    }
    throw error;
  }
}

function isLanUploadSession(value: unknown): value is LanChunkUploadSession {
  return (
    isRecord(value) &&
    typeof value.uploadId === "string" &&
    typeof value.originalName === "string" &&
    typeof value.mimeType === "string" &&
    Number.isSafeInteger(value.size) &&
    Number.isSafeInteger(value.chunkSize) &&
    Number.isSafeInteger(value.totalChunks) &&
    Array.isArray(value.uploadedChunks) &&
    value.uploadedChunks.every((item) => Number.isSafeInteger(item)) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
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
