/** 视频 GPU 增量环境的依赖优先级、基础包约束与 CPU 回退。 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComponentManagerError, type ComponentManager } from "../modules/components/component-manager";
import type { VerifiedComponentAsset } from "../modules/components/types";
import { videoAiCudaPythonEnvironment } from "../modules/components/video-ai-python-overlay";
import { resolveVideoAiWorkerRuntime } from "../runtime/desktop-capability-runtime";

let root = "";
let base: VerifiedComponentAsset;
let cuda: VerifiedComponentAsset;
const site = (asset: VerifiedComponentAsset) => path.join(asset.generationRoot, "venv", "Lib", "site-packages");

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "video-ai-python-overlay-"));
  base = python("video-ai", path.join(root, "基础 CPU 包"));
  cuda = python("video-ai-cuda", path.join(root, "GPU extension"));
  await Promise.all([base, cuda].map((asset) => fs.mkdir(site(asset), { recursive: true })));
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (root) {
    if (path.dirname(root) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("video-ai-python-overlay-"))
      throw new Error("视频环境测试清理路径越界");
    await fs.rm(root, { recursive: true, force: true });
  }
  root = "";
});

describe("video AI CUDA Python overlay", () => {
  it("uses the GPU interpreter with CUDA dependencies ahead of the base OCR and service dependencies", async () => {
    const resolveInstalledPython = vi.fn(async (id: string) => (id === "video-ai" ? base : cuda));
    const runtime = await resolveVideoAiWorkerRuntime({ resolveInstalledPython } as unknown as ComponentManager);
    expect(runtime).toEqual({
      componentId: "video-ai-cuda",
      python: cuda,
      environment: { PYTHONPATH: [site(cuda), site(base)].join(path.delimiter) }
    });
    expect(resolveInstalledPython.mock.calls.map(([id]) => id)).toEqual(["video-ai", "video-ai-cuda"]);
  });

  it("keeps the CPU environment isolated when the optional GPU package is absent", async () => {
    const resolveInstalledPython = vi.fn(async (id: string) => {
      if (id === "video-ai-cuda") throw new ComponentManagerError("COMPONENT_NOT_INSTALLED", "not installed");
      return base;
    });
    expect(await resolveVideoAiWorkerRuntime({ resolveInstalledPython } as unknown as ComponentManager)).toEqual({
      componentId: "video-ai",
      python: base,
      environment: {}
    });
  });

  it("never starts the GPU package without the installed base capability", async () => {
    const resolveInstalledPython = vi.fn(async () => {
      throw new ComponentManagerError("COMPONENT_NOT_INSTALLED", "not installed");
    });
    expect(
      await resolveVideoAiWorkerRuntime({ resolveInstalledPython } as unknown as ComponentManager)
    ).toBeUndefined();
    expect(resolveInstalledPython).toHaveBeenCalledExactlyOnceWith("video-ai");
  });

  it("keeps the base runtime available if CUDA integrity resolution fails", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const resolveInstalledPython = vi.fn(async (id: string) => {
      if (id === "video-ai-cuda") throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "invalid CUDA");
      return base;
    });
    const runtime = await resolveVideoAiWorkerRuntime({ resolveInstalledPython } as unknown as ComponentManager);
    expect(runtime?.python).toBe(base);
    expect(runtime?.environment).toEqual({});
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("回退到 CPU 运行时"));
  });

  it("rejects a missing base site-packages directory instead of using a development environment", async () => {
    await fs.rm(site(base), { recursive: true });
    await expect(videoAiCudaPythonEnvironment(cuda.generationRoot, base)).rejects.toThrow();
  });

  it("rejects an unrelated or incompatible base package", async () => {
    const unrelated = { ...base, manifest: { ...base.manifest, id: "image-ai" } };
    await expect(videoAiCudaPythonEnvironment(cuda.generationRoot, unrelated)).rejects.toThrow("基础包");
    const oldPython = {
      ...base,
      manifest: {
        ...base.manifest,
        pythonEnvironment: { ...base.manifest.pythonEnvironment!, expectedPythonVersion: "3.11" as const }
      }
    };
    await expect(videoAiCudaPythonEnvironment(cuda.generationRoot, oldPython)).rejects.toThrow("Python 3.12");
  });

  it("rejects site-packages links that escape a verified generation", async () => {
    const outside = path.join(root, "outside");
    await fs.mkdir(outside);
    await fs.rm(site(cuda), { recursive: true });
    await fs.symlink(outside, site(cuda), process.platform === "win32" ? "junction" : "dir");
    await expect(videoAiCudaPythonEnvironment(cuda.generationRoot, base)).rejects.toThrow("越界");
  });
});

function python(id: string, generationRoot: string): VerifiedComponentAsset {
  return {
    path: path.join(generationRoot, "venv", "Scripts", "python.exe"),
    generationRoot,
    manifest: {
      id,
      platform: "win32-x64",
      pythonEnvironment: { expectedPythonVersion: "3.12" }
    } as VerifiedComponentAsset["manifest"]
  };
}
