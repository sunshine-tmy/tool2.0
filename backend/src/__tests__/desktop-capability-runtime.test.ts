/** 中文模块说明：验证桌面端 CUDA 扩展选择与 CPU 回退。 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComponentManager, ComponentManagerError } from "../modules/components/component-manager";
import { resolveChatterboxWorkerRuntime } from "../runtime/desktop-capability-runtime";

afterEach(() => vi.restoreAllMocks());

describe("desktop Chatterbox runtime selection", () => {
  it("uses the separate CUDA worker and venv while the installed CPU capability supplies model assets", async () => {
    const result = await resolveChatterboxWorkerRuntime(makeComponents({ cudaInstalled: true }));

    expect(result).toMatchObject({
      componentId: "chatterbox-cuda",
      python: { path: "chatterbox-cuda/venv/Scripts/python.exe" },
      script: { path: "chatterbox-cuda/scripts/chatterbox-worker.py" },
      lifecycle: { path: "chatterbox-cuda/scripts/worker_lifecycle.py" }
    });
  });

  it("falls back to the base CPU runtime when CUDA has not been installed", async () => {
    const result = await resolveChatterboxWorkerRuntime(makeComponents({ cudaInstalled: false }));

    expect(result).toMatchObject({
      componentId: "chatterbox",
      python: { path: "chatterbox/venv/Scripts/python.exe" },
      script: { path: "chatterbox/scripts/chatterbox-worker.py" }
    });
  });

  it("can explicitly select the CPU package after a CUDA worker startup failure", async () => {
    const result = await resolveChatterboxWorkerRuntime(makeComponents({ cudaInstalled: true }), false);

    expect(result?.componentId).toBe("chatterbox");
  });

  it("keeps CPU service available if the installed CUDA package fails integrity resolution", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await resolveChatterboxWorkerRuntime(makeComponents({ cudaInstalled: true, cudaCorrupted: true }));

    expect(result?.componentId).toBe("chatterbox");
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("回退到 CPU 运行时"));
  });
});

function makeComponents({ cudaInstalled, cudaCorrupted = false }: { cudaInstalled: boolean; cudaCorrupted?: boolean }) {
  const resolveInstalledPython = async (componentId: string) => {
    if (componentId === "chatterbox-cuda" && !cudaInstalled) {
      throw new ComponentManagerError("COMPONENT_NOT_INSTALLED", "not installed");
    }
    return {
      path: `${componentId}/venv/Scripts/python.exe`,
      generationRoot: `${componentId}/generation`,
      manifest: {} as never
    };
  };
  const resolveInstalledAsset = async (componentId: string, relativePath: string) => {
    if (componentId === "chatterbox-cuda" && !cudaInstalled) {
      throw new ComponentManagerError("COMPONENT_NOT_INSTALLED", "not installed");
    }
    if (componentId === "chatterbox-cuda" && cudaCorrupted) {
      throw new ComponentManagerError("COMPONENT_INSTALL_FAILED", "asset integrity failure");
    }
    return {
      path: `${componentId}/${relativePath}`,
      generationRoot: `${componentId}/generation`,
      manifest: {} as never
    };
  };
  return { resolveInstalledPython, resolveInstalledAsset } as unknown as ComponentManager;
}
