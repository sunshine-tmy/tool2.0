/** 中文模块说明：准备带离线 CPU 依赖和固定模型权重的 Windows AI 图片能力包。 */
import { execFileSync } from "node:child_process";
import { createReadStream, constants as fsConstants } from "node:fs";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_SOURCE = path.join(REPOSITORY_ROOT, "scripts", "image-ai-worker.py");
const LOCK_SOURCE = path.join(REPOSITORY_ROOT, "scripts", "image-ai.lock.txt");
const DEFAULT_ASSET_CACHE = path.join(REPOSITORY_ROOT, ".package", "image-ai-source-assets");
const PYTORCH_CPU_INDEX = "https://download.pytorch.org/whl/cpu";
export const IMAGE_AI_SOURCE_DISTRIBUTIONS = [
  {
    packageName: "basicsr",
    version: "1.4.2",
    fileName: "basicsr-1.4.2.tar.gz",
    url: "https://files.pythonhosted.org/packages/86/41/00a6b000f222f0fa4c6d9e1d6dcc9811a374cabb8abb9d408b77de39648c/basicsr-1.4.2.tar.gz",
    sha256: "b89b595a87ef964cda9913b4d99380ddb6554c965577c0c10cb7b78e31301e87"
  },
  {
    packageName: "filterpy",
    version: "1.4.5",
    fileName: "filterpy-1.4.5.zip",
    url: "https://files.pythonhosted.org/packages/f6/1d/ac8914360460fafa1990890259b7fa5ef7ba4cd59014e782e4ab3ab144d8/filterpy-1.4.5.zip",
    sha256: "4f2a4d39e4ea601b9ab42b2db08b5918a9538c168cff1c6895ae26646f3d73b1"
  }
];

export const IMAGE_AI_MODEL_ASSETS = [
  {
    name: "RealESRGAN_x2plus.pth",
    url: "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth",
    sha256: "49fafd45f8fd7aa8d31ab2a22d14d91b536c34494a5cfe31eb5d89c2fa266abb",
    relativePath: "models/image-ai/RealESRGAN_x2plus.pth"
  },
  {
    name: "RealESRGAN_x4plus.pth",
    url: "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
    sha256: "4fa0d38905f75ac06eb49a7951b426670021be3018265fd191d2125df9d682f1",
    relativePath: "models/image-ai/RealESRGAN_x4plus.pth"
  },
  {
    name: "big-lama.pt",
    url: "https://github.com/enesmsahin/simple-lama-inpainting/releases/download/v0.1.0/big-lama.pt",
    sha256: "7ba7aa7ac37a4d41fdbbeba3a2af7ead18058552997e3a3cd1a3b2210c9e6b4c",
    relativePath: "models/image-ai/torch/hub/checkpoints/big-lama.pt"
  },
  {
    name: "birefnet-general.onnx",
    url: "https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-epoch_244.onnx",
    sha256: "58f621f00f5d756097615970a88a791584600dcf7c45b18a0a6267535a1ebd3c",
    relativePath: "models/image-ai/rembg/models/birefnet-general/birefnet-general.onnx"
  },
  ...createPaddleOcrAssets({
    model: "PP-OCRv5_mobile_det",
    revision: "0d63e78e2b680928f6b1747d76a08db6e645efb7",
    prefix: "det",
    relativeDirectory: "models/image-ai/ocr/detection",
    hashes: {
      "inference.json": "05feef1acb00aa4cd7362b15f7f501fc4f99d7b1fa73c1c871e0c7b1504b0f5c",
      "inference.pdiparams": "afa1820cb16c1fd0dad589d0f8b389139061c1ef6d68019685fd07be997dda5b",
      "inference.yml": "98069072e1b6b37d727fd9d9f11725faa46d6ea0de012f2ed26caea011c37699"
    }
  }),
  ...createPaddleOcrAssets({
    model: "PP-OCRv5_mobile_rec",
    revision: "682f20538d8c086cb2128e5cfac775e6c4904e85",
    prefix: "rec",
    relativeDirectory: "models/image-ai/ocr/recognition",
    hashes: {
      "inference.json": "24587345250c7332d0fc6f9a44e794d078cdaeb64c302fef906f325619de2569",
      "inference.pdiparams": "2460da90875937c94db97eba74ae3d9e5d4c4c57c42f1f41531c09a26bcc771a",
      "inference.yml": "5dfeb2777f6d0db8177d8128a8acfcf6e6276dc4ac73ea3bf0dc06d6a5e85d8e"
    }
  })
];

