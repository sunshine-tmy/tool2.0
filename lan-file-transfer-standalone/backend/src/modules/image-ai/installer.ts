import { closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import type { ImageAiInstallation } from "@toolbox/shared";
import type { AppConfig } from "../../config";

type PersistedStatus = {
  status: ImageAiInstallation["status"];
  message?: string;
  updatedAt: string;
};

type PersistedProgress = {
  stage: NonNullable<ImageAiInstallation["stage"]>;
  progress: number;
  message: string;
  startedAt: string;
  updatedAt: string;
};

export function createImageAiInstaller(config: AppConfig) {
  const runtimeDir = path.join(config.projectRoot, ".runtime");
  const statusPath = path.join(runtimeDir, "image-ai-install-status.json");
  const progressPath = path.join(runtimeDir, "image-ai-install-progress.json");
  const installPidPath = path.join(runtimeDir, "image-ai-install.pid");
  const workerPidPath = path.join(runtimeDir, "image-ai.pid");
  const installLogPath = path.join(runtimeDir, "image-ai-install.log");
  const workerLogPath = path.join(runtimeDir, "image-ai.log");
  const workerErrorLogPath = path.join(runtimeDir, "image-ai-error.log");
  let installProcessId: number | undefined;

  async function status(): Promise<ImageAiInstallation> {
    const runtimeInstalled = runtimeIsInstalled();
    const pythonInstalled = detectPython311();
    const persisted = await readStatus();
    const progress = await readProgress();
    const activityAt = await latestInstallActivity(progress?.updatedAt);
    let currentStatus: ImageAiInstallation["status"];
    let message = persisted?.message;

    if (runtimeInstalled) {
      currentStatus = "installed";
      message = "AI 环境已安装";
    } else if (persisted?.status === "installing") {
      const recordedPid = installProcessId ?? (await readPid(installPidPath));
      if (recordedPid && processIsAlive(recordedPid)) {
        currentStatus = "installing";
        message = progress?.message || persisted.message || "正在安装 Python、AI 依赖和模型";
      } else {
        currentStatus = "failed";
        message = "上次安装未完成，请重新点击一键安装";
      }
    } else if (persisted?.status === "failed") {
      currentStatus = "failed";
    } else {
      currentStatus = "not-installed";
      message = pythonInstalled ? "Python 3.11 已安装，AI 环境尚未安装" : "Python 3.11 和 AI 环境尚未安装";
    }
    const exposeProgress = currentStatus === "installing" || currentStatus === "failed";

    return {
      status: currentStatus,
      pythonInstalled,
      runtimeInstalled,
      installerAvailable: bundledInstallerExists(),
      platform: platformName(),
      message,
      stage: runtimeInstalled ? "completed" : exposeProgress ? progress?.stage : undefined,
      progress: runtimeInstalled ? 100 : exposeProgress ? progress?.progress : undefined,
      startedAt: exposeProgress ? progress?.startedAt : undefined,
      activityAt: exposeProgress ? activityAt : undefined,
      updatedAt: persisted?.updatedAt
    };
  }

  async function install(): Promise<ImageAiInstallation> {
    const current = await status();
    if (current.status === "installing") return current;
    if (current.runtimeInstalled) {
      await startWorker();
      return status();
    }
    if (current.platform === "unsupported") {
      throw new Error("当前系统不支持独立版 AI 环境自动安装");
    }
    if (!current.pythonInstalled && !current.installerAvailable) {
      throw new Error("未找到随包附带的 Python 3.11 安装程序");
    }

    mkdirSync(runtimeDir, { recursive: true });
    const startedAt = new Date().toISOString();
    await writeProgress({
      stage: current.pythonInstalled ? "environment" : "python",
      progress: current.pythonInstalled ? 8 : 3,
      message: current.pythonInstalled ? "正在准备独立 AI 运行环境" : "等待完成 Python 3.11 安装",
      startedAt,
      updatedAt: startedAt
    });
    await fs.appendFile(
      installLogPath,
      `\n=== ${new Date().toISOString()} image AI installation started (${process.platform}/${process.arch}) ===\n`,
      "utf8"
    );
    await writeStatus({
      status: "installing",
      message: current.pythonInstalled ? "正在安装 AI 依赖和模型" : "请先在弹出的窗口中完成 Python 安装",
      updatedAt: new Date().toISOString()
    });

    const command =
      process.platform === "win32"
        ? {
            file: "powershell.exe",
            args: [
              "-NoLogo",
              "-NoProfile",
              "-ExecutionPolicy",
              "Bypass",
              "-File",
              path.join(config.projectRoot, "scripts", "install-image-ai-windows.ps1")
            ]
          }
        : {
            file: "/bin/bash",
            args: [path.join(config.projectRoot, "scripts", "install-image-ai-macos.sh")]
          };

    const logFd = openSync(installLogPath, "a");
    const child = spawn(command.file, command.args, {
      cwd: config.projectRoot,
      env: { ...process.env },
      detached: process.platform !== "win32",
      windowsHide: true,
      stdio: ["ignore", logFd, logFd]
    });
    installProcessId = child.pid;
    await fs.writeFile(installPidPath, String(child.pid), "ascii");

    child.once("error", (error) => {
      closeFile(logFd);
      void writeStatus({
        status: "failed",
        message: `无法启动安装程序：${error.message}`,
        updatedAt: new Date().toISOString()
      });
    });
    child.once("exit", (code) => {
      closeFile(logFd);
      installProcessId = undefined;
      void fs.rm(installPidPath, { force: true });
      void (async () => {
        if (code === 0 && runtimeIsInstalled()) {
          await writeProgress({
            stage: "completed",
            progress: 100,
            message: "AI 环境安装完成",
            startedAt: (await readProgress())?.startedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          await writeStatus({
            status: "installed",
            message: "AI 环境安装完成，正在启动推理服务",
            updatedAt: new Date().toISOString()
          });
          await startWorker();
        } else {
          const lastProgress = await readProgress();
          await writeProgress({
            stage: "failed",
            progress: lastProgress?.progress || 0,
            message: code === 0 ? "安装脚本已结束，但 AI 环境未生成" : "AI 环境安装失败",
            startedAt: lastProgress?.startedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          await writeStatus({
            status: "failed",
            message:
              code === 0
                ? "安装脚本已结束，但 AI 环境未生成，请查看 .runtime/image-ai-install-transcript.log"
                : `AI 环境安装失败${code === null ? "" : `（退出码 ${code}）`}，请查看 .runtime/image-ai-install.log`,
            updatedAt: new Date().toISOString()
          });
        }
      })();
    });
    if (process.platform !== "win32") child.unref();
    return status();
  }

  async function startWorker() {
    if (!runtimeIsInstalled()) throw new Error("AI 环境尚未安装");
    const existingPid = await readPid(workerPidPath);
    if (existingPid && processIsAlive(existingPid)) return;

    const workerUrl = new URL(config.imageAiWorkerUrl);
    if (!["127.0.0.1", "localhost", "::1"].includes(workerUrl.hostname)) {
      throw new Error("AI Worker 仅允许监听本机地址");
    }
    const python = runtimePythonPath();
    const logFd = openSync(workerLogPath, "a");
    const errorFd = openSync(workerErrorLogPath, "a");
    const child = spawn(
      python,
      [
        path.join(config.projectRoot, "scripts", "image-ai-worker.py"),
        "--host",
        workerUrl.hostname === "::1" ? "::1" : "127.0.0.1",
        "--port",
        workerUrl.port || "3210"
      ],
      {
        cwd: config.projectRoot,
        env: { ...process.env, PYTORCH_ENABLE_MPS_FALLBACK: "1" },
        detached: true,
        windowsHide: true,
        stdio: ["ignore", logFd, errorFd]
      }
    );
    await fs.writeFile(workerPidPath, String(child.pid), "ascii");
    child.once("error", () => {
      closeFile(logFd);
      closeFile(errorFd);
      void fs.rm(workerPidPath, { force: true });
    });
    child.once("exit", () => {
      closeFile(logFd);
      closeFile(errorFd);
    });
    child.unref();
  }

  function runtimeIsInstalled() {
    return existsSync(runtimePythonPath()) && existsSync(path.join(config.projectRoot, ".venv-image-ai", ".ready"));
  }

  function runtimePythonPath() {
    return path.join(
      config.projectRoot,
      ".venv-image-ai",
      process.platform === "win32" ? path.join("Scripts", "python.exe") : path.join("bin", "python")
    );
  }

  function bundledInstallerExists() {
    const file =
      process.platform === "win32"
        ? "python-3.11.9-amd64.exe"
        : process.platform === "darwin"
          ? "python-3.11.9-macos11.pkg"
          : "";
    return Boolean(file && existsSync(path.join(config.projectRoot, file)));
  }

  function platformName(): ImageAiInstallation["platform"] {
    if (process.platform === "win32" && process.arch === "x64") return "windows";
    if (process.platform === "darwin" && process.arch === "arm64") return "macos";
    return "unsupported";
  }

  function detectPython311() {
    const candidates: Array<{ file: string; args: string[] }> =
      process.platform === "win32"
        ? [
            { file: "py.exe", args: ["-3.11", "-c", "import sys; print(sys.version_info[:2])"] },
            {
              file: path.join(process.env.LocalAppData || "", "Programs", "Python", "Python311", "python.exe"),
              args: ["-c", "import sys; print(sys.version_info[:2])"]
            },
            { file: "C:\\Program Files\\Python311\\python.exe", args: ["-c", "import sys; print(sys.version_info[:2])"] }
          ]
        : [
            { file: "python3.11", args: ["-c", "import sys; print(sys.version_info[:2])"] },
            { file: "/usr/local/bin/python3.11", args: ["-c", "import sys; print(sys.version_info[:2])"] },
            {
              file: "/Library/Frameworks/Python.framework/Versions/3.11/bin/python3.11",
              args: ["-c", "import sys; print(sys.version_info[:2])"]
            },
            { file: "/opt/homebrew/bin/python3.11", args: ["-c", "import sys; print(sys.version_info[:2])"] }
          ];
    return candidates.some(({ file, args }) => {
      if (path.isAbsolute(file) && !existsSync(file)) return false;
      const result = spawnSync(file, args, { windowsHide: true, encoding: "utf8", timeout: 5000 });
      return result.status === 0 && String(result.stdout).includes("(3, 11)");
    });
  }

  async function readStatus() {
    try {
      return JSON.parse(await fs.readFile(statusPath, "utf8")) as PersistedStatus;
    } catch {
      return undefined;
    }
  }

  async function readProgress() {
    try {
      const value = JSON.parse(await fs.readFile(progressPath, "utf8")) as PersistedProgress;
      if (
        !Number.isFinite(value.progress) ||
        value.progress < 0 ||
        value.progress > 100 ||
        typeof value.message !== "string"
      ) {
        return undefined;
      }
      return value;
    } catch {
      return undefined;
    }
  }

  async function writeProgress(value: PersistedProgress) {
    await fs.mkdir(runtimeDir, { recursive: true });
    await fs.writeFile(progressPath, JSON.stringify(value, null, 2), "utf8");
  }

  async function latestInstallActivity(progressUpdatedAt?: string) {
    let latest = progressUpdatedAt ? new Date(progressUpdatedAt).getTime() : 0;
    try {
      const log = await fs.stat(installLogPath);
      latest = Math.max(latest, log.mtimeMs);
    } catch {
      // The log is created only after the first installation starts.
    }
    return latest > 0 ? new Date(latest).toISOString() : undefined;
  }

  async function writeStatus(value: PersistedStatus) {
    await fs.mkdir(runtimeDir, { recursive: true });
    await fs.writeFile(statusPath, JSON.stringify(value, null, 2), "utf8");
  }

  return { status, install, startWorker };
}

async function readPid(filePath: string) {
  try {
    const value = Number((await fs.readFile(filePath, "utf8")).trim());
    return Number.isSafeInteger(value) && value > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function processIsAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function closeFile(fd: number) {
  try {
    closeSync(fd);
  } catch {
    // The child may have already closed the inherited file descriptor.
  }
}
