import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeLayout } from "../../../backend/src/runtime/runtime-layout";
const mocks = vi.hoisted(() => ({ fork: vi.fn(), guard: vi.fn(), close: vi.fn(), events: [] as string[] }));
vi.mock("electron", () => ({ utilityProcess: { fork: mocks.fork } }));
vi.mock("./process-guard", () => ({ guardBackendProcess: mocks.guard }));
vi.mock("../../../backend/src/runtime/diagnostic-journal", () => ({
  DiagnosticJournal: class {
    record(_phase: string, code: string) {
      mocks.events.push(code);
    }
    consume() {}
  }
}));
import { BackendSupervisor } from "./backend-supervisor";

class Child extends EventEmitter {
  pid = 123;
  stdout = new PassThrough();
  stderr = new PassThrough();
  respond = true;
  kill = vi.fn(() => {
    this.emit("exit", 1);
    return true;
  });
  postMessage = vi.fn((message: { type: string; id?: number; confirmed?: boolean }) => {
    if (message.type === "start")
      queueMicrotask(() => this.emit("message", { type: "ready", origin: "http://127.0.0.1:34567" }));
    if (message.type === "shutdown" && this.respond) queueMicrotask(() => this.emit("exit", 0));
    if (message.type === "shutdown-inspect" || message.type === "shutdown-prepare")
      queueMicrotask(() =>
        this.emit("message", {
          type: "shutdown-inspection",
          id: message.id,
          state: { busy: false, blocked: false, prepared: message.type === "shutdown-prepare" }
        })
      );
  });
}
function setup() {
  const child = new Child();
  mocks.fork.mockReturnValue(child);
  const supervisor = new BackendSupervisor({
    entrypoint: "fixed-entry",
    runtimeLayout: { appRoot: "test-root", storageRoot: "test-root/storage" } as RuntimeLayout
  });
  return { child, supervisor };
}
async function start() {
  const state = setup();
  const started = state.supervisor.start();
  state.child.emit("message", { type: "spawned" });
  await started;
  return state;
}
beforeEach(() => {
  mocks.guard.mockResolvedValue({ close: mocks.close });
  mocks.close.mockResolvedValue({ forced: false });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  mocks.events.length = 0;
});

describe("backend supervisor shutdown", () => {
  it("does not initialize the backend before process protection is attached", async () => {
    let attach!: (guard: { close: typeof mocks.close }) => void;
    mocks.guard.mockReturnValue(
      new Promise((resolve) => {
        attach = resolve;
      })
    );
    const { child, supervisor } = setup();
    const started = supervisor.start();
    child.emit("message", { type: "spawned" });
    expect(child.postMessage).not.toHaveBeenCalled();
    attach({ close: mocks.close });
    expect(await started).toBe("http://127.0.0.1:34567");
    expect(await supervisor.inspectShutdown()).toMatchObject({ prepared: false });
    expect(await supervisor.inspectShutdown(false)).toMatchObject({ prepared: true });
    await supervisor.stop();
    expect(mocks.close).toHaveBeenCalledTimes(1);
    expect(mocks.events).toContain("SHUTDOWN_COMPLETE");
  });
  it("terminates the owned job after timeout and waits for the root exit", async () => {
    vi.useFakeTimers();
    const { child, supervisor } = await start();
    child.respond = false;
    mocks.close.mockImplementation(async () => {
      child.emit("exit", 1);
      return { forced: true };
    });
    const stopping = supervisor.stop();
    await vi.advanceTimersByTimeAsync(15_000);
    await stopping;
    expect(child.kill).not.toHaveBeenCalled();
    expect(mocks.events).toContain("SHUTDOWN_FORCED_CLEANUP");
    expect(mocks.events).toContain("SHUTDOWN_COMPLETE");
  });
  it("never reports success if group cleanup cannot be verified", async () => {
    const { supervisor } = await start();
    mocks.close.mockRejectedValueOnce(new Error("unconfirmed"));
    await expect(supervisor.stop()).rejects.toThrow("unconfirmed");
    expect(mocks.events).not.toContain("SHUTDOWN_COMPLETE");
    await supervisor.stop();
    expect(mocks.events).toContain("SHUTDOWN_COMPLETE");
  });
  it("distinguishes resource cleanup from a failed task-state save", async () => {
    const { child, supervisor } = await start();
    child.emit("message", { type: "shutdown-error" });
    expect(await supervisor.stop()).toEqual({ clean: false });
    expect(mocks.events).toContain("SHUTDOWN_STATE_SAVE_FAILED");
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });
  it("cleans the owned descendants when the backend unexpectedly exits", async () => {
    const { child, supervisor } = await start();
    supervisor.monitorUnexpectedExit();
    child.emit("exit", 1);
    await Promise.resolve();
    expect(mocks.close).toHaveBeenCalledTimes(1);
    await supervisor.stop();
  });
});
