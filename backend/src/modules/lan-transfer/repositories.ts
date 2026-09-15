/**
 * 中文模块说明：局域网文件与图文传输领域，负责上传、分片、预览、下载和清理
 */
import fsp from "node:fs/promises";
import path from "node:path";
import {
  lanFileCategories,
  normalizeLanFileQuery,
  type LanFileRecord,
  type LanNoteImageRecord,
  type LanNoteRecord
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { FileMetadataRepository } from "../../database/file-metadata";
import { ensureJsonIndex, readJsonIndex } from "./repository-io";

export function createLanFileStore(
  config: AppConfig,
  database: ToolboxDatabase,
  fileMetadata?: FileMetadataRepository
) {
  const exclusive = createExclusiveQueue();

  async function ensure() {
    await fsp.mkdir(config.lanTransferFilesDir, { recursive: true });
    await ensureJsonIndex(config.lanTransferIndexPath);
    if (!database.isDomainInitialized("lan-file")) {
      const parsed = await readRecoverableIndex(config.lanTransferIndexPath, parseLanFileIndex);
      await write(parsed.records);
    }
  }

  async function read(): Promise<LanFileRecord[]> {
    await ensure();
    if (database.isDomainInitialized("lan-file")) {
      return database.list("lan-file").map((entity) => entity.payload as LanFileRecord);
    }
    const parsed = await readRecoverableIndex(config.lanTransferIndexPath, parseLanFileIndex);
    if (parsed.repaired) await write(parsed.records);
    return parsed.records;
  }

  async function write(records: LanFileRecord[]) {
    database.transaction(() => {
      const active = new Set(records.map((record) => record.id));
      for (const entity of database.list("lan-file")) {
        if (!active.has(entity.id)) database.remove("lan-file", entity.id);
      }
      for (const record of records) {
        database.upsert({
          id: record.id,
          kind: "lan-file",
          payload: record,
          createdAt: record.createdAt,
          updatedAt: record.createdAt
        });
      }
      database.markDomainInitialized("lan-file");
    });
  }

  return {
    ensure,
    add: (record: LanFileRecord) =>
      exclusive(async () => {
        const records = await read();
        records.unshift(record);
        await write(records);
        await fileMetadata
          ?.registerIfExists({
            entityKind: "lan-file",
            entityId: record.id,
            filePath: path.join(config.lanTransferFilesDir, record.storedName),
            mediaType: record.mimeType,
            owner: "lan"
          })
          .catch(() => undefined);
        return record;
      }),
    get: (id: string) => exclusive(async () => (await read()).find((record) => record.id === id)),
    getMany: (ids: string[]) =>
      exclusive(async () => {
        const wanted = new Set(ids);
        return (await read()).filter((record) => wanted.has(record.id));
      }),
    list: (query = normalizeLanFileQuery({})) =>
      exclusive(async () => {
        const keyword = query.keyword.toLowerCase();
        return (await read())
          .filter((record) => {
            const matchesKeyword =
              !keyword ||
              record.originalName.toLowerCase().includes(keyword) ||
              record.extension.toLowerCase().includes(keyword);
            const matchesCategory = !query.category || record.category === query.category;
            const matchesExtension = !query.extension || record.extension === query.extension;
            return matchesKeyword && matchesCategory && matchesExtension;
          })
          .sort((left, right) => compareLanFiles(left, right, query.sortBy, query.sortOrder));
      }),
    totalSize: () => exclusive(async () => (await read()).reduce((total, record) => total + record.size, 0)),
    incrementDownloadCount: (id: string) =>
      exclusive(async () => {
        const records = await read();
        await write(
          records.map((record) => (record.id === id ? { ...record, downloadCount: record.downloadCount + 1 } : record))
        );
      }),
    incrementDownloadCounts: (ids: string[]) =>
      exclusive(async () => {
        const wanted = new Set(ids);
        const records = await read();
        for (const record of records) if (wanted.has(record.id)) record.downloadCount += 1;
        await write(records);
      }),
    remove: (id: string) =>
      exclusive(async () => {
        const records = await read();
        const target = records.find((record) => record.id === id);
        if (!target) return false;
        await fsp.rm(path.join(config.lanTransferFilesDir, target.storedName), { force: true });
        fileMetadata?.removeForEntity("lan-file", target.id);
        await write(records.filter((record) => record.id !== id));
        return true;
      }),
    removeMany: (ids: string[]) =>
      exclusive(async () => {
        const wanted = new Set(ids);
        const records = await read();
        const targets = records.filter((record) => wanted.has(record.id));
        await Promise.all(
          targets.map((record) => fsp.rm(path.join(config.lanTransferFilesDir, record.storedName), { force: true }))
        );
        for (const record of targets) fileMetadata?.removeForEntity("lan-file", record.id);
        await write(records.filter((record) => !wanted.has(record.id)));
        return {
          removed: targets.map((record) => record.id),
          missing: ids.filter((id) => !targets.some((record) => record.id === id))
        };
      }),
    updateExpiry: (id: string, days: number) =>
      exclusive(async () => {
        const records = await read();
        const target = records.find((record) => record.id === id);
        if (!target) return undefined;
        target.expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
        await write(records);
        return target;
      }),
    cleanupExpired: () =>
      exclusive(async () => {
        const now = Date.now();
        const records = await read();
        const expired = records.filter((record) => Date.parse(record.expiresAt) <= now);
        await Promise.all(
          expired.map((record) => fsp.rm(path.join(config.lanTransferFilesDir, record.storedName), { force: true }))
        );
        for (const record of expired) fileMetadata?.removeForEntity("lan-file", record.id);
        if (expired.length) await write(records.filter((record) => Date.parse(record.expiresAt) > now));
        return { removed: expired.length };
      })
  };
}

export function createLanNoteStore(
  config: AppConfig,
  database: ToolboxDatabase,
  fileMetadata?: FileMetadataRepository
) {
  const notesDir = path.join(config.lanTransferDir, "notes");
  const imagesDir = path.join(notesDir, "images");
  const indexPath = path.join(notesDir, "index.json");
  const exclusive = createExclusiveQueue();

  async function ensure() {
    await fsp.mkdir(imagesDir, { recursive: true });
    await ensureJsonIndex(indexPath);
    if (!database.isDomainInitialized("lan-note")) {
      const parsed = await readRecoverableIndex(indexPath, parseLanNoteIndex);
      await write(parsed.records);
    }
  }

  async function read(): Promise<LanNoteRecord[]> {
    await ensure();
    if (database.isDomainInitialized("lan-note")) {
      return database.list("lan-note").map((entity) => entity.payload as LanNoteRecord);
    }
    const parsed = await readRecoverableIndex(indexPath, parseLanNoteIndex);
    if (parsed.repaired) await write(parsed.records);
    return parsed.records;
  }

  async function write(records: LanNoteRecord[]) {
    database.transaction(() => {
      const active = new Set(records.map((record) => record.id));
      for (const entity of database.list("lan-note")) {
        if (!active.has(entity.id)) database.remove("lan-note", entity.id);
      }
      for (const record of records) {
        database.upsert({
          id: record.id,
          kind: "lan-note",
          payload: record,
          createdAt: record.createdAt,
          updatedAt: record.createdAt
        });
      }
      database.markDomainInitialized("lan-note");
    });
  }

  async function removeImages(note: LanNoteRecord) {
    await Promise.all(note.images.map((image) => fsp.rm(path.join(imagesDir, image.storedName), { force: true })));
  }

  return {
    ensure,
    imagePath: (storedName: string) => path.join(imagesDir, path.basename(storedName)),
    add: (note: LanNoteRecord) =>
      exclusive(async () => {
        const notes = await read();
        notes.unshift(note);
        await write(notes);
        await Promise.all(
          note.images.map((image) =>
            fileMetadata
              ?.registerIfExists({
                entityKind: "lan-note-image",
                entityId: note.id,
                filePath: path.join(imagesDir, image.storedName),
                mediaType: image.mimeType,
                owner: "lan"
              })
              .catch(() => undefined)
          )
        );
        return note;
      }),
    list: () =>
      exclusive(async () => {
        const now = Date.now();
        return (await read())
          .filter((note) => Date.parse(note.expiresAt) > now)
          .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
      }),
    get: (id: string) =>
      exclusive(async () => (await read()).find((note) => note.id === id && Date.parse(note.expiresAt) > Date.now())),
    count: () =>
      exclusive(async () => {
        const now = Date.now();
        return (await read()).filter((note) => Date.parse(note.expiresAt) > now).length;
      }),
    totalSize: () =>
      exclusive(async () =>
        (await read()).reduce(
          (total, note) => total + note.images.reduce((imageTotal, image) => imageTotal + image.size, 0),
          0
        )
      ),
    updateExpiry: (id: string, days: number) =>
      exclusive(async () => {
        const notes = await read();
        const target = notes.find((note) => note.id === id);
        if (!target) return undefined;
        target.expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
        await write(notes);
        return target;
      }),
    remove: (id: string) =>
      exclusive(async () => {
        const notes = await read();
        const target = notes.find((note) => note.id === id);
        if (!target) return false;
        await removeImages(target);
        fileMetadata?.removeForEntity("lan-note-image", target.id);
        await write(notes.filter((note) => note.id !== id));
        return true;
      }),
    removeMany: (ids: string[]) =>
      exclusive(async () => {
        const notes = await read();
        const wanted = new Set(ids);
        const targets = notes.filter((note) => wanted.has(note.id));
        await Promise.all(targets.map(removeImages));
        for (const note of targets) fileMetadata?.removeForEntity("lan-note-image", note.id);
        if (targets.length) await write(notes.filter((note) => !wanted.has(note.id)));
        const removed = targets.map((note) => note.id);
        const removedSet = new Set(removed);
        return { removed, missing: ids.filter((id) => !removedSet.has(id)) };
      }),
    cleanupExpired: () =>
      exclusive(async () => {
        const now = Date.now();
        const notes = await read();
        const expired = notes.filter((note) => Date.parse(note.expiresAt) <= now);
        await Promise.all(expired.map(removeImages));
        for (const note of expired) fileMetadata?.removeForEntity("lan-note-image", note.id);
        if (expired.length) await write(notes.filter((note) => Date.parse(note.expiresAt) > now));
        return { removed: expired.length };
      })
  };
}

function createExclusiveQueue() {
  let queue = Promise.resolve();
  return function runExclusive<T>(operation: () => Promise<T>) {
    const current = queue.then(operation, operation);
    queue = current.then(
      () => undefined,
      () => undefined
    );
    return current;
  };
}

async function readRecoverableIndex<T>(indexPath: string, parse: (raw: string) => { records: T[]; repaired: boolean }) {
  try {
    return parse(await readJsonIndex(indexPath));
  } catch {
    const parsed = parse(await fsp.readFile(`${indexPath}.bak`, "utf8"));
    parsed.repaired = true;
    return parsed;
  }
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

function parseLanFileIndex(raw: string) {
  try {
    return { records: sanitizeLanFileRecords(JSON.parse(raw)), repaired: false };
  } catch (error) {
    const recovered = extractFirstJsonArray(raw);
    if (!recovered) throw error;
    return { records: sanitizeLanFileRecords(JSON.parse(recovered)), repaired: true };
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
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "[") depth += 1;
    else if (char === "]") {
      depth -= 1;
      if (depth === 0) return raw.slice(start, index + 1);
    }
  }
  return undefined;
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

function sanitizeLanFileRecords(value: unknown): LanFileRecord[] {
  return Array.isArray(value) ? value.filter(isLanFileRecord) : [];
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

function compareLanFiles(
  left: LanFileRecord,
  right: LanFileRecord,
  sortBy: "createdAt" | "size" | "name" | "downloadCount",
  sortOrder: "asc" | "desc"
) {
  const direction = sortOrder === "asc" ? 1 : -1;
  if (sortBy === "name") return left.originalName.localeCompare(right.originalName) * direction;
  const leftValue = sortBy === "createdAt" ? Date.parse(left.createdAt) : left[sortBy];
  const rightValue = sortBy === "createdAt" ? Date.parse(right.createdAt) : right[sortBy];
  return (leftValue - rightValue) * direction;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
