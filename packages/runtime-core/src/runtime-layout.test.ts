import path from "node:path";
import { describe, expect, it } from "vitest";
import { createRuntimeLayout, resolveRuntimePath } from "./index";

describe("explicit runtime layout", () => {
  it("keeps the caller's application root and historical directory names", () => {
    const appRoot = path.resolve("代码 空间", "项目");
    expect(createRuntimeLayout({ appRoot })).toEqual({
      appRoot,
      configRoot: appRoot,
      storageRoot: path.join(appRoot, "storage"),
      runtimeRoot: path.join(appRoot, ".runtime"),
      modelsRoot: path.join(appRoot, "models"),
      scriptsRoot: path.join(appRoot, "scripts"),
      frontendDistRoot: path.join(appRoot, "frontend", "dist")
    });
  });

  it("normalizes each explicit override independently and does not mutate options", () => {
    const root = path.resolve("路径 空间");
    const keys = [
      "appRoot",
      "configRoot",
      "storageRoot",
      "runtimeRoot",
      "modelsRoot",
      "scriptsRoot",
      "frontendDistRoot"
    ] as const;
    const options = Object.freeze(
      Object.fromEntries(keys.map((key) => [key, path.join(root, key, "子目录", "..")])) as Record<
        (typeof keys)[number],
        string
      >
    );
    const layout = createRuntimeLayout(options);
    for (const key of keys) expect(layout[key]).toBe(path.join(root, key));
    expect(createRuntimeLayout({ appRoot: "相对 应用" }).appRoot).toBe(path.resolve("相对 应用"));
  });

  it("resolves relative, empty and absolute configured values with existing semantics", () => {
    const base = path.resolve("配置 空间");
    expect(resolveRuntimePath(base, "媒体/../图片 文件")).toBe(path.join(base, "图片 文件"));
    expect(resolveRuntimePath(base, "")).toBe(base);
    const absolute = path.resolve("独立 空间", "媒体");
    expect(resolveRuntimePath(base, absolute)).toBe(absolute);
  });
});
