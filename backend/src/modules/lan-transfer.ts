import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import {
  LanAccessInputSchema,
  LanAccessResultSchema,
  LanChunkParamsSchema,
  LanFileUploadResultSchema,
  LanRemovalSchema,
  LanTransferInfoSchema,
  LanUploadParamsSchema,
  LanUploadSessionInputSchema,
  LanUploadStatusSchema,
  apiSuccessSchema,
  classifyLanFile,
  fail,
  getLanFileExtension,
  isLanFilePreviewable,
  ok,
  type LanFileRecord
} from "@toolbox/shared";
import type { AppConfig } from "../config";
import type { ToolboxDatabase } from "../database/toolbox-database";
import { REQUEST_QUOTAS } from "../security/request-quotas";
import {
  createLanAccessController,
  createLanAuditLog,
  getLanWebUrls,
  type LanAccessController
} from "./lan-transfer/access";
import { hasPdfSignature } from "./lan-transfer/files";
import { registerLanFileRoutes } from "./lan-transfer/file-routes";
import { registerLanNoteRoutes } from "./lan-transfer/note-routes";
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
import { lanFailureResponses } from "./lan-transfer/route-contract";

type RegisterLanTransferRoutesOptions = {
  app: FastifyInstance;
  config: AppConfig;
  database: ToolboxDatabase;
};

export async function registerLanTransferRoutes({ app, config, database }: RegisterLanTransferRoutesOptions) {
  const store = createLanFileStore(config, database);
  const noteStore = createLanNoteStore(config, database);
  const uploadStore = createLanUploadStore(config, database);
  const finalizingUploads = new Set<string>();
  const access = createLanAccessController(config);
  const audit = createLanAuditLog(database);
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
      ])
        .then(([files, notes, uploads]) => {
          if (files.removed + notes.removed + uploads.removed <= 0) return;
          database.appendAudit({
            action: "lan.cleanup.scheduled",
            outcome: "success",
            details: { filesRemoved: files.removed, notesRemoved: notes.removed, uploadsRemoved: uploads.removed }
          });
        })
        .catch(() => undefined);
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
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  typedApp.get(
    `${basePath}/info`,
    { schema: { response: { 200: apiSuccessSchema(LanTransferInfoSchema), ...lanFailureResponses } } },
    async (request) => {
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
    }
  );

  typedApp.post(
    `${basePath}/access`,
    {
      config: { ...REQUEST_QUOTAS.login, allowGuestTransfer: true },
      schema: {
        body: LanAccessInputSchema,
        response: { 200: apiSuccessSchema(LanAccessResultSchema), ...lanFailureResponses }
      }
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

  typedApp.delete(
    `${basePath}/access`,
    {
      config: { allowGuestTransfer: true },
      schema: { response: { 200: apiSuccessSchema(LanAccessResultSchema), ...lanFailureResponses } }
    },
    async (request, reply) => {
      access.logout(request);
      reply.header("set-cookie", access.expiredSessionCookie());
      return ok({ authenticated: false });
    }
  );

  registerLanNoteRoutes({ app, config, store, noteStore, uploadStore, access, audit, basePath });

  registerLanFileRoutes({ app, config, store, noteStore, uploadStore, access, audit, basePath });
  typedApp.post(
    `${basePath}/uploads`,
    {
      config: { ...REQUEST_QUOTAS.lanUpload, allowGuestTransfer: true },
      schema: {
        body: LanUploadSessionInputSchema,
        response: { 200: apiSuccessSchema(LanUploadStatusSchema), ...lanFailureResponses }
      }
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

  typedApp.get(
    `${basePath}/uploads/:uploadId`,
    {
      schema: {
        params: LanUploadParamsSchema,
        response: { 200: apiSuccessSchema(LanUploadStatusSchema), ...lanFailureResponses }
      }
    },
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

  typedApp.put(
    `${basePath}/uploads/:uploadId/chunks/:index`,
    {
      config: { ...REQUEST_QUOTAS.lanChunk, allowGuestTransfer: true },
      schema: {
        params: LanChunkParamsSchema,
        response: { 200: apiSuccessSchema(LanUploadStatusSchema), ...lanFailureResponses }
      }
    },
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

  typedApp.post(
    `${basePath}/uploads/:uploadId/complete`,
    {
      config: { ...REQUEST_QUOTAS.lanUpload, allowGuestTransfer: true },
      schema: {
        params: LanUploadParamsSchema,
        response: { 200: apiSuccessSchema(LanFileUploadResultSchema), ...lanFailureResponses }
      }
    },
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

  typedApp.delete(
    `${basePath}/uploads/:uploadId`,
    {
      config: { ...REQUEST_QUOTAS.lanUpload, allowGuestTransfer: true },
      schema: {
        params: LanUploadParamsSchema,
        response: { 200: apiSuccessSchema(LanRemovalSchema), ...lanFailureResponses }
      }
    },
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
