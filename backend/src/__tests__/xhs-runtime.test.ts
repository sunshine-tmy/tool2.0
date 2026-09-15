/**
 * 中文模块说明：测试 backend/src/__tests__/xhs-runtime.test.ts 中的稳定行为、边界条件和回归场景
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "../config";
import { XhsRuntimeManager } from "../modules/xhs-archive/runtime";
import { XHS_COMMIT, XhsRuntimeInstallGateway } from "../modules/xhs-archive/runtime-install-gateway";
import { XhsProviderProcess } from "../modules/xhs-archive/runtime-process";
import { XhsTranslationRuntime } from "../modules/xhs-archive/translation-runtime";

let runtimeDir = "";
const originalFetch = globalThis.fetch;

afterEach(async () => {
  delete process.env.XHS_RUNTIME_DIR;
  delete process.env.XHS_TRANSLATION_RUNTIME_DIR;
  delete process.env.XHS_TRANSLATION_MODEL_URL;
  delete process.env.XHS_TRANSLATION_MODEL_SHA256;
  globalThis.fetch = originalFetch;
  if (runtimeDir) await fs.rm(runtimeDir, { recursive: true, force: true });
});

describe("xhs runtime validation", () => {
  it("does not treat a virtual environment without pyvenv.cfg as installed", async () => {
    runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-xhs-runtime-"));
    process.env.XHS_RUNTIME_DIR = runtimeDir;
    const executable = path.join(
      runtimeDir,
      "venv",
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
    );
    await fs.mkdir(path.dirname(executable), { recursive: true });
    await fs.writeFile(executable, "");
    await fs.writeFile(path.join(runtimeDir, ".installed-commit"), "afaf2fb459980fccef9eec74e304a39af2c49cab\n");

    expect(new XhsRuntimeManager(getConfig()).getStatus().status).toBe("not-installed");

    await fs.writeFile(path.join(runtimeDir, "venv", "pyvenv.cfg"), "version = 3.12.11\n");
    expect(new XhsRuntimeManager(getConfig()).getStatus()).toMatchObject({ status: "ready", installProgress: 100 });
  });

  it("records a source digest and rejects a changed pinned source", async () => {
    runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-xhs-runtime-"));
    process.env.XHS_RUNTIME_DIR = runtimeDir;
    const sourceDir = path.join(runtimeDir, `XHS-Downloader-${XHS_COMMIT}`);
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.writeFile(path.join(sourceDir, "LICENSE"), "license");
    await fs.writeFile(path.join(sourceDir, "requirements.txt"), "fastapi==0.116.1\n");
    const gateway = new XhsRuntimeInstallGateway(getConfig(), () => undefined);

    await gateway.validateExistingSource();
    await expect(fs.readFile(path.join(runtimeDir, ".source-sha256"), "utf8")).resolves.toMatch(/^[a-f0-9]{64}\n$/);

    await fs.writeFile(path.join(sourceDir, "requirements.txt"), "fastapi==0.116.2\n");
    await expect(gateway.validateExistingSource()).rejects.toThrow("固定版本源码摘要校验失败");
  });

  it("rejects a pinned source when a required file is missing", async () => {
    runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-xhs-runtime-"));
    process.env.XHS_RUNTIME_DIR = runtimeDir;
    const sourceDir = path.join(runtimeDir, `XHS-Downloader-${XHS_COMMIT}`);
    await fs.mkdir(sourceDir, { recursive: true });
    await fs.writeFile(path.join(sourceDir, "LICENSE"), "license");

    const gateway = new XhsRuntimeInstallGateway(getConfig(), () => undefined);

    await expect(gateway.validateExistingSource()).rejects.toThrow("固定版本源码校验失败");
  });

  it("surfaces installation failures without starting a provider process", async () => {
    runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-xhs-runtime-"));
    process.env.XHS_RUNTIME_DIR = runtimeDir;
    vi.spyOn(XhsProviderProcess.prototype, "isHealthy").mockResolvedValue(false);
    vi.spyOn(XhsRuntimeInstallGateway.prototype, "install").mockRejectedValue(new Error("安装依赖失败"));

    const manager = new XhsRuntimeManager(getConfig());

    await expect(manager.ensureReady()).rejects.toThrow("安装依赖失败");
    expect(manager.getStatus()).toMatchObject({ status: "failed", message: "安装依赖失败" });
  });

  it("rejects a translation model whose pinned digest does not match", async () => {
    runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-xhs-runtime-"));
    process.env.XHS_RUNTIME_DIR = runtimeDir;
    process.env.XHS_TRANSLATION_RUNTIME_DIR = path.join(runtimeDir, "translation");
    process.env.XHS_TRANSLATION_MODEL_URL = "https://model.test/model.tar.gz";
    process.env.XHS_TRANSLATION_MODEL_SHA256 = "0".repeat(64);
    globalThis.fetch = vi.fn(
      async () => new Response(Buffer.from("not-the-pinned-model"), { status: 200 })
    ) as typeof fetch;

    const runtime = new XhsTranslationRuntime(getConfig());
    const downloadModel = (runtime as unknown as { downloadModel: () => Promise<void> }).downloadModel.bind(runtime);

    await expect(downloadModel()).rejects.toThrow("翻译模型校验失败");
  });
});
