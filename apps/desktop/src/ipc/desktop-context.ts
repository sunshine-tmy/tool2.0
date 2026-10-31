import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import type { RuntimeLayout } from "@toolbox/runtime-core";
import type { DesktopDataMigrationOptions } from "../data/desktop-data-migration";
import type { DesktopUpdater } from "../updates/desktop-updater";
export type DesktopIpcContext = {
  layout: RuntimeLayout;
  installRoot: string;
  dataRoot: string;
  getMainWindow: () => BrowserWindow | undefined;
  getBackendOrigin: () => string | undefined;
  getUpdater: () => DesktopUpdater;
  setPlaybackActive: (active: boolean) => void;
  scheduleConfiguredUpdateCheck: (updater: DesktopUpdater, settings: { automaticUpdateChecks: boolean }) => void;
  migrationOptions: DesktopDataMigrationOptions;
  withBackendStopped: ReturnType<typeof import("../app/maintenance").createDesktopMaintenance>["withBackendStopped"];
  dataBackup?: import("../data/data-backup").DesktopDataBackup;
};
export type DesktopIpcSecurity = {
  assertTrustedSender: (event: IpcMainInvokeEvent) => void;
  getMainWindow: DesktopIpcContext["getMainWindow"];
};
