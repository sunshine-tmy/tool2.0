// Anchor filesystem and CLI identity at the stable public entry.
const publicEntryUrl = new URL("../../scripts/prepare-video-ai-component.mjs", import.meta.url).href;

/** 中文模块说明：准备带离线 CPU 依赖和固定模型权重的 Windows 视频去字幕能力包。 */
import { execFileSync } from "node:child_process";
import { createReadStream, constants as fsConstants } from "node:fs";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertWorkerPythonVersion, assertWorkerWheelPython } from "./worker-python-policy.mjs";
import { stripPnpmSeparator } from "./cli-arguments.mjs";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(publicEntryUrl)), "..");
const SCRIPT_SOURCE = path.join(REPOSITORY_ROOT, "scripts", "video-ai-worker.py");
const DEVICE_POLICY_SOURCE = path.join(REPOSITORY_ROOT, "scripts", "video_ai_device.py");
const LOCK_SOURCE =
  process.platform === "darwin"
    ? path.join(REPOSITORY_ROOT, "tooling", "components", "macos", "locks", "video-ai.lock.txt")
    : path.join(REPOSITORY_ROOT, "scripts", "video-ai.lock.txt");
const DEFAULT_ASSET_CACHE = path.join(REPOSITORY_ROOT, ".package", "video-ai-source-assets");
const DOWNLOADER_SOURCE = path.join(REPOSITORY_ROOT, "scripts", "download-fixed-model-file.mjs");
const PYTORCH_CPU_INDEX = "https://download.pytorch.org/whl/cpu";
const MACOS_SUPPORT_SOURCE = path.join(
  REPOSITORY_ROOT,
  "tooling",
  "components",
  "macos",
  "video-ai-sequence-support.json"
);
const MACOS_SUPPORT_RELATIVE = "scripts/video-ai-sequence-support-macos.json";
const MACOS_DEFINITION_SOURCE = path.join(
  REPOSITORY_ROOT,
  "scripts",
  "component-definitions",
  "macos",
  "video-ai.json"
);

/**
 * Model weights shipped in the base capability. LaMa and PP-OCRv5 reuse the
 * exact upstream assets already pinned by the image-ai component.
 */
export const VIDEO_AI_MODEL_ASSETS = [
  {
    name: "big-lama.pt",
    url: "https://github.com/enesmsahin/simple-lama-inpainting/releases/download/v0.1.0/big-lama.pt",
    sha256: "7ba7aa7ac37a4d41fdbbeba3a2af7ead18058552997e3a3cd1a3b2210c9e6b4c",
    relativePath: "models/video-ai/big-lama.pt"
  },
  ...createPaddleOcrAssets({
    model: "PP-OCRv5_mobile_det",
    revision: "0d63e78e2b680928f6b1747d76a08db6e645efb7",
    prefix: "det",
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
    hashes: {
      "inference.json": "24587345250c7332d0fc6f9a44e794d078cdaeb64c302fef906f325619de2569",
      "inference.pdiparams": "2460da90875937c94db97eba74ae3d9e5d4c4c57c42f1f41531c09a26bcc771a",
      "inference.yml": "5dfeb2777f6d0db8177d8128a8acfcf6e6276dc4ac73ea3bf0dc06d6a5e85d8e"
    }
  })
];

/** Engine tiers beyond big-lama are supplied by the operator after license review. */
export const VIDEO_AI_ENGINE_DIRECTORIES = {
  sttn: path.join("models", "video-ai", "engines", "sttn"),
  propainter: path.join("models", "video-ai", "engines", "propainter")
};

