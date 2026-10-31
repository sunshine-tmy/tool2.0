/** Portable desktop DTOs without runtime validators or platform dependencies. */
export const backupModules = [
  { id: "image-compress", name: "图片压缩" },
  { id: "image-ai", name: "AI 图片处理" },
  { id: "speech", name: "多国语言配音" },
  { id: "audio-library", name: "音频素材库" },
  { id: "content-archive", name: "多媒体内容归档" },
  { id: "lan-transfer", name: "局域网文件传输" }
] as const;
export type BackupModuleId = (typeof backupModules)[number]["id"];
export type BackupMode = "merge" | "replace";
export type BackupSelection = {
  modules: BackupModuleId[];
  preferences?: Record<string, string>;
  clientPreferences?: Record<string, string>;
};
export type BackupModuleSummary = {
  id: BackupModuleId;
  records: number;
  files: number;
  bytes: number;
  expired: number;
};
export type BackupPreview = {
  planId: string;
  expiresAt: string;
  mode: BackupMode;
  createdAt: string;
  appVersion: string;
  modules: Array<BackupModuleSummary & { existing: number; added: number; skipped: number; conflicts: number }>;
  requiredBytes: number;
  warnings: string[];
};
export type BackupOperation = {
  id: string;
  type: "export" | "import" | "rollback";
  status: "running" | "completed" | "failed" | "canceled";
  phase: string;
  files: number;
  totalFiles: number;
  bytes: number;
  totalBytes: number;
  cancelable: boolean;
  startedAt: string;
  finishedAt?: string;
  message?: string;
  restorePointId?: string;
  preferences?: Record<string, string>;
};
export type BackupRestorePoint = {
  id: string;
  createdAt: string;
  modules: BackupModuleId[];
  bytes: number;
  problem?: string;
};
export type BackupState = {
  operations: BackupOperation[];
  restorePoints: BackupRestorePoint[];
  preflight?: Pick<BackupOperation, "id" | "phase" | "files" | "totalFiles" | "bytes" | "totalBytes" | "cancelable">;
};
export type BackupFileSelection = {
  canceled: boolean;
  selectionId?: string;
  displayName?: string;
  modules?: BackupModuleSummary[];
};
export interface DataBackupBridge {
  getDataBackupState(): Promise<BackupState>;
  selectDataBackup(): Promise<BackupFileSelection>;
  previewDataBackup(input: {
    selectionId: string;
    modules: BackupModuleId[];
    mode: BackupMode;
  }): Promise<BackupPreview>;
  exportModuleData(input: BackupSelection): Promise<{ canceled: boolean; operationId?: string }>;
  importModuleData(planId: string, clientPreferences?: Record<string, string>): Promise<string>;
  cancelDataBackup(operationId: string): Promise<void>;
  rollbackModuleData(restorePointId: string, clientPreferences?: Record<string, string>): Promise<string>;
  deleteDataRestorePoint(restorePointId: string): Promise<void>;
}