export function validateImageAiCpuLock(lockText) {
  if (!/^torch==2\.6\.0\+cpu\s*\\?\s*$/m.test(lockText)) {
    throw new Error("图片 AI 锁文件必须固定 CPU 版 PyTorch 2.6.0");
  }
  if (!/^torchvision==0\.21\.0\+cpu\s*\\?\s*$/m.test(lockText)) {
    throw new Error("图片 AI 锁文件必须固定 CPU 版 TorchVision 0.21.0");
  }
  if (!/^onnxruntime==[\d.]+\s*\\?\s*$/m.test(lockText) || /^onnxruntime-gpu==/m.test(lockText)) {
    throw new Error("图片 AI 锁文件必须使用 CPU 版 ONNX Runtime");
  }
  if (/^nvidia[-_\w]*==/m.test(lockText)) throw new Error("图片 AI 锁文件不能包含 NVIDIA/CUDA 运行时");
}

export function omitImageAiSourceDistributions(lockText, sources = IMAGE_AI_SOURCE_DISTRIBUTIONS) {
  const lines = lockText.split(/\r?\n/);
  const omittedBlocks = [];
  for (const source of sources) {
    const start = lines.findIndex((line) => line.startsWith(source.packageName + "==" + source.version + " "));
    if (start < 0) throw new Error(source.packageName + "==" + source.version + " 不在哈希锁文件中");
    let end = start + 1;
    while (end < lines.length && !/^[A-Za-z0-9][A-Za-z0-9_.+-]*==/.test(lines[end])) end++;
    const block = lines.slice(start, end).join("\n");
    if (!block.includes("--hash=sha256:" + source.sha256)) {
      throw new Error(source.packageName + " 源码分发包摘要与哈希锁文件不匹配");
    }
    omittedBlocks.push(block);
    lines.splice(start, end - start);
  }
  return { downloadLockText: lines.join("\n"), omittedBlocks };
}

