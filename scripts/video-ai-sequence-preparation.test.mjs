/** Preparation fixtures never invoke pip, compile models, sign archives or build Electron. */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { prepareVideoAiComponent } from "../tooling/components/prepare-video-ai-component.mjs";
import { prepareVideoAiCudaComponent } from "../tooling/components/prepare-video-ai-cuda-component.mjs";
import { buildComponentPackage } from "../tooling/components/build-component-package.mjs";

const windowsOnly = { skip: process.platform !== "win32" || process.arch !== "x64" };

test("sequence dependency lock preserves old CUDA pins and adds only the validated inference dependencies", async () => {
  const oldLock = await fs.readFile(new URL("./video-ai-cuda.lock.txt", import.meta.url), "utf8");
  const newLock = await fs.readFile(new URL("./video-ai-cuda-sequence.lock.txt", import.meta.url), "utf8");
  const pinnedNames = (text) =>
    [...text.matchAll(/^([a-z0-9_-]+)==([^\s]+).*$/gm)].map(([, name, version]) => `${name}==${version}`);
  assert.deepEqual(pinnedNames(newLock), [...pinnedNames(oldLock), "einops==0.8.1", "scipy==1.17.1"]);
  const script = await fs.readFile(
    new URL("../tooling/components/lock-worker-dependencies.ps1", import.meta.url),
    "utf8"
  );
  assert.match(
    script,
    /video-ai-cuda-sequence-requirements\.txt"; Output = "video-ai-cuda-sequence\.lock\.txt"; Torch = "cu124"/
  );
});

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-sequence-prepare-"));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("toolbox-sequence-prepare-"));
    await fs.rm(root, { recursive: true, force: true });
  });
  return root;
}

test("new Worker cannot be prepared or signed under the old released base version", windowsOnly, async (t) => {
  const root = await fixture(t);
  await assert.rejects(
    prepareVideoAiComponent({ pythonExecutablePath: "unused", stagingDirectory: root, sequenceSupport: false }),
    /旧 1\.0\.0/
  );
  const stage = path.join(root, "stage");
  await fs.mkdir(path.join(stage, "scripts"), { recursive: true });
  await fs.writeFile(path.join(stage, "scripts/video-ai-sequence-support.json"), "{}");
  const output = path.join(root, "output");
  await assert.rejects(
    buildComponentPackage({
      definitionPath: path.resolve("scripts/component-definitions/video-ai.json"),
      stagingDirectory: stage,
      outputDirectory: output,
      signingKeyPath: path.join(root, "must-not-be-read.pem"),
      assetBaseUrl: "https://packages.example.test/components/"
    }),
    /不能使用旧 1\.0\.0/
  );
  await assert.rejects(fs.access(output), { code: "ENOENT" });
});

test(
  "new base preparation explicitly includes the signed asset checker and a new-version definition",
  windowsOnly,
  async (t) => {
    const root = await fixture(t);
    const cache = path.join(root, "cache");
    await fs.mkdir(cache);
    await fs.writeFile(path.join(cache, "model.pt"), "fixture");
    const runCommand = (_python, args) => {
      if (args[0] === "-I") return "3.12\n";
      assert.equal(args[3], "--no-cache-dir");
      const wheelhouse = args[args.indexOf("--dest") + 1];
      mkdirSync(wheelhouse, { recursive: true });
      writeFileSync(path.join(wheelhouse, "fixture-1.0-py3-none-any.whl"), "fixture");
    };
    const result = await prepareVideoAiComponent({
      pythonExecutablePath: path.join(root, "python.exe"),
      stagingDirectory: path.join(root, "base"),
      assetCacheDirectory: cache,
      sequenceSupport: true,
      runCommand,
      assets: [
        {
          name: "model.pt",
          relativePath: "models/video-ai/model.pt",
          url: "https://example.test/model.pt",
          sha256: crypto.createHash("sha256").update("fixture").digest("hex")
        }
      ]
    });
    for (const file of [
      "video_ai_engine_assets.py",
      "video_ai_sequence.py",
      "video_ai_sttn.py",
      "video_ai_propainter.py",
      "video-ai-sequence-support.json"
    ])
      await fs.access(path.join(result.stagingDirectory, "scripts", file));
    assert.equal(JSON.parse(await fs.readFile(result.generatedDefinitionPath, "utf8")).version, "1.1.0-py312-cpu1");
    const support = JSON.parse(
      await fs.readFile(path.join(result.stagingDirectory, "scripts/video-ai-sequence-support.json"), "utf8")
    );
    assert.equal(support.assetSchemaVersion, 1);
  }
);

