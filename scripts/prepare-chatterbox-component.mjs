/** 中文模块说明：准备固定提交、哈希锁定且包含离线模型的 Chatterbox Windows CPU 能力包。 */
import { execFileSync } from "node:child_process";
import { createReadStream, constants as fsConstants } from "node:fs";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCK_SOURCE = path.join(REPOSITORY_ROOT, "scripts", "chatterbox.lock.txt");
const DEFAULT_WHEELHOUSE = path.join(REPOSITORY_ROOT, ".package", "cpu-lock-verify", "chatterbox-wheelhouse");
const DEFAULT_MODEL_SNAPSHOT = path.join(
  REPOSITORY_ROOT,
  "models",
  "chatterbox",
  "huggingface",
  "hub",
  "models--ResembleAI--chatterbox",
  "snapshots",
  "5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18"
);
const CHATTERBOX_GIT_URL = "https://github.com/resemble-ai/chatterbox.git";
export const CHATTERBOX_SOURCE_COMMIT = "65b18437192794391a0308a8f705b1e33e633948";
export const CHATTERBOX_PACKAGE_VERSION = "0.1.7";
export const CHATTERBOX_MODEL_REVISION = "5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18";
export const CHATTERBOX_MODEL_ASSETS = [
  {
    name: "ve.pt",
    relativePath: "models/chatterbox/ve.pt",
    bytes: 5_698_626,
    sha256: "4b16d836bc598509860f6fa068165a8bb5e9ac84f05582dfcf278a5a372879f1"
  },
  {
    name: "t3_mtl23ls_v3.safetensors",
    relativePath: "models/chatterbox/t3_mtl23ls_v3.safetensors",
    bytes: 2_143_989_928,
    sha256: "5abca8321ede76f8e61f1cc0d19aea6c946b28871017ce8726f8a69203f05953"
  },
  {
    name: "s3gen.pt",
    relativePath: "models/chatterbox/s3gen.pt",
    bytes: 1_057_165_844,
    sha256: "9b9ff07e60b20c136e2b1b3d7563a24604e8d2c4c267888d1ee929dd0151d2a3"
  },
  {
    name: "grapheme_mtl_merged_expanded_v1.json",
    relativePath: "models/chatterbox/grapheme_mtl_merged_expanded_v1.json",
    bytes: 69_989,
    sha256: "69632f47220a788a52ce2661d096453c5655e9bf25289d89a8d832c46ee07dbf"
  }
];

const PACKAGE_COPY = ["chatterbox", `chatterbox_tts-${CHATTERBOX_PACKAGE_VERSION}.dist-info`];
const EXPECTED_WORKER_FILES = [
  ["scripts/chatterbox-worker.py", path.join(REPOSITORY_ROOT, "scripts", "chatterbox-worker.py")],
  ["scripts/worker_lifecycle.py", path.join(REPOSITORY_ROOT, "scripts", "worker_lifecycle.py")]
];

export async function verifyChatterboxSource(sitePackagesDirectory) {
  const sitePackages = await fs.realpath(sitePackagesDirectory);
  const packageRoot = path.join(sitePackages, "chatterbox");
  const distInfoRoot = path.join(sitePackages, `chatterbox_tts-${CHATTERBOX_PACKAGE_VERSION}.dist-info`);
  const packageStat = await fs.stat(packageRoot).catch(() => undefined);
  const distInfoStat = await fs.stat(distInfoRoot).catch(() => undefined);
  if (!packageStat?.isDirectory() || !distInfoStat?.isDirectory()) {
    throw new Error("Python 环境缺少固定版本的 chatterbox 源码或 dist-info 元数据");
  }

  const metadata = await fs.readFile(path.join(distInfoRoot, "METADATA"), "utf8");
  if (
    !/^Name:\s*chatterbox-tts\s*$/im.test(metadata) ||
    !new RegExp(`^Version:\\s*${CHATTERBOX_PACKAGE_VERSION}\\s*$`, "im").test(metadata)
  ) {
    throw new Error(`Chatterbox Python 发行包必须固定为 chatterbox-tts ${CHATTERBOX_PACKAGE_VERSION}`);
  }
  const directUrl = JSON.parse(await fs.readFile(path.join(distInfoRoot, "direct_url.json"), "utf8"));
  if (
    directUrl.url !== CHATTERBOX_GIT_URL ||
    directUrl.vcs_info?.vcs !== "git" ||
    directUrl.vcs_info?.commit_id !== CHATTERBOX_SOURCE_COMMIT ||
    directUrl.vcs_info?.requested_revision !== CHATTERBOX_SOURCE_COMMIT
  ) {
    throw new Error("Chatterbox 源码必须来自已固定的官方 Git 提交");
  }
  return { sitePackages, packageRoot, distInfoRoot };
}

