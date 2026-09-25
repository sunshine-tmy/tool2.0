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
  maxInstalledBytes = 300_000_000
}) {
  if (!/^3\.(11|12)$/.test(expectedVersion)) throw new Error("桌面共享 Python 版本不受支持");
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
        !["File", "Directory"].includes(entry.type)
      ) {
        throw new Error(`Python 运行时归档含有不安全条目：${entry.path}`);
      }
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
    await assertNoLinks(temporary);
    const [major, minor] = expectedVersion.split(".");
    const pythonExe = path.join(temporary, "python", "python.exe");
    const pythonDll = path.join(temporary, "python", `python${major}${minor}.dll`);
    if (!(await isFile(pythonExe)) || !(await isFile(pythonDll))) {
      throw new Error(`Python ${expectedVersion} 运行时缺少 python.exe 或 python${major}${minor}.dll`);
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
