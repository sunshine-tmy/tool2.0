/** S02 package matrix: descriptors remain signed, bounded and separate from base models. */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { VerifiedComponentAsset } from "../modules/components/types";
import { createDesktopComponentSelfTest } from "../modules/components/desktop-component-self-test";
import {
  videoAiSequenceBundle,
  videoAiSequenceEnvironment,
  VIDEO_AI_SEQUENCE_LOADER,
  VIDEO_AI_SEQUENCE_RUNTIME_FILES,
  VIDEO_AI_SEQUENCE_SUPPORT
} from "../modules/components/video-ai-sequence-assets";
import { resolveVideoAiWorkerRuntime } from "../runtime/desktop-capability-runtime";
import type { ComponentManager } from "../modules/components/component-manager";

let root: string;
let base: VerifiedComponentAsset;
let cuda: VerifiedComponentAsset;

function python(id: string): VerifiedComponentAsset {
  const generationRoot = path.join(root, `${id} 中文 generation`);
  return {
    generationRoot,
    path: path.join(generationRoot, "venv", "Scripts", "python.exe"),
    manifest: {
      id,
      platform: "win32-x64",
      version: "1.1.0-py312-cpu1",
      files: [],
      pythonEnvironment: { expectedPythonVersion: "3.12" }
    } as unknown as VerifiedComponentAsset["manifest"]
  };
}
async function asset(python: VerifiedComponentAsset, relative: string, contents: string) {
  const file = path.join(python.generationRoot, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, contents);
  python.manifest.files = python.manifest.files.filter((listed) => listed.path !== relative);
  python.manifest.files.push({
    path: relative,
    bytes: Buffer.byteLength(contents),
    sha256: crypto.createHash("sha256").update(contents).digest("hex")
  });
  return file;
}
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-sequence-runtime-"));
  base = python("video-ai");
  cuda = python("video-ai-cuda");
  for (const packageAsset of [base, cuda])
    await fs.mkdir(path.join(packageAsset.generationRoot, "venv/Lib/site-packages"), { recursive: true });
  await asset(
    base,
    VIDEO_AI_SEQUENCE_SUPPORT,
    JSON.stringify({ assetSchemaVersion: 1, workerFeature: "sequence-assets-v1", sequenceRuntime: 1 })
  );
  await asset(base, VIDEO_AI_SEQUENCE_LOADER, "# signed application-independent asset check\n");
  for (const file of VIDEO_AI_SEQUENCE_RUNTIME_FILES) await asset(base, file, "# signed sequence runtime\n");
  await asset(cuda, "requirements.lock", "torch==2.6.0+cu124\n");
  for (const engine of ["sttn", "propainter"] as const)
    await asset(
      cuda,
      videoAiSequenceBundle(engine),
      JSON.stringify({ assetSchemaVersion: 1, engine, namespace: `toolbox_video_ai_vendor.${engine}` })
    );
});
afterEach(async () => {
  vi.restoreAllMocks();
  if (path.dirname(root) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith("toolbox-sequence-runtime-"))
    throw new Error("Invalid fixture cleanup");
  await fs.rm(root, { recursive: true, force: true });
});

