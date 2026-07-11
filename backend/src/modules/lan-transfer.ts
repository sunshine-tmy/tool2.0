import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { nanoid } from "nanoid";
import {
  classifyLanFile,
  fail,
  getLanFileExtension,
  isLanFilePreviewable,
  lanFileCategories,
  normalizeLanFileQuery,
  ok,
  type LanFileRecord
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

export async function registerLanTransferRoutes({ app, config }: RegisterLanTransferRoutesOptions) {
  const store = createLanFileStore(config);
  const uploadStore = createLanUploadStore(config);
  const finalizingUploads = new Set<string>();
  await store.ensure();
  await uploadStore.ensure();
  await store.cleanupExpired();

  for (const basePath of ["/api/tools/lan-transfer", "/api/lan"]) {
    registerLanTransferNamespace(app, config, store, uploadStore, finalizingUploads, basePath);
  }
}

function registerLanTransferNamespace(
  app: FastifyInstance,
  config: AppConfig,
  store: ReturnType<typeof createLanFileStore>,
  uploadStore: ReturnType<typeof createLanUploadStore>,
  finalizingUploads: Set<string>,
  basePath: string
) {
  app.post(`${basePath}/files`, async (request, reply) => {
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

  app.get(`${basePath}/files`, async (request) => {
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

  app.get(`${basePath}/files/:id/preview`, async (request, reply) => {
    const file = await getFileOr404(store, request, reply);
    if (!file) return reply;

    if (!file.previewable) {
      return reply.code(415).send(fail("PREVIEW_UNSUPPORTED", "This file type cannot be previewed"));
    }

    return sendFile(reply, config, file, "inline", request.headers.range);
  });

  app.get(`${basePath}/files/:id/download`, async (request, reply) => {
    const file = await getFileOr404(store, request, reply);
    if (!file) return reply;

    await store.incrementDownloadCount(file.id);
    return sendFile(reply, config, file, "attachment", request.headers.range);
  });

  app.delete(`${basePath}/files/:id`, async (request, reply) => {
    const { id } = request.params as { id: string };
    const removed = await store.remove(id);
    if (!removed) {
      return reply.code(404).send(fail("LAN_FILE_NOT_FOUND", "File not found"));
    }
    return ok({ removed: true });
  });

  app.post(`${basePath}/cleanup`, async () => {
    return ok(await store.cleanupExpired());
  });

  app.post(`${basePath}/uploads`, async (request, reply) => {
    const parsed = parseUploadSessionBody(request.body);
    if (!parsed.ok) {
      return reply.code(400).send(fail(parsed.code, parsed.message));
    }

    if (parsed.value.size > config.lanTransferMaxFileBytes) {
      return reply.code(413).send(fail("FILE_TOO_LARGE", "Uploaded file exceeds the configured limit"));
    }

    const session = await uploadStore.create(parsed.value);
    return ok(toUploadStatus(session));
  });

  app.get(`${basePath}/uploads/:uploadId`, async (request, reply) => {
    const { uploadId } = request.params as { uploadId: string };
    const session = await uploadStore.get(uploadId);
    if (!session) {
      return reply.code(404).send(fail("UPLOAD_NOT_FOUND", "Upload session not found"));
    }

    return ok(toUploadStatus(session));
  });

  app.put(`${basePath}/uploads/:uploadId/chunks/:index`, async (request, reply) => {
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
    try {
      await fsp.access(config.lanTransferIndexPath);
    } catch {
      await fsp.writeFile(config.lanTransferIndexPath, "[]");
    }
  }

  async function read(): Promise<LanFileRecord[]> {
    await ensure();
    const raw = await fsp.readFile(config.lanTransferIndexPath, "utf8");
    const parsed = parseLanFileIndex(raw);
    if (parsed.repaired) {
      await write(parsed.records);
    }
    return parsed.records;
  }

  async function write(records: LanFileRecord[]) {
    const temporaryPath = `${config.lanTransferIndexPath}.${process.pid}.${nanoid(6)}.tmp`;
    await fsp.writeFile(temporaryPath, JSON.stringify(records, null, 2));
    await fsp.rm(config.lanTransferIndexPath, { force: true });
    await fsp.rename(temporaryPath, config.lanTransferIndexPath);
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
    async incrementDownloadCount(id: string) {
      return runExclusive(async () => {
        const records = await read();
        const next = records.map((record) =>
          record.id === id ? { ...record, downloadCount: record.downloadCount + 1 } : record
        );
        await write(next);
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
    async cleanupExpired() {
      return runExclusive(async () => {
        const now = Date.now();
        const records = await read();
        const expired = records.filter((record) => Date.parse(record.expiresAt) <= now);
        await Promise.all(
          expired.map((record) => fsp.rm(path.join(config.lanTransferFilesDir, record.storedName), { force: true }))
        );
        await write(records.filter((record) => Date.parse(record.expiresAt) > now));
        return { removed: expired.length };
      });
    }
  };
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
    try {
      await fsp.access(uploadIndexPath);
    } catch {
      await fsp.writeFile(uploadIndexPath, "[]");
    }
  }

  async function read(): Promise<LanChunkUploadSession[]> {
    await ensure();
    const raw = await fsp.readFile(uploadIndexPath, "utf8");
    return JSON.parse(raw) as LanChunkUploadSession[];
  }

  async function write(sessions: LanChunkUploadSession[]) {
    const temporaryPath = `${uploadIndexPath}.${process.pid}.${nanoid(6)}.tmp`;
    await fsp.writeFile(temporaryPath, JSON.stringify(sessions, null, 2));
    await fsp.rm(uploadIndexPath, { force: true });
    await fsp.rename(temporaryPath, uploadIndexPath);
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
  const stat = await fsp.stat(filePath);
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

function parseRange(rangeHeader: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) {
    return undefined;
  }

  const start = match[1] ? Number(match[1]) : 0;
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

  if (!Number.isSafeInteger(size) || size <= 0) {
    return { ok: false, code: "INVALID_FILE_SIZE", message: "File size must be a positive integer" };
  }

  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
    return { ok: false, code: "INVALID_CHUNK_SIZE", message: "Chunk size must be a positive integer" };
  }

  if (!Number.isSafeInteger(totalChunks) || totalChunks <= 0 || totalChunks !== Math.ceil(size / chunkSize)) {
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
    for (let index = 0; index < session.totalChunks; index += 1) {
      const chunkPath = uploadStore.chunkPath(session.uploadId, index);
      await pipeline(
        fs.createReadStream(chunkPath),
        fs.createWriteStream(temporaryPath, { flags: index === 0 ? "wx" : "a" })
      );
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
  if (session.totalChunks <= 1) {
    return 0;
  }

  return Math.max(
    ...Array.from({ length: session.totalChunks - 1 }, (_, index) => getExpectedChunkSize(session, index + 1))
  );
}

function isNoSpaceError(error: unknown) {
  return isRecord(error) && error.code === "ENOSPC";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
