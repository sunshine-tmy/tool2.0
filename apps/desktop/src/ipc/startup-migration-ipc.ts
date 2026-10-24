import { app, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import {
  chooseFreshDesktopData,
  migrateLegacyDesktopData,
  prepareStartupDataMigration
} from "../data/desktop-root-migration";
import type { StartupDataMigrationState, DesktopRootMigrationResult } from "@toolbox/shared/desktop";
type StartupMigrationIpcContext = {
  dataRoot: string;
  legacyDataRoot: string;
  getWindow: () => BrowserWindow | undefined;
  getState: () => StartupDataMigrationState | undefined;
  setState: (state: StartupDataMigrationState) => void;
  isOperation: () => boolean;
  setOperation: (active: boolean) => void;
  completeStartupMigration: () => void;
};
export function registerStartupMigrationIpc(context: StartupMigrationIpcContext) {
  const {
    getWindow,
    getState,
    setState,
    isOperation,
    setOperation,
    dataRoot,
    legacyDataRoot,
    completeStartupMigration
  } = context;
  const assertMigrationSender = (event: IpcMainInvokeEvent) => {
    if (!getWindow() || event.sender !== getWindow()!.webContents) {
      throw new Error("未授权的首次启动迁移调用");
    }
  };

  ipcMain.handle("desktop:get-startup-data-migration", (event) => {
    assertMigrationSender(event);
    if (!getState()) throw new Error("首次启动迁移状态不可用");
    return getState()!;
  });
  ipcMain.handle("desktop:migrate-startup-data", async (event): Promise<DesktopRootMigrationResult | void> => {
    assertMigrationSender(event);
    if (isOperation()) throw new Error("数据迁移尚未结束");
    if (!getState()?.required) throw new Error("当前没有待迁移的旧版数据");
    setOperation(true);
    try {
      let result: Awaited<ReturnType<typeof migrateLegacyDesktopData>>;
      try {
        result = await migrateLegacyDesktopData({ dataRoot, legacyDataRoot });
      } catch (error) {
        try {
          setState(await prepareStartupDataMigration({ dataRoot, legacyDataRoot }));
          if (!getState()!.required) {
            completeStartupMigration();
            return;
          }
        } catch {
          // Preserve the actionable error from the failed attempt; an incomplete
          // journal remains on disk for the next startup recovery pass.
        }
        throw error;
      }
      setState({
        required: false,
        destinationDirectory: dataRoot,
        sourceBytes: result.bytes,
        sourceFiles: result.files
      });
      completeStartupMigration();
      return result;
    } finally {
      setOperation(false);
    }
  });
  ipcMain.handle("desktop:choose-fresh-startup-data", async (event) => {
    assertMigrationSender(event);
    if (isOperation()) throw new Error("数据迁移尚未结束");
    setOperation(true);
    try {
      await chooseFreshDesktopData({ dataRoot, legacyDataRoot });
      setState(await prepareStartupDataMigration({ dataRoot, legacyDataRoot }));
      completeStartupMigration();
    } finally {
      setOperation(false);
    }
  });
  ipcMain.handle("desktop:exit-startup-migration", (event) => {
    assertMigrationSender(event);
    app.quit();
  });
}
