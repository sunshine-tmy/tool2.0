import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureApplicationMenu } from "./application-menu";
const mock = vi.hoisted(() => ({ set: vi.fn(), build: vi.fn() }));
vi.mock("electron", () => ({
  app: { name: "Ecommerce Toolbox" },
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
  it("retains macOS app/edit/window roles without inventing browser commands", () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    configureApplicationMenu();
    expect(mock.build).toHaveBeenCalledOnce();
    expect(mock.build.mock.calls[0][0]).toEqual([
      { label: "Ecommerce Toolbox", submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }] },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" }
        ]
      },
      { label: "Window", submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }] }
    ]);
    expect(mock.set).toHaveBeenCalledWith(mock.build.mock.results[0].value);
  });
});
