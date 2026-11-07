/**
 * 中文模块说明：测试视频去字幕能力包的组件定义、锁策略与准备脚本契约。
 */
import { strict as assert } from "node:assert";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  VIDEO_AI_MODEL_ASSETS,
  stageEngineDirectory,
  validateVideoAiCpuLock
} from "../tooling/components/prepare-video-ai-component.mjs";
import {
  groupVideoAiCudaWheelhouseAssets,
  validateVideoAiCudaLock
} from "../tooling/components/prepare-video-ai-cuda-component.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const ALLOWED_GROUPS = ["shared", "media", "audio", "image", "archive", "translation"];

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(SCRIPT_DIRECTORY, relativePath), "utf8"));
}

test("视频去字幕基础包沿用共享 Python 3.12 与 FFmpeg，不重复打包媒体运行时", async () => {
  const definition = await readJson("component-definitions/video-ai.json");
  assert.equal(definition.id, "video-ai");
  assert.ok(ALLOWED_GROUPS.includes(definition.groupId));
  assert.deepEqual(definition.dependencyIds, ["python-312", "ffmpeg"]);
  assert.equal(definition.pythonEnvironment.pythonComponentId, "python-312");
  assert.equal(definition.pythonEnvironment.expectedPythonVersion, "3.12");
  assert.match(definition.version, /^1\.0\.0-py312-cpu1$/);
  assert.ok(definition.installConditions.some((line) => line.includes("不会在处理过程中下载")));
});

test("GPU 扩展包依赖已安装的基础包，并声明显存与驱动边界", async () => {
  const definition = await readJson("component-definitions/video-ai-cuda.json");
  assert.equal(definition.id, "video-ai-cuda");
  assert.deepEqual(definition.dependencyIds, ["video-ai", "python-312"]);
  assert.match(definition.version, /^1\.0\.0-py312-cu1241$/);
  assert.ok(definition.installConditions.some((line) => line.includes("RTX 3060 Ti")));
  assert.ok(definition.installConditions.some((line) => line.includes("不会安装或修改显卡驱动")));
  assert.ok(definition.installConditions.some((line) => line.includes("720p")));
});

