import { EventEmitter } from "node:events";
import type { BrowserWindow } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBusinessWindow } from "./business-window";
const mock = vi.hoisted(() => ({
  windows: [] as Array<
    EventEmitter & {
      options: Record<string, unknown>;
      webContents: {
        session: { setPermissionRequestHandler: ReturnType<typeof vi.fn> };
        setWindowOpenHandler: ReturnType<typeof vi.fn>;
      };
      show: ReturnType<typeof vi.fn>;
    }
  >,
  quit: vi.fn(),
  external: vi.fn(),
  load: vi.fn(),
  events: [] as string[]
}));
vi.mock("electron", () => ({
  app: { quit: mock.quit },
  shell: { openExternal: mock.external },
  BrowserWindow: class extends EventEmitter {
    webContents = {
      session: { setPermissionRequestHandler: vi.fn() },
      setWindowOpenHandler: vi.fn(),
      on: (...args: unknown[]) => this.on(String(args[0]), args[1] as (...args: unknown[]) => void)
    };
    show = vi.fn();
    loadURL = mock.load;
    constructor(readonly options: Record<string, unknown>) {
      super();
      mock.windows.push(this);
    }
  }
}));
beforeEach(() => {
  vi.clearAllMocks();
  mock.windows.length = 0;
  mock.events.length = 0;
  mock.load.mockImplementation(async () => {
    mock.events.push("load");
  });
});
afterEach(() => vi.restoreAllMocks());
async function setup() {
  let main: BrowserWindow | undefined,
    quitting = false;
  await createBusinessWindow({
    origin: "http://127.0.0.1:43210",
    preload: "fixed-preload.cjs",
    desktopIconPath: "fixed-icon.ico",
    getMainWindow: () => main,
    onCreated: (window) => {
      main = window;
      mock.events.push("attached");
    },
    closeStartupMigration: () => {
      mock.events.push("close-startup");
    },
    isQuitting: () => quitting
  });
  return {
    window: mock.windows[0],
    setQuitting: () => {
      quitting = true;
    }
  };
}
describe("business window boundary", () => {
  it("attaches the window before closing migration and loading the fixed backend origin", async () => {
    const { window } = await setup();
    expect(mock.events).toEqual(["attached", "close-startup", "load"]);
    expect(mock.load).toHaveBeenCalledWith("http://127.0.0.1:43210");
    expect(window.options).toMatchObject({
      icon: "fixed-icon.ico",
      width: 1440,
      height: 960,
      show: false,
      webPreferences: { preload: "fixed-preload.cjs", nodeIntegration: false, contextIsolation: true, sandbox: true }
    });
    window.emit("ready-to-show");
    expect(window.show).toHaveBeenCalledOnce();
  });
  it("denies permissions/new windows and only opens safe HTTPS links outside the app", async () => {
    const { window } = await setup(),
      permission = window.webContents.session.setPermissionRequestHandler.mock.calls[0][0] as (
        _a: unknown,
        _b: string,
        callback: (allowed: boolean) => void
      ) => void;
    const allowed = vi.fn();
    permission({}, "camera", allowed);
    expect(allowed).toHaveBeenCalledWith(false);
    const open = window.webContents.setWindowOpenHandler.mock.calls[0][0] as (value: { url: string }) => unknown;
    for (const url of ["file:///private", "javascript:alert(1)", "http://external.test"]) {
      expect(open({ url })).toEqual({ action: "deny" });
    }
    expect(mock.external).not.toHaveBeenCalled();
    expect(open({ url: "https://example.test" })).toEqual({ action: "deny" });
    expect(mock.external).toHaveBeenCalledWith("https://example.test");
  });
  it("keeps internal navigation and routes untrusted navigation/close through fixed policies", async () => {
    const { window, setQuitting } = await setup(),
      preventDefault = vi.fn();
    window.emit("will-navigate", { preventDefault }, "http://127.0.0.1:43210/tools/image-ai");
    expect(preventDefault).not.toHaveBeenCalled();
    window.emit("will-navigate", { preventDefault }, "https://example.test");
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(mock.external).toHaveBeenCalledWith("https://example.test");
    const close = vi.fn();
    window.emit("close", { preventDefault: close });
    expect(close).toHaveBeenCalledOnce();
    expect(mock.quit).toHaveBeenCalledOnce();
    setQuitting();
    window.emit("close", { preventDefault: close });
    expect(close).toHaveBeenCalledOnce();
  });
});
