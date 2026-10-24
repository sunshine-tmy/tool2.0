import { ipcMain } from "electron";
import type { DesktopIpcContext } from "./desktop-context";
import { desktopSenderAssertion } from "./trusted-desktop-sender";
import { createDesktopSettingsHandlers } from "./settings";
import { createDesktopPlaybackHandler } from "./playback";
import { createDiagnosticReportHandler } from "./diagnostic-report";
import { createDesktopDataHandlers } from "./data-migration";
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
}
