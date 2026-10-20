import { describe, expect, it, vi } from "vitest";
import { QuitCoordinator } from "./quit-coordinator";

function setup() {
  const options = {
    inspect: vi.fn(async (confirmed?: boolean) => ({ busy: false, blocked: false, prepared: confirmed !== undefined })),
    critical: vi.fn(() => false),
    playing: vi.fn(() => false),
    confirm: vi.fn(async () => true),
    notify: vi.fn(async () => undefined),
    begin: vi.fn(),
    stop: vi.fn(async () => undefined),
    finish: vi.fn()
  };
  return { options, coordinator: new QuitCoordinator(options) };
}
describe("desktop quit coordination", () => {
  it("exits quietly when idle and coalesces repeated close requests", async () => {
    const { options, coordinator } = setup();
    const first = coordinator.request();
    expect(coordinator.request()).toBe(first);
    expect(await first).toBe(true);
    expect(options.confirm).not.toHaveBeenCalled();
    expect(options.stop).toHaveBeenCalledTimes(1);
    expect(options.finish).toHaveBeenCalledTimes(1);
  });
  it("allows cancelling a playback close without freezing or destroying the page", async () => {
    const { options, coordinator } = setup();
    options.playing.mockReturnValue(true);
    options.confirm.mockResolvedValue(false);
    expect(await coordinator.request()).toBe(false);
    expect(options.inspect).toHaveBeenCalledTimes(1);
    expect(options.begin).not.toHaveBeenCalled();
  });
  it("asks again if a new task arrives between inspection and preparation", async () => {
    const { options, coordinator } = setup();
    options.inspect
      .mockResolvedValueOnce({ busy: false, blocked: false, prepared: false })
      .mockResolvedValueOnce({ busy: true, blocked: false, prepared: false })
      .mockResolvedValueOnce({ busy: true, blocked: false, prepared: true });
    expect(await coordinator.request()).toBe(true);
    expect(options.confirm).toHaveBeenCalledTimes(1);
    expect(options.inspect).toHaveBeenLastCalledWith(true);
  });
  it("refuses to stop during migration or installation", async () => {
    const { options, coordinator } = setup();
    options.critical.mockReturnValue(true);
    expect(await coordinator.request()).toBe(false);
    expect(options.inspect).not.toHaveBeenCalled();
    options.critical.mockReturnValue(false);
    options.inspect.mockResolvedValue({ busy: true, blocked: true, prepared: false });
    expect(await coordinator.request()).toBe(false);
    expect(options.stop).not.toHaveBeenCalled();
  });
  it("does not announce completion on cleanup failure and retries without resuming business", async () => {
    const { options, coordinator } = setup();
    options.stop.mockRejectedValueOnce(new Error("unconfirmed"));
    expect(await coordinator.request()).toBe(false);
    expect(options.finish).not.toHaveBeenCalled();
    expect(coordinator.complete).toBe(false);
    expect(await coordinator.request()).toBe(true);
    expect(options.begin).toHaveBeenCalledTimes(1);
    expect(options.inspect).toHaveBeenCalledTimes(2);
    expect(options.stop).toHaveBeenCalledTimes(2);
  });
});
