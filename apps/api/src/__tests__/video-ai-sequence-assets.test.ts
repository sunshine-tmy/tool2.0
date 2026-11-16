/** S02 package matrix: descriptors remain signed, bounded and separate from base models. */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { VerifiedComponentAsset } from "../modules/components/types";
import { createDesktopComponentSelfTest } from "../modules/components/desktop-component-self-test";
import {
  macOSVideoAiSequenceEnvironment,
  VIDEO_AI_MACOS_SEQUENCE_SUPPORT,
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
let macBase: VerifiedComponentAsset;

type FixtureSource = { path: string; sha256: string; gitBlobSha1: string };
type FixtureWeight = { path: string; bytes: number; sha256: string };
type FixtureEngine = {
  repository: string;
  revision: string;
  license: string;
  namespace: string;
  adapterReady: boolean;
  supportedDevices: string[];
  executionMode: string;
  sources: FixtureSource[];
  weights: FixtureWeight[];
};
type FixtureSupport = {
  assetSchemaVersion: number;
  workerFeature: string;
  sequenceRuntime: number;
  platform: string;
  torchVersion: string;
  torchvisionVersion: string;
  engines: Record<"sttn" | "propainter", FixtureEngine>;
};

function python(id: string, platform: "win32-x64" | "darwin-arm64" = "win32-x64"): VerifiedComponentAsset {
  const generationRoot = path.join(root, `${id} 中文 generation`);
  return {
    generationRoot,
    path:
      platform === "darwin-arm64"
        ? path.join(generationRoot, "venv", "bin", "python")
        : path.join(generationRoot, "venv", "Scripts", "python.exe"),
    manifest: {
      id,
      platform,
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

async function createMacBase() {
  macBase = python("video-ai", "darwin-arm64");
  const support = JSON.parse(
    await fs.readFile(
      new URL("../../../../tooling/components/macos/video-ai-sequence-support.json", import.meta.url),
      "utf8"
    )
  ) as FixtureSupport;
  for (const engine of ["sttn", "propainter"] as const) {
    const definition = support.engines[engine];
    const license = `license fixture for ${engine}\n`;
    definition.sources = definition.sources.map((source) => ({
      ...source,
      sha256:
        source.path === "LICENSE"
          ? crypto.createHash("sha256").update(license).digest("hex")
          : crypto.createHash("sha256").update(`source:${engine}:${source.path}`).digest("hex")
    }));
    definition.weights = definition.weights.map((weight) => {
      const bytes = Buffer.from(`weight:${engine}:${String(weight.path)}`);
      return {
        ...weight,
        bytes: bytes.length,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex")
      };
    });
  }
  await asset(macBase, VIDEO_AI_MACOS_SEQUENCE_SUPPORT, JSON.stringify(support));

  for (const engine of ["sttn", "propainter"] as const) {
    const definition = support.engines[engine];
    const relativeRoot = path.posix.dirname(videoAiSequenceBundle(engine));
    const bundleFiles: Array<Record<string, unknown>> = [];
    const sourceProvenance = [];
    const weightsProvenance = [];
    const license = `license fixture for ${engine}\n`;
    const sourceDirectories = new Set<string>(["vendor"]);
    for (const source of definition.sources) {
      if (source.path === "LICENSE") continue;
      const relative = `vendor/${source.path}`;
      const contents = `# ${engine} fixture ${source.path}\n`;
      await asset(macBase, `${relativeRoot}/${relative}`, contents);
      bundleFiles.push({
        path: relative,
        role: "source",
        bytes: Buffer.byteLength(contents),
        sha256: crypto.createHash("sha256").update(contents).digest("hex")
      });
      sourceProvenance.push({
        path: source.path,
        gitBlobSha1: source.gitBlobSha1,
        originalSha256: source.sha256,
        bundledSha256: crypto.createHash("sha256").update(contents).digest("hex")
      });
      let directory = path.posix.dirname(relative);
      while (directory.startsWith("vendor")) {
        sourceDirectories.add(directory);
        directory = path.posix.dirname(directory);
      }
    }
    for (const directory of sourceDirectories) {
      const init = `${directory}/__init__.py`;
      if (bundleFiles.some((file) => file.path === init)) continue;
      const contents = "# Isolated inference package.\n";
      await asset(macBase, `${relativeRoot}/${init}`, contents);
      bundleFiles.push({
        path: init,
        role: "source",
        bytes: Buffer.byteLength(contents),
        sha256: crypto.createHash("sha256").update(contents).digest("hex")
      });
    }
    await asset(macBase, `${relativeRoot}/LICENSE`, license);
    bundleFiles.push({
      path: "LICENSE",
      role: "license",
      bytes: Buffer.byteLength(license),
      sha256: crypto.createHash("sha256").update(license).digest("hex")
    });
    for (const weight of definition.weights) {
      const contents = Buffer.from(`weight:${engine}:${weight.path}`);
      await asset(macBase, `${relativeRoot}/${weight.path}`, contents.toString("utf8"));
      bundleFiles.push({
        path: weight.path,
        role: "weight",
        bytes: contents.length,
        sha256: weight.sha256
      });
      weightsProvenance.push({
        name: path.posix.basename(weight.path),
        bytes: weight.bytes,
        sha256: weight.sha256,
        url: `https://example.invalid/${path.posix.basename(weight.path)}`
      });
    }
    const provenance = {
      repository: definition.repository,
      revision: definition.revision,
      license: definition.license,
      modifications: [],
      sources: sourceProvenance,
      weights: weightsProvenance
    };
    const provenanceText = `${JSON.stringify(provenance, null, 2)}\n`;
    await asset(macBase, `${relativeRoot}/PROVENANCE.json`, provenanceText);
    bundleFiles.push({
      path: "PROVENANCE.json",
      role: "provenance",
      bytes: Buffer.byteLength(provenanceText),
      sha256: crypto.createHash("sha256").update(provenanceText).digest("hex")
    });
    const descriptor = {
      assetSchemaVersion: 1,
      engine,
      namespace: definition.namespace,
      repository: definition.repository,
      revision: definition.revision,
      license: definition.license,
      adapterReady: definition.adapterReady,
      files: bundleFiles
    };
    await asset(macBase, videoAiSequenceBundle(engine), JSON.stringify(descriptor));
  }
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
  const cudaRoot = await fs.realpath(cuda.generationRoot);
  const runtime = await resolveVideoAiWorkerRuntime({
    resolveInstalledPython: async (id: string) => (id === "video-ai" ? base : cuda)
  } as unknown as ComponentManager);
  expect(runtime?.environment).toMatchObject({
    VIDEO_AI_STTN_ENGINE_ROOT: path.join(cudaRoot, "models/video-ai/engines/sttn"),
    VIDEO_AI_PROPAINTER_ENGINE_ROOT: path.join(cudaRoot, "models/video-ai/engines/propainter")
  });
  const pythonPath = await Promise.all(
    [cuda, base].map(async (item) => path.join(await fs.realpath(item.generationRoot), "venv/Lib/site-packages"))
  );
  expect(runtime?.environment.PYTHONPATH).toBe(pythonPath.join(path.delimiter));
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
  const baseRoot = await fs.realpath(base.generationRoot);
  const run = vi.fn(async (_python: string, args: string[]) =>
    args[0] === "-c" ? '{"available":true}' : '{"available":false}'
  );
  await expect(
    createDesktopComponentSelfTest(run, undefined, async () => base)(cuda.manifest, cuda.generationRoot)
  ).rejects.toThrow("时序引擎资源");
  expect(run).toHaveBeenCalledTimes(2);
  expect(run.mock.calls[1][1]).toEqual([
    path.join(baseRoot, VIDEO_AI_SEQUENCE_LOADER),
    "--sttn-root",
    path.dirname(path.join(await fs.realpath(cuda.generationRoot), videoAiSequenceBundle("sttn"))),
    "--propainter-root",
    path.dirname(path.join(await fs.realpath(cuda.generationRoot), videoAiSequenceBundle("propainter")))
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

it("keeps the Mac support definition aligned with the pinned upstream source and weight lock", async () => {
  const support = JSON.parse(
    await fs.readFile(
      new URL("../../../../tooling/components/macos/video-ai-sequence-support.json", import.meta.url),
      "utf8"
    )
  ) as FixtureSupport;
  const lock = JSON.parse(
    await fs.readFile(new URL("../../../../tooling/video-ai/sequence-sources.json", import.meta.url), "utf8")
  ) as {
    engines: Record<
      "sttn" | "propainter",
      { files: FixtureSource[]; weights: Array<Omit<FixtureWeight, "path"> & { name: string }> }
    >;
  };
  for (const engine of ["sttn", "propainter"] as const) {
    expect(support.engines[engine].sources).toEqual(
      lock.engines[engine].files.map(({ path: sourcePath, sha256, gitBlobSha1 }) => ({
        path: sourcePath,
        sha256,
        gitBlobSha1
      }))
    );
    expect(support.engines[engine].weights).toEqual(
      lock.engines[engine].weights.map(({ name, bytes, sha256 }) => ({
        path: `weights/${name}`,
        bytes,
        sha256
      }))
    );
  }
});

it("resolves both Mac sequence engines only from the verified base generation", async () => {
  await createMacBase();
  const macRoot = await fs.realpath(macBase.generationRoot);
  const environment = await macOSVideoAiSequenceEnvironment(macBase, { requireBothEngines: true });
  expect(environment).toMatchObject({
    VIDEO_AI_SEQUENCE_PACKAGE_ROOT: macRoot,
    VIDEO_AI_SEQUENCE_DEVICE: "mps",
    VIDEO_AI_STTN_ENGINE_ROOT: path.join(macRoot, "models/video-ai/engines/sttn"),
    VIDEO_AI_PROPAINTER_ENGINE_ROOT: path.join(macRoot, "models/video-ai/engines/propainter")
  });

  const runtime = await resolveVideoAiWorkerRuntime({
    resolveInstalledPython: async (id: string) => {
      expect(id).toBe("video-ai");
      return macBase;
    }
  } as unknown as ComponentManager);
  expect(runtime?.componentId).toBe("video-ai");
  expect(runtime?.python).toBe(macBase);
  expect(runtime?.environment).toMatchObject(environment);
  expect(runtime?.environment).not.toHaveProperty("PYTHONPATH");
});

it("keeps only the unaffected Mac engine when one signed weight is missing", async () => {
  await createMacBase();
  const macRoot = await fs.realpath(macBase.generationRoot);
  const missingWeight = "models/video-ai/engines/sttn/weights/sttn.pth";
  await fs.rm(path.join(macBase.generationRoot, missingWeight));
  macBase.manifest.files = macBase.manifest.files.filter((file) => file.path !== missingWeight);

  const environment = await macOSVideoAiSequenceEnvironment(macBase);
  expect(environment).not.toHaveProperty("VIDEO_AI_STTN_ENGINE_ROOT");
  expect(environment.VIDEO_AI_STTN_SEQUENCE_REASON).toMatch(/缺少/u);
  expect(environment.VIDEO_AI_PROPAINTER_ENGINE_ROOT).toBe(path.join(macRoot, "models/video-ai/engines/propainter"));
});

it("rejects a tampered Mac descriptor, path traversal, wrong platform and runtime version", async () => {
  await createMacBase();
  const descriptorPath = videoAiSequenceBundle("sttn");
  const descriptorFile = path.join(macBase.generationRoot, descriptorPath);
  const descriptor = JSON.parse(await fs.readFile(descriptorFile, "utf8")) as Record<string, unknown>;
  await fs.appendFile(descriptorFile, "tampered");
  await expect(macOSVideoAiSequenceEnvironment(macBase, { requireBothEngines: true })).rejects.toThrow(
    /文件大小不符|摘要不符/u
  );

  await asset(macBase, descriptorPath, JSON.stringify(descriptor));
  descriptor.files = [
    ...((descriptor.files as Array<Record<string, unknown>>) ?? []),
    { path: "vendor/../../outside.py", role: "source", bytes: 1, sha256: "0".repeat(64) }
  ];
  await asset(macBase, descriptorPath, JSON.stringify(descriptor));
  await expect(macOSVideoAiSequenceEnvironment(macBase, { requireBothEngines: true })).rejects.toThrow(/闭包/u);

  macBase.manifest.platform = "win32-x64";
  await expect(macOSVideoAiSequenceEnvironment(macBase)).rejects.toThrow(/darwin-arm64/u);
  macBase.manifest.platform = "darwin-arm64";

  const support = JSON.parse(
    await fs.readFile(path.join(macBase.generationRoot, VIDEO_AI_MACOS_SEQUENCE_SUPPORT), "utf8")
  ) as FixtureSupport;
  support.torchVersion = "2.5.0";
  await asset(macBase, VIDEO_AI_MACOS_SEQUENCE_SUPPORT, JSON.stringify(support));
  await expect(macOSVideoAiSequenceEnvironment(macBase)).rejects.toThrow(/PyTorch 版本不兼容/u);
});

it("does not expose a Mac engine when the signed device definition has not approved it", async () => {
  await createMacBase();
  const support = JSON.parse(
    await fs.readFile(path.join(macBase.generationRoot, VIDEO_AI_MACOS_SEQUENCE_SUPPORT), "utf8")
  ) as FixtureSupport;
  support.engines.sttn.adapterReady = false;
  await asset(macBase, VIDEO_AI_MACOS_SEQUENCE_SUPPORT, JSON.stringify(support));

  const environment = await macOSVideoAiSequenceEnvironment(macBase);
  expect(environment).not.toHaveProperty("VIDEO_AI_STTN_ENGINE_ROOT");
  expect(environment.VIDEO_AI_STTN_SEQUENCE_REASON).toMatch(/尚未通过/u);
  expect(environment.VIDEO_AI_PROPAINTER_ENGINE_ROOT).toContain("engines/propainter");
});

it("validates signed Mac sequence assets during install self-test without loading either model", async () => {
  await createMacBase();
  for (const [relative, contents] of [
    ["scripts/video-ai-worker.py", "# worker fixture\n"],
    ["models/video-ai/big-lama.pt", "fixture model\n"],
    ["models/video-ai/ocr/detection/inference.yml", "fixture: true\n"],
    ["models/video-ai/ocr/recognition/inference.yml", "fixture: true\n"],
    [VIDEO_AI_SEQUENCE_LOADER, "# Mac engine asset loader fixture\n"],
    ["venv/bin/python", "#!/bin/sh\n"]
  ]) {
    const file = await asset(macBase, relative, contents);
    if (relative === "venv/bin/python") await fs.chmod(file, 0o755);
  }
  const run = vi.fn(async (_python: string, _args: string[]) => '{"available":true}');
  const selfTest = createDesktopComponentSelfTest(
    run,
    async () => "/verified/ffmpeg",
    async () => macBase
  );
  await selfTest(macBase.manifest, macBase.generationRoot);
  expect(run).toHaveBeenCalledTimes(2);
  expect(run.mock.calls.map((call) => call[1])).toEqual([
    ["-c", expect.stringContaining("import json, torch")],
    [path.join(macBase.generationRoot, "scripts/video-ai-worker.py"), "--check"]
  ]);
});
