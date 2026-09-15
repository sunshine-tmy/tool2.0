import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { FastifyInstance } from "fastify";
import { ZipArchive } from "archiver";
import { nanoid } from "nanoid";
import {
  LanBatchRemovalSchema,
  LanExpiryInputSchema,
  LanFileListSchema,
  LanFileListQuerySchema,
  LanFileUploadResultSchema,
  LanFileWithUrlsSchema,
  LanIdParamsSchema,
  LanIdsInputSchema,
  LanRemovalSchema,
  LanCleanupResultSchema,
  apiSuccessSchema,
  classifyLanFile,
  fail,
  getLanFileExtension,
  isLanFilePreviewable,
  normalizeLanFileQuery,
  ok,
  type LanFileRecord,
  type LanIdsInput
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import { REQUEST_QUOTAS } from "../../security/request-quotas";
import { getFileOr404, hasPdfSignature, sendFile, withUrls } from "./files";
import type { createLanAccessController, createLanAuditLog } from "./access";
import type { createLanFileStore, createLanNoteStore } from "./repositories";
import type { createLanUploadStore } from "./uploads";
import { lanFailureResponses, type LanFileListResponse } from "./route-contract";

type RegisterLanFileRoutesOptions = {
  app: FastifyInstance;
  config: AppConfig;
  store: ReturnType<typeof createLanFileStore>;
  noteStore: ReturnType<typeof createLanNoteStore>;
  uploadStore: ReturnType<typeof createLanUploadStore>;
  access: ReturnType<typeof createLanAccessController>;
  audit: ReturnType<typeof createLanAuditLog>;
  basePath: string;
};

export function registerLanFileRoutes({
  app,
  config,
  store,
  noteStore,
  uploadStore,
  access,
  audit,
  basePath
}: RegisterLanFileRoutesOptions) {
  const typedApp = app.withTypeProvider<TypeBoxTypeProvider>();

  typedApp.post(
    `${basePath}/files`,
    {
      config: { ...REQUEST_QUOTAS.lanUpload, allowGuestTransfer: true },
      schema: { response: { 200: apiSuccessSchema(LanFileUploadResultSchema), ...lanFailureResponses } }
    },
    async (request, reply) => {
      if (!access.authorize(request, reply, "upload")) return reply;
      const file = await request.file({ limits: { fileSize: config.lanTransferMaxFileBytes } });
      if (!file) return reply.code(400).send(fail("FILE_REQUIRED", "Please upload a file"));

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
        const message = error instanceof Error ? error.message : "File upload failed";
        return reply.code(500).send(fail("UPLOAD_FAILED", message));
      }
    }
  );

  typedApp.get(
    `${basePath}/files`,
    {
      schema: {
        querystring: LanFileListQuerySchema,
        response: { 200: apiSuccessSchema(LanFileListSchema), ...lanFailureResponses }
      }
    },
    async (request, reply) => {
      if (!access.authorize(request, reply, "read")) return reply;
      const query = normalizeLanFileQuery(request.query);
      const files = await store.list(query);
      const total = files.length;
      const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
      const page = Math.min(query.page, pageCount);
      const start = (page - 1) * query.pageSize;
      return ok<LanFileListResponse>({
        files: files.slice(start, start + query.pageSize).map((file) => withUrls(file, basePath)),
        pagination: { page, pageSize: query.pageSize, total, pageCount }
      });
    }
  );

  typedApp.post<{ Body: LanIdsInput }>(
    `${basePath}/files/batch-download`,
    {
      config: { ...REQUEST_QUOTAS.batchDownload, allowGuestTransfer: true },
      schema: { body: LanIdsInputSchema, response: lanFailureResponses }
    },
    async (request, reply) => {
      if (!access.authorize(request, reply, "read")) return reply;
      const ids = parseLanFileIds(request.body);
      if (!ids.length) return reply.code(400).send(fail("FILE_IDS_REQUIRED", "请至少选择一个文件"));
      const files = await store.getMany(ids);
      if (!files.length) return reply.code(404).send(fail("LAN_FILE_NOT_FOUND", "File not found"));
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

  typedApp.post(
    `${basePath}/files/batch-delete`,
    {
      schema: {
        body: LanIdsInputSchema,
        response: { 200: apiSuccessSchema(LanBatchRemovalSchema), ...lanFailureResponses }
      }
    },
    async (request, reply) => {
      if (!access.authorize(request, reply, "manage")) return reply;
      const ids = parseLanFileIds(request.body);
      if (!ids.length) return reply.code(400).send(fail("FILE_IDS_REQUIRED", "请至少选择一个文件"));
      const result = await store.removeMany(ids);
      await audit.write("files.batch-deleted", request, result);
      return ok(result);
    }
  );

  typedApp.get(
    `${basePath}/files/:id/preview`,
    { schema: { params: LanIdParamsSchema, response: lanFailureResponses } },
    async (request, reply) => {
      if (!access.authorize(request, reply, "read")) return reply;
      const file = await getFileOr404(store, request, reply);
      if (!file) return reply;
      if (!file.previewable)
        return reply.code(415).send(fail("PREVIEW_UNSUPPORTED", "This file type cannot be previewed"));
      return sendFile(reply, config, file, "inline", request.headers.range);
    }
  );

  typedApp.get(
    `${basePath}/files/:id/download`,
    { schema: { params: LanIdParamsSchema, response: lanFailureResponses } },
    async (request, reply) => {
      if (!access.authorize(request, reply, "read")) return reply;
      const file = await getFileOr404(store, request, reply);
      if (!file) return reply;
      if (!request.headers.range || /^bytes=0-/i.test(request.headers.range)) {
        await store.incrementDownloadCount(file.id);
        await audit.write("file.downloaded", request, { fileId: file.id });
      }
      return sendFile(reply, config, file, "attachment", request.headers.range);
    }
  );

  typedApp.delete(
    `${basePath}/files/:id`,
    {
      schema: {
        params: LanIdParamsSchema,
        response: { 200: apiSuccessSchema(LanRemovalSchema), ...lanFailureResponses }
      }
    },
    async (request, reply) => {
      if (!access.authorize(request, reply, "manage")) return reply;
      const { id } = request.params;
      const removed = await store.remove(id);
      if (!removed) return reply.code(404).send(fail("LAN_FILE_NOT_FOUND", "File not found"));
      await audit.write("file.deleted", request, { fileId: id });
      return ok({ removed: true });
    }
  );

  typedApp.patch(
    `${basePath}/files/:id/expiry`,
    {
      schema: {
        params: LanIdParamsSchema,
        body: LanExpiryInputSchema,
        response: { 200: apiSuccessSchema(LanFileWithUrlsSchema), ...lanFailureResponses }
      }
    },
    async (request, reply) => {
      if (!access.authorize(request, reply, "manage")) return reply;
      const { id } = request.params;
      const updated = await store.updateExpiry(id, request.body.days);
      if (!updated) return reply.code(404).send(fail("LAN_FILE_NOT_FOUND", "File not found"));
      await audit.write("file.expiry-updated", request, { fileId: id, days: request.body.days });
      return ok(withUrls(updated, basePath));
    }
  );

  typedApp.post(
    `${basePath}/cleanup`,
    { schema: { response: { 200: apiSuccessSchema(LanCleanupResultSchema), ...lanFailureResponses } } },
    async (request, reply) => {
      if (!access.authorize(request, reply, "manage")) return reply;
      const [files, notes] = await Promise.all([store.cleanupExpired(), noteStore.cleanupExpired()]);
      await audit.write("cleanup.completed", request, {
        filesRemoved: files.removed,
        notesRemoved: notes.removed
      });
      return ok({ removed: files.removed + notes.removed, filesRemoved: files.removed, notesRemoved: notes.removed });
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
