/** 中文模块说明：以摘要固定的 XHS-Downloader 源码和哈希锁准备离线归档运行时。 */
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMMIT = "afaf2fb459980fccef9eec74e304a39af2c49cab";
const ARCHIVE_NAME = "xhs-downloader-" + COMMIT + ".zip";
const ARCHIVE_BYTES = 3_470_287;
const ARCHIVE_SHA256 = "58155970bd3a246bb6bd692f6833ef4645c44a4d39c1080e93ce9c2a4d651004";

export async function prepareXhsArchiveComponent({ pythonExecutablePath, sourceArchivePath, stagingDirectory }) {
  const python = path.resolve(pythonExecutablePath);
  const archive = path.resolve(sourceArchivePath);
  const stage = path.resolve(stagingDirectory);
  const version = execFileSync(
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
  if (version.trim() !== "3.12") throw new Error("小红书归档 wheelhouse 必须由 Python 3.12 准备");
  await verifyPinnedSourceArchive(archive);
  if (await pathExists(stage)) throw new Error("小红书归档暂存目录已存在，拒绝覆盖");

  const lockSource = path.join(REPOSITORY_ROOT, "scripts", "xhs-archive.lock.txt");
  await fs.access(lockSource);
  const parent = path.dirname(stage);
  await fs.mkdir(parent, { recursive: true });
  const extraction = await fs.mkdtemp(path.join(parent, ".xhs-source-extract-"));
  let stageCreated = false;
  try {
    execFileSync("tar", ["-xf", archive, "-C", extraction], {
      stdio: "ignore",
      windowsHide: true,
      timeout: 120_000
    });
    const upstreamRoot = path.join(extraction, "XHS-Downloader-" + COMMIT);
    await assertNoLinks(upstreamRoot);
    const project = await fs.readFile(path.join(upstreamRoot, "pyproject.toml"), "utf8");
    if (!project.includes('version = "2.7"') || !project.includes('requires-python = ">=3.12,<3.13"')) {
      throw new Error("XHS 固定源码版本或 Python 约束不匹配");
    }

    await fs.mkdir(stage, { recursive: false });
    stageCreated = true;
    const sourceRoot = path.join(stage, "source");
    const packageSourceRoot = path.join(sourceRoot, "source");
    const wheelhouse = path.join(stage, "wheelhouse");
    await Promise.all([fs.mkdir(packageSourceRoot, { recursive: true }), fs.mkdir(wheelhouse)]);
    await fs.cp(path.join(upstreamRoot, "source"), packageSourceRoot, { recursive: true, filter: sourceFilter });
    await fs.cp(path.join(upstreamRoot, "locale"), path.join(packageSourceRoot, "locale"), {
      recursive: true,
      filter: sourceFilter
    });
    await fs.copyFile(path.join(upstreamRoot, "LICENSE"), path.join(sourceRoot, "LICENSE"));
    await fs.copyFile(path.join(upstreamRoot, "requirements.txt"), path.join(sourceRoot, "requirements.txt"));
    await fs.copyFile(lockSource, path.join(stage, "requirements.lock"));
    await redirectUpstreamVolumeToData(packageSourceRoot);

    const lock = path.join(stage, "requirements.lock");
    execFileSync(
      python,
      [
        "-m",
        "pip",
        "--isolated",
        "--no-cache-dir",
        "--disable-pip-version-check",
        "download",
        "--only-binary=:all:",
        "--require-hashes",
        "--dest",
        wheelhouse,
        "-r",
        lock
      ],
      {
        stdio: "inherit",
        windowsHide: true,
        timeout: 60 * 60 * 1000,
        env: cleanPythonEnvironment()
      }
    );
    const wheels = await fs.readdir(wheelhouse, { withFileTypes: true });
    if (!wheels.length || wheels.some((entry) => !entry.isFile() || !entry.name.endsWith(".whl"))) {
      throw new Error("小红书归档 wheelhouse 必须只包含通过哈希锁校验的 wheel 文件");
    }
    return { stagingDirectory: stage, wheelCount: wheels.length, sourceCommit: COMMIT };
  } catch (error) {
    if (stageCreated) await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  } finally {
    await fs.rm(extraction, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function verifyPinnedSourceArchive(archive) {
  const stat = await fs.stat(archive);
  if (!stat.isFile() || path.basename(archive) !== ARCHIVE_NAME || stat.size !== ARCHIVE_BYTES) {
    throw new Error("XHS 固定源码归档大小或文件名不匹配（需要 " + ARCHIVE_BYTES + " 字节）");
  }
  const digest = crypto.createHash("sha256");
  for await (const chunk of createReadStream(archive)) digest.update(chunk);
  if (digest.digest("hex") !== ARCHIVE_SHA256) throw new Error("XHS 固定源码归档 SHA-256 校验失败");

  const entries = execFileSync("tar", ["-tf", archive], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    timeout: 30_000
  })
    .split(/\r?\n/)
    .filter(Boolean);
  if (!entries.length) throw new Error("XHS 固定源码归档为空");
  for (const entry of entries) {
    const normalized = entry.replaceAll("\\", "/").replace(/\/$/, "");
    const segments = normalized.split("/");
    if (
      !normalized ||
      path.posix.isAbsolute(normalized) ||
      segments[0] !== "XHS-Downloader-" + COMMIT ||
      segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes(":"))
    ) {
      throw new Error("XHS 固定源码归档路径无效：" + entry);
    }
  }
}

async function redirectUpstreamVolumeToData(packageSourceRoot) {
  const staticPath = path.join(packageSourceRoot, "module", "static.py");
  let source = await fs.readFile(staticPath, "utf8");
  const pathlibImport = "from pathlib import Path";
  if (!source.includes(pathlibImport)) throw new Error("XHS 固定源码路径模块格式与已审核补丁上下文不匹配");
  if (!source.includes("import os")) source = source.replace(pathlibImport, "import os\n" + pathlibImport);
  const original = 'ROOT = Path(__file__).resolve().parent.parent.parent.joinpath("Volume")\nROOT.mkdir(exist_ok=True)';
  const patched =
    'ROOT = Path(os.environ.get("XHS_VOLUME_DIR", Path(__file__).resolve().parent.parent.parent.joinpath("Volume")))\nROOT.mkdir(parents=True, exist_ok=True)';
  if (!source.includes(original)) throw new Error("XHS 固定源码 Volume 路径与已审核补丁上下文不匹配");
  await fs.writeFile(staticPath, source.replace(original, patched), "utf8");
}

async function assertNoLinks(root) {
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    if (!current) continue;
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      const stat = await fs.lstat(fullPath);
      if (stat.isSymbolicLink()) throw new Error("XHS 固定源码归档不允许包含符号链接");
      if (stat.isDirectory()) pending.push(fullPath);
      else if (!stat.isFile()) throw new Error("XHS 固定源码归档包含特殊文件");
    }
  }
}

