import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  windows: [] as unknown[],
  writes: vi.fn(),
  quit: vi.fn()
}));
vi.mock("electron", () => ({
  app: { getVersion: () => "0.1.0", quit: mock.quit },
  clipboard: { writeText: mock.writes },
  dialog: { showSaveDialog: async () => ({ canceled: true }) },
  shell: { openPath: vi.fn() },
  ipcMain: { handle: (name: string, fn: (...args: unknown[]) => unknown) => mock.handlers.set(name, fn) },
  BrowserWindow: class extends EventEmitter {
    webContents = {
      mainFrame: { url: "data:text/html;charset=utf-8,local" },
      setWindowOpenHandler: vi.fn(),
      setBackgroundThrottling: vi.fn(),
      send: vi.fn(),
      on: vi.fn()
    };
    constructor() {
      super();
      mock.windows.push(this);
    }
    isDestroyed() {
      return false;
    }
    show() {}
    close() {
      this.emit("closed");
    }
    async loadURL() {}
  }
}));
vi.mock("../../../backend/src/runtime/diagnostic-journal", () => ({
  DiagnosticJournal: class {
    bootId = "boot-id";
    events = [];
    record() {}
  }
}));
import { StartupDiagnostics } from "./startup-diagnostics";
afterEach(() => {
  mock.handlers.clear();
  mock.windows.length = 0;
  vi.clearAllMocks();
});
function event() {
  const window = mock.windows.at(-1) as { webContents: { mainFrame: object } };
  return { sender: window.webContents, senderFrame: window.webContents.mainFrame };
}
describe("backend-independent desktop diagnostics", () => {
  it("keeps a failed startup inspectable and lets the user explicitly retry", async () => {
    const retry = vi.fn(async () => undefined);
    const state = new StartupDiagnostics({ dataRoot: "unused", preload: "unused", retry });
    state.show();
    state.stage("database");
    state.fail({ code: "SQLITE_CANTOPEN", message: "private user text" });
    const result = mock.handlers.get("diagnostics:startup-state")!(event());
    expect(result).toMatchObject({ failed: true, canRetry: true, phase: "初始化数据库", code: "DATABASE_UNAVAILABLE" });
    expect(JSON.stringify(result)).not.toContain("private");
    await mock.handlers.get("diagnostics:startup-retry")!(event());
    expect(retry).toHaveBeenCalledTimes(1);
    await expect(mock.handlers.get("diagnostics:startup-retry")!(event())).rejects.toThrow();
  });
  it("does not offer recovery after runtime service loss with unknown work state", async () => {
    const retry = vi.fn(async () => undefined);
    const state = new StartupDiagnostics({ dataRoot: "unused", preload: "unused", retry });
    state.show();
    state.ready();
    state.fail(new Error("exit"), false);
    expect(mock.handlers.get("diagnostics:startup-state")!(event())).toMatchObject({ entered: true, canRetry: false });
    await expect(mock.handlers.get("diagnostics:startup-retry")!(event())).rejects.toThrow();
    expect(retry).not.toHaveBeenCalled();
  });
  it("rejects unknown senders and subframes", () => {
    const state = new StartupDiagnostics({ dataRoot: "unused", preload: "unused", retry: async () => undefined });
    state.show();
    expect(() => mock.handlers.get("diagnostics:startup-state")!({ sender: {}, senderFrame: {} })).toThrow();
    expect(() => mock.handlers.get("diagnostics:startup-state")!({ ...event(), senderFrame: {} })).toThrow();
  });
  it("pushes real stage snapshots and includes counters and elapsed time in the summary", async () => {
    const state = new StartupDiagnostics({ dataRoot: "unused", preload: "unused", retry: async () => undefined });
    state.show();
    state.stage("migration");
    const window = mock.windows.at(-1) as { webContents: { send: ReturnType<typeof vi.fn> } };
    expect(window.webContents.send).toHaveBeenLastCalledWith(
      "diagnostics:startup-updated",
      expect.objectContaining({
        phase: "检查数据迁移",
        completedCount: 1,
        totalSteps: 9,
        elapsedMs: expect.any(Number)
      })
    );
    mock.handlers.get("diagnostics:startup-copy")!(event());
    expect(mock.writes).toHaveBeenLastCalledWith(expect.stringContaining("已完成 1/9 步"));
    state.fail(new Error("failure"));
    await mock.handlers.get("diagnostics:startup-retry")!(event());
    expect(mock.handlers.get("diagnostics:startup-state")!(event())).toMatchObject({
      completedCount: 0,
      stageId: "storage",
      failed: false,
      canRetry: false
    });
  });
});
