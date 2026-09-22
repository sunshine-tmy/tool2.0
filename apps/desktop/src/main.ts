import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { BackendSupervisor } from "./backend-supervisor";
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
  backend = new BackendSupervisor({
    entrypoint: desktopBackendEntrypoint(app.isPackaged, process.resourcesPath),
    runtimeLayout: layout,
    onUnexpectedExit: (message) => {
      void dialog.showErrorBox("本地服务已停止", `${message}，请重新启动应用。`);
    }
  });

  try {
    backendOrigin = await backend.start();
    backend.monitorUnexpectedExit();
    createWindow(backendOrigin);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    dialog.showErrorBox("电商工具箱无法启动", message);
    app.exit(1);
  }
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
