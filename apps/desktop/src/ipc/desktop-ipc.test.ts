import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWindow } from "electron";
import { createRuntimeLayout } from "@toolbox/runtime-core";
import { registerDesktopIpc } from "./register-desktop-ipc";
const mock = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  login: vi.fn(),
  open: vi.fn(),
  save: vi.fn(),
  reveal: vi.fn(),
  mkdir: vi.fn(),
  write: vi.fn(),
  readSettings: vi.fn(),
  updateSettings: vi.fn(),
  importData: vi.fn(),
  rollback: vi.fn()
}));
vi.mock("electron", () => ({
  app: { setLoginItemSettings: mock.login },
  ipcMain: {
    handle: (name: string, handler: (...args: unknown[]) => unknown) => {
      if (mock.handlers.has(name)) throw Error("duplicate channel");
      mock.handlers.set(name, handler);
    }
  },
  dialog: { showOpenDialog: mock.open, showSaveDialog: mock.save },
  shell: { openPath: mock.reveal }
}));
vi.mock("node:fs", () => ({ default: { promises: { mkdir: mock.mkdir, writeFile: mock.write } } }));
vi.mock("../data/desktop-settings", () => ({
  readDesktopSettings: mock.readSettings,
  updateDesktopSettings: mock.updateSettings
}));
vi.mock("../data/desktop-data-migration", () => ({
  importDesktopData: mock.importData,
  rollbackDesktopData: mock.rollback
}));
const channels = [
  "desktop:get-settings",
  "desktop:audio-playback",
  "desktop:save-diagnostic-report",
  "desktop:update-settings",
  "desktop:check-for-updates",
  "desktop:reveal-data-directory",
  "desktop:select-legacy-data-directory",
  "desktop:import-legacy-data",
  "desktop:rollback-data-migration"
];
const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform")!;
function setup() {
  const contents = { mainFrame: { url: "http://127.0.0.1:43210/settings" }, setBackgroundThrottling: vi.fn() };
  const mainWindow = { webContents: contents } as unknown as BrowserWindow;
  let origin: string | undefined = "http://127.0.0.1:43210",
    window: BrowserWindow | undefined = mainWindow;
  const layout = createRuntimeLayout({ appRoot: "synthetic-app", configRoot: "synthetic-config" });
  const updater = { isEnabled: true, checkForUpdates: vi.fn(async () => ({ enabled: true, checking: true })) };
  const schedule = vi.fn(),
    playback = vi.fn(),
    withBackendStopped = vi.fn();
  const migrationOptions = { dataRoot: "fixed-data", storageRoot: layout.storageRoot, configRoot: layout.configRoot };
  registerDesktopIpc({
    layout,
    installRoot: "fixed-install",
    dataRoot: "fixed-data",
    getMainWindow: () => window,
    getBackendOrigin: () => origin,
    getUpdater: () => updater,
    setPlaybackActive: playback,
    scheduleConfiguredUpdateCheck: schedule,
    migrationOptions,
    withBackendStopped: async <T>(operation: () => Promise<T>) => {
      withBackendStopped();
      return operation();
    }
  });
  const event = { sender: contents, senderFrame: contents.mainFrame };
  const invoke = (name: string, ...args: unknown[]) => mock.handlers.get(name)!(event, ...args);
  return {
    contents,
    event,
    invoke,
    layout,
    updater,
    schedule,
    playback,
    withBackendStopped,
    migrationOptions,
    setOrigin: (value: string | undefined) => {
      origin = value;
    },
    closeWindow: () => {
      window = undefined;
    }
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.handlers.clear();
  mock.readSettings.mockResolvedValue({ schemaVersion: 1, startAtLogin: false, automaticUpdateChecks: true });
  mock.updateSettings.mockResolvedValue({ automaticUpdateChecks: true });
  mock.open.mockResolvedValue({ canceled: false, filePaths: ["C:\\synthetic\\legacy"] });
  mock.save.mockResolvedValue({ canceled: true });
  mock.reveal.mockResolvedValue("");
  mock.mkdir.mockResolvedValue(undefined);
  mock.write.mockResolvedValue(undefined);
  mock.importData.mockResolvedValue({ id: "migration", source: { files: 2, bytes: 10 } });
  mock.rollback.mockResolvedValue({ id: "migration", restored: { files: 2, bytes: 10 } });
});
afterEach(() => {
  Object.defineProperty(process, "platform", originalPlatform);
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe("fixed desktop IPC capabilities", () => {
  it("registers exactly the existing methods in the original order and refuses unknown windows, frames and origins", async () => {
    const s = setup();
    expect([...mock.handlers.keys()]).toEqual(channels);
    for (const channel of channels)
      for (const event of [
        { sender: {}, senderFrame: s.contents.mainFrame },
        { ...s.event, senderFrame: {} },
        { sender: s.contents, senderFrame: { ...s.contents.mainFrame, url: "https://untrusted.test" } }
      ])
        await expect(Promise.resolve().then(() => mock.handlers.get(channel)!(event))).rejects.toThrow(
          "未授权的桌面调用"
        );
    s.contents.mainFrame.url = "https://untrusted.test";
    await expect(Promise.resolve().then(() => s.invoke("desktop:get-settings"))).rejects.toThrow("未授权");
    s.contents.mainFrame.url = "http://127.0.0.1:43210/settings";
    s.setOrigin(undefined);
    await expect(Promise.resolve().then(() => s.invoke("desktop:get-settings"))).rejects.toThrow("未授权");
    s.closeWindow();
    expect(() => s.invoke("desktop:audio-playback", false)).toThrow("未授权");
  });
  it("updates only boolean playback and returns the same fixed settings/path projection", async () => {
    const s = setup();
    s.invoke("desktop:audio-playback", true);
    expect(s.playback).toHaveBeenCalledWith(true);
    expect(s.contents.setBackgroundThrottling).toHaveBeenCalledWith(false);
    expect(() => s.invoke("desktop:audio-playback", "true")).toThrow("无效的播放状态");
    expect(await s.invoke("desktop:get-settings")).toMatchObject({
      dataDirectory: "fixed-data",
      installDirectory: "fixed-install",
      platform: process.platform === "darwin" ? "darwin" : "win32"
    });
    await s.invoke("desktop:reveal-data-directory", "arbitrary-path");
    expect(mock.reveal).toHaveBeenCalledWith("fixed-data");
    mock.reveal.mockResolvedValueOnce("failure");
    await expect(s.invoke("desktop:reveal-data-directory")).rejects.toThrow("无法打开");
  });
  it("preserves preference acceptance, rejects extra fields, and schedules the current updater", async () => {
    const s = setup();
    await s.invoke("desktop:update-settings", { startAtLogin: true });
    expect(mock.login).toHaveBeenCalledWith({ openAtLogin: true });
    expect(mock.updateSettings).toHaveBeenCalledWith(s.layout.configRoot, { startAtLogin: true });
    expect(s.schedule).toHaveBeenCalledWith(s.updater, { automaticUpdateChecks: true });
    for (const value of [null, [], { path: "any" }, { startAtLogin: 1 }])
      await expect(s.invoke("desktop:update-settings", value)).rejects.toThrow("设置参数无效");
    expect(await s.invoke("desktop:check-for-updates")).toEqual({ enabled: true, checking: true });
  });
  it("retains macOS update restrictions without changing data-root choices", async () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    const s = setup();
    expect(await s.invoke("desktop:get-settings")).toMatchObject({
      platform: "darwin",
      automaticUpdateChecks: false,
      updateChecksSupported: false,
      dataDirectory: "fixed-data"
    });
    await expect(s.invoke("desktop:update-settings", { automaticUpdateChecks: true })).rejects.toThrow("macOS");
    expect(await s.invoke("desktop:check-for-updates")).toEqual({ enabled: false, checking: false });
    expect(s.updater.checkForUpdates).not.toHaveBeenCalled();
  });
  it("exports only validated diagnostic envelopes through the user-approved save selection", async () => {
    const s = setup();
    for (const content of [1, "x".repeat(256001), JSON.stringify({ application: "other", schemaVersion: 1 })])
      await expect(s.invoke("desktop:save-diagnostic-report", content)).rejects.toThrow();
    const content = JSON.stringify({ application: "ecommerce-toolbox", schemaVersion: 1 });
    await s.invoke("desktop:save-diagnostic-report", content);
    expect(mock.write).not.toHaveBeenCalled();
    mock.save.mockResolvedValueOnce({ canceled: false, filePath: "synthetic-selected-report.json" });
    await s.invoke("desktop:save-diagnostic-report", content);
    expect(mock.write).toHaveBeenCalledWith("synthetic-selected-report.json", content, "utf8");
  });
  it("accepts only one-use unexpired main-process directory selections, not renderer paths", async () => {
    vi.useFakeTimers();
    const s = setup();
    await expect(s.invoke("desktop:import-legacy-data", "C:\\arbitrary")).rejects.toThrow("选择已失效");
    const selected = (await s.invoke("desktop:select-legacy-data-directory")) as { selectionId: string };
    await s.invoke("desktop:import-legacy-data", selected.selectionId);
    expect(mock.importData).toHaveBeenCalledWith(s.migrationOptions, "C:\\synthetic\\legacy");
    expect(s.withBackendStopped).toHaveBeenCalledOnce();
    expect(mock.updateSettings).toHaveBeenCalledWith(s.layout.configRoot, {
      lastMigration: expect.objectContaining({ id: "migration", status: "imported", files: 2, bytes: 10 })
    });
    await expect(s.invoke("desktop:import-legacy-data", selected.selectionId)).rejects.toThrow("选择已失效");
    const expired = (await s.invoke("desktop:select-legacy-data-directory")) as { selectionId: string };
    await vi.advanceTimersByTimeAsync(600001);
    await expect(s.invoke("desktop:import-legacy-data", expired.selectionId)).rejects.toThrow("选择已失效");
    expect(mock.importData).toHaveBeenCalledOnce();
  });
  it("keeps cancellation inert and performs rollback through the same maintenance boundary", async () => {
    const s = setup();
    mock.open.mockResolvedValueOnce({ canceled: true, filePaths: [] });
    expect(await s.invoke("desktop:select-legacy-data-directory")).toEqual({ canceled: true });
    await expect(s.invoke("desktop:rollback-data-migration", 10)).rejects.toThrow("迁移编号无效");
    await s.invoke("desktop:rollback-data-migration", "migration");
    expect(mock.rollback).toHaveBeenCalledWith(s.migrationOptions, "migration");
    expect(mock.updateSettings).toHaveBeenCalledWith(s.layout.configRoot, {
      lastMigration: expect.objectContaining({ status: "rolled-back" })
    });
    expect(s.withBackendStopped).toHaveBeenCalledOnce();
  });
});
