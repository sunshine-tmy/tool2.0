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
