import { afterEach, expect, it, vi } from "vitest";
import { resolveRifeRuntime } from "../domains/content-archive/video-edit/interpolation-runtime";
import type { ComponentManager } from "../modules/components/component-manager";
afterEach(() => vi.unstubAllEnvs());
it("桌面补帧不使用开发环境中的原生程序或模型路径", async () => {
  vi.stubEnv("TOOLBOX_RIFE_PATH", "development-rife.exe");
  vi.stubEnv("TOOLBOX_RIFE_MODEL_DIR", "development-models");
  expect(await resolveRifeRuntime(true)).toBeUndefined();
});
it("只解析签名目录中的固定程序及 rife-v4.6 模型", async () => {
  const resolve = vi.fn(async (_id: string, asset: string) => ({
    path: `verified/${asset}`,
    generationRoot: "verified",
    manifest: { version: "1.0.0-rife46", files: [{ path: "models/rife-v4.6/flownet.bin", sha256: "a".repeat(64) }] }
  }));
  const runtime = await resolveRifeRuntime(true, { resolveInstalledAsset: resolve } as unknown as ComponentManager);
  expect(runtime?.version).toBe("1.0.0-rife46:aaaaaaaaaaaaaaaa");
  expect(resolve.mock.calls.map((entry) => entry[0])).toEqual(Array(3).fill("video-interpolation"));
  expect(resolve.mock.calls.map((entry) => entry[1])).toEqual([
    `bin/rife-ncnn-vulkan${process.platform === "win32" ? ".exe" : ""}`,
    "models/rife-v4.6/flownet.param",
    "models/rife-v4.6/flownet.bin"
  ]);
});