export function validateVideoAiCpuLock(lockText, platform = process.platform) {
  const isMacOS = platform === "darwin" || platform === "darwin-arm64";
  const torchPattern = isMacOS ? /^torch==2\.6\.0\s*\\?\s*$/m : /^torch==2\.6\.0\+cpu\s*\\?\s*$/m;
  const torchvisionPattern = isMacOS ? /^torchvision==0\.21\.0\s*\\?\s*$/m : /^torchvision==0\.21\.0\+cpu\s*\\?\s*$/m;
  if (!torchPattern.test(lockText) || !torchvisionPattern.test(lockText)) {
    throw new Error(
      isMacOS
        ? "Mac 视频去字幕锁文件必须固定原生 PyTorch 2.6.0 与 TorchVision 0.21.0"
        : "视频去字幕锁文件必须固定 CPU 版 PyTorch 2.6.0 与 TorchVision 0.21.0"
    );
  }
  if (/^nvidia[-_\w]*==|^torch(?:vision|audio)?==[^\n]*\+cu\d+/imu.test(lockText)) {
    throw new Error("视频去字幕基础包锁文件不能包含 NVIDIA/CUDA 运行时");
  }
  if (!/^opencv-python-headless==[\d.]+\s*\\?\s*$/m.test(lockText)) {
    throw new Error("视频去字幕锁文件必须固定 opencv-python-headless");
  }
  if (!/^paddleocr==[\d.]+\s*\\?\s*$/m.test(lockText)) {
    throw new Error("视频去字幕锁文件必须固定 paddleocr（字幕检测依赖）");
  }
}

export async function verifyVideoAiAssets(assetCacheDirectory, assets = VIDEO_AI_MODEL_ASSETS) {
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
    verified.push({ ...asset, sourcePath, bytes: stat.size, sha256: actual });
  }
  return verified;
}

/**
 * Copy one operator-supplied engine directory (engine.py + weights/) into the
 * stage and record a per-file provenance manifest. The license review happens
 * before this step; the script only guarantees byte-level traceability.
 */
export async function stageEngineDirectory(sourceDirectory, destinationDirectory) {
  const source = path.resolve(sourceDirectory);
  const entry = path.join(source, "engine.py");
  const weights = path.join(source, "weights");
  const entryStat = await fs.stat(entry).catch(() => undefined);
  if (!entryStat?.isFile()) throw new Error("引擎目录缺少 engine.py：" + source);
  const weightNames = await fs.readdir(weights).catch(() => []);
  if (!weightNames.length) throw new Error("引擎目录缺少 weights/ 权重：" + source);
  await fs.mkdir(destinationDirectory, { recursive: true });
  await fs.copyFile(entry, path.join(destinationDirectory, "engine.py"));
  const files = [{ path: "engine.py", sha256: await sha256File(entry), bytes: entryStat.size }];
  for (const name of weightNames) {
    const weightPath = path.join(weights, name);
    const stat = await fs.stat(weightPath);
    if (!stat.isFile()) continue;
    await fs.mkdir(path.join(destinationDirectory, "weights"), { recursive: true });
    await fs.copyFile(weightPath, path.join(destinationDirectory, "weights", name));
    files.push({ path: path.join("weights", name), sha256: await sha256File(weightPath), bytes: stat.size });
  }
  return files;
}

