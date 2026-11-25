import { app, BrowserWindow, Menu, shell } from "electron";
import { isSafeExternalUrl, isTrustedBackendUrl } from "../security/window-security";
type BusinessWindowOptions = {
  origin: string;
  preload: string;
  desktopIconPath?: string;
  getMainWindow: () => BrowserWindow | undefined;
  onCreated: (window: BrowserWindow) => void;
  closeStartupMigration: () => void;
  isQuitting: () => boolean;
  hideWindow: (window: BrowserWindow) => boolean;
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
    ...(process.platform === "win32"
      ? {
          titleBarStyle: "hidden" as const,
          titleBarOverlay: { height: 44, color: "#faf9ff", symbolColor: "#243047" }
        }
      : {}),
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  context.onCreated(mainWindow);
  context.closeStartupMigration();
  const allowFullscreen = (permission: string) => permission === "fullscreen" || permission === "automatic-fullscreen";
  mainWindow.webContents.session.setPermissionCheckHandler((_contents, permission) => allowFullscreen(permission));
  mainWindow.webContents.session.setPermissionRequestHandler((_contents, permission, callback) =>
    callback(allowFullscreen(permission))
  );
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("context-menu", (_event, params) => {
    if (!params.isEditable && !params.selectionText) return;
    const { canCut, canCopy, canPaste, canSelectAll } = params.editFlags;
    Menu.buildFromTemplate([
      { role: "cut", label: "剪切", enabled: params.isEditable && canCut },
      { role: "copy", label: "复制", enabled: canCopy },
      { role: "paste", label: "粘贴", enabled: params.isEditable && canPaste },
      { type: "separator" },
      { role: "selectAll", label: "全选", enabled: canSelectAll }
    ]).popup({ window: mainWindow });
  });
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (process.platform !== "darwin" || input.type !== "keyDown" || !input.meta || input.control || input.alt) return;
    const key = input.key.toLowerCase();
    const contents = mainWindow.webContents;
    if (input.shift && key === "z") contents.redo();
    else if (input.shift) return;
    else if (key === "c") contents.copy();
    else if (key === "x") contents.cut();
    else if (key === "v") contents.paste();
    else if (key === "a") contents.selectAll();
    else if (key === "z") contents.undo();
    else return;
    event.preventDefault();
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
    if (context.hideWindow(mainWindow)) return;
    // Windows needs a tray recovery entry; macOS can always restore through its Dock icon.
    app.quit();
  });
  await mainWindow.loadURL(origin);
}
