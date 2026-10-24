/** Database implementation detail; public callers continue through ToolboxDatabase. */
export type StoredEntity = {
  id: string;
  kind: string;
  status?: string;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
};

export type FileMetadata = {
  id: string;
  entityKind: string;
  entityId: string;
  relativePath: string;
  byteSize: number;
  sha256?: string;
  mediaType?: string;
  owner?: string;
  createdAt: string;
};

export type EntityRow = {
  id: string;
  kind: string;
  status: string | null;
  payload_json: string;
  created_at: string;
  updated_at: string;
};

export type FileMetadataRow = {
  id: string;
  entity_kind: string;
  entity_id: string;
  relative_path: string;
  byte_size: number;
  sha256: string | null;
  media_type: string | null;
  owner: string | null;
  created_at: string;
};

export type EntityTableColumn = {
  name: string;
  pk: number;
};

export type LegacyEntityRow = Omit<EntityRow, "kind"> & { kind?: string | null };
