import { ipcMain } from "electron";
import type { DesktopIpcContext } from "./desktop-context";
import { desktopSenderAssertion } from "./trusted-desktop-sender";
import { createDesktopSettingsHandlers } from "./settings";
import { createDesktopPlaybackHandler } from "./playback";
import { createDiagnosticReportHandler } from "./diagnostic-report";
import { createDesktopDataHandlers } from "./data-migration";
import { createDataBackupHandlers } from "./data-backup";
export function registerDesktopIpc(context: DesktopIpcContext) {
  const security = { getMainWindow: context.getMainWindow, assertTrustedSender: desktopSenderAssertion(context) };
  const settings = createDesktopSettingsHandlers({ ...context, ...security });
  const playback = createDesktopPlaybackHandler({ ...context, ...security });
  const saveReport = createDiagnosticReportHandler(security);
  const data = createDesktopDataHandlers({ ...context, ...security });
  ipcMain.handle("desktop:get-settings", settings.getSettings);
  ipcMain.handle("desktop:audio-playback", playback);
  ipcMain.handle("desktop:save-diagnostic-report", saveReport);
  ipcMain.handle("desktop:update-settings", settings.updateSettings);
  ipcMain.handle("desktop:check-for-updates", settings.checkForUpdates);
  ipcMain.handle("desktop:reveal-data-directory", settings.revealDataDirectory);
  ipcMain.handle("desktop:select-legacy-data-directory", data.selectLegacyDirectory);
  ipcMain.handle("desktop:import-legacy-data", data.importLegacyData);
  ipcMain.handle("desktop:rollback-data-migration", data.rollbackDataMigration);
  if (context.dataBackup) {
    const backup = createDataBackupHandlers(security, context.dataBackup);
    ipcMain.handle("desktop:data-backup-state", backup.state);
    ipcMain.handle("desktop:data-backup-select", backup.select);
    ipcMain.handle("desktop:data-backup-preview", backup.preview);
    ipcMain.handle("desktop:data-backup-export", backup.export);
    ipcMain.handle("desktop:data-backup-import", backup.import);
    ipcMain.handle("desktop:data-backup-cancel", backup.cancel);
    ipcMain.handle("desktop:data-backup-rollback", backup.rollback);
    ipcMain.handle("desktop:data-backup-delete-point", backup.deletePoint);
  }
}