test("两个锁任务登记在共享的 Worker 锁生成脚本中", async () => {
  const script = await fs.readFile(
    path.join(SCRIPT_DIRECTORY, "../tooling/components/lock-worker-dependencies.ps1"),
    "utf8"
  );
  assert.match(script, /video-ai-requirements\.txt"; Output = "video-ai\.lock\.txt"; Torch = "cpu"/);
  assert.match(script, /video-ai-cuda-requirements\.txt"; Output = "video-ai-cuda\.lock\.txt"; Torch = "cu124"/);
});

test("CPU 锁只接受 CPU PyTorch，GPU 锁必须锁定 CUDA 12.4 运行时", () => {
  const cpuLock = [
    "fastapi==0.141.1 \\",
    "    --hash=sha256:aaaa",
    "torch==2.6.0+cpu \\",
    "    --hash=sha256:bbbb",
    "opencv-python-headless==4.11.0.86 \\",
    "    --hash=sha256:cccc",
    "paddleocr==3.7.0 \\",
    "    --hash=sha256:dddd",
    ""
  ].join("\n");
  assert.doesNotThrow(() => validateVideoAiCpuLock(cpuLock));
  assert.throws(() => validateVideoAiCpuLock(cpuLock.replace("2.6.0+cpu", "2.6.0+cu124")), /CPU 版 PyTorch/);
  assert.throws(() => validateVideoAiCpuLock(cpuLock + "nvidia-cublas-cu12==12.4.5.8 \\\n"), /NVIDIA/);
  assert.throws(() => validateVideoAiCpuLock(cpuLock.replace("paddleocr", "paddlepaddle-replacer")), /paddleocr/);

  // Windows 版 cu124 wheel 自带 CUDA 12 运行库，nvidia-* 属 Linux 专用分发，锁文件不得混入。
  const windowsCudaLock = ["torch==2.6.0+cu124 \\", "torchvision==0.21.0+cu124 \\", ""].join("\n");
  assert.doesNotThrow(() => validateVideoAiCudaLock(windowsCudaLock, "win32"));
  assert.throws(
    () => validateVideoAiCudaLock(windowsCudaLock + "nvidia-cublas-cu12==12.4.5.8 \\\n", "win32"),
    /nvidia-\*/
  );
  // Linux 仍要求显式锁定 CUDA 12 运行时包。
  const linuxCudaLock = ["torch==2.6.0+cu124 \\", "nvidia-cublas-cu12==12.4.5.8 \\", ""].join("\n");
  assert.doesNotThrow(() => validateVideoAiCudaLock(linuxCudaLock, "linux"));
  assert.throws(() => validateVideoAiCudaLock("torch==2.6.0+cpu \\\n"), /cu124/);
  assert.throws(() => validateVideoAiCudaLock(windowsCudaLock, "linux"), /NVIDIA CUDA 12/);
});

test("video-ai CUDA wheelhouse 分组：torch 分片逐卷、torchvision 单卷、小 wheel 留主归档", () => {
  const groups = groupVideoAiCudaWheelhouseAssets([
    {
      name: "torch-2.6.0+cu124-cp312-cp312-win_amd64.whl.part-0001",
      path: "wheelhouse/.parts/torch-2.6.0+cu124-cp312-cp312-win_amd64.whl.part-0001"
    },
    {
      name: "torch-2.6.0+cu124-cp312-cp312-win_amd64.whl.part-0002",
      path: "wheelhouse/.parts/torch-2.6.0+cu124-cp312-cp312-win_amd64.whl.part-0002"
    },
    {
      name: "torchvision-0.21.0+cu124-cp312-cp312-win_amd64.whl",
      path: "wheelhouse/torchvision-0.21.0+cu124-cp312-cp312-win_amd64.whl"
    },
    { name: "numpy-2.5.4-cp312-cp312-win_amd64.whl", path: "wheelhouse/numpy-2.5.4-cp312-cp312-win_amd64.whl" }
  ]);
  assert.deepEqual(
    groups.map((group) => group.name),
    ["cuda-torch-part-0001", "cuda-torch-part-0002", "cuda-torchvision"]
  );
  assert.deepEqual(groups[2].paths, ["wheelhouse/torchvision-0.21.0+cu124-cp312-cp312-win_amd64.whl"]);
  // 缺 torch / torchvision 时必须显式失败，不能静默生成不完整分组。
  assert.throws(
    () => groupVideoAiCudaWheelhouseAssets([{ name: "numpy-1.0-cp312.whl", path: "wheelhouse/numpy-1.0-cp312.whl" }]),
    /torchvision/
  );
  // 非 wheel / 非受控分片一律拒绝。
  assert.throws(() => groupVideoAiCudaWheelhouseAssets([{ name: "evil.bin", path: "wheelhouse/evil.bin" }]), /仅允许/);
});

test("固定模型资产使用 HTTPS 与 SHA-256，并落在 video-ai 自己的模型目录", () => {
  assert.ok(VIDEO_AI_MODEL_ASSETS.length >= 7);
  for (const asset of VIDEO_AI_MODEL_ASSETS) {
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    assert.ok(asset.url.startsWith("https://"));
    assert.ok(asset.relativePath.startsWith("models/video-ai/"));
  }
  assert.ok(VIDEO_AI_MODEL_ASSETS.some((asset) => asset.name === "big-lama.pt"));
  assert.ok(VIDEO_AI_MODEL_ASSETS.some((asset) => asset.relativePath.includes("ocr/detection/inference.yml")));
});

test("引擎目录入包时记录逐文件摘要，缺少 engine.py 或权重会拒绝", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "video-ai-engine-"));
  try {
    const source = path.join(temporary, "sttn");
    await fs.mkdir(path.join(source, "weights"), { recursive: true });
    await fs.writeFile(path.join(source, "engine.py"), "def create_engine(**kwargs):\n    return None\n");
    await fs.writeFile(path.join(source, "weights", "infer_model.pth"), "mock-weights");
    const destination = path.join(temporary, "stage", "models", "video-ai", "engines", "sttn");
    const files = await stageEngineDirectory(source, destination);
    assert.equal(files.length, 2);
    assert.deepEqual(files.map((file) => file.path).sort(), ["engine.py", path.join("weights", "infer_model.pth")]);
    assert.ok(files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)));
    await assert.rejects(stageEngineDirectory(path.join(temporary, "missing"), destination), /engine\.py/);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("准备脚本提供稳定入口且 worker 源文件存在", async () => {
  for (const entry of ["prepare-video-ai-component.mjs", "prepare-video-ai-cuda-component.mjs"]) {
    const source = await fs.readFile(path.join(SCRIPT_DIRECTORY, entry), "utf8");
    assert.match(source, /export \* from "\.\.\/tooling\/components\/prepare-video-ai/);
  }
  const worker = await fs.readFile(path.join(SCRIPT_DIRECTORY, "video-ai-worker.py"), "utf8");
  assert.match(worker, /def run_subtitle_removal\(/);
  assert.match(worker, /subtitle_remove/);
});
