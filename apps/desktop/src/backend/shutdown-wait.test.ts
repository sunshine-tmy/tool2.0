import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForGracefulShutdown } from "./shutdown-wait";
afterEach(() => vi.useRealTimers());
describe("shutdown phase deadlines", () => {
  it("waits for real process exit and removes stage listeners", async () => {
    const source = new EventEmitter();
    let exit!: () => void;
    const waiting = waitForGracefulShutdown(
      source,
      new Promise<void>((resolve) => {
        exit = resolve;
      })
    );
    exit();
    expect(await waiting).toBe(true);
    expect(source.listenerCount("message")).toBe(0);
  });
  it("does not allow repeated or backwards stages to extend a phase deadline", async () => {
    vi.useFakeTimers();
    const source = new EventEmitter();
    const waiting = waitForGracefulShutdown(source, new Promise(() => undefined));
    await vi.advanceTimersByTimeAsync(14_000);
    source.emit("message", { type: "shutdown-stage", stage: "tasks" });
    source.emit("message", { type: "shutdown-stage", stage: "unknown" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(await waiting).toBe(false);
    expect(source.listenerCount("message")).toBe(0);
  });
  it("uses the worker/database deadlines with an overall time limit", async () => {
    vi.useFakeTimers();
    const source = new EventEmitter();
    const waiting = waitForGracefulShutdown(source, new Promise(() => undefined));
    await vi.advanceTimersByTimeAsync(14_000);
    source.emit("message", { type: "shutdown-stage", stage: "workers" });
    await vi.advanceTimersByTimeAsync(9000);
    source.emit("message", { type: "shutdown-stage", stage: "database" });
    source.emit("message", { type: "shutdown-stage", stage: "tasks" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(await waiting).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