test(
  "offline base preparation uses only the supplied wheelhouse with hash checks and no indexes",
  windowsOnly,
  async (t) => {
    const root = await fixture(t);
    const cache = path.join(root, "cache");
    await fs.mkdir(cache);
    await fs.writeFile(path.join(cache, "model.pt"), "fixture");
    const input = path.join(root, "offline wheels");
    const result = await prepareVideoAiComponent({
      pythonExecutablePath: path.join(root, "python.exe"),
      stagingDirectory: path.join(root, "offline-stage"),
      assetCacheDirectory: cache,
      wheelhouseDirectory: input,
      assets: [
        {
          name: "model.pt",
          relativePath: "models/video-ai/model.pt",
          url: "https://example.test/model.pt",
          sha256: crypto.createHash("sha256").update("fixture").digest("hex")
        }
      ],
      runCommand: (_python, args) => {
        if (args[0] === "-I") return "3.12\n";
        assert.ok(args.includes("--no-index"));
        assert.ok(args.includes("--require-hashes"));
        assert.ok(args.includes("--no-deps"));
        assert.equal(args[args.indexOf("--find-links") + 1], path.resolve(input));
        assert.ok(!args.includes("--extra-index-url"));
        writeFileSync(path.join(args[args.indexOf("--dest") + 1], "fixture-1.0-py3-none-any.whl"), "fixture");
      }
    });
    assert.equal(result.wheelCount, 1);
  }
);

async function cudaFixture(t) {
  const root = await fixture(t);
  const wheelhouseDirectory = path.join(root, "wheels");
  await fs.mkdir(wheelhouseDirectory);
  for (const name of [
    "torch-2.6.0+cu124-cp312-cp312-win_amd64.whl",
    "torchvision-0.21.0+cu124-cp312-cp312-win_amd64.whl",
    "einops-0.8.1-py3-none-any.whl",
    "scipy-1.17.1-cp312-cp312-win_amd64.whl"
  ])
    await fs.writeFile(path.join(wheelhouseDirectory, name), "fixture");
  return {
    root,
    pythonExecutablePath: path.join(root, "python.exe"),
    stagingDirectory: path.join(root, "cuda"),
    wheelhouseDirectory,
    sequenceCacheDirectory: path.join(root, "pinned-source-cache"),
    runCommand: () => "3.12\n"
  };
}

test(
  "new CUDA preparation maps both engines into the GPU package and preserves dependency version lines",
  windowsOnly,
  async (t) => {
    const f = await cudaFixture(t);
    const calls = [];
    const result = await prepareVideoAiCudaComponent({
      ...f,
      stageSequence: async (args) => {
        calls.push(args);
        await fs.mkdir(args.destination);
        await fs.writeFile(path.join(args.destination, "sequence-bundle.json"), "{}");
        return { engine: args.engine };
      }
    });
    assert.deepEqual(
      calls.map((call) => call.engine),
      ["sttn", "propainter"]
    );
    assert.ok(calls.every((call) => call.cacheRoot === f.sequenceCacheDirectory));
    assert.ok(calls.every((call) => call.adapterReady === false));
    const definition = JSON.parse(await fs.readFile(result.generatedDefinitionPath, "utf8"));
    assert.equal(definition.version, "1.1.0-py312-cu1241");
    assert.match(definition.license.name, /non-commercial/);
    assert.equal(result.engines.length, 2);
    const lock = await fs.readFile(path.join(result.stagingDirectory, "requirements.lock"), "utf8");
    assert.match(lock, /^einops==0\.8\.1/m);
    assert.match(lock, /^scipy==1\.17\.1/m);
    assert.match(lock, /^torch==2\.6\.0\+cu124/m);
  }
);

test(
  "explicit internal trial opt-in reaches both new bundles and needs the pinned sequence cache",
  windowsOnly,
  async (t) => {
    const f = await cudaFixture(t);
    await assert.rejects(
      prepareVideoAiCudaComponent({ ...f, sequenceCacheDirectory: undefined, enableSequenceEngines: true }),
      /sequence-cache/
    );
    const calls = [];
    const result = await prepareVideoAiCudaComponent({
      ...f,
      enableSequenceEngines: true,
      stageSequence: async (args) => {
        calls.push(args);
        await fs.mkdir(args.destination);
        return { engine: args.engine, adapterReady: args.adapterReady };
      }
    });
    assert.equal(calls.length, 2);
    assert.ok(calls.every((call) => call.adapterReady === true));
    const definition = JSON.parse(await fs.readFile(result.generatedDefinitionPath, "utf8"));
    assert.match(definition.purpose, /非商用内部试用/);
    assert.match(definition.purpose, /STTN.*ProPainter/);
  }
);

test(
  "sequence preparation fails before copying large wheels if dependencies are missing, and rejects the old release version",
  windowsOnly,
  async (t) => {
    const f = await cudaFixture(t);
    await fs.unlink(path.join(f.wheelhouseDirectory, "scipy-1.17.1-cp312-cp312-win_amd64.whl"));
    await assert.rejects(prepareVideoAiCudaComponent(f), /缺少锁定/);
    await assert.rejects(fs.access(f.stagingDirectory), { code: "ENOENT" });
    await fs.writeFile(path.join(f.wheelhouseDirectory, "scipy-1.17.1-cp312-cp312-win_amd64.whl"), "fixture");
    await assert.rejects(
      prepareVideoAiCudaComponent({
        ...f,
        definitionPath: path.resolve("scripts/component-definitions/video-ai-cuda.json"),
        stageSequence: async () => ({ engine: "fixture" })
      }),
      /不能覆盖旧签名版本/
    );
    await assert.rejects(fs.access(f.stagingDirectory), { code: "ENOENT" });
  }
);
