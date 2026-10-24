/** Database implementation detail; public callers continue through ToolboxDatabase. */
import type Database from "better-sqlite3";
import type { FileMetadata, FileMetadataRow } from "./types";
import { deserializeFileMetadata } from "./row-mapping";
export function upsertFile(connection: Database.Database, file: FileMetadata) {
  // 文件表只保存相对路径和可验证摘要；媒体本身仍在 storage，避免 SQLite 膨胀。
  const relativePath = normalizeRelativePath(file.relativePath);
  if (!file.id || !file.entityKind || !file.entityId || !relativePath) {
    throw new Error("Invalid file metadata identity");
  }
  if (!Number.isSafeInteger(file.byteSize) || file.byteSize < 0) {
    throw new Error("Invalid file metadata size");
  }
  connection
    .prepare(
      `INSERT INTO files
           (id, entity_kind, entity_id, relative_path, byte_size, sha256, media_type, owner, created_at)
         VALUES (@id, @entityKind, @entityId, @relativePath, @byteSize, @sha256, @mediaType, @owner, @createdAt)
         ON CONFLICT(id) DO UPDATE SET entity_kind = excluded.entity_kind,
           entity_id = excluded.entity_id, relative_path = excluded.relative_path,
           byte_size = excluded.byte_size, sha256 = excluded.sha256,
           media_type = excluded.media_type, owner = excluded.owner
         ON CONFLICT(relative_path) DO UPDATE SET id = excluded.id,
           entity_kind = excluded.entity_kind, entity_id = excluded.entity_id,
           byte_size = excluded.byte_size, sha256 = excluded.sha256,
           media_type = excluded.media_type, owner = excluded.owner`
    )
    .run({
      ...file,
      relativePath,
      sha256: file.sha256 ?? null,
      mediaType: file.mediaType ?? null,
      owner: file.owner ?? null
    });
}

export function getFile(connection: Database.Database, id: string): FileMetadata | undefined {
  const row = connection.prepare("SELECT * FROM files WHERE id = ?").get(id) as FileMetadataRow | undefined;
  return row ? deserializeFileMetadata(row) : undefined;
}

export function listFiles(
  connection: Database.Database,
  filter: { entityKind?: string; entityId?: string; owner?: string } = {}
) {
  const clauses: string[] = [];
  const values: string[] = [];
  if (filter.entityKind) {
    clauses.push("entity_kind = ?");
    values.push(filter.entityKind);
  }
  if (filter.entityId) {
    clauses.push("entity_id = ?");
    values.push(filter.entityId);
  }
  if (filter.owner) {
    clauses.push("owner = ?");
    values.push(filter.owner);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const rows = connection
    .prepare(`SELECT * FROM files${where} ORDER BY created_at DESC, relative_path ASC`)
    .all(...values) as FileMetadataRow[];
  return rows.map(deserializeFileMetadata);
}

export function removeFile(connection: Database.Database, id: string) {
  return connection.prepare("DELETE FROM files WHERE id = ?").run(id).changes > 0;
}

export function removeFilesForEntity(connection: Database.Database, entityKind: string, entityId: string) {
  return connection.prepare("DELETE FROM files WHERE entity_kind = ? AND entity_id = ?").run(entityKind, entityId)
    .changes;
}
function normalizeRelativePath(value: string) {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0") || /(^|\/)\.\.(\/|$)/.test(normalized)) {
    throw new Error("Invalid relative file path");
  }
  return normalized;
}
