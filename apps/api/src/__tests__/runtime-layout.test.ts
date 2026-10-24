/**
 * 中文模块说明：桌面运行时路径的回归测试，确保打包模式无需依赖仓库 cwd。
 */
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getConfig } from "../config";
import { createDevelopmentRuntimeLayout, createRuntimeLayout, resolveRuntimePath } from "../runtime/runtime-layout";

describe("runtime layout", () => {
  it("anchors development defaults at the application, not at a reusable package", () => {
    const appRoot = fileURLToPath(new URL("../../../..", import.meta.url));
    expect(createDevelopmentRuntimeLayout()).toEqual({
      appRoot: path.resolve(appRoot),
      configRoot: path.resolve(appRoot),
      storageRoot: path.join(appRoot, "storage"),
      runtimeRoot: path.join(appRoot, ".runtime"),
      modelsRoot: path.join(appRoot, "models"),
      scriptsRoot: path.join(appRoot, "scripts"),
      frontendDistRoot: path.join(appRoot, "apps", "web", "dist")
    });
  });

  it("preserves explicit Chinese/spaced roots and relative-path expansion without touching files", () => {
    const appRoot = path.resolve("源码 空间", "项目");
    const layout = createDevelopmentRuntimeLayout({ appRoot, configRoot: path.join(appRoot, "配置 空间") });
    expect(layout.appRoot).toBe(appRoot);
    expect(layout.storageRoot).toBe(path.join(appRoot, "storage"));
    expect(resolveRuntimePath(layout.configRoot, "数据/../图片 文件")).toBe(path.join(layout.configRoot, "图片 文件"));
    expect(resolveRuntimePath(layout.configRoot, path.join(appRoot, "独立 文件"))).toBe(
      path.join(appRoot, "独立 文件")
    );
  });

  it("keeps a missing .env optional and environment overrides relative to the explicit config root", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-layout-config-"));
    try {
      const layout = createRuntimeLayout({ appRoot: root, configRoot: path.join(root, "配置 空间") });
      const defaults = getConfig({ layout, environment: { NODE_ENV: "test" } });
      expect(defaults.storageRoot).toBe(layout.storageRoot);
      expect(defaults.databasePath).toBe(":memory:");
      const overridden = getConfig({
        layout,
        environment: { STORAGE_ROOT: "图片 文件", DATABASE_PATH: "数据库/toolbox.db" }
      });
      expect(overridden.storageRoot).toBe(path.join(layout.configRoot, "图片 文件"));
      expect(overridden.databasePath).toBe(path.join(layout.configRoot, "数据库", "toolbox.db"));
      expect(await fs.readdir(root)).toEqual([]);
    } finally {
      expect(path.dirname(root)).toBe(path.resolve(os.tmpdir()));
      expect(path.basename(root)).toMatch(/^toolbox-layout-config-/);
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("keeps environment > selected .env > defaults precedence, with dotenvPath:false still disabling file reads", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-layout-config-"));
    try {
      const layout = createRuntimeLayout({ appRoot: root });
      await fs.writeFile(
        path.join(root, ".env"),
        'API_PORT=4700\nSTORAGE_ROOT="文件 数据"\nDATABASE_PATH=数据库/file.db\n'
      );
      const fromFile = getConfig({ layout, environment: {} });
      expect(fromFile.port).toBe(4700);
      expect(fromFile.storageRoot).toBe(path.join(root, "文件 数据"));
      expect(fromFile.databasePath).toBe(path.join(root, "数据库", "file.db"));
      const absolute = path.join(root, "显式 数据");
      const overridden = getConfig({ layout, environment: { API_PORT: "4701", STORAGE_ROOT: absolute } });
      expect(overridden.port).toBe(4701);
      expect(overridden.storageRoot).toBe(absolute);
      expect(overridden.databasePath).toBe(fromFile.databasePath);
      expect(getConfig({ layout, dotenvPath: false, environment: {} }).port).toBe(3100);
      const selectedFile = path.join(root, "selected.env");
      await fs.writeFile(selectedFile, "API_PORT=4702\n");
      expect(getConfig({ layout, dotenvPath: selectedFile, environment: {} }).port).toBe(4702);
    } finally {
      expect(path.dirname(root)).toBe(path.resolve(os.tmpdir()));
      expect(path.basename(root)).toMatch(/^toolbox-layout-config-/);
      await fs.rm(root, { recursive: true, force: true });
    }
  });
  it("uses the explicit layout for writable data and runtime scripts", () => {
    const root = path.join(process.cwd(), ".test-runtime-layout");
    const layout = createRuntimeLayout({
      appRoot: path.join(root, "app"),
      configRoot: path.join(root, "config"),
      storageRoot: path.join(root, "storage"),
      runtimeRoot: path.join(root, "components"),
      modelsRoot: path.join(root, "models"),
      scriptsRoot: path.join(root, "resources", "workers"),
      frontendDistRoot: path.join(root, "resources", "frontend")
    });

    const config = getConfig({
      layout,
      dotenvPath: false,
      environment: {
        NODE_ENV: "test",
        STORAGE_ROOT: "用户数据",
        XHS_RUNTIME_DIR: "xhs-runtime",
        XHS_TRANSLATION_RUNTIME_DIR: "translate-runtime",
        XHS_PROVIDER_TOKEN: "provider-token",
        XHS_TRANSLATION_TOKEN: "translation-token",
        IMAGE_AI_WORKER_TOKEN: "image-token",
        CHATTERBOX_WORKER_TOKEN: "chatterbox-token",
        EDGE_TTS_PYTHON: "components/edge-tts/python.exe",
        EDGE_TTS_SCRIPT: "workers/edge-tts-generate.py"
      }
    });

    expect(config.runtime).toBe(layout);
    expect(config.storageRoot).toBe(path.join(layout.configRoot, "用户数据"));
    expect(config.databasePath).toBe(":memory:");
    expect(config.xhsRuntimeDir).toBe(path.join(layout.configRoot, "xhs-runtime"));
    expect(config.xhsTranslationRuntimeDir).toBe(path.join(layout.configRoot, "translate-runtime"));
    expect(config.xhsProviderToken).toBe("provider-token");
    expect(config.xhsTranslationToken).toBe("translation-token");
    expect(config.imageAiWorkerToken).toBe("image-token");
    expect(config.chatterboxWorkerToken).toBe("chatterbox-token");
    expect(config.edgeTtsPythonPath).toBe(path.join(layout.configRoot, "components", "edge-tts", "python.exe"));
    expect(config.edgeTtsScriptPath).toBe(path.join(layout.configRoot, "workers", "edge-tts-generate.py"));
  });

  it("keeps configured database paths relative to the explicit config root", () => {
    const layout = createRuntimeLayout({
      appRoot: path.join(process.cwd(), "desktop-app"),
      configRoot: path.join(process.cwd(), "desktop-config")
    });
    const config = getConfig({
      layout,
      dotenvPath: false,
      environment: { DATABASE_PATH: "state/toolbox.db" }
    });

    expect(config.databasePath).toBe(path.join(layout.configRoot, "state", "toolbox.db"));
  });

  it("ignores arbitrary desktop Worker commands, paths, endpoints, and credentials until signed assets are resolved", () => {
    const layout = createRuntimeLayout({ appRoot: path.join(process.cwd(), "desktop-app") });
    const config = getConfig({
      layout,
      dotenvPath: false,
      desktopManagedCapabilities: true,
      environment: {
        NODE_ENV: "test",
        STORAGE_ROOT: "untrusted-storage",
        DATABASE_PATH: "outside-toolbox.db",
        XHS_RUNTIME_DIR: "outside-xhs",
        XHS_TRANSLATION_MODEL_DIR: "outside-translation-model",
        EDGE_TTS_PYTHON: "untrusted-python.exe",
        EDGE_TTS_SCRIPT: "untrusted-runner.py",
        IMAGE_AI_WORKER_URL: "http://127.0.0.1:45678",
        IMAGE_AI_WORKER_TOKEN: "untrusted-token",
        CHATTERBOX_WORKER_URL: "http://127.0.0.1:45679",
        CHATTERBOX_WORKER_TOKEN: "untrusted-token",
        CHATTERBOX_FFMPEG_PATH: "untrusted-ffmpeg.exe"
      }
    });

    expect(config.desktopManagedCapabilities).toBe(true);
    expect(config.storageRoot).toBe(layout.storageRoot);
    expect(config.databasePath).toBe(":memory:");
    expect(config.xhsRuntimeDir).toBe(path.join(layout.runtimeRoot, "xhs-downloader"));
    expect(config.xhsTranslationModelDir).toBe(path.join(layout.runtimeRoot, "xhs-translate", "model"));
    expect(config.edgeTtsCapabilityReady).toBe(false);
    expect(config.imageAiCapabilityReady).toBe(false);
    expect(config.chatterboxCapabilityReady).toBe(false);
    expect(config.edgeTtsPythonPath).toBe("");
    expect(config.edgeTtsScriptPath).toBe("");
    expect(config.imageAiWorkerUrl).toBe("http://127.0.0.1:1");
    expect(config.imageAiWorkerToken).toBeUndefined();
    expect(config.chatterboxWorkerUrl).toBe("http://127.0.0.1:1");
    expect(config.chatterboxWorkerToken).toBeUndefined();
    expect(config.chatterboxFfmpegPath).toBe("");
  });
});
