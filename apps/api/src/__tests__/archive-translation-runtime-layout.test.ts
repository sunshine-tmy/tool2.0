/** Shared-runtime relocation guards. Synthetic files/assets only; no Python, model or signed-package installation. */
import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getConfig, type AppConfig } from "../config";
import { createIsolatedAppFixture } from "./helpers/isolated-app";
import type { ComponentManager } from "../modules/components/component-manager";
import { ComponentManagerError } from "../modules/components/component-manager";
import { XhsTranslationRuntime, XhsTranslationRuntimeError } from "../domains/content-archive/core/translation-runtime";
import { errorCode } from "../domains/content-archive/core/translation-state";

type RuntimePaths = {
  venvDir(): string;
  venvPython(): string;
  modelDir(): string;
  markerPath(): string;
  startWorker(
    options?: { pythonPath: string; scriptPath: string; modelDir: string },
    signal?: AbortSignal
  ): Promise<void>;
  install(): Promise<void>;
};
let fixture: Awaited<ReturnType<typeof createIsolatedAppFixture>>;
let config: AppConfig;
beforeEach(async () => {
  fixture = await createIsolatedAppFixture();
  config = getConfig({
    layout: fixture.layout,
    dotenvPath: false,
    environment: {
      NODE_ENV: "test",
      XHS_TRANSLATION_RUNTIME_DIR: path.join(fixture.root, "中文 翻译运行时"),
      XHS_TRANSLATION_MODEL_DIR: path.join(fixture.root, "独立 模型"),
      XHS_TRANSLATION_PROVIDER_PORT: "5558",
      XHS_TRANSLATION_TOKEN: "synthetic-translation-token"
    }
  });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected network request in isolated test")));
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await fixture?.dispose();
});
function managed() {
  const root = path.join(fixture.root, "合成 generation");
  const manager = {
    list: vi.fn().mockResolvedValue([]),
    resolveInstalledPython: vi.fn(async () => ({ path: path.join(root, "python.exe") })),
    resolveInstalledAsset: vi.fn(async (_id: string, asset: string) => ({ path: path.join(root, asset) }))
  };
  const runtime = new XhsTranslationRuntime(
    { ...config, desktopManagedCapabilities: true },
    manager as unknown as ComponentManager
  );
  return { root, manager, runtime, internal: runtime as unknown as RuntimePaths };
}

it.each([
  "XHS_TRANSLATION_NOT_INSTALLED",
  "XHS_TRANSLATION_INTERRUPTED",
  "XHS_TRANSLATION_MODEL_NOT_FOUND",
  "XHS_TRANSLATION_MODEL_DOWNLOAD_FAILED",
  "XHS_TRANSLATION_MODEL_INVALID"
] as const)("keeps %s in the same runtime error identity used by domain classification", (code) => {
  const failure = new XhsTranslationRuntimeError(code, "synthetic failure");
  expect(failure).toBeInstanceOf(Error);
  expect(failure.name).toBe("XhsTranslationRuntimeError");
  expect(failure.message).toBe("synthetic failure");
  expect(errorCode(failure)).toBe(code);
});

it("does not classify an unrelated error by a copied runtime name and code", () => {
  const failure = Object.assign(new Error("synthetic failure"), {
    name: "XhsTranslationRuntimeError",
    code: "XHS_TRANSLATION_MODEL_INVALID"
  });
  expect(failure).not.toBeInstanceOf(XhsTranslationRuntimeError);
  expect(errorCode(failure)).toBe("XHS_TRANSLATION_FAILED");
});

