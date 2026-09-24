/** 中文模块说明：校验固定来源的 Python 3.11 运行时并安全准备能力包暂存目录。 */
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(REPOSITORY_ROOT, "backend", "package.json"));
const tar = require("tar");
const EXPECTED_ARCHIVE_SOURCE_URL =
  "https://github.com/astral-sh/python-build-standalone/releases/download/20260901/cpython-3.11.16%2B20260901-x86_64-pc-windows-msvc-install_only_stripped.tar.gz";
const EXPECTED_ARCHIVE_BYTES = 25_189_257;
const EXPECTED_ARCHIVE_SHA256 = "06cbe479e039f5b9cb5640c286d790074d63f549f92a32d599a3748293bd4510";
const MAX_INSTALLED_BYTES = 300_000_000;

export async function preparePython311Runtime({ archivePath, stagingDirectory }) {
  const archive = path.resolve(archivePath);
  const stage = path.resolve(stagingDirectory);
  const archiveStat = await fs.stat(archive);
  if (!archiveStat.isFile() || archiveStat.size !== EXPECTED_ARCHIVE_BYTES) {
    throw new Error(`Python 3.11 归档大小不匹配：需要 ${EXPECTED_ARCHIVE_BYTES} 字节`);
  }
  if ((await sha256File(archive)) !== EXPECTED_ARCHIVE_SHA256) {
    throw new Error("Python 3.11 官方运行时 SHA-256 校验失败");
  }
  if (await pathExists(stage)) throw new Error("Python 3.11 暂存目录已存在，拒绝覆盖");

  let extractedBytes = 0;
  await tar.t({
    file: archive,
    strict: true,
    onentry(entry) {
      const entryPath = entry.path.replaceAll("\\", "/");
      const trimmedPath = entryPath.endsWith("/") ? entryPath.slice(0, -1) : entryPath;
      const segments = trimmedPath.split("/");
      if (
        !trimmedPath ||
        path.posix.isAbsolute(trimmedPath) ||
        segments[0] !== "python" ||
        segments.some((segment) => !segment || segment === "." || segment === "..") ||
        !["File", "Directory"].includes(entry.type)
      ) {
        throw new Error(`Python 运行时归档含有不安全条目：${entry.path}`);
      }
      if (entry.type === "File") {
        if (!Number.isSafeInteger(entry.size) || entry.size < 0) {
          throw new Error(`Python 运行时归档条目大小无效：${entry.path}`);
        }
        extractedBytes += entry.size;
        if (extractedBytes > MAX_INSTALLED_BYTES) throw new Error("Python 运行时解压大小超过限制");
      }
    }
  });

  const parent = path.dirname(stage);
  await fs.mkdir(parent, { recursive: true });
  const temporary = await fs.mkdtemp(path.join(parent, ".python-311-extract-"));
  let stageCreated = false;
  try {
    await tar.x({ file: archive, cwd: temporary, strict: true, preservePaths: false });
    await assertNoLinks(temporary);
    const pythonExe = path.join(temporary, "python", "python.exe");
    const pythonDll = path.join(temporary, "python", "python311.dll");
    if (!(await isFile(pythonExe)) || !(await isFile(pythonDll))) {
      throw new Error("Python 3.11 运行时缺少 python.exe 或 python311.dll");
    }
    const output = execFileSync(
      pythonExe,
      [
        "-I",
        "-c",
        "import ensurepip, ssl, sqlite3, sys, venv; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        timeout: 30_000,
        env: cleanPythonEnvironment()
      }
    );
    if (output.trim() !== "3.11") throw new Error("Python 3.11 运行时自检未返回预期版本");
    await fs.rename(temporary, stage);
    stageCreated = true;
    return { stagingDirectory: stage, extractedBytes };
  } catch (error) {
    if (stageCreated) await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  } finally {
    await fs.rm(temporary, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function assertNoLinks(root) {
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    if (!current) continue;
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      const stat = await fs.lstat(fullPath);
      if (stat.isSymbolicLink()) throw new Error("Python 运行时解压结果不允许包含符号链接");
      if (stat.isDirectory()) pending.push(fullPath);
      else if (!stat.isFile()) throw new Error("Python 运行时解压结果包含特殊文件");
    }
  }
}

async function sha256File(filePath) {
  const digest = crypto.createHash("sha256");
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  return digest.digest("hex");
}

function cleanPythonEnvironment() {
  const environment = { ...process.env };
  for (const key of ["PYTHONHOME", "PYTHONPATH", "PYTHONUSERBASE"]) delete environment[key];
  environment.PYTHONNOUSERSITE = "1";
  return environment;
}

function isFile(filePath) {
  return fs.stat(filePath).then(
    (stat) => stat.isFile(),
    () => false
  );
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
  if (values.size !== 2 || !values.has("archive") || !values.has("stage")) {
    throw new Error("用法：node scripts/prepare-python-311-runtime.mjs --archive <官方归档> --stage <新暂存目录>");
  }
  return { archivePath: values.get("archive"), stagingDirectory: values.get("stage") };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await preparePython311Runtime(parseArguments(process.argv.slice(2)));
    console.log(`Python 3.11.16 运行时已校验并准备：${result.stagingDirectory}`);
    console.log(`解压文件大小：${result.extractedBytes} 字节`);
    console.log(`固定来源：${EXPECTED_ARCHIVE_SOURCE_URL}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Python 运行时准备失败");
    process.exitCode = 1;
  }
}
