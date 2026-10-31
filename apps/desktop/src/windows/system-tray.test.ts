import { EventEmitter } from "node:events";
import type { BrowserWindow, MenuItemConstructorOptions } from "electron";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSystemTray } from "./system-tray";

const mock = vi.hoisted(() => ({
  icon: vi.fn(),
  buildMenu: vi.fn(),
  create: vi.fn(),
  trays: [] as Array<
    EventEmitter & {
      destroyed: boolean;
      isDestroyed(): boolean;
      destroy: ReturnType<typeof vi.fn>;
      setToolTip: ReturnType<typeof vi.fn>;
      setContextMenu: ReturnType<typeof vi.fn>;
    }
  >
}));
vi.mock("electron", () => ({
  nativeImage: { createFromPath: mock.icon },
  Menu: { buildFromTemplate: mock.buildMenu },
  Tray: class extends EventEmitter {
    destroyed = false;
    isDestroyed() {
      return this.destroyed;
    }
    destroy = vi.fn(() => {
      this.destroyed = true;
    });
    setToolTip = vi.fn();
    setContextMenu = vi.fn();
    constructor(icon: unknown) {
      super();
      mock.create(icon);
      mock.trays.push(this);
    }
  }
}));
beforeEach(() => {
  vi.clearAllMocks();
  mock.trays.length = 0;
  mock.icon.mockReturnValue({ isEmpty: () => false });
  mock.create.mockImplementation(() => undefined);
  mock.buildMenu.mockImplementation((template) => template);
});
afterEach(() => vi.restoreAllMocks());
function windowFixture() {
  return Object.assign(new EventEmitter(), { isDestroyed: vi.fn(() => false), hide: vi.fn() });
}
function setup(platform: NodeJS.Platform = "win32", iconPath: string | undefined = "fixed.ico") {
  const showWindow = vi.fn(),
    quit = vi.fn(),
    isQuitting = vi.fn(() => false);
  const controller = createSystemTray({ platform, iconPath, showWindow, quit, isQuitting });
  const window = windowFixture();
  controller.attach(window as unknown as BrowserWindow);
  return { controller, window, showWindow, quit, isQuitting };
}
it("keeps one tray across window replacements and removes obsolete minimize listeners", () => {
  const { controller, window } = setup();
  window.emit("minimize");
  expect(window.hide).toHaveBeenCalledOnce();
  controller.attach(window as unknown as BrowserWindow);
  expect(window.listenerCount("minimize")).toBe(1);
  const next = windowFixture();
  controller.attach(next as unknown as BrowserWindow);
  expect(mock.trays).toHaveLength(1);
  window.emit("minimize");
  expect(window.hide).toHaveBeenCalledOnce();
  next.emit("minimize");
  expect(next.hide).toHaveBeenCalledOnce();
  next.emit("closed");
  expect(next.listenerCount("minimize")).toBe(0);
  controller.dispose();
});
it("provides restore actions for both click types and routes tray exit through the application's safe quit callback", () => {
  const { controller, window, showWindow, quit } = setup();
  const tray = mock.trays[0];
  tray.emit("click");
  tray.emit("double-click");
  expect(showWindow).toHaveBeenCalledTimes(2);
  expect(tray.setToolTip).toHaveBeenCalledWith("电商工具箱 · 后台运行");
  const menu = mock.buildMenu.mock.calls[0][0] as MenuItemConstructorOptions[];
  Reflect.apply(menu[0].click!, undefined, []);
  expect(showWindow).toHaveBeenCalledTimes(3);
  Reflect.apply(menu[1].click!, undefined, []);
  expect(window.hide).toHaveBeenCalledOnce();
  Reflect.apply(menu[3].click!, undefined, []);
  expect(quit).toHaveBeenCalledOnce();
  expect(window.listenerCount("close")).toBe(0);
  controller.dispose();
});
it("does not hide windows during shutdown, after disposal or if the tray/window has been destroyed", () => {
  const { controller, window, isQuitting } = setup();
  isQuitting.mockReturnValue(true);
  window.emit("minimize");
  expect(window.hide).not.toHaveBeenCalled();
  isQuitting.mockReturnValue(false);
  window.isDestroyed.mockReturnValue(true);
  window.emit("minimize");
  expect(window.hide).not.toHaveBeenCalled();
  window.isDestroyed.mockReturnValue(false);
  mock.trays[0].destroyed = true;
  window.emit("minimize");
  expect(window.hide).not.toHaveBeenCalled();
  controller.dispose();
  controller.dispose();
  window.emit("minimize");
  expect(window.hide).not.toHaveBeenCalled();
});
it.each(["darwin", "linux"] as const)("preserves native minimize behavior on %s", (platform) => {
  const { window, controller } = setup(platform);
  window.emit("minimize");
  expect(window.hide).not.toHaveBeenCalled();
  expect(mock.create).not.toHaveBeenCalled();
  controller.dispose();
});
it("keeps a recovery entry available by falling back to normal minimize when the icon cannot load", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  mock.icon.mockReturnValue({ isEmpty: () => true });
  const { window, controller } = setup();
  window.emit("minimize");
  expect(window.hide).not.toHaveBeenCalled();
  expect(mock.create).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledOnce();
  controller.dispose();
});
it("destroys a partially initialized tray and retries on the next attachment without hiding the window", () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  mock.buildMenu.mockImplementationOnce(() => {
    throw new Error("menu failed");
  });
  const { window, controller } = setup();
  expect(mock.trays[0].destroy).toHaveBeenCalledOnce();
  window.emit("minimize");
  expect(window.hide).not.toHaveBeenCalled();
  controller.attach(window as unknown as BrowserWindow);
  expect(mock.trays).toHaveLength(2);
  window.emit("minimize");
  expect(window.hide).toHaveBeenCalledOnce();
  controller.dispose();
  expect(mock.trays[1].destroy).toHaveBeenCalledOnce();
});
