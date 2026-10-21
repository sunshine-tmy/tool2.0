/**
 * 中文模块说明：测试脚本维护的 Windows Worker 锁文件保持 CPU 基线且可离线复现。
 */
import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import {
  assertUnifiedPythonCatalog,
  assertWorkerPythonVersion,
  assertWorkerWheelPython
} from "./worker-python-policy.mjs";

const scriptsDirectory = path.join(process.cwd(), "scripts");

async function readScript(name) {
  return readFile(path.join(scriptsDirectory, name), "utf8");
}

describe("Windows AI Worker CPU dependency locks", () => {
  it("refuses a mixed-runtime release catalog without deleting or rewriting legacy packages", () => {
    const python = { id: "python-312", dependencyIds: [] };
    const edge = {
      id: "edge-tts",
      dependencyIds: ["python-312", "ffmpeg"],
      pythonEnvironment: { pythonComponentId: "python-312", expectedPythonVersion: "3.12" }
    };
    assertUnifiedPythonCatalog({ manifests: [python, edge, { id: "ffmpeg", dependencyIds: [] }] });
    assert.throws(() => assertUnifiedPythonCatalog({ manifests: [python, { id: "python-311" }] }), /旧 python-311/);
    assert.throws(
      () => assertUnifiedPythonCatalog({ manifests: [python, { ...edge, dependencyIds: ["python-311"] }] }),
      /仍依赖/
    );
    assert.throws(() => assertUnifiedPythonCatalog({ manifests: [edge] }), /共享运行时/);
    assert.throws(
      () =>
        assertUnifiedPythonCatalog({
          manifests: [python, { ...edge, pythonEnvironment: { expectedPythonVersion: "3.11" } }]
        }),
      /共享运行时/
    );
  });

  it("uses one Python 3.12 runtime for all newly built Python capabilities", async () => {
    for (const id of ["edge-tts", "image-ai", "chatterbox", "chatterbox-cuda", "xhs-archive", "xhs-translation"]) {
      const definition = JSON.parse(await readScript(`component-definitions/${id}.json`));
      assert.ok(definition.dependencyIds.includes("python-312"), id);
      assert.ok(!definition.dependencyIds.includes("python-311"), id);
      assert.equal(definition.pythonEnvironment.pythonComponentId, "python-312", id);
      assert.equal(definition.pythonEnvironment.expectedPythonVersion, "3.12", id);
    }
    assertWorkerPythonVersion("3.12\n");
    assert.throws(() => assertWorkerPythonVersion("3.11\n"), /不能复用旧版 venv/);
    assert.throws(() => assertWorkerPythonVersion("3.13\n"), /Python 3.12/);
  });

  it("accepts cp312 and stable ABI wheels but rejects cp311 native wheels", () => {
    for (const filename of [
      "torch-2.6.0+cpu-cp312-cp312-win_amd64.whl",
      "aiohttp-3.14.3-cp312-cp312-macosx_11_0_arm64.whl",
      "cryptography-46.0.0-cp38-abi3-win_amd64.whl",
      "edge_tts-7.3.1-py3-none-any.whl",
      "six-1.17.0-py2.py3-none-any.whl",
      "antlr4_python3_runtime-4.9.3.tar.gz"
    ])
      assertWorkerWheelPython(filename);
    for (const filename of [
      "torch-2.6.0+cpu-cp311-cp311-win_amd64.whl",
      "native-1.0-cp313-abi3-win_amd64.whl",
      "native-1.0-cp312-cp311-win_amd64.whl",
      "native-1.0-cp312t-cp312t-win_amd64.whl",
      "broken.whl"
    ])
      assert.throws(() => assertWorkerWheelPython(filename), /不兼容|文件名无效/);
  });

  it("pins Edge-TTS to the upstream 403 fix with verified package hashes", async () => {
    const requirements = await readScript("edge-tts-requirements.txt");
    const lock = await readScript("edge-tts.lock.txt");
    const definition = JSON.parse(await readScript("component-definitions/edge-tts.json"));
    assert.match(requirements, /^edge-tts==7\.3\.1$/m);
    assert.match(lock, /^edge-tts==7\.3\.1 \\/m);
    assert.ok(lock.includes("2a3c79d6235a7a736d681233823ce5492e829b43eb47beae49aa181237a8f9a4"));
    assert.ok(lock.includes("ee1fabf911b9ea83b38ae93aee5619ee41eaf0b109fef6e65d797dc4ebf1f20f"));
    assert.equal(definition.version, "7.3.1-py312-1");
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
