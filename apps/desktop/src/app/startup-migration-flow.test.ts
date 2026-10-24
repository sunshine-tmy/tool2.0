import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StartupDataMigrationState } from "@toolbox/shared/desktop";
import { createStartupMigrationFlow } from "./startup-migration-flow";
type TestWindow = EventEmitter & {
  webContents: { setWindowOpenHandler: ReturnType<typeof vi.fn> };
  options: { webPreferences: Record<string, unknown> };
  loadURL: ReturnType<typeof vi.fn>;
  close: () => void;
  destroy: () => void;
};
const mock = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  windows: [] as TestWindow[],
  quit: vi.fn(),
  partition: vi.fn(),
  load: vi.fn(),
  migrate: vi.fn(),
  prepare: vi.fn(),
  fresh: vi.fn()
}));
vi.mock("electron", () => ({
  app: { quit: mock.quit },
  session: { fromPartition: mock.partition },
  ipcMain: {
    handle: (name: string, fn: (...args: unknown[]) => unknown) => {
      if (mock.handlers.has(name)) throw Error("duplicate migration IPC");
      mock.handlers.set(name, fn);
    }
  },
  BrowserWindow: class extends EventEmitter {
    webContents = { setWindowOpenHandler: vi.fn() };
    loadURL = mock.load;
    constructor(readonly options: TestWindow["options"]) {
      super();
      mock.windows.push(this);
    }
    close() {
      const event = { preventDefault: vi.fn() };
      this.emit("close", event);
      if (!event.preventDefault.mock.calls.length) this.emit("closed");
    }
    destroy() {
      this.emit("closed");
    }
  }
}));
vi.mock("../data/desktop-root-migration", () => ({
  migrateLegacyDesktopData: mock.migrate,
  prepareStartupDataMigration: mock.prepare,
  chooseFreshDesktopData: mock.fresh
}));
const initial: StartupDataMigrationState = {
  required: true,
  destinationDirectory: "synthetic-data",
  sourceDirectory: "synthetic-legacy",
  sourceBytes: 5,
  sourceFiles: 1
};
function setup() {
  let critical = false;
  const flow = createStartupMigrationFlow({
    preload: "fixed-preload.cjs",
    desktopIconPath: "fixed-icon.ico",
    dataRoot: "synthetic-data",
    legacyDataRoot: "synthetic-legacy",
    isOperation: () => critical,
    setOperation: (value) => {
      critical = value;
    }
  });
  flow.registerIpc();
  return { flow, critical: () => critical };
}
const tick = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};
const invoke = (name: string, ...args: unknown[]) =>
  mock.handlers.get(name)!({ sender: mock.windows.at(-1)?.webContents }, ...args);
beforeEach(() => {
  vi.clearAllMocks();
  mock.handlers.clear();
  mock.windows.length = 0;
  mock.load.mockResolvedValue(undefined);
  mock.prepare.mockResolvedValue({ ...initial, required: false });
  mock.migrate.mockResolvedValue({ files: 1, bytes: 5 });
  mock.partition.mockReturnValue({ id: "no-cache" });
});
afterEach(() => vi.restoreAllMocks());
describe("startup migration ownership", () => {
  it("registers fixed IPC once and keeps the isolated no-cache startup window", async () => {
    const { flow } = setup();
    flow.registerIpc();
    expect([...mock.handlers.keys()]).toEqual([
      "desktop:get-startup-data-migration",
      "desktop:migrate-startup-data",
      "desktop:choose-fresh-startup-data",
      "desktop:exit-startup-migration"
    ]);
    const pending = flow.show(initial);
    await tick();
    const window = mock.windows[0];
    expect(window.options.webPreferences).toMatchObject({
      preload: "fixed-preload.cjs",
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    });
    expect(mock.partition).toHaveBeenCalledWith("desktop-startup-migration", { cache: false });
    expect(invoke("desktop:get-startup-data-migration")).toEqual(initial);
    expect(() => mock.handlers.get("desktop:get-startup-data-migration")!({ sender: {} })).toThrow("未授权");
    await invoke("desktop:migrate-startup-data");
    expect(await pending).toBe(true);
    expect(flow.getState()).toMatchObject({ required: false, sourceBytes: 5, sourceFiles: 1 });
    flow.closeForMainWindow();
    expect(mock.quit).not.toHaveBeenCalled();
  });
  it("prevents close and duplicate migration while switching, then resolves completion", async () => {
    let finish!: (value: { files: number; bytes: number }) => void;
    mock.migrate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const { flow, critical } = setup();
    const pending = flow.show(initial);
    await tick();
    const migration = invoke("desktop:migrate-startup-data") as Promise<unknown>;
    expect(critical()).toBe(true);
    await expect(invoke("desktop:choose-fresh-startup-data")).rejects.toThrow("尚未结束");
    mock.windows[0].close();
    expect(mock.quit).toHaveBeenCalledOnce();
    finish({ files: 1, bytes: 5 });
    await migration;
    expect(await pending).toBe(true);
    expect(critical()).toBe(false);
    flow.closeForMainWindow();
  });
  it("keeps explicit fresh-start selection and cancellation separate from migration", async () => {
    const { flow } = setup();
    const pending = flow.show(initial);
    await tick();
    await invoke("desktop:choose-fresh-startup-data");
    expect(await pending).toBe(true);
    expect(mock.fresh).toHaveBeenCalledWith({ dataRoot: "synthetic-data", legacyDataRoot: "synthetic-legacy" });
    expect(mock.migrate).not.toHaveBeenCalled();
    flow.closeForMainWindow();
    const cancelled = flow.show(initial);
    await tick();
    mock.windows.at(-1)!.close();
    expect(await cancelled).toBe(false);
    expect(mock.quit).toHaveBeenCalledOnce();
  });
  it("preserves the original migration error and unlocks critical state when recovery still needs a choice", async () => {
    const failure = new Error("original migration error");
    mock.migrate.mockRejectedValueOnce(failure);
    mock.prepare.mockResolvedValueOnce(initial);
    const { flow, critical } = setup();
    const pending = flow.show(initial);
    await tick();
    await expect(invoke("desktop:migrate-startup-data")).rejects.toBe(failure);
    expect(critical()).toBe(false);
    expect(flow.getState()?.required).toBe(true);
    mock.windows[0].close();
    expect(await pending).toBe(false);
  });
  it("continues when recovery proves migration finished despite the initial error, and cleans up a failed window load", async () => {
    mock.migrate.mockRejectedValueOnce(new Error("recoverable"));
    const { flow } = setup();
    const pending = flow.show(initial);
    await tick();
    await invoke("desktop:migrate-startup-data");
    expect(await pending).toBe(true);
    flow.closeForMainWindow();
    mock.load.mockRejectedValueOnce(new Error("window load failed"));
    await expect(flow.show(initial)).rejects.toThrow("window load failed");
  });
});
