/** 中文模块说明：从哈希锁文件准备 faster-whisper CPU worker 与 Windows x64 离线 wheelhouse。 */
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKER_SOURCE = path.join(REPOSITORY_ROOT, "scripts", "video-transcribe-faster-whisper.py");
const LOCK_SOURCE = path.join(REPOSITORY_ROOT, "scripts", "video-transcribe.lock.txt");

export async function prepareVideoTextComponent({ pythonExecutablePath, stagingDirectory }) {
  const python = path.resolve(pythonExecutablePath);
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
  if (version.trim() !== "3.11") throw new Error("视频转写 wheelhouse 必须由 Python 3.11 准备");
  if (await pathExists(stage)) throw new Error("视频转写暂存目录已存在，拒绝覆盖");

  let stageCreated = false;
  try {
    await fs.mkdir(stage, { recursive: false });
    stageCreated = true;
    const wheelhouse = path.join(stage, "wheelhouse");
    const scripts = path.join(stage, "scripts");
    await Promise.all([fs.mkdir(wheelhouse), fs.mkdir(scripts)]);
    await Promise.all([
      fs.copyFile(WORKER_SOURCE, path.join(scripts, "video-transcribe-faster-whisper.py")),
      fs.copyFile(LOCK_SOURCE, path.join(stage, "requirements.lock"))
    ]);
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
        path.join(stage, "requirements.lock")
      ],
      { stdio: "inherit", windowsHide: true, timeout: 60 * 60 * 1000, env: cleanPythonEnvironment() }
    );
    const wheels = await fs.readdir(wheelhouse, { withFileTypes: true });
    if (!wheels.length || wheels.some((entry) => !entry.isFile() || !entry.name.endsWith(".whl"))) {
      throw new Error("视频转写 wheelhouse 必须只包含通过哈希锁校验的 wheel 文件");
    }
    return { stagingDirectory: stage, wheelCount: wheels.length };
  } catch (error) {
    if (stageCreated) await fs.rm(stage, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
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
  if (values.size !== 2 || !values.has("python") || !values.has("stage")) {
    throw new Error(
      "用法：pnpm components:prepare-video-text -- --python <Python 3.11 python.exe> --stage <新暂存目录>"
    );
  }
  return { pythonExecutablePath: values.get("python"), stagingDirectory: values.get("stage") };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await prepareVideoTextComponent(parseArguments(process.argv.slice(2)));
    console.log(`视频转写暂存目录已准备：${result.stagingDirectory}`);
    console.log(`wheelhouse：${result.wheelCount} 个经过锁文件摘要校验的 wheel`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "视频转写组件准备失败");
    process.exitCode = 1;
  }
}