export async function copyMacSequenceBundle({ sourceDirectory, destinationDirectory, engine }) {
  const source = path.resolve(sourceDirectory);
  const destination = path.resolve(destinationDirectory);
  if (!Object.hasOwn(VIDEO_AI_ENGINE_DIRECTORIES, engine)) throw new Error("未知 Mac 视频引擎：" + engine);
  const sourceStat = await fs.lstat(source);
  if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) throw new Error("Mac 视频 bundle 根目录无效");
  const descriptorPath = path.join(source, "sequence-bundle.json");
  const provenancePath = path.join(source, "PROVENANCE.json");
  const descriptor = JSON.parse(await fs.readFile(descriptorPath, "utf8"));
  const provenance = JSON.parse(await fs.readFile(provenancePath, "utf8"));
  const support = JSON.parse(await fs.readFile(MACOS_SUPPORT_SOURCE, "utf8"));
  const expected = support.engines?.[engine];
  if (
    support.platform !== "darwin-arm64" ||
    !expected ||
    expected.adapterReady !== true ||
    !Array.isArray(expected.supportedDevices) ||
    expected.supportedDevices.length !== 1 ||
    expected.supportedDevices[0] !== "mps" ||
    descriptor.assetSchemaVersion !== 1 ||
    descriptor.engine !== engine ||
    descriptor.repository !== expected.repository ||
    descriptor.revision !== expected.revision ||
    descriptor.license !== expected.license ||
    descriptor.namespace !== expected.namespace ||
    descriptor.adapterReady !== true ||
    !Array.isArray(descriptor.files) ||
    !Array.isArray(expected.sources) ||
    !Array.isArray(expected.weights)
  ) {
    throw new Error(`Mac ${engine} bundle 尚未通过已冻结的 MPS 验收定义`);
  }
  if (
    provenance.repository !== expected.repository ||
    provenance.revision !== expected.revision ||
    provenance.license !== expected.license ||
    !Array.isArray(provenance.sources) ||
    !Array.isArray(provenance.weights)
  ) {
    throw new Error(`Mac ${engine} bundle provenance 与冻结来源不匹配`);
  }

  const fileEntries = new Map();
  for (const file of descriptor.files) {
    if (
      !file ||
      typeof file.path !== "string" ||
      !isSafeBundleRelativePath(file.path) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 1 ||
      !/^[a-f0-9]{64}$/u.test(file.sha256) ||
      !["source", "weight", "license", "provenance"].includes(file.role) ||
      fileEntries.has(file.path.toLowerCase())
    ) {
      throw new Error(`Mac ${engine} bundle descriptor 文件清单无效`);
    }
    fileEntries.set(file.path.toLowerCase(), file);
  }
  const expectedWeights = new Map(expected.weights.map((weight) => [weight.path, weight]));
  const actualWeights = descriptor.files
    .filter((file) => file.role === "weight")
    .map((file) => file.path)
    .sort();
  if (
    actualWeights.length !== expectedWeights.size ||
    actualWeights.some((relative, index) => relative !== [...expectedWeights.keys()].sort()[index])
  ) {
    throw new Error(`Mac ${engine} bundle 权重集合与冻结清单不匹配`);
  }
  const provenanceSources = new Map(provenance.sources.map((source) => [source.path, source]));
  const lockedSources = new Map(
    expected.sources.filter((source) => source.path !== "LICENSE").map((source) => [source.path, source])
  );
  if (provenanceSources.size !== lockedSources.size) throw new Error(`Mac ${engine} bundle 源码 provenance 不完整`);
  for (const [relative, locked] of lockedSources) {
    const actual = provenanceSources.get(relative);
    if (
      !actual ||
      actual.gitBlobSha1 !== locked.gitBlobSha1 ||
      actual.originalSha256 !== locked.sha256 ||
      !/^[a-f0-9]{64}$/u.test(actual.bundledSha256)
    ) {
      throw new Error(`Mac ${engine} bundle 源码 provenance 与固定 revision 不匹配：${relative}`);
    }
    const bundled = fileEntries.get(`vendor/${relative}`.toLowerCase());
    if (!bundled || bundled.role !== "source" || bundled.sha256 !== actual.bundledSha256) {
      throw new Error(`Mac ${engine} bundle 不包含固定来源源码：${relative}`);
    }
  }
  const license = expected.sources.find((source) => source.path === "LICENSE");
  const licenseFile = fileEntries.get("license");
  if (!license || !licenseFile || licenseFile.role !== "license" || licenseFile.sha256 !== license.sha256) {
    throw new Error(`Mac ${engine} bundle 许可证与冻结清单不匹配`);
  }
  for (const [relative, locked] of expectedWeights) {
    const descriptorFile = fileEntries.get(relative.toLowerCase());
    const weightName = relative.slice("weights/".length);
    const provenanceWeight = provenance.weights.find((weight) => weight.name === weightName);
    if (
      !descriptorFile ||
      descriptorFile.role !== "weight" ||
      descriptorFile.bytes !== locked.bytes ||
      descriptorFile.sha256 !== locked.sha256 ||
      !provenanceWeight ||
      provenanceWeight.bytes !== locked.bytes ||
      provenanceWeight.sha256 !== locked.sha256
    ) {
      throw new Error(`Mac ${engine} bundle 权重与冻结摘要不匹配：${relative}`);
    }
  }
  for (const required of engine === "sttn"
    ? ["vendor/__init__.py", "vendor/model/sttn.py"]
    : [
        "vendor/__init__.py",
        "vendor/RAFT/raft.py",
        "vendor/model/propainter.py",
        "vendor/model/recurrent_flow_completion.py"
      ]) {
    const file = fileEntries.get(required.toLowerCase());
    if (!file || file.role !== "source") throw new Error(`Mac ${engine} bundle 缺少必要源码：${required}`);
  }
  if (!fileEntries.has("provenance.json")) throw new Error(`Mac ${engine} bundle 缺少 provenance`);

  const actualFiles = await listRegularFiles(source);
  const allowedFiles = new Set([...descriptor.files.map((file) => file.path), "sequence-bundle.json"]);
  if (actualFiles.length !== allowedFiles.size || actualFiles.some((relative) => !allowedFiles.has(relative))) {
    throw new Error(`Mac ${engine} bundle 有未声明或缺失文件`);
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.mkdir(destination, { recursive: false });
  const copied = [];
  for (const file of descriptor.files) {
    const sourcePath = await resolveRegularFile(source, file.path);
    const bytes = await fs.readFile(sourcePath);
    if (bytes.length !== file.bytes || crypto.createHash("sha256").update(bytes).digest("hex") !== file.sha256) {
      throw new Error(`Mac ${engine} bundle 文件摘要或大小不匹配：${file.path}`);
    }
    const target = path.join(destination, ...file.path.split("/"));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes, { flag: "wx" });
    copied.push({ path: file.path, bytes: file.bytes, sha256: file.sha256, role: file.role });
  }
  const descriptorBytes = await fs.readFile(descriptorPath);
  await fs.writeFile(path.join(destination, "sequence-bundle.json"), descriptorBytes, { flag: "wx" });
  copied.push({
    path: "sequence-bundle.json",
    bytes: descriptorBytes.length,
    sha256: crypto.createHash("sha256").update(descriptorBytes).digest("hex"),
    role: "descriptor"
  });
  return copied;
}

