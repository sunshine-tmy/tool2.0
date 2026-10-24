import { app, shell, type IpcMainInvokeEvent } from "electron";
import fs from "node:fs";
import { readDesktopSettings, updateDesktopSettings } from "../data/desktop-settings";
import type { DesktopSettingsState, DesktopUpdateCheck } from "@toolbox/shared/desktop";
import type { DesktopIpcContext, DesktopIpcSecurity } from "./desktop-context";
export function createDesktopSettingsHandlers(
  context: Pick<
    DesktopIpcContext,
    "layout" | "installRoot" | "dataRoot" | "getUpdater" | "scheduleConfiguredUpdateCheck"
  > &
    DesktopIpcSecurity
) {
  const { layout, installRoot, dataRoot, getUpdater, scheduleConfiguredUpdateCheck, assertTrustedSender } = context;
  const currentSettings = async (): Promise<DesktopSettingsState> => {
    const saved = await readDesktopSettings(layout.configRoot);
    return {
      ...saved,
      platform: process.platform === "darwin" ? "darwin" : "win32",
      automaticUpdateChecks: process.platform === "darwin" ? false : saved.automaticUpdateChecks,
      installDirectory: installRoot,
      dataDirectory: dataRoot,
      dataDirectoryDescription:
        process.platform === "darwin"
          ? "应用支持目录；移动或替换应用时数据仍会保留。"
          : "安装目录下的 data 文件夹；卸载时默认保留。",
      updateChecksSupported: process.platform === "win32"
    };
  };
  return {
    getSettings: async (event: IpcMainInvokeEvent) => {
      assertTrustedSender(event);
      return currentSettings();
    },
    updateSettings: async (event: IpcMainInvokeEvent, value: unknown) => {
      assertTrustedSender(event);
      if (!isSettingsUpdate(value)) throw new Error("设置参数无效");
      if (process.platform === "darwin" && value.automaticUpdateChecks !== undefined) {
        throw new Error("当前 macOS 内部测试版尚未配置自动更新源");
      }
      if (value.startAtLogin !== undefined) app.setLoginItemSettings({ openAtLogin: value.startAtLogin });
      const settings = await updateDesktopSettings(layout.configRoot, value);
      scheduleConfiguredUpdateCheck(getUpdater(), settings);
      return currentSettings();
    },
    checkForUpdates: async (event: IpcMainInvokeEvent): Promise<DesktopUpdateCheck> => {
      assertTrustedSender(event);
      if (process.platform === "darwin") return { enabled: false, checking: false };
      return getUpdater().checkForUpdates();
    },
    revealDataDirectory: async (event: IpcMainInvokeEvent) => {
      assertTrustedSender(event);
      await fs.promises.mkdir(dataRoot, { recursive: true });
      const error = await shell.openPath(dataRoot);
      if (error) throw new Error("无法打开用户数据目录");
    }
  };
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
