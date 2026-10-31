import type { BackupModuleId } from "@toolbox/shared/system";
import type { StoredEntity, FileMetadata } from "../../database/types";

export type BackupFile = {
  path: string;
  sha256: string;
  bytes: number;
  entityKind: string;
  entityId: string;
  mediaType?: string;
  createdAt: string;
};
export type ModuleData = {
  version: 1;
  id: BackupModuleId;
  records: StoredEntity[];
  files: BackupFile[];
  catalog?: import("@toolbox/shared").AudioLibraryCatalog;
  preferences?: Record<string, string>;
};
export type BackupManifest = {
  format: "toolbox-module-backup";
  version: 1;
  id: string;
  createdAt: string;
  appVersion: string;
  modules: Array<{
    id: BackupModuleId;
    version: 1;
    records: number;
    files: number;
    bytes: number;
    expired: number;
    recordsHash: string;
    filesHash: string;
  }>;
};
export type BackupBundle = { manifest: BackupManifest; modules: ModuleData[]; directory: string };
export type BackupProgress = (
  phase: string,
  files: number,
  totalFiles: number,
  bytes: number,
  totalBytes: number
) => void;
export type RestoreChange = { path: string; source?: string; content?: string };
export type RestoreDraft = {
  mode: import("@toolbox/shared/system").BackupMode;
  modules: ModuleData[];
  files: RestoreChange[];
  removeFiles: string[];
  counts: Map<BackupModuleId, { added: number; skipped: number; conflicts: number }>;
  mappings: Record<string, string>;
  fingerprint: string;
  metadata: FileMetadata[];
};