export async function verifyChatterboxWheelhouse(wheelhouseDirectory, lockText) {
  const wheelhouse = await fs.realpath(wheelhouseDirectory);
  const expectedHashes = new Set([...lockText.matchAll(/--hash=sha256:([a-f0-9]{64})/g)].map((match) => match[1]));
  if (!expectedHashes.size) throw new Error("Chatterbox 锁文件未包含哈希约束");
  const entries = await fs.readdir(wheelhouse, { withFileTypes: true });
  if (!entries.length) throw new Error("Chatterbox wheelhouse 为空");
  let bytes = 0;
  let count = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(?:whl|zip|tar\.gz)$/i.test(entry.name)) {
      throw new Error(`Chatterbox wheelhouse 包含非归档资产：${entry.name}`);
    }
    const assetPath = path.join(wheelhouse, entry.name);
    const stat = await fs.lstat(assetPath);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size === 0) {
      throw new Error(`Chatterbox wheelhouse 资产类型无效：${entry.name}`);
    }
    const digest = await sha256File(assetPath);
    if (!expectedHashes.has(digest)) throw new Error(`Chatterbox wheelhouse 资产未被锁文件摘要授权：${entry.name}`);
    bytes += stat.size;
    count += 1;
  }
  return { wheelhouse, count, bytes };
}

export async function verifyChatterboxModelAssets(snapshotDirectory, assets = CHATTERBOX_MODEL_ASSETS) {
  const snapshot = await fs.realpath(snapshotDirectory);
  if (path.basename(snapshot) !== CHATTERBOX_MODEL_REVISION) {
    throw new Error(`Chatterbox 模型目录必须使用固定 Hugging Face revision ${CHATTERBOX_MODEL_REVISION}`);
  }
  const repositoryRoot = await fs.realpath(path.resolve(snapshot, "..", ".."));
  const verified = [];
  for (const asset of assets) {
    if (!/^[a-f0-9]{64}$/.test(asset.sha256) || !Number.isSafeInteger(asset.bytes) || asset.bytes <= 0) {
      throw new Error(`Chatterbox 模型固定摘要或大小无效：${asset.name}`);
    }
    const sourcePath = path.join(snapshot, asset.name);
    const resolved = await fs.realpath(sourcePath).catch((error) => {
      if (error?.code === "ENOENT") throw new Error(`缺少固定模型缓存文件：${asset.name}`);
      throw error;
    });
    if (!isPathWithin(repositoryRoot, resolved)) throw new Error(`模型缓存链接目标越界：${asset.name}`);
    const stat = await fs.stat(resolved);
    if (!stat.isFile() || stat.size !== asset.bytes) throw new Error(`模型大小与固定 revision 不匹配：${asset.name}`);
    if ((await sha256File(resolved)) !== asset.sha256) throw new Error(`模型 ${asset.name} 的 SHA-256 不匹配`);
    verified.push({ ...asset, sourcePath: resolved });
  }
  return verified;
}

