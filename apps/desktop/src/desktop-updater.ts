/** 中文模块说明：桌面壳更新层，负责只从 electron-builder 写入的 HTTPS feed 检查和安装更新。 */
import fs from "node:fs";
import { createRequire } from "node:module";
import { dialog, type BrowserWindow } from "electron";
import type { AppUpdater } from "electron-updater";
import { readDesktopUpdateFeed } from "./desktop-update-feed";

// electron-updater is CommonJS. Loading it through createRequire keeps the
// packaged ESM main process compatible with Node's strict CJS named-export rules.
const require = createRequire(import.meta.url);
let updaterModule: typeof import("electron-updater") | undefined;

export function getDesktopAutoUpdater(): AppUpdater {
  return (updaterModule ??= require("electron-updater")).autoUpdater;
}

export type DesktopUpdateSettings = { automaticUpdateChecks: boolean };

type DesktopUpdaterOptions = {
  resourcesPath: string;
  packaged: boolean;
  platform: NodeJS.Platform;
  getWindow: () => BrowserWindow | undefined;
  installDownloadedUpdate: () => Promise<void>;
  log: (message: string, error?: unknown) => void;
};

export type DesktopUpdater = {
  isEnabled: boolean;
  checkForUpdates: () => Promise<{ enabled: boolean; checking: boolean }>;
};

export function createDesktopUpdater(options: DesktopUpdaterOptions): DesktopUpdater {
  const autoUpdater = getDesktopAutoUpdater();
  const feedUrl = readDesktopUpdateFeed(options.resourcesPath);
  const isEnabled = Boolean(
    options.packaged && options.platform === "win32" && feedUrl && fs.existsSync(options.resourcesPath)
  );
  let checking = false;
  let downloaded = false;

  if (!isEnabled || !feedUrl) {
    return { isEnabled: false, checkForUpdates: async () => ({ enabled: false, checking: false }) };
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on("error", (error) => {
    checking = false;
    options.log("Desktop update check failed", error);
  });
  autoUpdater.on("update-not-available", () => {
    checking = false;
  });
  autoUpdater.on("update-available", () => {
    checking = false;
  });
  autoUpdater.on("update-downloaded", (event) => {
    checking = false;
    if (downloaded) return;
    downloaded = true;
    const window = options.getWindow();
    if (!window) return;
    void dialog
      .showMessageBox(window, {
        type: "info",
        title: "更新已准备就绪",
        message: `已下载${event.version ? ` ${event.version}` : "新版本"}，是否立即重启并安装？`,
        detail: "稍后退出应用时也会应用此更新。",
        buttons: ["立即重启并安装", "稍后"],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      })
      .then(({ response }) => (response === 0 ? options.installDownloadedUpdate() : undefined))
      .catch((error) => options.log("Desktop update installation prompt failed", error));
  });

  return {
    isEnabled: true,
    async checkForUpdates() {
      if (checking || downloaded) return { enabled: true, checking };
      checking = true;
      try {
        await autoUpdater.checkForUpdates();
      } catch (error) {
        checking = false;
        options.log("Desktop update check could not start", error);
      }
      return { enabled: true, checking };
    }
  };
}

export function scheduleAutomaticUpdateCheck(
  updater: DesktopUpdater,
  settings: DesktopUpdateSettings
): NodeJS.Timeout | undefined {
  if (!updater.isEnabled || !settings.automaticUpdateChecks) return;
  // Leave the first interactive paint fast before opening the release feed.
  const timer = setTimeout(() => void updater.checkForUpdates(), 10_000);
  timer.unref();
  return timer;
}
