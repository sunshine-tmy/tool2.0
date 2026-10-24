import { app, BrowserWindow, session } from "electron";
import type { StartupDataMigrationState } from "@toolbox/shared/desktop";
import { startupMigrationHtml } from "../windows/startup-migration-page";
import { registerStartupMigrationIpc } from "../ipc/startup-migration-ipc";
type StartupMigrationFlowOptions = {
  preload: string;
  desktopIconPath?: string;
  dataRoot: string;
  legacyDataRoot: string;
  isOperation: () => boolean;
  setOperation: (active: boolean) => void;
};
export function createStartupMigrationFlow(options: StartupMigrationFlowOptions) {
  const { preload, desktopIconPath } = options;
  let startupMigrationWindow: BrowserWindow | undefined,
    startupMigrationState: StartupDataMigrationState | undefined,
    startupMigrationResolve: ((completed: boolean) => void) | undefined,
    startupMigrationCompleted = false,
    registered = false;
  async function showStartupMigrationWindow(state: StartupDataMigrationState) {
    startupMigrationState = state;
    startupMigrationCompleted = false;
    const completion = new Promise<boolean>((resolve) => {
      startupMigrationResolve = resolve;
    });
    startupMigrationWindow = new BrowserWindow({
      title: "电商工具箱 · 首次启动数据迁移",
      ...(desktopIconPath ? { icon: desktopIconPath } : {}),
      width: 720,
      height: 620,
      minWidth: 620,
      minHeight: 560,
      resizable: true,
      autoHideMenuBar: true,
      webPreferences: {
        preload,
        // The bootstrap window must not leave cache files in profile while that
        // directory is being atomically replaced by the legacy profile copy.
        session: session.fromPartition("desktop-startup-migration", { cache: false }),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });
    startupMigrationWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    startupMigrationWindow.on("close", (event) => {
      if (options.isOperation()) {
        event.preventDefault();
        app.quit();
      }
    });
    startupMigrationWindow.on("closed", () => {
      startupMigrationWindow = undefined;
      if (!startupMigrationCompleted) {
        startupMigrationResolve?.(false);
        startupMigrationResolve = undefined;
        app.quit();
      }
    });
    const preloadEntry = startupMigrationHtml();
    try {
      await startupMigrationWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(preloadEntry)}`);
    } catch (error) {
      startupMigrationWindow.destroy();
      startupMigrationWindow = undefined;
      startupMigrationResolve = undefined;
      throw error;
    }
    return completion;
  }
  function completeStartupMigration() {
    startupMigrationCompleted = true;
    startupMigrationResolve?.(true);
    startupMigrationResolve = undefined;
  }
  function registerIpc() {
    if (registered) return;
    registerStartupMigrationIpc({
      ...options,
      getWindow: () => startupMigrationWindow,
      getState: () => startupMigrationState,
      setState: (state) => {
        startupMigrationState = state;
      },
      completeStartupMigration
    });
    registered = true;
  }
  function closeForMainWindow() {
    if (startupMigrationWindow) {
      startupMigrationWindow.close();
      startupMigrationWindow = undefined;
    }
  }
  return {
    registerIpc,
    show: showStartupMigrationWindow,
    getState: () => startupMigrationState,
    setState: (state: StartupDataMigrationState) => {
      startupMigrationState = state;
    },
    closeForMainWindow
  };
}
