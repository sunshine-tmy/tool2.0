import { Menu, nativeImage, Tray, type BrowserWindow } from "electron";

type SystemTrayOptions = {
  iconPath?: string;
  platform: NodeJS.Platform;
  isQuitting: () => boolean;
  showWindow: () => void;
  quit: () => void;
};

/** App-owned Windows tray and macOS status item. */
export function createSystemTray(context: SystemTrayOptions) {
  let tray: Tray | undefined;
  let attached: { window: BrowserWindow; closed: () => void } | undefined;

  function detach() {
    if (!attached) return;
    attached.window.removeListener("closed", attached.closed);
    attached = undefined;
  }
  function hideWindow(window: BrowserWindow) {
    if (
      (context.platform !== "win32" && context.platform !== "darwin") ||
      context.isQuitting() ||
      window.isDestroyed() ||
      attached?.window !== window
    )
      return false;
    // The Dock is always a recovery path on macOS, even if the status item failed.
    if (context.platform === "win32" && (!tray || tray.isDestroyed())) return false;
    window.hide();
    return true;
  }
  function attach(window: BrowserWindow) {
    const supportsStatusItem = context.platform === "win32" || context.platform === "darwin";
    if (!supportsStatusItem || context.isQuitting()) return;
    if ((!tray || tray.isDestroyed()) && context.iconPath) {
      let candidate: Tray | undefined;
      try {
        const icon = nativeImage.createFromPath(context.iconPath);
        if (icon.isEmpty()) throw new Error("系统托盘图标不可用");
        if (context.platform === "darwin") icon.setTemplateImage(true);
        candidate = new Tray(icon);
        candidate.setToolTip("电商工具箱 · 后台运行");
        candidate.setContextMenu(
          Menu.buildFromTemplate([
            { label: "显示主窗口", click: context.showWindow },
            {
              label: context.platform === "darwin" ? "隐藏主窗口" : "隐藏到托盘",
              click: () => {
                if (attached) hideWindow(attached.window);
              }
            },
            { type: "separator" },
            { label: "退出电商工具箱", click: context.quit }
          ])
        );
        candidate.on("click", () => {
          if (
            context.platform === "darwin" &&
            attached &&
            !attached.window.isDestroyed() &&
            attached.window.isVisible()
          ) {
            hideWindow(attached.window);
            return;
          }
          context.showWindow();
        });
        candidate.on("double-click", context.showWindow);
        tray = candidate;
      } catch (error) {
        if (candidate && !candidate.isDestroyed()) candidate.destroy();
        console.warn("系统托盘初始化失败，将保留普通窗口行为和安全退出入口", error);
        // macOS can still hide and restore through its Dock icon.
        if (context.platform !== "darwin") return;
      }
    } else if (!context.iconPath && context.platform !== "darwin") {
      return;
    }
    detach();
    const closed = () => {
      if (attached?.window === window) detach();
    };
    attached = { window, closed };
    window.once("closed", closed);
  }
  function dispose() {
    detach();
    if (tray && !tray.isDestroyed()) tray.destroy();
    tray = undefined;
  }
  return { attach, hideWindow, dispose };
}
