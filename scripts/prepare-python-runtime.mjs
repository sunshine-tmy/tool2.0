/** 中文模块说明：校验固定来源的 Python install_only_stripped 运行时并安全准备能力包暂存目录。 */
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(REPOSITORY_ROOT, "backend", "package.json"));
const tar = require("tar");

export async function preparePythonRuntime({
  archivePath,
  stagingDirectory,
  expectedVersion,
  expectedArchiveBytes,
  expectedArchiveSha256,
  platform = process.platform === "darwin" ? "darwin-arm64" : "win32-x64",
  maxInstalledBytes = 300_000_000
}) {
  if (!/^3\.(11|12)$/.test(expectedVersion)) throw new Error("桌面共享 Python 版本不受支持");
  if (!(
    (platform === "win32-x64" && process.platform === "win32" && process.arch === "x64") ||
    (platform === "darwin-arm64" && process.platform === "darwin" && process.arch === "arm64")
  )) {
    throw new Error("Python 共享运行时必须在对应 Windows x64 或 Apple Silicon 原生构建机上准备");
  }
  if (!Number.isSafeInteger(expectedArchiveBytes) || !/^[a-f0-9]{64}$/.test(expectedArchiveSha256)) {
    throw new Error("Python 固定归档信息无效");
  }
  const archive = path.resolve(archivePath);
  const stage = path.resolve(stagingDirectory);
  const archiveStat = await fs.stat(archive);
  if (!archiveStat.isFile() || archiveStat.size !== expectedArchiveBytes) {
    throw new Error(`Python ${expectedVersion} 归档大小不匹配：需要 ${expectedArchiveBytes} 字节`);
  }
  if ((await sha256File(archive)) !== expectedArchiveSha256) {
    throw new Error(`Python ${expectedVersion} 官方运行时 SHA-256 校验失败`);
  }
  if (await pathExists(stage)) throw new Error(`Python ${expectedVersion} 暂存目录已存在，拒绝覆盖`);

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
        !["File", "Directory", ...(platform === "darwin-arm64" ? ["SymbolicLink"] : [])].includes(entry.type)
      ) {
        throw new Error(`Python 运行时归档含有不安全条目：${entry.path}`);
      }
      if (entry.type === "SymbolicLink") validatePythonLink(entry.path, entry.linkpath);
      if (entry.type === "File") {
        if (!Number.isSafeInteger(entry.size) || entry.size < 0) {
          throw new Error(`Python 运行时归档条目大小无效：${entry.path}`);
        }
        extractedBytes += entry.size;
        if (extractedBytes > maxInstalledBytes) throw new Error("Python 运行时解压大小超过限制");
      }
    }
  });

  const parent = path.dirname(stage);
  await fs.mkdir(parent, { recursive: true });
  const temporary = await fs.mkdtemp(path.join(parent, `.python-${expectedVersion.replaceAll(".", "-")}-extract-`));
  let stageCreated = false;
  try {
    await tar.x({ file: archive, cwd: temporary, strict: true, preservePaths: false });
    if (platform === "darwin-arm64") await materializeMacRuntimeLinks(temporary);
    await assertNoLinks(temporary);
    const [major, minor] = expectedVersion.split(".");
    const pythonRelativePath =
      platform === "darwin-arm64" ? `python/bin/python${expectedVersion}` : "python/python.exe";
    const pythonExe = path.join(temporary, ...pythonRelativePath.split("/"));
    const pythonDll = path.join(temporary, "python", `python${major}${minor}.dll`);
    if (!(await isFile(pythonExe)) || (platform === "win32-x64" && !(await isFile(pythonDll)))) {
      throw new Error(
        platform === "darwin-arm64"
          ? `Python ${expectedVersion} 运行时缺少 ${pythonRelativePath}`
          : `Python ${expectedVersion} 运行时缺少 python.exe 或 python${major}${minor}.dll`
      );
    }
    if (platform === "darwin-arm64" && ((await fs.stat(pythonExe)).mode & 0o111) === 0) {
      throw new Error(`Python ${expectedVersion} macOS 运行时缺少可执行权限`);
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
    if (output.trim() !== expectedVersion) throw new Error(`Python ${expectedVersion} 运行时自检未返回预期版本`);
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

export async function materializeMacRuntimeLinks(root) {
  const resolvedRoot = await fs.realpath(root);
  const pending = [resolvedRoot];
  const links = [];
  while (pending.length) {
    const current = pending.pop();
    if (!current) continue;
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isSymbolicLink()) links.push(fullPath);
      else if (entry.isDirectory()) pending.push(fullPath);
      else if (!entry.isFile()) throw new Error("Python 运行时解压结果包含特殊文件");
    }
  }

  for (const linkPath of links) {
    const linkTarget = await fs.readlink(linkPath);
    validatePythonLink(path.relative(resolvedRoot, linkPath).split(path.sep).join("/"), linkTarget);
    const targetPath = await fs.realpath(linkPath);
    if (!isPathWithin(resolvedRoot, targetPath)) throw new Error("Python 运行时符号链接越界");
    const targetStat = await fs.stat(targetPath);
    if (!targetStat.isFile()) throw new Error("Python macOS 运行时仅允许将文件符号链接实体化");
    await fs.unlink(linkPath);
    await fs.copyFile(targetPath, linkPath);
    await fs.chmod(linkPath, targetStat.mode & 0o777);
  }
}

function validatePythonLink(entryPath, linkTarget) {
  if (
    typeof linkTarget !== "string" ||
    !linkTarget ||
    path.posix.isAbsolute(linkTarget) ||
    path.win32.isAbsolute(linkTarget) ||
    linkTarget.includes("\\") ||
    linkTarget.includes(":")
  ) {
    throw new Error(`Python 运行时包含不安全的符号链接：${entryPath}`);
  }
  const resolvedTarget = path.posix.normalize(path.posix.join(path.posix.dirname(entryPath), linkTarget));
  if (resolvedTarget !== "python" && !resolvedTarget.startsWith("python/")) {
    throw new Error(`Python 运行时符号链接越界：${entryPath}`);
  }
}

function isPathWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
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
