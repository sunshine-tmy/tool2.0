// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { startLanListSync } from "./list-sync";

describe("LAN cross-device list synchronization", () => {
  let stop: (() => void) | undefined;
  afterEach(() => {
    stop?.();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("refreshes periodically and stops on disposal", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue(undefined);
    stop = startLanListSync(refresh);
    await vi.advanceTimersByTimeAsync(6000);
    expect(refresh).toHaveBeenCalledTimes(2);
    stop();
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(6000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("pauses while hidden and synchronizes immediately when visible", async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const refresh = vi.fn().mockResolvedValue(undefined);
    stop = startLanListSync(refresh);
    await vi.advanceTimersByTimeAsync(6000);
    expect(refresh).not.toHaveBeenCalled();
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("does not overlap slow requests or restart after disposal during a request", async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    const refresh = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    stop = startLanListSync(refresh);
    await vi.advanceTimersByTimeAsync(3000);
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(9000);
    expect(refresh).toHaveBeenCalledOnce();
    stop();
    finish();
    await vi.advanceTimersByTimeAsync(6000);
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("retries after transient failures", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    stop = startLanListSync(refresh);
    await vi.advanceTimersByTimeAsync(6000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
