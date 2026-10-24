import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDesktopPaths } from "./desktop-paths";
const mock = vi.hoisted(() => ({ setPath: vi.fn(), setLogs: vi.fn() }));
vi.mock("electron", () => ({ app: { setPath: mock.setPath, setAppLogsPath: mock.setLogs } }));
const roots: string[] = [];
function setup(platform: NodeJS.Platform = "win32", packaged = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "toolbox-r09-paths-"));
  roots.push(root);
  const installRoot = path.join(root, "安装 空间"),
    dataRoot = path.join(installRoot, "data"),
    legacyDataRoot = path.join(root, "旧数据");
  fs.mkdirSync(installRoot);
  const options = { installRoot, dataRoot, legacyDataRoot, platform, packaged };
  return { root, options, paths: createDesktopPaths(options) };
}
beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) {
    expect(path.dirname(path.resolve(root))).toBe(path.resolve(os.tmpdir()));
    expect(path.basename(root)).toMatch(/^toolbox-r09-paths-/);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
describe("desktop path initialization", () => {
  it("keeps exact writable subdirectories and Electron path mapping without moving data", () => {
    const { options, paths } = setup();
    paths.initializeDesktopPaths();
    for (const relative of [".runtime", "models", "profile", "temp", "logs/crash-dumps"])
      expect(fs.statSync(path.join(options.dataRoot, relative)).isDirectory()).toBe(true);
    expect(mock.setPath.mock.calls).toEqual([
      ["userData", path.join(options.dataRoot, ".runtime")],
      ["sessionData", path.join(options.dataRoot, "profile")],
      ["temp", path.join(options.dataRoot, "temp")],
      ["crashDumps", path.join(options.dataRoot, "logs", "crash-dumps")]
    ]);
    expect(mock.setLogs).toHaveBeenCalledWith(path.join(options.dataRoot, "logs"));
    expect(fs.readdirSync(options.installRoot).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });
  it("rejects overlapping legacy roots and unwritable installation paths before changing Electron settings", () => {
    const { options } = setup();
    const overlap = createDesktopPaths({ ...options, legacyDataRoot: path.join(options.dataRoot, "legacy") });
    expect(overlap.desktopRootsWritable()).toBe(false);
    expect(() => overlap.initializeDesktopPaths()).toThrow("数据目录不可写");
    const file = path.join(options.installRoot, "not-directory");
    fs.writeFileSync(file, "synthetic");
    expect(createDesktopPaths({ ...options, installRoot: file }).desktopRootsWritable()).toBe(false);
    expect(mock.setPath).not.toHaveBeenCalled();
  });
  it("does not require writable macOS install bundles and preserves the development bypass", () => {
    const { options } = setup("darwin");
    const mac = createDesktopPaths({
      ...options,
      installRoot: path.join(options.installRoot, "read-only-app-does-not-exist")
    });
    expect(mac.desktopRootsWritable()).toBe(true);
    expect(mock.setPath).not.toHaveBeenCalled();
    const dev = createDesktopPaths({ ...options, packaged: false, legacyDataRoot: options.dataRoot });
    expect(dev.desktopRootsWritable()).toBe(true);
  });
});