function sourceFilter(_source, destination) {
  return !destination.split(path.sep).some((segment) => segment === "__pycache__") && !destination.endsWith(".pyc");
}

function cleanPythonEnvironment() {
  const environment = { ...process.env };
  for (const key of ["PYTHONHOME", "PYTHONPATH", "PYTHONUSERBASE"]) delete environment[key];
  environment.PYTHONNOUSERSITE = "1";
  if (process.platform === "win32") environment.PIP_CONFIG_FILE = "NUL";
  return environment;
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
  if (values.size !== 3 || !values.has("python") || !values.has("archive") || !values.has("stage")) {
    throw new Error(
      "用法：pnpm components:prepare-xhs-archive -- --python <Python 3.12 python.exe> --archive <固定源码 zip> --stage <新暂存目录>"
    );
  }
  return {
    pythonExecutablePath: values.get("python"),
    sourceArchivePath: values.get("archive"),
    stagingDirectory: values.get("stage")
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await prepareXhsArchiveComponent(parseArguments(process.argv.slice(2)));
    console.log("小红书归档运行时暂存目录已准备：" + result.stagingDirectory);
    console.log("固定源码提交：" + result.sourceCommit + "；wheelhouse：" + result.wheelCount + " 个哈希锁定 wheel");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "小红书归档能力准备失败");
    process.exitCode = 1;
  }
}
