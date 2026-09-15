/**
 * 中文模块说明：测试 backend/src/__tests__/graceful-shutdown.test.ts 中的稳定行为、边界条件和回归场景
 */
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installGracefulShutdown } from "../lifecycle/graceful-shutdown";

afterEach(() => vi.useRealTimers());

describe("graceful shutdown", () => {
  it("closes once when termination signals repeat", async () => {
    const signals = new EventEmitter();
    const close = vi.fn().mockResolvedValue(undefined);
    const setExitCode = vi.fn();
    const lifecycle = installGracefulShutdown(
      { close },
      {
        signalSource: signals,
        setExitCode,
        forceExit: vi.fn(),
        logger: { info: vi.fn(), error: vi.fn() }
      }
    );

    signals.emit("SIGTERM");
    signals.emit("SIGINT");
    await lifecycle.shutdown("SIGTERM");

    expect(close).toHaveBeenCalledTimes(1);
    expect(setExitCode).toHaveBeenCalledWith(0);
    lifecycle.dispose();
    expect(signals.listenerCount("SIGTERM")).toBe(0);
    expect(signals.listenerCount("SIGINT")).toBe(0);
  });

  it("forces exit when close exceeds the bounded timeout", async () => {
    vi.useFakeTimers();
    const signals = new EventEmitter();
    let finishClose: (() => void) | undefined;
    const close = vi.fn(
      () =>
        new Promise<undefined>((resolve) => {
          finishClose = () => resolve(undefined);
        })
    );
    const forceExit = vi.fn();
    const lifecycle = installGracefulShutdown(
      { close },
      {
        timeoutMs: 50,
        signalSource: signals,
        setExitCode: vi.fn(),
        forceExit,
        logger: { info: vi.fn(), error: vi.fn() }
      }
    );

    const shutdown = lifecycle.shutdown("SIGTERM");
    await vi.advanceTimersByTimeAsync(50);
    expect(forceExit).toHaveBeenCalledWith(1);
    finishClose?.();
    await shutdown;
    lifecycle.dispose();
  });
});