async function listRegularFiles(root) {
  const results = [];
  const visit = async (directory, prefix = "") => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const fullPath = path.join(directory, entry.name);
      const stat = await fs.lstat(fullPath);
      if (stat.isSymbolicLink()) throw new Error("Mac 视频 bundle 不允许链接");
      if (entry.isDirectory()) await visit(fullPath, relative);
      else if (entry.isFile()) results.push(relative);
      else throw new Error("Mac 视频 bundle 包含特殊文件");
    }
  };
  await visit(root);
  return results;
}

async function resolveRegularFile(root, relative) {
  if (!isSafeBundleRelativePath(relative)) throw new Error("Mac 视频 bundle 路径无效");
  let current = root;
  for (const segment of relative.split("/")) {
    current = path.join(current, segment);
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink()) throw new Error("Mac 视频 bundle 不允许链接");
  }
  const stat = await fs.stat(current);
  if (!stat.isFile()) throw new Error("Mac 视频 bundle 文件类型无效");
  return current;
}

function isSafeBundleRelativePath(relative) {
  return (
    typeof relative === "string" &&
    relative.length > 0 &&
    !relative.includes("\\") &&
    !path.posix.isAbsolute(relative) &&
    path.posix.normalize(relative) === relative &&
    !relative.split("/").some((segment) => !segment || segment === "." || segment === ".." || segment.includes(":"))
  );
}

