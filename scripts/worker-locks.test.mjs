/**
 * 中文模块说明：测试脚本维护的 Windows Worker 锁文件保持 CPU 基线且可离线复现。
 */
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const scriptsDirectory = path.join(process.cwd(), "scripts");

async function readScript(name) {
  return readFile(path.join(scriptsDirectory, name), "utf8");
}

describe("Windows AI Worker CPU dependency locks", () => {
  it("pins Edge-TTS to the upstream 403 fix with verified package hashes", async () => {
    const requirements = await readScript("edge-tts-requirements.txt");
    const lock = await readScript("edge-tts.lock.txt");
    const definition = JSON.parse(await readScript("component-definitions/edge-tts.json"));
    assert.match(requirements, /^edge-tts==7\.3\.1$/m);
    assert.match(lock, /^edge-tts==7\.3\.1 \\/m);
    assert.ok(lock.includes("2a3c79d6235a7a736d681233823ce5492e829b43eb47beae49aa181237a8f9a4"));
    assert.ok(lock.includes("ee1fabf911b9ea83b38ae93aee5619ee41eaf0b109fef6e65d797dc4ebf1f20f"));
    assert.equal(definition.version, "7.3.1-1");
  });

  it("pins Chatterbox to CPU-only PyTorch", async () => {
    const lock = await readScript("chatterbox.lock.txt");
    const generator = await readScript("lock-worker-dependencies.ps1");

    assert.match(lock, /^torch==2\.6\.0\+cpu/m);
    assert.match(lock, /^torchaudio==2\.6\.0\+cpu/m);
    assert.match(generator, /chatterbox-requirements\.txt"; Output = "chatterbox\.lock\.txt"; Torch = "cpu"/);
    assert.doesNotMatch(lock, /^nvidia[-_\w]*==/m);
  });

  it("pins image AI to CPU PyTorch and CPU ONNX Runtime", async () => {
    const lock = await readScript("image-ai.lock.txt");
    const requirements = await readScript("image-ai-requirements.txt");
    const generator = await readScript("lock-worker-dependencies.ps1");

    assert.match(lock, /^torch==2\.6\.0\+cpu/m);
    assert.match(lock, /^torchvision==0\.21\.0\+cpu/m);
    assert.match(lock, /^onnxruntime==[\d.]+/m);
    assert.doesNotMatch(lock, /^onnxruntime-gpu==/m);
    assert.doesNotMatch(lock, /^nvidia[-_\w]*==/m);
    assert.match(requirements, /^rembg\[cpu\]==/m);
    assert.match(generator, /image-ai-requirements\.txt"; Output = "image-ai\.lock\.txt"; Torch = "cpu"/);
  });
});
