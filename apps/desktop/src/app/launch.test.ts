import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { launchDesktopApplication } from "./launch";
const mock = vi.hoisted(() => ({
  lock: vi.fn(),
  quit: vi.fn(),
  model: vi.fn(),
  handlers: new Map<string, () => void>(),
  events: [] as string[]
}));
const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform")!;
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
afterEach(() => Object.defineProperty(process, "platform", originalPlatform));
describe("single desktop entry launch", () => {
  it("keeps macOS alive with no windows and restores the hidden window on Dock activation", async () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    const boot = vi.fn(async () => {
        mock.events.push("boot");
      }),
      focusMainWindow = vi.fn(),
      beforeQuit = vi.fn();
    launchDesktopApplication({ boot, focusMainWindow, beforeQuit });
    expect(mock.model).toHaveBeenCalledWith("com.ecommercetoolbox.desktop");
    expect(mock.events).toEqual(["second-instance", "activate", "window-all-closed", "before-quit", "boot"]);
    expect(boot).toHaveBeenCalledOnce();
    mock.handlers.get("second-instance")!();
    expect(focusMainWindow).toHaveBeenCalledOnce();
    mock.handlers.get("activate")!();
    expect(focusMainWindow).toHaveBeenCalledTimes(2);
    mock.handlers.get("before-quit")!();
    expect(beforeQuit).toHaveBeenCalledOnce();
    mock.handlers.get("window-all-closed")!();
    expect(mock.quit).not.toHaveBeenCalled();
  });
  it("keeps the existing Windows quit behavior when all windows close", () => {
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    launchDesktopApplication({ boot: vi.fn(async () => undefined), focusMainWindow: vi.fn(), beforeQuit: vi.fn() });
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
