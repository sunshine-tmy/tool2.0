import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import fsSync from "node:fs";
import { expect, it, vi } from "vitest";
import { getFrontendDistRoot, getProjectRoot, isBuiltProjectModule } from "../project-root";
import { createDefaultRuntimeLayout } from "../runtime/default-layout";
import { createRuntimeLayout } from "../runtime/runtime-layout";
import { getConfig } from "../config";

it("anchors source and built modules at the same project root, including Chinese/spaced ZIP paths", () => {
  const root = path.resolve("ZIP 解压 空间", "工具箱");
  for (const application of [["apps", "api"], ["backend"]]) {
    for (const directory of ["src", "dist"]) {
      const url = pathToFileURL(path.join(root, ...application, directory, "project-root.js")).href;
      expect(getProjectRoot(url)).toBe(root);
      expect(getFrontendDistRoot(root, url)).toBe(
        application[0] === "apps" ? path.join(root, "apps", "web", "dist") : path.join(root, "frontend", "dist")
      );
      expect(isBuiltProjectModule(url)).toBe(directory === "dist");
    }
  }
});

async function fixture(run: (root: string, appRoot: string) => Promise<void>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-root-compat-"));
  const appRoot = path.join(root, "应用 空间");
  try {
    await fs.mkdir(appRoot);
    await run(root, appRoot);
  } finally {
    expect(path.dirname(root)).toBe(path.resolve(os.tmpdir()));
    expect(path.basename(root)).toMatch(/^toolbox-root-compat-/);
    await fs.rm(root, { recursive: true, force: true });
  }
}

it("uses the corrected root without creating directories when no legacy markers exist", () =>
  fixture(async (root, appRoot) => {
    const before = await fs.readdir(root);
    const layout = createDefaultRuntimeLayout({}, { appRoot, compiled: true });
    expect(layout.appRoot).toBe(appRoot);
    expect(layout.configRoot).toBe(appRoot);
    expect(layout.storageRoot).toBe(path.join(appRoot, "storage"));
    expect(await fs.readdir(root)).toEqual(before);
    expect(await fs.readdir(appRoot)).toEqual([]);
  }));

it.each([".env", "storage", ".runtime", "models"])(
  "stops rather than silently switching away from legacy %s",
  (marker) =>
    fixture(async (root, appRoot) => {
      const legacy = path.join(root, marker);
      if (marker === ".env") await fs.writeFile(legacy, "not read by root discovery");
      else await fs.mkdir(legacy);
      expect(() => createDefaultRuntimeLayout({}, { appRoot, compiled: true })).toThrow("LEGACY_RUNTIME_ROOT_DETECTED");
      expect(await fs.readdir(appRoot)).toEqual([]);
      expect(await fs.stat(legacy)).toBeDefined();
      expect(createDefaultRuntimeLayout({}, { appRoot, compiled: false }).storageRoot).toBe(
        path.join(appRoot, "storage")
      );
    })
);

it("explicitly reuses old mutable roots but keeps resources in the corrected application", () =>
  fixture(async (root, appRoot) => {
    await fs.writeFile(path.join(root, ".env"), "API_PORT=4708\nSTORAGE_ROOT=旧 数据\nDATABASE_PATH=旧 库/state.db\n");
    const layout = createDefaultRuntimeLayout({ TOOLBOX_LEGACY_DATA_ROOT: root }, { appRoot, compiled: true });
    expect(layout).toEqual({
      appRoot,
      configRoot: root,
      storageRoot: path.join(root, "storage"),
      runtimeRoot: path.join(root, ".runtime"),
      modelsRoot: path.join(root, "models"),
      scriptsRoot: path.join(appRoot, "scripts"),
      frontendDistRoot: path.join(appRoot, "apps", "web", "dist")
    });
    const config = getConfig({ layout, environment: { API_PORT: "4709" } });
    expect(config.port).toBe(4709);
    expect(config.storageRoot).toBe(path.join(root, "旧 数据"));
    expect(config.databasePath).toBe(path.join(root, "旧 库", "state.db"));
    const fromEnvironment = getConfig({ environment: { TOOLBOX_LEGACY_DATA_ROOT: root, API_PORT: "4709" } });
    expect(fromEnvironment.runtime.configRoot).toBe(root);
    expect(fromEnvironment.port).toBe(4709);
    expect(fromEnvironment.storageRoot).toBe(config.storageRoot);
    expect(getConfig({ dotenvPath: false, environment: { TOOLBOX_LEGACY_DATA_ROOT: root } }).port).toBe(3100);
    expect(await fs.readdir(appRoot)).toEqual([]);
  }));

it("propagates inaccessible legacy paths instead of treating them as missing", () => {
  const denied = Object.assign(new Error("fixture access denied"), { code: "EACCES" });
  const stat = vi.spyOn(fsSync, "lstatSync").mockImplementation(() => {
    throw denied;
  });
  try {
    expect(() => createDefaultRuntimeLayout({}, { appRoot: path.resolve("fixture"), compiled: true })).toThrow(denied);
  } finally {
    stat.mockRestore();
  }
});

it("requires explicit absolute existing legacy directories and preserves explicit layout priority", () =>
  fixture(async (root, appRoot) => {
    expect(() => createDefaultRuntimeLayout({ TOOLBOX_LEGACY_DATA_ROOT: "relative" }, { appRoot })).toThrow("absolute");
    expect(() =>
      createDefaultRuntimeLayout({ TOOLBOX_LEGACY_DATA_ROOT: path.join(root, "missing") }, { appRoot })
    ).toThrow();
    const file = path.join(root, "file");
    await fs.writeFile(file, "fixture");
    expect(() => createDefaultRuntimeLayout({ TOOLBOX_LEGACY_DATA_ROOT: file }, { appRoot })).toThrow("directory");
    const layout = createRuntimeLayout({ appRoot });
    expect(getConfig({ layout, dotenvPath: false, environment: { TOOLBOX_LEGACY_DATA_ROOT: "ignored" } }).runtime).toBe(
      layout
    );
  }));
