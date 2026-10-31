/** Desktop wire contracts only: no Electron, Node, persistence or executable validation. */
import type { DataBackupBridge } from "../system/data-backup-contract";
export type DesktopMigrationSummary = {
  id: string;
  status: "imported" | "rolled-back";
  completedAt: string;
  files: number;
  bytes: number;
};

export type DesktopSettings = {
  schemaVersion: 1;
  updatedAt: string;
  startAtLogin: boolean;
  automaticUpdateChecks: boolean;
  lastMigration?: DesktopMigrationSummary;
};

export type DesktopSettingsUpdate = Partial<Pick<DesktopSettings, "startAtLogin" | "automaticUpdateChecks">>;

export type DesktopSettingsState = DesktopSettings & {
  platform: "win32" | "darwin";
  updateChecksSupported: boolean;
  installDirectory: string;
  dataDirectory: string;
  dataDirectoryDescription: string;
};

export type StartupDataMigrationState = {
  required: boolean;
  sourceDirectory?: string;
  destinationDirectory: string;
  sourceBytes: number;
  sourceFiles: number;
  freeBytes?: number;
  sufficientSpace?: boolean;
};

export type DesktopRootMigrationResult = {
  id: string;
  files: number;
  bytes: number;
  sourceDirectory: string;
  destinationDirectory: string;
};

export type DesktopDataMigrationResult = {
  id: string;
  source: { files: number; bytes: number };
  previous: { files: number; bytes: number };
};

export type DesktopDataRollbackResult = {
  id: string;
  restored: { files: number; bytes: number };
};

export type DesktopLegacyDirectorySelection =
  { canceled: true } | { canceled: false; selectionId: string; displayName: string };

export type DesktopUpdateCheck = { enabled: boolean; checking: boolean };

export type StartupStepId =
  "storage" | "migration" | "proxy" | "process" | "config" | "database" | "directories" | "service" | "window";

export type StartupSnapshot = {
  revision: number;
  phase: string;
  stageId: StartupStepId | "ready";
  failed: boolean;
  canRetry: boolean;
  code: string;
  message: string;
  entered: boolean;
  elapsedMs: number;
  stageElapsedMs: number;
  completedCount: number;
  totalSteps: number;
  steps: Array<{ id: StartupStepId; label: string; status: "pending" | "active" | "completed" | "failed" }>;
};

export type ShutdownInspection = { busy: boolean; blocked: boolean; reason?: string };
export type ShutdownPreparation = ShutdownInspection & { prepared: boolean };

/** Each method remains a fixed capability; never expose a generic invoke/channel API. */
export interface DesktopBridge extends Partial<DataBackupBridge> {
  getStartupDiagnostics(): Promise<StartupSnapshot>;
  onStartupDiagnostics(callback: (state: StartupSnapshot) => void): () => void;
  retryStartup(): Promise<void>;
  copyStartupDiagnostics(): Promise<void>;
  exportStartupDiagnostics(): Promise<void>;
  revealStartupLogs(): Promise<void>;
  exitStartupDiagnostics(): Promise<void>;
  saveDiagnosticReport?(content: string): Promise<void>;
  getVersion(): Promise<string>;
  setAudioPlaybackActive?(active: boolean): Promise<void>;
  getSettings(): Promise<DesktopSettingsState>;
  getStartupDataMigrationState(): Promise<StartupDataMigrationState>;
  /** The existing recovered/complete branch returns void, not a fabricated migration result. */
  migrateStartupData(): Promise<DesktopRootMigrationResult | void>;
  chooseFreshStartupData(): Promise<void>;
  exitStartupMigration(): Promise<void>;
  updateSettings(settings: DesktopSettingsUpdate): Promise<DesktopSettingsState>;
  checkForUpdates(): Promise<DesktopUpdateCheck>;
  revealDataDirectory(): Promise<void>;
  selectLegacyDataDirectory(): Promise<DesktopLegacyDirectorySelection>;
  importLegacyData(selectionId: string): Promise<DesktopDataMigrationResult>;
  rollbackDataMigration(migrationId: string): Promise<DesktopDataRollbackResult>;
}
