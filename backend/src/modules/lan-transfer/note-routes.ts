import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance } from "fastify";
import { nanoid } from "nanoid";
import {
  LanExpiryInputSchema,
  LanIdParamsSchema,
  LanIdsInputSchema,
  LanNoteImageParamsSchema,
  LanPaginationQuerySchema,
  fail,
  lanNoteLimits,
  ok,
  type LanExpiryInput,
  type LanIdParams,
  type LanIdsInput,
  type LanNoteImageParams,
  type LanNoteImageRecord,
  type LanNoteRecord,
  type LanPaginationQuery
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { createLanAccessController, createLanAuditLog } from "./access";
import {
  extensionForLanNoteImage,
  hasLanNoteImageSignature,
  isAllowedLanNoteImageMime,
  sendLanNoteImage,
  withNoteUrls
} from "./files";
import type { createLanFileStore, createLanNoteStore } from "./repositories";
import type { createLanUploadStore } from "./uploads";

type RegisterLanNoteRoutesOptions = {
  app: FastifyInstance;
  config: AppConfig;
  store: ReturnType<typeof createLanFileStore>;
  noteStore: ReturnType<typeof createLanNoteStore>;
  uploadStore: ReturnType<typeof createLanUploadStore>;
  access: ReturnType<typeof createLanAccessController>;
  audit: ReturnType<typeof createLanAuditLog>;
  basePath: string;
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

export function registerLanNoteRoutes({
  app,
  config,
  store,
  noteStore,
  uploadStore,
  access,
  audit,
  basePath
}: RegisterLanNoteRoutesOptions) {
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
      const ids = parseLanNoteIds(request.body);
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
}

function parseLanNoteIds(body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.ids)) return [];
  return Array.from(
    new Set(body.ids.filter((value): value is string => typeof value === "string" && value.length > 0).slice(0, 100))
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
