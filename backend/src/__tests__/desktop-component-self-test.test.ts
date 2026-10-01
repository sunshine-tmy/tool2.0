/** 中文模块说明：桌面能力自检测试，确保调用受管解释器并拒绝缺失资产。 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDesktopComponentSelfTest } from "../modules/components/desktop-component-self-test";
import type { ComponentPackageManifest } from "../modules/components/component-manager";

let temporaryRoot = "";

afterEach(async () => {
  if (temporaryRoot) {
    if (
      !path.resolve(temporaryRoot).startsWith(path.resolve(os.tmpdir()) + path.sep) ||
      !path.basename(temporaryRoot).startsWith("desktop-component-self-test-")
    )
      throw new Error("自检测试清理路径越界");
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
  temporaryRoot = "";
});

describe("desktop component self-test", () => {
  it.each(["win32-x64", "darwin-arm64"] as const)("抖音 %s 描述包只做本地协议自检，不启动进程", async (platform) => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-component-self-test-"));
    const descriptor = await fs.readFile(
      new URL("../../../packaging/components/douyin-archive/adapter/manifest.json", import.meta.url),
      "utf8"
    );
    await writeAsset("adapter/manifest.json", descriptor);
    const component = manifest("douyin-archive", ["adapter/manifest.json"], "3.11", platform);
    component.dependencyIds = ["xhs-browser"];
    const runProcess = vi.fn(async () => "");
    await createDesktopComponentSelfTest(runProcess)(component, temporaryRoot);
    expect(runProcess).not.toHaveBeenCalled();
  });

  it.each(["invalid", "oversized", "dependency"] as const)("抖音能力自检拒绝 %s，不激活损坏能力", async (failure) => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-component-self-test-"));
    const descriptor = await fs.readFile(
      new URL("../../../packaging/components/douyin-archive/adapter/manifest.json", import.meta.url),
      "utf8"
    );
    await writeAsset(
      "adapter/manifest.json",
      failure === "invalid" ? "{}" : failure === "oversized" ? "x".repeat(4097) : descriptor
    );
    const component = manifest("douyin-archive", ["adapter/manifest.json"]);
    component.dependencyIds = failure === "dependency" ? [] : ["xhs-browser"];
    const runProcess = vi.fn(async () => "");
    await expect(createDesktopComponentSelfTest(runProcess)(component, temporaryRoot)).rejects.toThrow(/抖音/);
    expect(runProcess).not.toHaveBeenCalled();
  });

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
    await Promise.all(files.map((file) => writeAsset(file)));
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
    await Promise.all(files.map((file) => writeAsset(file)));
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

  it("validates the CUDA 12.4 runtime without requiring an NVIDIA GPU on the package build host", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-component-self-test-"));
    const files = [
      "scripts/chatterbox-worker.py",
      "scripts/worker_lifecycle.py",
      "vendor/chatterbox/__init__.py",
      "vendor/chatterbox_tts-0.1.7.dist-info/METADATA"
    ];
    await Promise.all(files.map((file) => writeAsset(file)));
    const runProcess = vi.fn(async () => '{"available":true,"cudaRuntimeAvailable":true,"cudaAvailable":false}');
    const selfTest = createDesktopComponentSelfTest(runProcess);

    await selfTest(manifest("chatterbox-cuda", files), temporaryRoot);

    expect(runProcess).toHaveBeenCalledWith(
      path.join(temporaryRoot, "venv", "Scripts", "python.exe"),
      ["-c", expect.stringContaining("torch.version.cuda == '12.4'")],
      temporaryRoot,
      expect.objectContaining({
        TOOLBOX_DESKTOP_MANAGED: "1",
        PYTHONPATH: path.join(temporaryRoot, "vendor")
      })
    );
  });

  it("keeps the XHS upstream runtime Volume outside the signed package generation", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-component-self-test-"));
    const files = ["source/requirements.txt", "source/source/__init__.py"];
    await Promise.all(files.map((file) => writeAsset(file)));
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
    await Promise.all(files.map((file) => writeAsset(file)));
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
    await Promise.all(files.map((file) => writeAsset(file)));
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

  it.skipIf(process.platform !== "darwin")(
    "uses the Mac FFmpeg names and verifies executable permissions",
    async () => {
      temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-component-self-test-mac-"));
      await writeExecutableAsset("bin/ffmpeg");
      await writeExecutableAsset("bin/ffprobe");
      const runProcess = vi.fn(async () => "ffmpeg version 8.1.2");
      const selfTest = createDesktopComponentSelfTest(runProcess);

      await selfTest(manifest("ffmpeg", ["bin/ffmpeg", "bin/ffprobe"], "3.11", "darwin-arm64"), temporaryRoot);

      expect(runProcess).toHaveBeenNthCalledWith(
        1,
        path.join(temporaryRoot, "bin", "ffmpeg"),
        ["-version"],
        temporaryRoot,
        expect.any(Object)
      );
      expect(runProcess).toHaveBeenNthCalledWith(
        2,
        path.join(temporaryRoot, "bin", "ffprobe"),
        ["-version"],
        temporaryRoot,
        expect.any(Object)
      );
    }
  );

  it.skipIf(process.platform !== "darwin")(
    "loads the Mac Chromium executable only from its signed launcher map",
    async () => {
      temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-component-self-test-mac-"));
      const browserExecutable = "browser/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
      await writeExecutableAsset(browserExecutable);
      await writeAsset("browser/browser-launcher.json", JSON.stringify({ executableAssetPath: browserExecutable }));
      const runProcess = vi.fn(async () => "<html><body></body></html>");
      const selfTest = createDesktopComponentSelfTest(runProcess);

      await selfTest(
        manifest("xhs-browser", ["browser/browser-launcher.json", browserExecutable], "3.11", "darwin-arm64"),
        temporaryRoot
      );

      expect(runProcess).toHaveBeenCalledWith(
        path.join(temporaryRoot, ...browserExecutable.split("/")),
        ["--no-sandbox", "--headless", "--disable-gpu", "--dump-dom", "about:blank"],
        temporaryRoot,
        expect.any(Object)
      );
    }
  );

  it.skipIf(process.platform !== "darwin")("runs the Chatterbox check in the isolated Mac CPU venv", async () => {
    temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "desktop-component-self-test-mac-"));
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
    await Promise.all(files.map((file) => writeAsset(file)));
    await writeExecutableAsset("venv/bin/python");
    const runProcess = vi.fn(async () => '{"available":true}');
    const selfTest = createDesktopComponentSelfTest(runProcess);

    await selfTest(manifest("chatterbox", files, "3.11", "darwin-arm64"), temporaryRoot);

    expect(runProcess).toHaveBeenCalledWith(
      path.join(temporaryRoot, "venv", "bin", "python"),
      [path.join(temporaryRoot, "scripts", "chatterbox-worker.py"), "--check"],
      temporaryRoot,
      expect.objectContaining({ CHATTERBOX_DEVICE: "cpu", PYTHONPATH: path.join(temporaryRoot, "vendor") })
    );
  });
});

async function writeAsset(relativePath: string, content = "verified test asset") {
  const target = path.join(temporaryRoot, ...relativePath.split("/"));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
}

async function writeExecutableAsset(relativePath: string) {
  await writeAsset(relativePath);
  await fs.chmod(path.join(temporaryRoot, ...relativePath.split("/")), 0o755);
}

function manifest(
  id: string,
  files: string[],
  expectedPythonVersion: "3.11" | "3.12" = "3.11",
  platform: "win32-x64" | "darwin-arm64" = "win32-x64"
): ComponentPackageManifest {
  return {
    id,
    moduleId: id,
    platform,
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
