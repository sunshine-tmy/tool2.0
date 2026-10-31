import { Menu, nativeImage, Tray, type BrowserWindow } from "electron";

type SystemTrayOptions = {
  iconPath?: string;
  platform: NodeJS.Platform;
  isQuitting: () => boolean;
  showWindow: () => void;
  quit: () => void;
};

/** App-owned tray. A window is hidden only after its recovery entry is available. */
export function createSystemTray(context: SystemTrayOptions) {
  let tray: Tray | undefined;
  let attached: { window: BrowserWindow; minimize: () => void; closed: () => void } | undefined;

  function detach() {
    if (!attached) return;
    attached.window.removeListener("minimize", attached.minimize);
    attached.window.removeListener("closed", attached.closed);
    attached = undefined;
  }
  function hideWindow(window: BrowserWindow) {
    if (!context.isQuitting() && tray && !tray.isDestroyed() && !window.isDestroyed()) window.hide();
  }
  function attach(window: BrowserWindow) {
    // Keep the existing Dock/window behavior on other operating systems.
    if (context.platform !== "win32" || !context.iconPath || context.isQuitting()) return;
    if (!tray || tray.isDestroyed()) {
      let candidate: Tray | undefined;
      try {
        const icon = nativeImage.createFromPath(context.iconPath);
        if (icon.isEmpty()) throw new Error("系统托盘图标不可用");
        candidate = new Tray(icon);
        candidate.setToolTip("电商工具箱 · 后台运行");
        candidate.setContextMenu(
          Menu.buildFromTemplate([
            { label: "显示主窗口", click: context.showWindow },
            {
              label: "最小化到托盘",
              click: () => {
                if (attached) hideWindow(attached.window);
              }
            },
            { type: "separator" },
            { label: "退出电商工具箱", click: context.quit }
          ])
        );
        candidate.on("click", context.showWindow);
        candidate.on("double-click", context.showWindow);
        tray = candidate;
      } catch (error) {
        if (candidate && !candidate.isDestroyed()) candidate.destroy();
        console.warn("系统托盘初始化失败，将保留普通最小化行为", error);
        return;
      }
    }
    detach();
    const minimize = () => hideWindow(window);
    const closed = () => {
      if (attached?.window === window) detach();
    };
    attached = { window, minimize, closed };
    window.on("minimize", minimize);
    window.once("closed", closed);
  }
  function dispose() {
    detach();
    if (tray && !tray.isDestroyed()) tray.destroy();
    tray = undefined;
  }
  return { attach, dispose };
}
