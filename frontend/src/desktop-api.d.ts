export {};

declare global {
  type StartupDataMigrationState = {
    required: boolean;
    sourceDirectory?: string;
    destinationDirectory: string;
    sourceBytes: number;
    sourceFiles: number;
    freeBytes?: number;
    sufficientSpace?: boolean;
  };

  type DesktopMigrationSummary = {
    id: string;
    status: "imported" | "rolled-back";
    completedAt: string;
    files: number;
    bytes: number;
  };

  type DesktopSettingsState = {
    schemaVersion: 1;
    updatedAt: string;
    startAtLogin: boolean;
    automaticUpdateChecks: boolean;
    installDirectory: string;
    dataDirectory: string;
    lastMigration?: DesktopMigrationSummary;
  };

  interface Window {
    toolboxDesktop?: {
      getVersion(): Promise<string>;
      getSettings(): Promise<DesktopSettingsState>;
      getStartupDataMigrationState(): Promise<StartupDataMigrationState>;
      migrateStartupData(): Promise<{
        id: string;
        files: number;
        bytes: number;
        sourceDirectory: string;
        destinationDirectory: string;
      }>;
      chooseFreshStartupData(): Promise<void>;
      exitStartupMigration(): Promise<void>;
      updateSettings(settings: {
        startAtLogin?: boolean;
        automaticUpdateChecks?: boolean;
      }): Promise<DesktopSettingsState>;
      checkForUpdates(): Promise<{ enabled: boolean; checking: boolean }>;
      revealDataDirectory(): Promise<void>;
      selectLegacyDataDirectory(): Promise<
        { canceled: true } | { canceled: false; selectionId: string; displayName: string }
      >;
      importLegacyData(selectionId: string): Promise<{ id: string; source: { files: number; bytes: number } }>;
      rollbackDataMigration(migrationId: string): Promise<{ id: string; restored: { files: number; bytes: number } }>;
    };
  }
}
