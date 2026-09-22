import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("toolboxDesktop", {
  getVersion: () => ipcRenderer.invoke("desktop:get-version") as Promise<string>,
  getSettings: () => ipcRenderer.invoke("desktop:get-settings"),
  updateSettings: (settings: { startAtLogin?: boolean; automaticUpdateChecks?: boolean }) =>
    ipcRenderer.invoke("desktop:update-settings", settings),
  revealDataDirectory: () => ipcRenderer.invoke("desktop:reveal-data-directory") as Promise<void>,
  selectLegacyDataDirectory: () => ipcRenderer.invoke("desktop:select-legacy-data-directory"),
  importLegacyData: (selectionId: string) => ipcRenderer.invoke("desktop:import-legacy-data", selectionId),
  rollbackDataMigration: (migrationId: string) => ipcRenderer.invoke("desktop:rollback-data-migration", migrationId)
});
