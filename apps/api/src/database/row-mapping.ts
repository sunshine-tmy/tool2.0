/** Database implementation detail; public callers continue through ToolboxDatabase. */
import type { EntityRow, StoredEntity, FileMetadataRow, FileMetadata } from "./types";
export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function numberValue(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

export function deserializeEntity(row: EntityRow): StoredEntity {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status ?? undefined,
    payload: JSON.parse(row.payload_json) as unknown,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function deserializeFileMetadata(row: FileMetadataRow): FileMetadata {
  return {
    id: row.id,
    entityKind: row.entity_kind,
    entityId: row.entity_id,
    relativePath: row.relative_path,
    byteSize: row.byte_size,
    sha256: row.sha256 ?? undefined,
    mediaType: row.media_type ?? undefined,
    owner: row.owner ?? undefined,
    createdAt: row.created_at
  };
}
