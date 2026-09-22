export {};

declare global {
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
    dataDirectory: string;
    lastMigration?: DesktopMigrationSummary;
  };

  interface Window {
    toolboxDesktop?: {
      getVersion(): Promise<string>;
      getSettings(): Promise<DesktopSettingsState>;
      updateSettings(settings: {
        startAtLogin?: boolean;
        automaticUpdateChecks?: boolean;
      }): Promise<DesktopSettingsState>;
      revealDataDirectory(): Promise<void>;
      selectLegacyDataDirectory(): Promise<
        { canceled: true } | { canceled: false; selectionId: string; displayName: string }
      >;
      importLegacyData(selectionId: string): Promise<{ id: string; source: { files: number; bytes: number } }>;
      rollbackDataMigration(migrationId: string): Promise<{ id: string; restored: { files: number; bytes: number } }>;
    };
  }
}
