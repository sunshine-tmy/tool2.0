import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("toolboxDesktop", {
  getVersion: () => ipcRenderer.invoke("desktop:get-version") as Promise<string>,
  getSettings: () => ipcRenderer.invoke("desktop:get-settings"),
  getStartupDataMigrationState: () => ipcRenderer.invoke("desktop:get-startup-data-migration"),
  migrateStartupData: () => ipcRenderer.invoke("desktop:migrate-startup-data"),
  chooseFreshStartupData: () => ipcRenderer.invoke("desktop:choose-fresh-startup-data"),
  exitStartupMigration: () => ipcRenderer.invoke("desktop:exit-startup-migration"),
  updateSettings: (settings: { startAtLogin?: boolean; automaticUpdateChecks?: boolean }) =>
    ipcRenderer.invoke("desktop:update-settings", settings),
  checkForUpdates: () =>
    ipcRenderer.invoke("desktop:check-for-updates") as Promise<{ enabled: boolean; checking: boolean }>,
  revealDataDirectory: () => ipcRenderer.invoke("desktop:reveal-data-directory") as Promise<void>,
  selectLegacyDataDirectory: () => ipcRenderer.invoke("desktop:select-legacy-data-directory"),
  importLegacyData: (selectionId: string) => ipcRenderer.invoke("desktop:import-legacy-data", selectionId),
  rollbackDataMigration: (migrationId: string) => ipcRenderer.invoke("desktop:rollback-data-migration", migrationId)
});