it("keeps explicit Chinese/space runtime and independent model roots without creating or downloading anything", async () => {
  const runtime = new XhsTranslationRuntime(config);
  const internal = runtime as unknown as RuntimePaths;
  expect(internal.venvDir()).toBe(path.join(config.xhsTranslationRuntimeDir, "venv"));
  expect(internal.venvPython()).toBe(
    path.join(
      config.xhsTranslationRuntimeDir,
      "venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
    )
  );
  expect(internal.modelDir()).toBe(config.xhsTranslationModelDir);
  expect(internal.markerPath()).toBe(path.join(config.xhsTranslationRuntimeDir, ".installed-model"));
  expect(runtime.getStatus()).toMatchObject({
    status: "not-installed",
    modelId: "Helsinki-NLP/opus-mt-zh-en",
    modelRevision: "cf109095479db38d6df799875e34039d4938aaa6",
    version: "CTranslate2 4.8.2 / SentencePiece 0.2.2"
  });
  await expect(fs.stat(config.xhsTranslationRuntimeDir)).rejects.toMatchObject({ code: "ENOENT" });
  await expect(fs.stat(config.xhsTranslationModelDir)).rejects.toMatchObject({ code: "ENOENT" });
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

it("keeps missing-script validation anchored to scriptsRoot before attempting to spawn Python", async () => {
  const runtime = new XhsTranslationRuntime(config);
  const script = path.join(config.runtime.scriptsRoot, "xhs-translation-worker.py");
  await expect(fs.stat(script)).rejects.toMatchObject({ code: "ENOENT" });
  await expect((runtime as unknown as RuntimePaths).startWorker()).rejects.toThrow(
    "找不到运行时脚本：xhs-translation-worker.py"
  );
  await runtime.stop();
});

it("keeps the constructor's original marker/file-presence check separate from actual model validation", async () => {
  await fs.mkdir(config.xhsTranslationRuntimeDir, { recursive: true });
  await fs.mkdir(config.xhsTranslationModelDir, { recursive: true });
  const marker = path.join(config.xhsTranslationRuntimeDir, ".installed-model");
  await fs.writeFile(marker, "synthetic readiness marker");
  for (const name of ["model.bin", "source.spm", "target.spm"])
    await fs.writeFile(path.join(config.xhsTranslationModelDir, name), "synthetic placeholder");
  expect(new XhsTranslationRuntime(config).getStatus().status).toBe("not-installed");
  await fs.writeFile(path.join(config.xhsTranslationModelDir, "manifest.json"), "{}");
  expect(new XhsTranslationRuntime(config).getStatus()).toMatchObject({ status: "ready", installProgress: 100 });
  await fs.unlink(marker);
  expect(new XhsTranslationRuntime(config).getStatus().status).toBe("not-installed");
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

it("reuses an explicit endpoint without health checks, installation or starting a worker", async () => {
  config.xhsTranslationProviderUrl = "https://translate.test/base/";
  const runtime = new XhsTranslationRuntime(config);
  const internal = runtime as unknown as RuntimePaths;
  const install = vi.spyOn(internal, "install").mockRejectedValue(new Error("Unexpected installation"));
  const start = vi.spyOn(internal, "startWorker").mockResolvedValue(undefined);
  expect(await runtime.ensureReady()).toBe("https://translate.test/base");
  expect(runtime.getStatus().providerUrl).toBe("https://translate.test/base/");
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(install).not.toHaveBeenCalled();
  expect(start).not.toHaveBeenCalled();
});

it("retains pre-cancellation before even reusing an external endpoint", async () => {
  config.xhsTranslationProviderUrl = "https://translate.test/base/";
  const runtime = new XhsTranslationRuntime(config);
  const controller = new AbortController();
  const reason = new Error("synthetic cancellation");
  controller.abort(reason);
  await expect(runtime.ensureReady(undefined, { signal: controller.signal })).rejects.toBe(reason);
  expect(globalThis.fetch).not.toHaveBeenCalled();
});

it.each(["COMPONENT_NOT_FOUND", "COMPONENT_NOT_INSTALLED", "COMPONENT_DEPENDENCY_MISSING"] as const)(
  "keeps %s mapped to the same managed-runtime error without starting or downloading",
  async (code) => {
    const { manager, runtime, internal } = managed();
    manager.resolveInstalledPython.mockRejectedValue(new ComponentManagerError(code, "synthetic asset failure"));
    const start = vi.spyOn(internal, "startWorker").mockResolvedValue(undefined);
    const failure = await runtime.ensureReady().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(XhsTranslationRuntimeError);
    expect(errorCode(failure)).toBe("XHS_TRANSLATION_NOT_INSTALLED");
    expect(runtime.getStatus()).toMatchObject({ status: "not-installed", installProgress: 0 });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  }
);

it("keeps managed package asset names, resolved paths, cancellation signal and original progress order", async () => {
  const { root, manager, runtime, internal } = managed();
  const start = vi.spyOn(internal, "startWorker").mockResolvedValue(undefined);
  vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 503 }));
  const progress = vi.fn();
  const controller = new AbortController();
  expect(await runtime.ensureReady(progress, { signal: controller.signal })).toBe("http://127.0.0.1:5558");
  expect(manager.resolveInstalledPython).toHaveBeenCalledExactlyOnceWith("xhs-translation");
  expect(manager.resolveInstalledAsset.mock.calls).toEqual([
    ["xhs-translation", "scripts/xhs-translation-worker.py"],
    ["xhs-translation", "model/manifest.json"]
  ]);
  expect(start).toHaveBeenCalledExactlyOnceWith(
    {
      pythonPath: path.join(root, "python.exe"),
      scriptPath: path.join(root, "scripts/xhs-translation-worker.py"),
      modelDir: path.join(root, "model")
    },
    controller.signal
  );
  expect(progress.mock.calls.map(([status]) => [status.status, status.installProgress])).toEqual([
    ["installing", 80],
    ["ready", 100]
  ]);
  expect(runtime.getStatus().status).toBe("ready");
});

it("reuses a healthy local managed service with the original token without starting a second worker", async () => {
  const { runtime, internal } = managed();
  const start = vi.spyOn(internal, "startWorker").mockResolvedValue(undefined);
  vi.mocked(globalThis.fetch).mockResolvedValue(new Response(null, { status: 200 }));
  expect(await runtime.ensureReady()).toBe("http://127.0.0.1:5558");
  expect(globalThis.fetch).toHaveBeenCalledExactlyOnceWith("http://127.0.0.1:5558/health", {
    headers: { "x-toolbox-worker-token": "synthetic-translation-token" },
    signal: expect.any(AbortSignal)
  });
  expect(start).not.toHaveBeenCalled();
});

it("keeps public status snapshots independent from caller edits", () => {
  const runtime = new XhsTranslationRuntime(config);
  const status = runtime.getStatus();
  status.message = "caller edit";
  status.installProgress = 99;
  expect(runtime.getStatus()).toMatchObject({
    modelId: "Helsinki-NLP/opus-mt-zh-en",
    message: "首次翻译时准备本地翻译环境",
    installProgress: 0
  });
});

it("preserves the previous managed status if the capability catalog cannot be read", async () => {
  const { manager, runtime } = managed();
  const before = runtime.getStatus();
  manager.list.mockRejectedValue(new Error("synthetic catalog failure"));
  expect(await runtime.refreshCapabilityStatus()).toEqual(before);
  expect(globalThis.fetch).not.toHaveBeenCalled();
});
