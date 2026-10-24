import type { DesktopBridge, StartupSnapshot } from "@toolbox/shared/desktop";
import { contextBridge, ipcRenderer } from "electron";

const desktopBridge: Required<DesktopBridge> = {
  getStartupDiagnostics: () => ipcRenderer.invoke("diagnostics:startup-state"),
  onStartupDiagnostics: (callback: (state: StartupSnapshot) => void) => {
    const listener = (_event: unknown, state: StartupSnapshot) => callback(state);
    ipcRenderer.on("diagnostics:startup-updated", listener);
    return () => ipcRenderer.removeListener("diagnostics:startup-updated", listener);
  },
  saveDiagnosticReport: (content: string) => ipcRenderer.invoke("desktop:save-diagnostic-report", content),
  retryStartup: () => ipcRenderer.invoke("diagnostics:startup-retry"),
  copyStartupDiagnostics: () => ipcRenderer.invoke("diagnostics:startup-copy"),
  exportStartupDiagnostics: () => ipcRenderer.invoke("diagnostics:startup-export"),
  revealStartupLogs: () => ipcRenderer.invoke("diagnostics:startup-logs"),
  exitStartupDiagnostics: () => ipcRenderer.invoke("diagnostics:startup-exit"),
  getVersion: () => ipcRenderer.invoke("desktop:get-version") as Promise<string>,
  setAudioPlaybackActive: (active: boolean) => ipcRenderer.invoke("desktop:audio-playback", active) as Promise<void>,
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
};

contextBridge.exposeInMainWorld("toolboxDesktop", desktopBridge);