export function assertMacOSWheelName(filename) {
  if (!filename.toLowerCase().endsWith(".whl")) throw new Error(`Mac 视频 wheel 不是 wheel 文件：${filename}`);
  const platformTag = filename.slice(0, -4).split("-").at(-1);
  if (!platformTag || platformTag.startsWith("win_") || platformTag === "win32") {
    throw new Error(`Mac 视频 wheelhouse 包含 Windows wheel：${filename}`);
  }
  if (platformTag === "any") return;
  const tags = platformTag.split(".");
  const macTags = tags.filter((tag) => /^macosx_\d+_\d+_(?:arm64|universal2)$/u.test(tag));
  if (!macTags.length) throw new Error(`Mac 视频 wheel 缺少 arm64/universal2 平台标签：${filename}`);
  for (const tag of macTags) {
    const match = /^macosx_(\d+)_(\d+)_/u.exec(tag);
    if (!match || Number(match[1]) > 14 || (Number(match[1]) === 14 && Number(match[2]) > 0)) {
      throw new Error(`Mac 视频 wheel 要求高于最低支持 macOS 14：${filename}`);
    }
  }
}

export async function prepareVideoAiComponent({
  pythonExecutablePath,
  stagingDirectory,
  lockFilePath = LOCK_SOURCE,
  assetCacheDirectory = DEFAULT_ASSET_CACHE,
  wheelhouseDirectory,
  sequenceSupport = true,
  generatedDefinitionPath,
  engineDirectories = {},
  runCommand = execFileSync,
  assets = VIDEO_AI_MODEL_ASSETS
}) {
  const isMacOS = process.platform === "darwin" && process.arch === "arm64";
  const isWindows = process.platform === "win32" && process.arch === "x64";
  if (!isMacOS && !isWindows) throw new Error("视频去字幕能力包仅支持 Windows x64 或 Apple Silicon 原生构建环境");
  if (!sequenceSupport)
    throw new Error("新版 Worker 需要完整时序运行时与新版本定义；旧 1.0.0 签名包请直接复用，不原位重建");
  if (isMacOS) {
    if (!wheelhouseDirectory) throw new Error("Mac 视频能力必须从经验证的离线 wheelhouse 制作");
    if (!engineDirectories.sttn || !engineDirectories.propainter) {
      throw new Error("Mac 视频能力必须包含已验收的 STTN 与 ProPainter bundle");
    }
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
  assertWorkerPythonVersion(version);
  if (await pathExists(stage)) throw new Error("视频去字幕暂存目录已存在，拒绝覆盖");

  const lockText = await fs.readFile(lockFilePath, "utf8");
  validateVideoAiCpuLock(lockText, isMacOS ? "darwin-arm64" : "win32-x64");
  await ensureVideoAiAssets({ assetCacheDirectory, assets, runCommand });
  const verifiedAssets = await verifyVideoAiAssets(assetCacheDirectory, assets);

  let stageCreated = false;
  try {
    await fs.mkdir(stage, { recursive: false });
    stageCreated = true;
    const wheelhouse = path.join(stage, "wheelhouse");
    const scripts = path.join(stage, "scripts");
    await Promise.all([fs.mkdir(wheelhouse), fs.mkdir(scripts)]);
    await Promise.all([
      fs.copyFile(SCRIPT_SOURCE, path.join(scripts, "video-ai-worker.py")),
      fs.copyFile(DEVICE_POLICY_SOURCE, path.join(scripts, "video_ai_device.py")),
      fs.writeFile(path.join(stage, "requirements.lock"), lockText, { flag: "wx" })
    ]);
    if (sequenceSupport) {
      for (const filename of [
        "video_ai_engine_assets.py",
        "video_ai_sequence.py",
        "video_ai_sttn.py",
        "video_ai_propainter.py"
      ])
        await fs.copyFile(
          path.join(REPOSITORY_ROOT, "scripts", filename),
          path.join(scripts, filename),
          fsConstants.COPYFILE_EXCL
        );
      if (isMacOS) {
        await fs.copyFile(
          MACOS_SUPPORT_SOURCE,
          path.join(stage, ...MACOS_SUPPORT_RELATIVE.split("/")),
          fsConstants.COPYFILE_EXCL
        );
      } else {
        await fs.copyFile(
          path.join(REPOSITORY_ROOT, "scripts", "video-ai-sequence-support.json"),
          path.join(scripts, "video-ai-sequence-support.json"),
          fsConstants.COPYFILE_EXCL
        );
      }
    }
    for (const asset of verifiedAssets) {
      const destination = path.join(stage, ...asset.relativePath.split("/"));
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(asset.sourcePath, destination, fsConstants.COPYFILE_EXCL);
    }

    const provenance = {
      models: verifiedAssets.map(({ name, url, sha256, bytes }) => ({ name, url, sha256, bytes })),
      engines: {}
    };
    for (const [tier, sourceDirectory] of Object.entries(engineDirectories)) {
      const relative = VIDEO_AI_ENGINE_DIRECTORIES[tier];
      if (!relative) throw new Error("未知引擎档位：" + tier);
      const destination = path.join(stage, ...relative.split("/"));
      provenance.engines[tier] = isMacOS
        ? await copyMacSequenceBundle({ sourceDirectory, destinationDirectory: destination, engine: tier })
        : await stageEngineDirectory(sourceDirectory, destination);
    }
    await fs.writeFile(path.join(stage, "PROVENANCE.json"), JSON.stringify(provenance, null, 2), { flag: "wx" });

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
        ...(wheelhouseDirectory
          ? ["--no-index", "--find-links", path.resolve(wheelhouseDirectory)]
          : ["--extra-index-url", PYTORCH_CPU_INDEX]),
        "--dest",
        wheelhouse,
        "-r",
        path.join(stage, "requirements.lock")
      ],
      {
        stdio: "inherit",
        windowsHide: true,
        timeout: 90 * 60 * 1000,
        env: cleanPythonEnvironment()
      }
    );
    const wheels = await fs.readdir(wheelhouse, { withFileTypes: true });
    if (!wheels.length || wheels.some((entry) => !entry.isFile() || !entry.name.toLowerCase().endsWith(".whl"))) {
      throw new Error("视频去字幕离线包必须只包含通过哈希锁校验的 Python wheel");
    }
    for (const entry of wheels) {
      assertWorkerWheelPython(entry.name);
      if (isMacOS) assertMacOSWheelName(entry.name);
    }
    const modelBytes = verifiedAssets.reduce((total, asset) => total + asset.bytes, 0);
    let definitionOutput;
    if (sequenceSupport) {
      const definition = JSON.parse(
        await fs.readFile(
          isMacOS
            ? MACOS_DEFINITION_SOURCE
            : path.join(REPOSITORY_ROOT, "scripts", "component-definitions", "video-ai-sequence.json"),
          "utf8"
        )
      );
      if (
        definition.id !== "video-ai" ||
        definition.version === "1.0.0-py312-cpu1" ||
        (isMacOS && (definition.platform !== "darwin-arm64" || !definition.version.includes("darwin-arm64")))
      )
        throw new Error("时序基础包必须使用新的能力版本");
      definitionOutput = path.resolve(
        generatedDefinitionPath ?? path.join(path.dirname(stage), "video-ai-sequence-definition.generated.json")
      );
      await fs.writeFile(definitionOutput, JSON.stringify(definition, null, 2) + "\n", { flag: "wx" });
    }
    return {
      stagingDirectory: stage,
      platform: isMacOS ? "darwin-arm64" : "win32-x64",
      ...(definitionOutput ? { generatedDefinitionPath: definitionOutput } : {}),
      wheelCount: wheels.length,
      modelBytes,
      engines: Object.keys(provenance.engines)
    };
  } catch (error) {
    if (stageCreated) await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

async function ensureVideoAiAssets({ assetCacheDirectory, assets, runCommand }) {
  const cache = path.resolve(assetCacheDirectory);
  await fs.mkdir(cache, { recursive: true });
  for (const asset of assets) {
    const destination = path.join(cache, asset.name);
    if (await pathExists(destination)) continue;
    await downloadPinnedFile(asset.url, destination, asset.sha256, runCommand);
  }
}

/**
 * 固定资产一律经共享的 Node 下载器获取：强制 HTTPS、流式落盘并在完成前校验
 * SHA-256。PowerShell 转发包装在 pwsh 7 下会因空 `$args` splat 触发参数绑定
 * 失败，因此这里不再经过 `.ps1` 包装。
 */
async function downloadPinnedFile(url, destination, expectedSha256, runCommand = execFileSync) {
  runCommand(
    process.execPath,
    [DOWNLOADER_SOURCE, "--url", url, "--destination", destination, "--sha256", expectedSha256],
    { stdio: "inherit", windowsHide: true, timeout: 90 * 60 * 1000 }
  );
}

function createPaddleOcrAssets({ model, revision, prefix, hashes }) {
  return Object.entries(hashes).map(([fileName, sha256]) => ({
    name: prefix + "-" + fileName,
    url: "https://huggingface.co/PaddlePaddle/" + model + "/resolve/" + revision + "/" + fileName,
    sha256,
    relativePath: "models/video-ai/ocr/" + (prefix === "det" ? "detection" : "recognition") + "/" + fileName
  }));
}

function cleanPythonEnvironment() {
  const environment = { ...process.env };
  for (const key of ["PYTHONHOME", "PYTHONPATH", "PYTHONUSERBASE"]) delete environment[key];
  environment.PYTHONNOUSERSITE = "1";
  if (process.platform === "win32") environment.PIP_CONFIG_FILE = "NUL";
  return environment;
}

export async function sha256File(filePath) {
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
  const args = stripPnpmSeparator(argv);
  const values = new Map();
  const allowed = [
    "python",
    "stage",
    "asset-cache",
    "wheelhouse",
    "lock",
    "sttn-assets",
    "propainter-assets",
    "sequence-support",
    "definition-output"
  ];
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || !value || values.has(key.slice(2))) throw new Error("命令行参数无效");
    values.set(key.slice(2), value);
  }
  const required = ["python", "stage"];
  if (process.platform === "darwin") required.push("wheelhouse", "sttn-assets", "propainter-assets");
  if (values.has("sequence-support") && values.get("sequence-support") !== "true")
    throw new Error("--sequence-support 只接受 true");
  if (required.some((key) => !values.has(key)) || [...values.keys()].some((key) => !allowed.includes(key))) {
    throw new Error(
      "用法：pnpm components:prepare-video-ai -- --python <Python 3.12 路径> --stage <新暂存目录> " +
        "[--lock <平台专用哈希锁>] [--asset-cache <模型缓存目录>] [--wheelhouse <已校验离线wheel目录>] [--sttn-assets <STTN bundle>] [--propainter-assets <ProPainter bundle>] " +
        "[--sequence-support true] [--definition-output <新版本定义输出>]。macOS 还必须提供锁定的 MPS bundle 与 wheelhouse。"
    );
  }
  return {
    pythonExecutablePath: values.get("python"),
    stagingDirectory: values.get("stage"),
    ...(values.has("lock") ? { lockFilePath: values.get("lock") } : {}),
    ...(values.has("wheelhouse") ? { wheelhouseDirectory: values.get("wheelhouse") } : {}),
    sequenceSupport: true,
    ...(values.has("definition-output") ? { generatedDefinitionPath: values.get("definition-output") } : {}),
    ...(values.has("asset-cache") ? { assetCacheDirectory: values.get("asset-cache") } : {}),
    engineDirectories: {
      ...(values.has("sttn-assets") ? { sttn: values.get("sttn-assets") } : {}),
      ...(values.has("propainter-assets") ? { propainter: values.get("propainter-assets") } : {})
    }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(publicEntryUrl)) {
  try {
    const result = await prepareVideoAiComponent(parseArguments(process.argv.slice(2)));
    console.log("视频去字幕暂存目录已准备：" + result.stagingDirectory);
    console.log("wheelhouse：" + result.wheelCount + " 个经过哈希锁和平台标签校验的 wheel");
    console.log("固定模型：" + result.modelBytes + " bytes");
    if (result.generatedDefinitionPath) console.log("新版本定义：" + result.generatedDefinitionPath);
    console.log(
      "序列引擎：" + (result.engines.length ? result.engines.join(", ") : "未提供（仅快速档与 delogo 可用）")
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "视频去字幕能力包准备失败");
    process.exitCode = 1;
  }
}