export async function verifyImageAiAssets(assetCacheDirectory, assets = IMAGE_AI_MODEL_ASSETS) {
  const verified = [];
  for (const asset of assets) {
    if (!/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error("模型 " + asset.name + " 的 SHA-256 固定值无效");
    if (!isHttpsUrl(asset.url)) throw new Error("模型 " + asset.name + " 的来源必须使用 HTTPS");
    const sourcePath = path.join(path.resolve(assetCacheDirectory), asset.name);
    const stat = await fs.stat(sourcePath).catch((error) => {
      if (error?.code === "ENOENT") throw new Error("缺少模型缓存文件：" + asset.name);
      throw error;
    });
    if (!stat.isFile() || stat.size === 0) throw new Error("模型缓存不是非空文件：" + asset.name);
    const actual = await sha256File(sourcePath);
    if (actual !== asset.sha256) throw new Error("模型 " + asset.name + " 的 SHA-256 不匹配");
    verified.push({ ...asset, sourcePath, bytes: stat.size });
  }
  return verified;
}

export async function prepareImageAiComponent({
  pythonExecutablePath,
  stagingDirectory,
  assetCacheDirectory = DEFAULT_ASSET_CACHE,
  runCommand = execFileSync,
  assets = IMAGE_AI_MODEL_ASSETS
}) {
  if (process.platform !== "win32" || process.arch !== "x64") {
    throw new Error("AI 图片能力包仅支持 Windows x64 构建环境");
  }
  const python = path.resolve(pythonExecutablePath);
  const stage = path.resolve(stagingDirectory);
  const version = runCommand(
    python,
    ["-I", "-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      timeout: 30_000,
      env: cleanPythonEnvironment()
    }
  );
  if (version.trim() !== "3.11") throw new Error("图片 AI wheelhouse 必须由 Python 3.11 准备");
  if (await pathExists(stage)) throw new Error("图片 AI 暂存目录已存在，拒绝覆盖");

  const lockText = await fs.readFile(LOCK_SOURCE, "utf8");
  validateImageAiCpuLock(lockText);
  const { downloadLockText } = omitImageAiSourceDistributions(lockText);
  await ensureImageAiAssets({ assetCacheDirectory, assets, runCommand });
  const verifiedAssets = await verifyImageAiAssets(assetCacheDirectory, assets);

  let stageCreated = false;
  try {
    await fs.mkdir(stage, { recursive: false });
    stageCreated = true;
    const wheelhouse = path.join(stage, "wheelhouse");
    const scripts = path.join(stage, "scripts");
    const downloadLock = path.join(stage, ".requirements-download.lock");
    await Promise.all([fs.mkdir(wheelhouse), fs.mkdir(scripts)]);
    await Promise.all([
      fs.copyFile(SCRIPT_SOURCE, path.join(scripts, "image-ai-worker.py")),
      fs.writeFile(path.join(stage, "requirements.lock"), lockText, { flag: "wx" }),
      fs.writeFile(downloadLock, downloadLockText, { flag: "wx" })
    ]);
    for (const asset of verifiedAssets) {
      const destination = path.join(stage, ...asset.relativePath.split("/"));
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(asset.sourcePath, destination, fsConstants.COPYFILE_EXCL);
    }

    runCommand(
      python,
      [
        "-m",
        "pip",
        "--isolated",
        "--no-cache-dir",
        "--disable-pip-version-check",
        "download",
        "--no-deps",
        "--require-hashes",
        "--extra-index-url",
        PYTORCH_CPU_INDEX,
        "--dest",
        wheelhouse,
        "-r",
        downloadLock
      ],
      {
        stdio: "inherit",
        windowsHide: true,
        timeout: 90 * 60 * 1000,
        env: cleanPythonEnvironment()
      }
    );
    await fs.rm(downloadLock);
    for (const sourceDistribution of IMAGE_AI_SOURCE_DISTRIBUTIONS) {
      const sourceDestination = path.join(wheelhouse, sourceDistribution.fileName);
      runCommand(
        "pwsh",
        [
          "-NoProfile",
          "-File",
          path.join(REPOSITORY_ROOT, "scripts", "download-fixed-model-file.ps1"),
          "-Url",
          sourceDistribution.url,
          "-Destination",
          sourceDestination,
          "-ExpectedSha256",
          sourceDistribution.sha256
        ],
        { stdio: "inherit", windowsHide: true, timeout: 10 * 60 * 1000 }
      );
    }
    const wheels = await fs.readdir(wheelhouse, { withFileTypes: true });
    if (
      !wheels.length ||
      wheels.some((entry) => {
        const fileName = entry.name.toLowerCase();
        const validDistribution =
          fileName.endsWith(".whl") || fileName.endsWith(".zip") || fileName.endsWith(".tar.gz");
        return !entry.isFile() || !validDistribution;
      })
    ) {
      throw new Error("图片 AI 离线包必须只包含通过哈希锁校验的 Python wheel 或源码分发包");
    }
    const modelBytes = verifiedAssets.reduce((total, asset) => total + asset.bytes, 0);
    return { stagingDirectory: stage, wheelCount: wheels.length, modelBytes };
  } catch (error) {
    if (stageCreated) await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

async function ensureImageAiAssets({ assetCacheDirectory, assets, runCommand }) {
  const cache = path.resolve(assetCacheDirectory);
  await fs.mkdir(cache, { recursive: true });
  const downloader = path.join(REPOSITORY_ROOT, "scripts", "download-fixed-model-file.ps1");
  for (const asset of assets) {
    const destination = path.join(cache, asset.name);
    if (await pathExists(destination)) continue;
    runCommand(
      "pwsh",
      [
        "-NoProfile",
        "-File",
        downloader,
        "-Url",
        asset.url,
        "-Destination",
        destination,
        "-ExpectedSha256",
        asset.sha256
      ],
      { stdio: "inherit", windowsHide: true, timeout: 90 * 60 * 1000 }
    );
  }
}

function createPaddleOcrAssets({ model, revision, prefix, relativeDirectory, hashes }) {
  return Object.entries(hashes).map(([fileName, sha256]) => ({
    name: prefix + "-" + fileName,
    url: "https://huggingface.co/PaddlePaddle/" + model + "/resolve/" + revision + "/" + fileName,
    sha256,
    relativePath: relativeDirectory + "/" + fileName
  }));
}

function cleanPythonEnvironment() {
  const environment = { ...process.env };
  for (const key of ["PYTHONHOME", "PYTHONPATH", "PYTHONUSERBASE"]) delete environment[key];
  environment.PYTHONNOUSERSITE = "1";
  if (process.platform === "win32") environment.PIP_CONFIG_FILE = "NUL";
  return environment;
}

async function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function pathExists(candidate) {
  return fs.lstat(candidate).then(
    () => true,
    (error) => {
      if (error?.code === "ENOENT") return false;
      throw error;
    }
  );
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value || values.has(key.slice(2))) throw new Error("命令行参数无效");
    values.set(key.slice(2), value);
  }
  const required = ["python", "stage"];
  if (
    required.some((key) => !values.has(key)) ||
    [...values.keys()].some((key) => ![...required, "asset-cache"].includes(key))
  ) {
    throw new Error(
      "用法：pnpm components:prepare-image-ai -- --python <Python 3.11 python.exe> --stage <新暂存目录> [--asset-cache <模型缓存目录>]"
    );
  }
  return {
    pythonExecutablePath: values.get("python"),
    stagingDirectory: values.get("stage"),
    ...(values.has("asset-cache") ? { assetCacheDirectory: values.get("asset-cache") } : {})
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await prepareImageAiComponent(parseArguments(process.argv.slice(2)));
    console.log("AI 图片暂存目录已准备：" + result.stagingDirectory);
    console.log("wheelhouse：" + result.wheelCount + " 个经过 CPU 锁文件摘要校验的 wheel");
    console.log("固定模型：" + result.modelBytes + " bytes");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "AI 图片能力包准备失败");
    process.exitCode = 1;
  }
}
