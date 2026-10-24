import { beforeEach, describe, expect, it, vi } from "vitest";
import { launchDesktopApplication } from "./launch";
const mock = vi.hoisted(() => ({
  lock: vi.fn(),
  quit: vi.fn(),
  model: vi.fn(),
  handlers: new Map<string, () => void>(),
  events: [] as string[]
}));
vi.mock("electron", () => ({
  app: {
    requestSingleInstanceLock: mock.lock,
    quit: mock.quit,
    setAppUserModelId: mock.model,
    on: (name: string, fn: () => void) => {
      mock.events.push(name);
      mock.handlers.set(name, fn);
    }
  }
}));
beforeEach(() => {
  vi.clearAllMocks();
  mock.handlers.clear();
  mock.events.length = 0;
  mock.lock.mockReturnValue(true);
});
describe("single desktop entry launch", () => {
  it("registers lifecycle in the original order and boots only the lock owner", async () => {
    const boot = vi.fn(async () => {
        mock.events.push("boot");
      }),
      focusMainWindow = vi.fn(),
      beforeQuit = vi.fn();
    launchDesktopApplication({ boot, focusMainWindow, beforeQuit });
    expect(mock.model).toHaveBeenCalledWith("com.ecommercetoolbox.desktop");
    expect(mock.events).toEqual(["second-instance", "boot", "window-all-closed", "before-quit"]);
    expect(boot).toHaveBeenCalledOnce();
    mock.handlers.get("second-instance")!();
    expect(focusMainWindow).toHaveBeenCalledOnce();
    mock.handlers.get("before-quit")!();
    expect(beforeQuit).toHaveBeenCalledOnce();
    mock.handlers.get("window-all-closed")!();
    expect(mock.quit).toHaveBeenCalledOnce();
  });
  it("does not boot or take over the other instance when the lock is unavailable", () => {
    mock.lock.mockReturnValue(false);
    const boot = vi.fn(async () => undefined);
    launchDesktopApplication({ boot, focusMainWindow: vi.fn(), beforeQuit: vi.fn() });
    expect(mock.quit).toHaveBeenCalledOnce();
    expect(boot).not.toHaveBeenCalled();
    expect(mock.handlers.has("second-instance")).toBe(false);
  });
});
