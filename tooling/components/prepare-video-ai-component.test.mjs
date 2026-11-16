/** 中文模块说明：验证 Mac 视频基础包只接受固定 MPS 依赖、原生 wheel 与已验收引擎 bundle。 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { assertMacOSWheelName, copyMacSequenceBundle, validateVideoAiCpuLock } from "./prepare-video-ai-component.mjs";

const repositoryRoot = process.cwd();
const temporaryRoots = [];

async function makeRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-macos-video-package-"));
  temporaryRoots.push(root);
  return root;
}

after(async () => {
  await Promise.all(temporaryRoots.map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("Mac video component preparation", () => {
  it("accepts only the frozen native PyTorch lock without CUDA", async () => {
    const lock = await fs.readFile(
      path.join(repositoryRoot, "tooling/components/macos/locks/video-ai.lock.txt"),
      "utf8"
    );
    assert.doesNotThrow(() => validateVideoAiCpuLock(lock, "darwin-arm64"));
    assert.throws(
      () => validateVideoAiCpuLock(lock.replace("torch==2.6.0", "torch==2.6.0+cu124"), "darwin-arm64"),
      /原生 PyTorch/u
    );
    assert.throws(
      () => validateVideoAiCpuLock(lock + "\nnvidia-cublas-cu12==12.4.5\n", "darwin-arm64"),
      /NVIDIA\/CUDA/u
    );
  });

  it("requires arm64-compatible wheels with a deployment target no newer than macOS 14", () => {
    assert.doesNotThrow(() => assertMacOSWheelName("numpy-2.2.0-cp312-cp312-macosx_11_0_arm64.whl"));
    assert.doesNotThrow(() => assertMacOSWheelName("typing_extensions-4.14.0-py3-none-any.whl"));
    assert.throws(() => assertMacOSWheelName("numpy-2.2.0-cp312-cp312-win_amd64.whl"), /Windows wheel/u);
    assert.throws(() => assertMacOSWheelName("numpy-2.2.0-cp312-cp312-macosx_15_0_arm64.whl"), /macOS 14/u);
    assert.throws(
      () => assertMacOSWheelName("numpy-2.2.0-cp312-cp312-manylinux_2_17_aarch64.whl"),
      /arm64\/universal2/u
    );
  });

  it("refuses a bundle that has not passed the frozen engine gate", async () => {
    const root = await makeRoot();
    const sourceDirectory = path.join(root, "candidate");
    const destinationDirectory = path.join(root, "stage");
    await fs.mkdir(sourceDirectory);
    await fs.writeFile(path.join(sourceDirectory, "sequence-bundle.json"), JSON.stringify({ engine: "sttn" }));
    await fs.writeFile(path.join(sourceDirectory, "PROVENANCE.json"), JSON.stringify({}));
    await assert.rejects(
      copyMacSequenceBundle({ sourceDirectory, destinationDirectory, engine: "sttn" }),
      /尚未通过已冻结的 MPS 验收定义/u
    );
    await assert.rejects(fs.access(destinationDirectory), { code: "ENOENT" });
  });
});
