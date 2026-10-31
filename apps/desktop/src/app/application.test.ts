import type { BrowserWindow } from "electron";
import type { StartupDataMigrationState } from "@toolbox/shared/desktop";
import type { DesktopIpcContext } from "../ipc/desktop-context";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDesktopApplication } from "./application";
type BackendOptions = {
  onUnexpectedExit: (message: string) => void;
  onStage: (stage: string) => void;
  onShutdownStage: (stage: string) => void;
};
type DiagnosticsOptions = { retry: () => Promise<void>; preload: string };
type TrayOptions = { showWindow: () => void; quit: () => void; isQuitting: () => boolean };
const mock = vi.hoisted(() => ({
  events: [] as string[],
  backendOptions: [] as BackendOptions[],
  diagnosticsOptions: [] as DiagnosticsOptions[],
  terminated: true,
  init: vi.fn(),
  ready: vi.fn(),
  stage: vi.fn(),
  show: vi.fn(),
  fail: vi.fn(),
  entered: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  inspect: vi.fn(),
  monitor: vi.fn(),
  resolveProxy: vi.fn(),
  prepare: vi.fn(),
  recover: vi.fn(),
  register: vi.fn(),
  window: vi.fn(),
  menu: vi.fn(),
  createUpdater: vi.fn(),
  readSettings: vi.fn(),
  schedule: vi.fn(),
  showMigration: vi.fn(),
  migrationIpc: vi.fn(),
  quit: vi.fn(),
  exit: vi.fn(),
  dialog: vi.fn(),
  trayOptions: [] as TrayOptions[],
  trayAttach: vi.fn(),
  trayDispose: vi.fn()
}));
vi.mock("electron", () => ({
  app: { isPackaged: false, whenReady: mock.ready, getVersion: () => "0.1.0", quit: mock.quit, exit: mock.exit },
  session: { defaultSession: { resolveProxy: mock.resolveProxy } },
  ipcMain: { handle: mock.register },
  dialog: { showMessageBox: mock.dialog }
}));
vi.mock("../data/desktop-paths", () => ({ createDesktopPaths: () => ({ initializeDesktopPaths: mock.init }) }));
vi.mock("./application-menu", () => ({ configureApplicationMenu: mock.menu }));
vi.mock("../data/desktop-root-migration", () => ({ prepareStartupDataMigration: mock.prepare }));
vi.mock("../data/desktop-data-migration", () => ({ recoverDesktopDataMigrations: mock.recover }));
vi.mock("../data/data-backup", () => ({
  createBackupHelper: () => vi.fn(),
  DesktopDataBackup: class {
    initialize = vi.fn(async () => undefined);
  }
}));
vi.mock("../data/desktop-settings", () => ({ readDesktopSettings: mock.readSettings }));
vi.mock("../ipc/register-desktop-ipc", () => ({
  registerDesktopIpc: (context: DesktopIpcContext) => mock.register("fixed-desktop-methods", context)
}));
vi.mock("../windows/business-window", () => ({ createBusinessWindow: mock.window }));
vi.mock("../windows/system-tray", () => ({
  createSystemTray: (options: TrayOptions) => {
    mock.trayOptions.push(options);
    return { attach: mock.trayAttach, dispose: mock.trayDispose };
  }
}));
vi.mock("../windows/shutdown-window", () => ({
  ShutdownWindow: class {
    show() {}
  }
}));
vi.mock("../updates/desktop-updater", () => ({
  createDesktopUpdater: mock.createUpdater,
  scheduleAutomaticUpdateCheck: mock.schedule,
  getDesktopAutoUpdater: () => ({ quitAndInstall: vi.fn() })
}));
vi.mock("./startup-diagnostics", () => ({
  StartupDiagnostics: class {
    bootId = "fixed-boot";
    stage = mock.stage;
    show = mock.show;
    fail = mock.fail;
    ready = mock.entered;
    constructor(options: DiagnosticsOptions) {
      mock.diagnosticsOptions.push(options);
    }
  }
}));
vi.mock("./startup-migration-flow", () => ({
  createStartupMigrationFlow: () => {
    let state: StartupDataMigrationState | undefined;
    return {
      setState: (value: StartupDataMigrationState) => {
        state = value;
      },
      getState: () => state,
      registerIpc: mock.migrationIpc,
      show: mock.showMigration,
      closeForMainWindow: vi.fn()
    };
  }
}));
vi.mock("../backend/backend-supervisor", () => ({
  BackendSupervisor: class {
    get startupTerminated() {
      return mock.terminated;
    }
    start = mock.start;
    stop = mock.stop;
    inspectShutdown = mock.inspect;
    monitorUnexpectedExit = mock.monitor;
    constructor(options: BackendOptions) {
      mock.events.push("backend-created");
      mock.backendOptions.push(options);
    }
  }
}));
const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform")!;
const drain = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
function application() {
  return createDesktopApplication({
    preloadPath: "fixed-preload.cjs",
    desktopIconPath: "fixed-icon.ico",
    installRoot: "synthetic-install",
    dataRoot: "synthetic-data",
    legacyDataRoot: "synthetic-legacy"
  });
}
const frameWindow = {
  isDestroyed: vi.fn(() => false),
  isMinimized: vi.fn(() => true),
  restore: vi.fn(),
  show: vi.fn(),
  focus: vi.fn(),
  loadURL: vi.fn(async () => undefined),
  destroy: vi.fn()
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.events.length = 0;
  mock.backendOptions.length = 0;
  mock.diagnosticsOptions.length = 0;
  mock.trayOptions.length = 0;
  frameWindow.isDestroyed.mockReturnValue(false);
  mock.terminated = true;
  mock.init.mockImplementation(() => {
    mock.events.push("paths");
  });
  mock.ready.mockImplementation(async () => {
    mock.events.push("ready");
  });
  mock.stage.mockImplementation((stage) => {
    mock.events.push("stage:" + stage);
  });
  mock.show.mockImplementation(() => {
    mock.events.push("diagnostics");
  });
  mock.menu.mockImplementation(() => {
    mock.events.push("menu");
  });
  mock.prepare.mockResolvedValue({
    required: false,
    destinationDirectory: "synthetic-data",
    sourceBytes: 0,
    sourceFiles: 0
  });
  mock.recover.mockImplementation(async () => {
    mock.events.push("recover");
  });
  mock.resolveProxy.mockImplementation(async () => {
    mock.events.push("proxy");
    return "DIRECT";
  });
  mock.start.mockResolvedValue("http://127.0.0.1:43210");
  mock.stop.mockResolvedValue({ clean: true });
  mock.inspect.mockResolvedValue({ busy: false, blocked: false, prepared: true });
  mock.window.mockImplementation(async (options: { onCreated: (window: BrowserWindow) => void }) => {
    mock.events.push("window");
    options.onCreated(frameWindow as unknown as BrowserWindow);
  });
  mock.entered.mockImplementation(() => {
    mock.events.push("entered");
  });
  mock.createUpdater.mockReturnValue({ isEnabled: false, checkForUpdates: vi.fn() });
  mock.readSettings.mockResolvedValue({ automaticUpdateChecks: true });
  mock.schedule.mockReturnValue(undefined);
  mock.dialog.mockResolvedValue({ response: 1 });
  mock.showMigration.mockResolvedValue(false);
});
afterEach(() => {
  Object.defineProperty(process, "platform", originalPlatform);
  vi.restoreAllMocks();
});
describe("desktop application assembly", () => {
  it("preserves paths/ready/recovery/proxy/backend/window/entered order and attaches the fixed preload", async () => {
    const app = application();
    app.focusMainWindow();
    expect(frameWindow.focus).not.toHaveBeenCalled();
    await app.boot();
    expect(mock.events).toEqual([
      "paths",
      "ready",
      "diagnostics",
      "stage:storage",
      "menu",
      "stage:migration",
      "recover",
      "stage:proxy",
      "proxy",
      "stage:process",
      "backend-created",
      "stage:window",
      "window",
      "entered"
    ]);
    expect(mock.diagnosticsOptions[0].preload).toBe("fixed-preload.cjs");
    expect(mock.register.mock.calls.map(([name]) => name)).toEqual(["desktop:get-version", "fixed-desktop-methods"]);
    expect(mock.recover).toHaveBeenCalledWith(expect.objectContaining({ dataRoot: "synthetic-data" }));
    app.focusMainWindow();
    expect(frameWindow.restore).toHaveBeenCalledOnce();
    expect(frameWindow.show).toHaveBeenCalledOnce();
    expect(frameWindow.focus).toHaveBeenCalledOnce();
    expect(mock.trayAttach).toHaveBeenCalledExactlyOnceWith(frameWindow);
  });
  it("retries startup using the same diagnostics and IPC registrations while replacing only the failed backend", async () => {
    const failure = new Error("startup failed");
    mock.start.mockRejectedValueOnce(failure);
    const app = application();
    await app.boot();
    expect(mock.fail).toHaveBeenCalledWith(failure, true);
    const context = mock.register.mock.calls.find(
      ([name]) => name === "fixed-desktop-methods"
    )![1] as DesktopIpcContext;
    expect(context.getBackendOrigin()).toBeUndefined();
    await mock.diagnosticsOptions[0].retry();
    expect(mock.diagnosticsOptions).toHaveLength(1);
    expect(mock.backendOptions).toHaveLength(2);
    expect(mock.register).toHaveBeenCalledTimes(2);
    expect(context.getBackendOrigin()).toBe("http://127.0.0.1:43210");
    expect(context.getMainWindow()).toBe(frameWindow);
  });
  it("keeps storage failures inspectable before recovery or backend startup", async () => {
    const failure = Object.assign(new Error("readonly"), { code: "EACCES" });
    mock.init.mockImplementationOnce(() => {
      throw failure;
    });
    await application().boot();
    expect(mock.fail).toHaveBeenCalledWith(failure);
    expect(mock.recover).not.toHaveBeenCalled();
    expect(mock.backendOptions).toEqual([]);
    expect(mock.menu).not.toHaveBeenCalled();
  });
  it("stops when the first-run choice is incomplete and keeps migration critical state visible to quit handling", async () => {
    mock.prepare.mockResolvedValueOnce({
      required: true,
      destinationDirectory: "synthetic-data",
      sourceBytes: 5,
      sourceFiles: 1
    });
    const app = application();
    await app.boot();
    expect(mock.migrationIpc).toHaveBeenCalledOnce();
    expect(mock.showMigration).toHaveBeenCalledOnce();
    expect(mock.backendOptions).toEqual([]);
    let finish!: () => void;
    mock.prepare.mockImplementationOnce(() =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }).then(() => ({ required: false, destinationDirectory: "synthetic-data", sourceBytes: 0, sourceFiles: 0 }))
    );
    const pending = app.boot();
    await drain();
    const event = { preventDefault: vi.fn() };
    app.beforeQuit(event);
    await drain();
    expect(mock.dialog).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("迁移数据") }));
    expect(mock.exit).not.toHaveBeenCalled();
    finish();
    await pending;
  });
  it("does not mark entered until the window loads and disables retry if process termination is unknown", async () => {
    const failure = new Error("window failed");
    mock.terminated = false;
    mock.window.mockRejectedValueOnce(failure);
    await application().boot();
    expect(mock.entered).not.toHaveBeenCalled();
    expect(mock.fail).toHaveBeenCalledWith(failure, false);
  });
  it("retains active desktop state for maintenance, playback protection and unexpected-exit diagnostics", async () => {
    const app = application();
    await app.boot();
    const context = mock.register.mock.calls.find(
      ([name]) => name === "fixed-desktop-methods"
    )![1] as DesktopIpcContext;
    const updater = mock.createUpdater.mock.calls[0][0] as { installDownloadedUpdate: () => Promise<void> };
    context.setPlaybackActive(true);
    await expect(updater.installDownloadedUpdate()).rejects.toThrow("音频播放");
    context.setPlaybackActive(false);
    await context.withBackendStopped(async () => "same-application");
    expect(frameWindow.loadURL).toHaveBeenCalledWith("http://127.0.0.1:43210");
    mock.backendOptions[0].onStage("storage");
    expect(mock.stage).toHaveBeenLastCalledWith("directories");
    mock.backendOptions[0].onUnexpectedExit("lost service");
    expect(mock.fail).toHaveBeenLastCalledWith(expect.any(Error), false);
  });
  it("does not offer Windows legacy migration during a simulated macOS startup", async () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    await application().boot();
    expect(mock.prepare).not.toHaveBeenCalled();
    expect(mock.migrationIpc).not.toHaveBeenCalled();
    expect(mock.entered).toHaveBeenCalledOnce();
  });
  it("restores a hidden window from tray or second instance and keeps tray exit behind the normal shutdown handshake", async () => {
    const applicationInstance = application();
    await applicationInstance.boot();
    mock.trayOptions[0].showWindow();
    expect(frameWindow.show).toHaveBeenCalledOnce();
    expect(frameWindow.focus).toHaveBeenCalledOnce();
    expect(mock.stop).not.toHaveBeenCalled();
    expect(frameWindow.destroy).not.toHaveBeenCalled();
    mock.trayOptions[0].quit();
    expect(mock.quit).toHaveBeenCalledOnce();
    expect(mock.exit).not.toHaveBeenCalled();
    applicationInstance.beforeQuit({ preventDefault: vi.fn() });
    await drain();
    expect(mock.inspect).toHaveBeenCalled();
    expect(mock.stop).toHaveBeenCalledOnce();
    expect(mock.trayDispose).toHaveBeenCalledOnce();
    expect(mock.exit).toHaveBeenCalledWith(0);
    frameWindow.show.mockClear();
    applicationInstance.focusMainWindow();
    expect(frameWindow.show).not.toHaveBeenCalled();
  });
  it("does not focus a destroyed main window", async () => {
    const applicationInstance = application();
    await applicationInstance.boot();
    frameWindow.isDestroyed.mockReturnValue(true);
    applicationInstance.focusMainWindow();
    expect(frameWindow.show).not.toHaveBeenCalled();
    expect(frameWindow.focus).not.toHaveBeenCalled();
  });
});
