import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { nanoid } from "nanoid";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import { ensureJsonIndex, readJsonIndex } from "./repository-io";

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

export function createLanUploadStore(config: AppConfig, database: ToolboxDatabase) {
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
    if (!database.isDomainInitialized("upload-session")) {
      let value: unknown;
      try {
        value = JSON.parse(await readJsonIndex(uploadIndexPath)) as unknown;
      } catch {
        value = JSON.parse(await fsp.readFile(`${uploadIndexPath}.bak`, "utf8")) as unknown;
      }
      await write(Array.isArray(value) ? value.filter(isLanUploadSession) : []);
    }
  }

  async function read(): Promise<LanChunkUploadSession[]> {
    await ensure();
    if (database.isDomainInitialized("upload-session")) {
      return database.list("upload-session").map((entity) => entity.payload as LanChunkUploadSession);
    }
    let value: unknown;
    try {
      value = JSON.parse(await readJsonIndex(uploadIndexPath)) as unknown;
    } catch {
      value = JSON.parse(await fsp.readFile(`${uploadIndexPath}.bak`, "utf8")) as unknown;
    }
    return Array.isArray(value) ? value.filter(isLanUploadSession) : [];
  }

  async function write(sessions: LanChunkUploadSession[]) {
    database.transaction(() => {
      const active = new Set(sessions.map((session) => session.uploadId));
      for (const entity of database.list("upload-session")) {
        if (!active.has(entity.id)) database.remove("upload-session", entity.id);
      }
      for (const session of sessions) {
        database.upsert({
          id: session.uploadId,
          kind: "upload-session",
          status: "uploading",
          payload: session,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt
        });
      }
      database.markDomainInitialized("upload-session");
    });
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
        if (!target) return undefined;
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
        if (!exists) return false;
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

export function parseUploadSessionBody(body: unknown):
  | {
      ok: true;
      value: Omit<LanChunkUploadSession, "uploadId" | "uploadedChunks" | "createdAt" | "updatedAt">;
    }
  | { ok: false; code: string; message: string } {
  if (!isRecord(body)) return { ok: false, code: "INVALID_UPLOAD_SESSION", message: "Invalid upload session payload" };

  const originalName = path.basename(String(body.originalName ?? body.fileName ?? ""));
  const mimeType = String(body.mimeType ?? "application/octet-stream");
  const size = Number(body.size);
  const chunkSize = Number(body.chunkSize);
  const totalChunks = Number(body.totalChunks);

  if (!originalName) return { ok: false, code: "INVALID_FILE_NAME", message: "File name is required" };
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

  return { ok: true, value: { originalName, mimeType, size, chunkSize, totalChunks } };
}

export function toUploadStatus(session: LanChunkUploadSession) {
  return {
    ...session,
    uploadedBytes: session.uploadedChunks.reduce((total, index) => total + getExpectedChunkSize(session, index), 0)
  };
}

export function getExpectedChunkSize(session: LanChunkUploadSession, chunkIndex: number) {
  if (chunkIndex === session.totalChunks - 1) return session.size - session.chunkSize * (session.totalChunks - 1);
  return session.chunkSize;
}

export function getMissingChunks(session: LanChunkUploadSession) {
  const uploaded = new Set(session.uploadedChunks);
  return Array.from({ length: session.totalChunks }, (_, index) => index).filter((index) => !uploaded.has(index));
}

export async function mergeChunks(
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
        await pipeline(
          fs.createReadStream(uploadStore.chunkPath(session.uploadId, index)),
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

export async function checkMergeHeadroom(directory: string, session: LanChunkUploadSession) {
  const requiredBytes = session.size;
  if (requiredBytes === 0) {
    return { ok: true as const, requiredBytes, availableBytes: Number.POSITIVE_INFINITY };
  }
  const stats = await fsp.statfs(directory);
  const availableBytes = Number(stats.bavail) * Number(stats.bsize);
  return { ok: availableBytes >= requiredBytes, requiredBytes, availableBytes };
}

export function isNoSpaceError(error: unknown) {
  return isRecord(error) && error.code === "ENOSPC";
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
    value.uploadedChunks.every((index) => Number.isSafeInteger(index) && Number(index) >= 0) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
