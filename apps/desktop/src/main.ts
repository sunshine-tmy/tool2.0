import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from "electron";
import { BackendSupervisor } from "./backend-supervisor";
import {
  importDesktopData,
  recoverDesktopDataMigrations,
  rollbackDesktopData,
  type DesktopDataMigrationOptions
} from "./desktop-data-migration";
import { readDesktopSettings, updateDesktopSettings } from "./desktop-settings";
import { createDesktopRuntimeLayout, desktopBackendEntrypoint, desktopDataRoot } from "./runtime-layout";
import { isSafeExternalUrl, isTrustedBackendUrl } from "./window-security";

let mainWindow: BrowserWindow | undefined;
let backend: BackendSupervisor | undefined;
let backendOrigin: string | undefined;
let quitting = false;

const dataRoot = desktopDataRoot(process.env.LOCALAPPDATA, app.getPath("appData"));
fs.mkdirSync(path.join(dataRoot, "profile"), { recursive: true });
app.setPath("userData", path.join(dataRoot, "profile"));

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  void boot();
}

async function boot() {
  await app.whenReady();
  ipcMain.handle("desktop:get-version", () => app.getVersion());

  const layout = createDesktopRuntimeLayout({
    packaged: app.isPackaged,
    userDataRoot: dataRoot,
    resourcesPath: process.resourcesPath
  });

  try {
    // 在后端打开任何数据库或业务文件之前恢复未完成切换，防止半迁移目录被误认为有效数据。
    await recoverDesktopDataMigrations(migrationOptions(layout));
    backend = new BackendSupervisor({
      entrypoint: desktopBackendEntrypoint(app.isPackaged, process.resourcesPath),
      runtimeLayout: layout,
      onUnexpectedExit: (message) => {
        void dialog.showErrorBox("本地服务已停止", `${message}，请重新启动应用。`);
      }
    });
    registerDesktopIpc(layout);
    backendOrigin = await backend.start();
    backend.monitorUnexpectedExit();
    createWindow(backendOrigin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    dialog.showErrorBox("电商工具箱无法启动", message);
    app.exit(1);
  }
}

function registerDesktopIpc(layout: ReturnType<typeof createDesktopRuntimeLayout>) {
  const selectedLegacyDirectories = new Map<string, { path: string; expiresAt: number }>();
  const options = migrationOptions(layout);
  const assertTrustedSender = (event: IpcMainInvokeEvent) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error("未授权的桌面调用");
  };
  const currentSettings = async () => ({
    ...(await readDesktopSettings(layout.configRoot)),
    dataDirectory: layout.storageRoot
  });

  ipcMain.handle("desktop:get-settings", async (event) => {
    assertTrustedSender(event);
    return currentSettings();
  });
  ipcMain.handle("desktop:update-settings", async (event, value: unknown) => {
    assertTrustedSender(event);
    if (!isSettingsUpdate(value)) throw new Error("设置参数无效");
    if (value.startAtLogin !== undefined) app.setLoginItemSettings({ openAtLogin: value.startAtLogin });
    await updateDesktopSettings(layout.configRoot, value);
    return currentSettings();
  });
  ipcMain.handle("desktop:reveal-data-directory", async (event) => {
    assertTrustedSender(event);
    await fs.promises.mkdir(dataRoot, { recursive: true });
    const error = await shell.openPath(dataRoot);
    if (error) throw new Error("无法打开用户数据目录");
  });
  ipcMain.handle("desktop:select-legacy-data-directory", async (event) => {
    assertTrustedSender(event);
    const selected = await dialog.showOpenDialog(mainWindow!, {
      title: "选择旧版电商工具箱数据目录",
      buttonLabel: "选择此目录",
      properties: ["openDirectory", "dontAddToRecent"]
    });
    if (selected.canceled || !selected.filePaths[0]) return { canceled: true };
    const selectionId = crypto.randomBytes(18).toString("base64url");
    selectedLegacyDirectories.set(selectionId, {
      path: selected.filePaths[0],
      expiresAt: Date.now() + 10 * 60_000
    });
    return { canceled: false, selectionId, displayName: path.basename(selected.filePaths[0]) };
  });
  ipcMain.handle("desktop:import-legacy-data", async (event, selectionId: unknown) => {
    assertTrustedSender(event);
    const selected = typeof selectionId === "string" ? selectedLegacyDirectories.get(selectionId) : undefined;
    selectedLegacyDirectories.delete(typeof selectionId === "string" ? selectionId : "");
    if (!selected || selected.expiresAt < Date.now()) throw new Error("历史目录选择已失效，请重新选择");
    const result = await withBackendStopped(async () => {
      const migrated = await importDesktopData(options, selected.path);
      await updateDesktopSettings(layout.configRoot, {
        lastMigration: {
          id: migrated.id,
          status: "imported",
          completedAt: new Date().toISOString(),
          files: migrated.source.files,
          bytes: migrated.source.bytes
        }
      });
      return migrated;
    });
    return result;
  });
  ipcMain.handle("desktop:rollback-data-migration", async (event, migrationId: unknown) => {
    assertTrustedSender(event);
    if (typeof migrationId !== "string") throw new Error("迁移编号无效");
    const result = await withBackendStopped(async () => {
      const rolledBack = await rollbackDesktopData(options, migrationId);
      await updateDesktopSettings(layout.configRoot, {
        lastMigration: {
          id: rolledBack.id,
          status: "rolled-back",
          completedAt: new Date().toISOString(),
          files: rolledBack.restored.files,
          bytes: rolledBack.restored.bytes
        }
      });
      return rolledBack;
    });
    return result;
  });
}

async function withBackendStopped<T>(operation: () => Promise<T>) {
  if (!backend) throw new Error("本地服务尚未启动");
  await backend.stop();
  let result: T | undefined;
  let operationError: unknown;
  try {
    result = await operation();
  } catch (error) {
    operationError = error;
  }
  try {
    backendOrigin = await backend.start();
    backend.monitorUnexpectedExit();
    if (mainWindow && backendOrigin) await mainWindow.loadURL(backendOrigin);
  } catch (restartError) {
    throw new Error(`本地服务重启失败：${message(restartError)}`);
  }
  if (operationError) throw operationError;
  return result!;
}

function migrationOptions(layout: ReturnType<typeof createDesktopRuntimeLayout>): DesktopDataMigrationOptions {
  return { dataRoot, storageRoot: layout.storageRoot, configRoot: layout.configRoot };
}

function isSettingsUpdate(value: unknown): value is { startAtLogin?: boolean; automaticUpdateChecks?: boolean } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const update = value as Record<string, unknown>;
  if (Object.keys(update).some((key) => key !== "startAtLogin" && key !== "automaticUpdateChecks")) return false;
  return (
    (update.startAtLogin === undefined || typeof update.startAtLogin === "boolean") &&
    (update.automaticUpdateChecks === undefined || typeof update.automaticUpdateChecks === "boolean")
  );
}

function message(error: unknown) {
  return error instanceof Error && error.message ? error.message : "未知错误";
}

function createWindow(origin: string) {
  const preload = path.join(path.dirname(fileURLToPath(import.meta.url)), "preload.cjs");
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isTrustedBackendUrl(url, origin)) return;
    event.preventDefault();
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  void mainWindow.loadURL(origin);
}

app.on("window-all-closed", () => app.quit());
app.on("before-quit", (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  void (backend?.stop() ?? Promise.resolve()).finally(() => app.exit(0));
});
