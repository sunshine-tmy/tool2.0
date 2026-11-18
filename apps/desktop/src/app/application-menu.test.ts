import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureApplicationMenu } from "./application-menu";
const mock = vi.hoisted(() => ({ set: vi.fn(), build: vi.fn() }));
vi.mock("electron", () => ({
  app: { setName: vi.fn() },
  Menu: { setApplicationMenu: mock.set, buildFromTemplate: mock.build }
}));
const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
beforeEach(() => {
  vi.clearAllMocks();
  mock.build.mockImplementation((value) => value);
});
afterEach(() => Object.defineProperty(process, "platform", platform));
describe("existing platform menu policy", () => {
  it("keeps Windows menu hidden", () => {
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    configureApplicationMenu();
    expect(mock.set).toHaveBeenCalledWith(null);
    expect(mock.build).not.toHaveBeenCalled();
  });
  it("retains macOS app and window menus", () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    configureApplicationMenu();
    expect(mock.build).toHaveBeenCalledOnce();
    expect(mock.build.mock.calls[0][0]).toEqual([
      {
        label: "电商工具箱",
        submenu: [
          { role: "about", label: "关于电商工具箱" },
          { type: "separator" },
          { role: "quit", label: "退出电商工具箱" }
        ]
      },
      {
        label: "窗口",
        submenu: [
          { role: "minimize", label: "最小化" },
          { role: "zoom", label: "缩放" },
          { role: "close", label: "关闭窗口" },
          { type: "separator" },
          { role: "front", label: "全部置于前台" }
        ]
      }
    ]);
    expect(mock.set).toHaveBeenCalledWith(mock.build.mock.results[0].value);
  });
});
