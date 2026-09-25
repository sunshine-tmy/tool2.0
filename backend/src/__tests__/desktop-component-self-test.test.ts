/** 中文模块说明：桌面能力自检测试，确保调用受管解释器并拒绝缺失资产。 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDesktopComponentSelfTest } from "../modules/components/desktop-component-self-test";
import type { ComponentPackageManifest } from "../modules/components/component-manager";

let temporaryRoot = "";

afterEach(async () => {
  if (temporaryRoot) await fs.rm(temporaryRoot, { recursive: true, force: true });
  temporaryRoot = "";
});

describe("desktop component self-test", () => {
  it("runs the Edge-TTS check in its package-local Python environment with downloads disabled", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-component-self-test-"));
    await writeAsset("scripts/edge-tts-generate.py");
    const runProcess = vi.fn(
      async (_executable: string, _args: string[], _cwd: string, _environment: Record<string, string>) =>
        '{"available":true,"version":"7.2.0"}'
    );
    const selfTest = createDesktopComponentSelfTest(runProcess);

    await selfTest(manifest("edge-tts", ["scripts/edge-tts-generate.py"]), temporaryRoot);

    expect(runProcess).toHaveBeenCalledWith(
      path.join(temporaryRoot, "venv", "Scripts", "python.exe"),
      [path.join(temporaryRoot, "scripts", "edge-tts-generate.py"), "check"],
      temporaryRoot,
      expect.objectContaining({
        PYTHONNOUSERSITE: "1",
        HF_HUB_OFFLINE: "1",
        TRANSFORMERS_OFFLINE: "1"
      })
    );
    expect((runProcess.mock.calls[0]?.[3] as Record<string, string>).PYTHONPATH).toBeUndefined();
  });

  it("rejects an image package that omits one of its fixed CPU models before launching the worker", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-component-self-test-"));
    const files = [
      "scripts/image-ai-worker.py",
      "models/image-ai/torch/hub/checkpoints/big-lama.pt",
      "models/image-ai/RealESRGAN_x2plus.pth",
      "models/image-ai/RealESRGAN_x4plus.pth",
      "models/image-ai/rembg/models/birefnet-general/birefnet-general.onnx",
      "models/image-ai/ocr/detection/inference.yml"
    ];
    await Promise.all(files.map(writeAsset));
    const runProcess = vi.fn(
      async (_executable: string, _args: string[], _cwd: string, _environment: Record<string, string>) =>
        '{"available":true}'
    );
    const selfTest = createDesktopComponentSelfTest(runProcess);

    await expect(selfTest(manifest("image-ai", files), temporaryRoot)).rejects.toThrow(
      "models/image-ai/ocr/recognition/inference.yml"
    );
    expect(runProcess).not.toHaveBeenCalled();
  });

  it("checks Chatterbox against the package-vendored source and fixed models", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-component-self-test-"));
    const files = [
      "scripts/chatterbox-worker.py",
      "scripts/worker_lifecycle.py",
      "vendor/chatterbox/__init__.py",
      "vendor/chatterbox_tts-0.1.7.dist-info/METADATA",
      "models/chatterbox/ve.pt",
      "models/chatterbox/t3_mtl23ls_v3.safetensors",
      "models/chatterbox/s3gen.pt",
      "models/chatterbox/grapheme_mtl_merged_expanded_v1.json"
    ];
    await Promise.all(files.map(writeAsset));
    const runProcess = vi.fn(async () => '{"available":true}');
    const selfTest = createDesktopComponentSelfTest(runProcess);

    await selfTest(manifest("chatterbox", files), temporaryRoot);

    expect(runProcess).toHaveBeenCalledWith(
      path.join(temporaryRoot, "venv", "Scripts", "python.exe"),
      [path.join(temporaryRoot, "scripts", "chatterbox-worker.py"), "--check"],
      temporaryRoot,
      expect.objectContaining({
        TOOLBOX_DESKTOP_MANAGED: "1",
        CHATTERBOX_DEVICE: "cpu",
        PYTHONPATH: path.join(temporaryRoot, "vendor")
      })
    );
  });

  it("keeps the XHS upstream runtime Volume outside the signed package generation", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-component-self-test-"));
    const files = ["source/requirements.txt", "source/source/__init__.py"];
    await Promise.all(files.map(writeAsset));
    const runProcess = vi.fn(
      async (_executable: string, _args: string[], _cwd: string, _environment: Record<string, string>) =>
        '{"available":true}'
    );
    const selfTest = createDesktopComponentSelfTest(runProcess);

    await selfTest(manifest("xhs-archive", files, "3.12"), temporaryRoot);

    const environment = runProcess.mock.calls[0]?.[3];
    expect(environment).toBeDefined();
    if (!environment) throw new Error("XHS self-test did not receive an environment");
    expect(environment.XHS_VOLUME_DIR).toContain("toolbox-xhs-selftest-");
    await expect(fs.access(environment.XHS_VOLUME_DIR)).rejects.toThrow();
  });

  it("self-tests the packaged translation worker with its signed model directory", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-component-self-test-"));
    const files = [
      "scripts/xhs-translation-worker.py",
      "model/model.bin",
      "model/source.spm",
      "model/target.spm",
      "model/manifest.json"
    ];
    await Promise.all(files.map(writeAsset));
    const runProcess = vi.fn(async () => '{"available":true}');
    const selfTest = createDesktopComponentSelfTest(runProcess);

    await selfTest(manifest("xhs-translation", files, "3.12"), temporaryRoot);

    expect(runProcess).toHaveBeenCalledWith(
      path.join(temporaryRoot, "venv", "Scripts", "python.exe"),
      [path.join(temporaryRoot, "scripts", "xhs-translation-worker.py"), "--check"],
      temporaryRoot,
      expect.objectContaining({
        XHS_TRANSLATION_MODEL_DIR: path.join(temporaryRoot, "model"),
        HF_HUB_OFFLINE: "1",
        TRANSFORMERS_OFFLINE: "1"
      })
    );
  });

  it("headless-smoke-tests the optional Chromium package without requiring Python", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-component-self-test-"));
    const files = ["browser/chrome.exe"];
    await Promise.all(files.map(writeAsset));
    const runProcess = vi.fn(async () => "<html><body></body></html>");
    const selfTest = createDesktopComponentSelfTest(runProcess);

    await selfTest(manifest("xhs-browser", files), temporaryRoot);

    expect(runProcess).toHaveBeenCalledWith(
      path.join(temporaryRoot, "browser", "chrome.exe"),
      ["--no-sandbox", "--headless", "--disable-gpu", "--dump-dom", "about:blank"],
      temporaryRoot,
      expect.any(Object)
    );
  });
});

async function writeAsset(relativePath: string) {
  const target = path.join(temporaryRoot, ...relativePath.split("/"));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, "verified test asset");
}

function manifest(
  id: string,
  files: string[],
  expectedPythonVersion: "3.11" | "3.12" = "3.11"
): ComponentPackageManifest {
  return {
    id,
    moduleId: id,
    pythonEnvironment: {
      pythonExecutablePath: "python/python.exe",
      wheelhousePath: "wheelhouse",
      requirementsLockPath: "requirements.lock",
      requirementsLockSha256: "0".repeat(64),
      expectedPythonVersion
    },
    files: files.map((filePath) => ({ path: filePath, bytes: 1, sha256: "0".repeat(64) }))
  } as unknown as ComponentPackageManifest;
}