export async function prepareChatterboxComponent({
  pythonExecutablePath,
  stagingDirectory,
  wheelhouseDirectory = DEFAULT_WHEELHOUSE,
  modelSnapshotDirectory = DEFAULT_MODEL_SNAPSHOT,
  lockFilePath = LOCK_SOURCE,
  runCommand = execFileSync,
  assets = CHATTERBOX_MODEL_ASSETS
}) {
  if (process.platform !== "win32" || process.arch !== "x64") {
    throw new Error("Chatterbox CPU 能力包仅支持 Windows x64 构建环境");
  }
  const python = path.resolve(pythonExecutablePath);
  const stage = path.resolve(stagingDirectory);
  const pythonVersion = runCommand(
    python,
    ["-I", "-X", "utf8", "-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true, timeout: 30_000, env: cleanEnvironment() }
  );
  if (pythonVersion.trim() !== "3.11") throw new Error("Chatterbox 能力包必须使用 Python 3.11 环境");
  const sitePackagesDirectory = runCommand(
    python,
    ["-I", "-X", "utf8", "-c", "import sysconfig; print(sysconfig.get_paths()['purelib'])"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true, timeout: 30_000, env: cleanEnvironment() }
  ).trim();
  const source = await verifyChatterboxSource(sitePackagesDirectory);
  const lockText = await fs.readFile(lockFilePath, "utf8");
  const wheelhouse = await verifyChatterboxWheelhouse(wheelhouseDirectory, lockText);
  const modelAssets = await verifyChatterboxModelAssets(modelSnapshotDirectory, assets);
  if (await pathExists(stage)) throw new Error("Chatterbox 暂存目录已存在，拒绝覆盖");
  for (const sourcePath of [source.sitePackages, wheelhouse.wheelhouse, path.resolve(modelSnapshotDirectory)]) {
    if (pathsOverlap(stage, sourcePath)) throw new Error("Chatterbox 暂存目录不能与源资产目录互相包含");
  }

  let stageCreated = false;
  try {
    await fs.mkdir(stage, { recursive: false });
    stageCreated = true;
    const vendor = path.join(stage, "vendor");
    await fs.mkdir(vendor);
    for (const packageName of PACKAGE_COPY) {
      await copyTreeWithoutBytecode(path.join(source.sitePackages, packageName), path.join(vendor, packageName));
    }
    const wheelhouseTarget = path.join(stage, "wheelhouse");
    await fs.mkdir(wheelhouseTarget);
    for (const entry of await fs.readdir(wheelhouse.wheelhouse, { withFileTypes: true })) {
      await fs.copyFile(
        path.join(wheelhouse.wheelhouse, entry.name),
        path.join(wheelhouseTarget, entry.name),
        fsConstants.COPYFILE_EXCL
      );
    }
    for (const [relativePath, sourcePath] of EXPECTED_WORKER_FILES) {
      const destination = path.join(stage, ...relativePath.split("/"));
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(sourcePath, destination, fsConstants.COPYFILE_EXCL);
    }
    await fs.writeFile(path.join(stage, "requirements.lock"), lockText, { flag: "wx" });
    let modelBytes = 0;
    for (const asset of modelAssets) {
      const destination = path.join(stage, ...asset.relativePath.split("/"));
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(asset.sourcePath, destination, fsConstants.COPYFILE_EXCL);
      if ((await sha256File(destination)) !== asset.sha256) throw new Error(`复制后的模型校验失败：${asset.name}`);
      modelBytes += asset.bytes;
    }
    const totalPayloadBytes = await directoryBytes(stage);
    return {
      stagingDirectory: stage,
      wheelCount: wheelhouse.count,
      wheelhouseBytes: wheelhouse.bytes,
      modelBytes,
      totalPayloadBytes
    };
  } catch (error) {
    if (stageCreated) await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

async function copyTreeWithoutBytecode(source, destination) {
  const sourceStat = await fs.lstat(source);
  if (sourceStat.isSymbolicLink() || !sourceStat.isDirectory()) throw new Error(`Chatterbox 源码目录无效：${source}`);
  await fs.mkdir(destination, { recursive: false });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    if (entry.name === "__pycache__" || entry.name.endsWith(".pyc")) continue;
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    const stat = await fs.lstat(sourcePath);
    if (stat.isSymbolicLink()) throw new Error(`Chatterbox 源码不允许包含符号链接：${sourcePath}`);
    if (stat.isDirectory()) await copyTreeWithoutBytecode(sourcePath, destinationPath);
    else if (stat.isFile()) await fs.copyFile(sourcePath, destinationPath, fsConstants.COPYFILE_EXCL);
    else throw new Error(`Chatterbox 源码包含不支持的文件类型：${sourcePath}`);
  }
}

async function directoryBytes(root) {
  let bytes = 0;
  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(candidate);
      else if (entry.isFile()) bytes += (await fs.stat(candidate)).size;
      else throw new Error(`Chatterbox 暂存目录包含不支持的文件类型：${candidate}`);
    }
  }
  await visit(root);
  return bytes;
}

function cleanEnvironment() {
  const environment = { ...process.env };
  for (const key of ["PYTHONHOME", "PYTHONPATH", "PYTHONUSERBASE"]) delete environment[key];
  environment.PYTHONNOUSERSITE = "1";
  if (process.platform === "win32") environment.PIP_CONFIG_FILE = "NUL";
  return environment;
}

async function sha256File(filePath) {
  const digest = crypto.createHash("sha256");
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  return digest.digest("hex");
}

function pathsOverlap(left, right) {
  const resolvedLeft = path.resolve(left);
  const resolvedRight = path.resolve(right);
  return isPathWithin(resolvedLeft, resolvedRight) || isPathWithin(resolvedRight, resolvedLeft);
}

function isPathWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function pathExists(candidate) {
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
  const allowed = [...required, "wheelhouse", "model-snapshot"];
  if (required.some((key) => !values.has(key)) || [...values.keys()].some((key) => !allowed.includes(key))) {
    throw new Error(
      "用法：pnpm components:prepare-chatterbox -- --python <已安装 chatterbox-tts 的 Python 3.11 python.exe> --stage <新暂存目录> [--wheelhouse <已校验 wheelhouse>] [--model-snapshot <固定 revision 模型目录>]"
    );
  }
  return {
    pythonExecutablePath: values.get("python"),
    stagingDirectory: values.get("stage"),
    ...(values.has("wheelhouse") ? { wheelhouseDirectory: values.get("wheelhouse") } : {}),
    ...(values.has("model-snapshot") ? { modelSnapshotDirectory: values.get("model-snapshot") } : {})
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await prepareChatterboxComponent(parseArguments(process.argv.slice(2)));
    console.log("Chatterbox CPU 暂存目录已准备：" + result.stagingDirectory);
    console.log(`wheelhouse：${result.wheelCount} 个锁文件哈希匹配的离线依赖（${result.wheelhouseBytes} bytes）`);
    console.log(`模型：${result.modelBytes} bytes；能力包载荷：${result.totalPayloadBytes} bytes`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Chatterbox CPU 能力包准备失败");
    process.exitCode = 1;
  }
}
