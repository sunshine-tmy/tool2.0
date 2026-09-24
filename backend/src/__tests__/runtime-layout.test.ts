/**
 * 中文模块说明：桌面运行时路径的回归测试，确保打包模式无需依赖仓库 cwd。
 */
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getConfig } from "../config";
import { createRuntimeLayout } from "../runtime/runtime-layout";

describe("runtime layout", () => {
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
        VIDEO_TEXT_TRANSCRIBE_COMMAND: "untrusted-transcriber.exe",
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
    expect(config.videoTextCapabilityReady).toBe(false);
    expect(config.edgeTtsCapabilityReady).toBe(false);
    expect(config.imageAiCapabilityReady).toBe(false);
    expect(config.chatterboxCapabilityReady).toBe(false);
    expect(config.videoTextAudioExtractCommand).toBe("");
    expect(config.videoTextTranscribeCommand).toBeUndefined();
    expect(config.edgeTtsPythonPath).toBe("");
    expect(config.edgeTtsScriptPath).toBe("");
    expect(config.imageAiWorkerUrl).toBe("http://127.0.0.1:1");
    expect(config.imageAiWorkerToken).toBeUndefined();
    expect(config.chatterboxWorkerUrl).toBe("http://127.0.0.1:1");
    expect(config.chatterboxWorkerToken).toBeUndefined();
    expect(config.chatterboxFfmpegPath).toBe("");
  });
});
