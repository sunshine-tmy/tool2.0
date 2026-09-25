/** 中文模块说明：验证 AI 图片离线能力的 CPU 固定版本、来源摘要和组件定义。 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  IMAGE_AI_MODEL_ASSETS,
  IMAGE_AI_SOURCE_DISTRIBUTIONS,
  omitImageAiSourceDistributions,
  validateImageAiCpuLock,
  verifyImageAiAssets
} from "./prepare-image-ai-component.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

test("image AI package uses pinned offline CPU model assets and one signed worker component", async () => {
  const definition = JSON.parse(
    await fs.readFile(path.join(SCRIPT_DIRECTORY, "component-definitions/image-ai.json"), "utf8")
  );
  assert.equal(definition.id, "image-ai");
  assert.deepEqual(definition.dependencyIds, ["python-311"]);
  assert.deepEqual(definition.taskToolIds, ["image-ai"]);
  assert.equal(definition.pythonEnvironment.expectedPythonVersion, "3.11");
  assert.equal(IMAGE_AI_MODEL_ASSETS.length, 10);
  assert.ok(IMAGE_AI_MODEL_ASSETS.every((asset) => new URL(asset.url).protocol === "https:"));
  assert.ok(IMAGE_AI_MODEL_ASSETS.every((asset) => /^[a-f0-9]{64}$/.test(asset.sha256)));
  assert.ok(IMAGE_AI_MODEL_ASSETS.some((asset) => asset.relativePath.endsWith("birefnet-general.onnx")));
  assert.ok(IMAGE_AI_MODEL_ASSETS.some((asset) => asset.relativePath.endsWith("ocr/detection/inference.yml")));
  assert.ok(IMAGE_AI_MODEL_ASSETS.some((asset) => asset.relativePath.endsWith("ocr/recognition/inference.yml")));
  assert.equal(IMAGE_AI_SOURCE_DISTRIBUTIONS[0].fileName, "basicsr-1.4.2.tar.gz");
  assert.equal(
    IMAGE_AI_SOURCE_DISTRIBUTIONS[0].sha256,
    "b89b595a87ef964cda9913b4d99380ddb6554c965577c0c10cb7b78e31301e87"
  );
});

test("image AI dependency lock accepts only the CPU PyTorch and ONNX runtime baseline", async () => {
  const lock = await fs.readFile(path.join(SCRIPT_DIRECTORY, "image-ai.lock.txt"), "utf8");
  validateImageAiCpuLock(lock);
  const downloadLock = omitImageAiSourceDistributions(lock);
  assert.doesNotMatch(downloadLock.downloadLockText, /^(basicsr|filterpy)==/m);
  assert.equal(downloadLock.omittedBlocks.length, 2);
  assert.match(
    downloadLock.omittedBlocks[0],
    /sha256:b89b595a87ef964cda9913b4d99380ddb6554c965577c0c10cb7b78e31301e87/
  );
  assert.match(
    downloadLock.omittedBlocks[1],
    /sha256:4f2a4d39e4ea601b9ab42b2db08b5918a9538c168cff1c6895ae26646f3d73b1/
  );
  validateImageAiCpuLock("torch==2.6.0+cpu\ntorchvision==0.21.0+cpu\nonnxruntime==1.30.0\n");
  assert.throws(
    () => validateImageAiCpuLock("torch==2.6.0\ntorchvision==0.21.0+cpu\nonnxruntime==1.30.0\n"),
    /CPU 版 PyTorch/
  );
  assert.throws(
    () => validateImageAiCpuLock("torch==2.6.0+cpu\ntorchvision==0.21.0+cpu\nonnxruntime-gpu==1.30.0\n"),
    /CPU 版 ONNX Runtime/
  );
  assert.throws(
    () =>
      validateImageAiCpuLock("torch==2.6.0+cpu\ntorchvision==0.21.0+cpu\nonnxruntime==1.30.0\nnvidia-cublas==1.0\n"),
    /NVIDIA\/CUDA/
  );
});

test("cached image model assets are SHA-256 verified before packaging", async (context) => {
  const cache = await fs.mkdtemp(path.join(os.tmpdir(), "image-ai-assets-test-"));
  context.after(() => fs.rm(cache, { recursive: true, force: true }));
  const content = Buffer.from("fixed test model");
  const asset = {
    name: "model.bin",
    url: "https://models.example.invalid/fixed/model.bin",
    sha256: createHash("sha256").update(content).digest("hex"),
    relativePath: "models/model.bin"
  };
  await fs.writeFile(path.join(cache, asset.name), content);
  assert.equal((await verifyImageAiAssets(cache, [asset]))[0].bytes, content.length);
  await fs.writeFile(path.join(cache, asset.name), "tampered");
  await assert.rejects(verifyImageAiAssets(cache, [asset]), /SHA-256 不匹配/);
});
