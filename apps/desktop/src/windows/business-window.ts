import { app, BrowserWindow, shell } from "electron";
import { isSafeExternalUrl, isTrustedBackendUrl } from "../security/window-security";
type BusinessWindowOptions = {
  origin: string;
  preload: string;
  desktopIconPath?: string;
  getMainWindow: () => BrowserWindow | undefined;
  onCreated: (window: BrowserWindow) => void;
  closeStartupMigration: () => void;
  isQuitting: () => boolean;
};
export async function createBusinessWindow(context: BusinessWindowOptions) {
  const { origin, preload, desktopIconPath } = context;
  const mainWindow = new BrowserWindow({
    ...(desktopIconPath ? { icon: desktopIconPath } : {}),
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
  context.onCreated(mainWindow);
  context.closeStartupMigration();
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
  mainWindow.once("ready-to-show", () => context.getMainWindow()?.show());
  mainWindow.on("close", (event) => {
    if (context.isQuitting()) return;
    event.preventDefault();
    app.quit();
  });
  await mainWindow.loadURL(origin);
}
