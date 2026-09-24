/** 中文模块说明：在不可变版本最终目录内，由固定解释器与哈希锁定的 wheelhouse 离线构建 Python 环境。 */
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_RELATIVE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export type PythonRuntimeVersion = "3.11" | "3.12";

export type PythonEnvironmentBuildOptions = {
  packageRoot: string;
  pythonExecutablePath: string;
  wheelhousePath: string;
  requirementsLockPath: string;
  requirementsLockSha256: string;
  expectedPythonVersion: PythonRuntimeVersion;
  runProcess?: (
    executable: string,
    args: string[],
    cwd: string,
    environment?: Record<string, string>
  ) => Promise<string>;
};

export async function buildPythonEnvironment(options: PythonEnvironmentBuildOptions) {
  if (!SHA256.test(options.requirementsLockSha256)) throw new Error("Python 依赖锁文件摘要格式无效");
  const packageRoot = await fs.realpath(options.packageRoot);
  const pythonExecutable = await resolvePackageAsset(packageRoot, options.pythonExecutablePath, "Python 解释器");
  const wheelhouse = await resolvePackageAsset(packageRoot, options.wheelhousePath, "wheelhouse");
  const requirementsLock = await resolvePackageAsset(packageRoot, options.requirementsLockPath, "Python 依赖锁文件");
  const pythonStat = await fs.stat(pythonExecutable);
  const wheelhouseStat = await fs.stat(wheelhouse);
  const lockStat = await fs.stat(requirementsLock);
  if (!pythonStat.isFile() || !wheelhouseStat.isDirectory() || !lockStat.isFile()) {
    throw new Error("Python 运行时资产类型无效");
  }
  if ((await sha256File(requirementsLock)) !== options.requirementsLockSha256) {
    throw new Error("Python 依赖锁文件摘要校验失败");
  }

  const environmentDirectory = path.join(packageRoot, "venv");
  if (await pathExists(environmentDirectory)) throw new Error("Python 环境目标目录已存在，拒绝覆盖");
  const temporaryDirectory = path.join(packageRoot, ".python-build-temp");
  if (await pathExists(temporaryDirectory)) throw new Error("Python 构建临时目录已存在，拒绝覆盖");
  await fs.mkdir(temporaryDirectory);
  const run = options.runProcess ?? runProcess;
  const temporaryEnvironment = {
    TEMP: temporaryDirectory,
    TMP: temporaryDirectory,
    TMPDIR: temporaryDirectory
  };
  try {
    const baseVersion = await run(
      pythonExecutable,
      ["-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"],
      packageRoot,
      temporaryEnvironment
    );
    assertExpectedVersion(baseVersion, options.expectedPythonVersion);
    await run(pythonExecutable, ["-m", "venv", environmentDirectory], packageRoot, temporaryEnvironment);

    const environmentPython = path.join(environmentDirectory, "Scripts", "python.exe");
    const environmentVersion = await run(
      environmentPython,
      ["-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"],
      packageRoot,
      temporaryEnvironment
    );
    assertExpectedVersion(environmentVersion, options.expectedPythonVersion);
    await run(
      environmentPython,
      [
        "-m",
        "pip",
        "--isolated",
        "--no-cache-dir",
        "install",
        "--disable-pip-version-check",
        "--no-index",
        "--require-hashes",
        "--find-links",
        wheelhouse,
        "-r",
        requirementsLock
      ],
      packageRoot,
      temporaryEnvironment
    );
    await run(environmentPython, ["-m", "pip", "--isolated", "check"], packageRoot, temporaryEnvironment);
    return { environmentDirectory, pythonExecutable: environmentPython, pythonVersion: options.expectedPythonVersion };
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function resolvePackageAsset(packageRoot: string, relative: string, label: string) {
  if (
    !SAFE_RELATIVE_PATH.test(relative) ||
    relative.includes("\\") ||
    relative.split("/").some((part) => part === "..")
  ) {
    throw new Error(`${label}路径不安全`);
  }
  const candidate = path.resolve(packageRoot, ...relative.split("/"));
  if (!isWithin(packageRoot, candidate)) throw new Error(`${label}路径越界`);
  const resolved = await fs.realpath(candidate);
  if (!isWithin(packageRoot, resolved)) throw new Error(`${label}链接目标越界`);
  return resolved;
}

function assertExpectedVersion(output: string, expected: PythonRuntimeVersion) {
  if (output.trim() !== expected) throw new Error(`Python 版本不匹配；需要 ${expected}`);
}

function isWithin(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function sha256File(filePath: string) {
  const digest = crypto.createHash("sha256");
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  return digest.digest("hex");
}

async function runProcess(executable: string, args: string[], cwd: string, environment?: Record<string, string>) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ...environment,
        PIP_CONFIG_FILE: process.platform === "win32" ? "NUL" : os.devNull,
        PIP_DISABLE_PIP_VERSION_CHECK: "1",
        PYTHONNOUSERSITE: "1"
      }
    });
    let output = "";
    const timeout = setTimeout(
      () => {
        child.kill();
        reject(new Error("Python 环境命令超时"));
      },
      30 * 60 * 1000
    );
    timeout.unref();
    const collect = (chunk: Buffer) => {
      if (output.length < 16_000) output += chunk.toString("utf8").slice(0, 16_000 - output.length);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve(output);
      else reject(new Error(`Python 环境命令失败（exit ${code}）：${output.trim().slice(-800)}`));
    });
  });
}

function pathExists(candidate: string) {
  return fs.access(candidate).then(
    () => true,
    () => false
  );
}