it("resolves distinct verified GPU roots while retaining base CPU models and CUDA-first dependencies", async () => {
  const runtime = await resolveVideoAiWorkerRuntime({
    resolveInstalledPython: async (id: string) => (id === "video-ai" ? base : cuda)
  } as unknown as ComponentManager);
  expect(runtime?.environment).toMatchObject({
    VIDEO_AI_STTN_ENGINE_ROOT: path.join(cuda.generationRoot, "models/video-ai/engines/sttn"),
    VIDEO_AI_PROPAINTER_ENGINE_ROOT: path.join(cuda.generationRoot, "models/video-ai/engines/propainter")
  });
  expect(runtime?.environment.PYTHONPATH).toBe(
    [cuda, base].map((item) => path.join(item.generationRoot, "venv/Lib/site-packages")).join(path.delimiter)
  );
  expect(runtime?.environment).not.toHaveProperty("VIDEO_AI_MODELS_ROOT");
});
it("allows a new base with the old CUDA package without requiring sequence assets", async () => {
  cuda.manifest.files = cuda.manifest.files.filter((file) => file.path === "requirements.lock");
  expect(await videoAiSequenceEnvironment(cuda, base)).toEqual({});
});
it("rejects missing or tampered signed sequence runtime helpers before activation", async () => {
  const file = VIDEO_AI_SEQUENCE_RUNTIME_FILES[0];
  await fs.appendFile(path.join(base.generationRoot, file), "tampered");
  await expect(videoAiSequenceEnvironment(cuda, base)).rejects.toThrow("大小不符");
  base.manifest.files = base.manifest.files.filter((entry) => entry.path !== file);
  await expect(videoAiSequenceEnvironment(cuda, base)).rejects.toThrow("签名清单缺少");
});
it("verifies new base helpers even with no optional CUDA package installed", async () => {
  await fs.appendFile(path.join(base.generationRoot, VIDEO_AI_SEQUENCE_RUNTIME_FILES[0]), "tampered");
  await expect(
    resolveVideoAiWorkerRuntime({
      resolveInstalledPython: async (id: string) => {
        if (id === "video-ai") return base;
        throw new Error("optional GPU must not be queried before base validation");
      }
    } as unknown as ComponentManager)
  ).rejects.toThrow("大小不符");
});
it("rejects a new CUDA package with an old/missing/incompatible base support protocol", async () => {
  base.manifest.files = [];
  await expect(videoAiSequenceEnvironment(cuda, base)).rejects.toThrow("签名清单缺少");
  await asset(base, VIDEO_AI_SEQUENCE_SUPPORT, JSON.stringify({ assetSchemaVersion: 99, workerFeature: "unknown" }));
  await expect(videoAiSequenceEnvironment(cuda, base)).rejects.toThrow("不支持");
});
it("rejects incomplete bundles, mismatched platform and signed descriptor tampering", async () => {
  await fs.appendFile(path.join(cuda.generationRoot, videoAiSequenceBundle("sttn")), " ");
  await expect(videoAiSequenceEnvironment(cuda, base)).rejects.toThrow("大小不符");
  await asset(
    cuda,
    videoAiSequenceBundle("sttn"),
    JSON.stringify({ assetSchemaVersion: 1, engine: "propainter", namespace: "toolbox_video_ai_vendor.sttn" })
  );
  await expect(videoAiSequenceEnvironment(cuda, base)).rejects.toThrow("协议不兼容");
  cuda.manifest.platform = "darwin-arm64";
  await expect(videoAiSequenceEnvironment(cuda, base)).rejects.toThrow("Windows");
});
it("does not follow an engine descriptor junction out of the verified generation", async () => {
  const directory = path.join(cuda.generationRoot, "models/video-ai/engines/sttn");
  const outside = path.join(root, "outside");
  await fs.mkdir(outside);
  await fs.copyFile(path.join(directory, "sequence-bundle.json"), path.join(outside, "sequence-bundle.json"));
  await fs.rm(directory, { recursive: true });
  await fs.symlink(outside, directory, process.platform === "win32" ? "junction" : "dir");
  await expect(videoAiSequenceEnvironment(cuda, base)).rejects.toThrow("越界");
});
it("runs the signed base asset checker during new CUDA install and propagates failure", async () => {
  const run = vi.fn(async (_python: string, args: string[]) =>
    args[0] === "-c" ? '{"available":true}' : '{"available":false}'
  );
  await expect(
    createDesktopComponentSelfTest(run, undefined, async () => base)(cuda.manifest, cuda.generationRoot)
  ).rejects.toThrow("时序引擎资源");
  expect(run).toHaveBeenCalledTimes(2);
  expect(run.mock.calls[1][1]).toEqual([
    path.join(base.generationRoot, VIDEO_AI_SEQUENCE_LOADER),
    "--sttn-root",
    path.dirname(path.join(cuda.generationRoot, videoAiSequenceBundle("sttn"))),
    "--propainter-root",
    path.dirname(path.join(cuda.generationRoot, videoAiSequenceBundle("propainter")))
  ]);
});
it("falls back to the existing CPU runtime if an optional sequence package is incompatible", async () => {
  base.manifest.files = [];
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const runtime = await resolveVideoAiWorkerRuntime({
    resolveInstalledPython: async (id: string) => (id === "video-ai" ? base : cuda)
  } as unknown as ComponentManager);
  expect(runtime).toMatchObject({ componentId: "video-ai", python: base, environment: {} });
});
