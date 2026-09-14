import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { XhsRuntimeStatus } from "@toolbox/shared";
import type { AppConfig } from "../../config";
import { terminateChildProcess } from "../../lifecycle/child-process";

const XHS_COMMIT = "afaf2fb459980fccef9eec74e304a39af2c49cab";
const UV_VERSION = "0.8.17";

export class XhsRuntimeManager {
  private worker?: ChildProcess;
  private installPromise?: Promise<void>;
  private status: XhsRuntimeStatus = {
    status: "not-installed",
    installProgress: 0,
    message: "首次获取时自动安装解析环境",
    version: `XHS-Downloader 2.7 (${XHS_COMMIT.slice(0, 8)})`,
    authenticated: false
  };

  constructor(private readonly config: AppConfig) {
    if (config.xhsProviderUrl) {
      this.status = { ...this.status, status: "ready", installProgress: 100, message: "已连接外部解析服务" };
    } else if (
      fs.existsSync(path.join(config.xhsRuntimeDir, ".installed-commit")) &&
      fs.existsSync(this.venvPython()) &&
      fs.existsSync(path.join(this.venvDir(), "pyvenv.cfg"))
    ) {
      this.status = { ...this.status, status: "ready", installProgress: 100, message: "解析环境已安装" };
    }
  }

  getStatus() {
    return { ...this.status };
  }

  async ensureReady(onProgress?: (status: XhsRuntimeStatus) => void) {
    if (this.config.xhsProviderUrl) return this.config.xhsProviderUrl.replace(/\/$/, "");
    if (await this.isHealthy()) return this.baseUrl();
    if (!this.installPromise) {
      this.installPromise = this.install(onProgress).finally(() => {
        this.installPromise = undefined;
      });
    }
    await this.installPromise;
    try {
      await this.startWorker();
    } catch (error) {
      this.status = {
        ...this.status,
        status: "failed",
        message: error instanceof Error ? error.message : "解析服务启动失败"
      };
      throw error;
    }
    return this.baseUrl();
  }

  async stop() {
    if (!this.worker || this.worker.killed) return;
    const worker = this.worker;
    this.worker = undefined;
    await terminateChildProcess(worker);
  }

  private async install(onProgress?: (status: XhsRuntimeStatus) => void) {
    try {
      await fsp.mkdir(this.config.xhsRuntimeDir, { recursive: true });
      this.update("installing", 5, "检查 Python 3.12", onProgress);
      const python = (await findPython312()) ?? (await this.installManagedPython(onProgress));
      const sourceDir = await this.ensureSource(onProgress);
      const venvPython = this.venvPython();
      const venvConfig = path.join(this.venvDir(), "pyvenv.cfg");
      if (!fs.existsSync(venvPython) || !fs.existsSync(venvConfig)) {
        await fsp.rm(this.venvDir(), { recursive: true, force: true });
        this.update("installing", 55, "创建隔离的 Python 环境", onProgress);
        await run(python.command, [...python.args, "-m", "venv", this.venvDir()], this.config.xhsInstallTimeoutMs);
        if (!fs.existsSync(venvPython) || !fs.existsSync(venvConfig))
          throw new Error("隔离 Python 环境创建不完整，请重新尝试");
      }
      const marker = path.join(this.config.xhsRuntimeDir, ".installed-commit");
      const installed = await fsp.readFile(marker, "utf8").catch(() => "");
      if (installed.trim() !== XHS_COMMIT) {
        this.update("installing", 65, "安装固定版本解析依赖", onProgress);
        const uv = await this.ensureUv();
        await run(
          uv,
          ["pip", "install", "--python", venvPython, "-r", path.join(sourceDir, "requirements.txt")],
          this.config.xhsInstallTimeoutMs,
          { UV_CACHE_DIR: path.join(this.config.xhsRuntimeDir, "cache") }
        );
        await fsp.writeFile(marker, `${XHS_COMMIT}\n`, "utf8");
      }
      this.update("ready", 100, "解析环境已安装", onProgress);
    } catch (error) {
      this.update(
        "failed",
        this.status.installProgress,
        error instanceof Error ? error.message : "解析环境安装失败",
        onProgress
      );
      throw error;
    }
  }

  private async installManagedPython(onProgress?: (status: XhsRuntimeStatus) => void) {
    const pythonDir = path.join(this.config.xhsRuntimeDir, "python");
    const existing = await findManagedPython(pythonDir);
    if (existing) {
      this.update("installing", 35, "复用受管 Python 3.12", onProgress);
      return { command: existing, args: [] as string[] };
    }
    this.update("installing", 15, "下载受管 Python 安装器", onProgress);
    const uv = await this.ensureUv();
    await run(uv, ["python", "install", "3.12"], this.config.xhsInstallTimeoutMs, {
      UV_PYTHON_INSTALL_DIR: pythonDir
    });
    const managed = await findManagedPython(pythonDir);
    if (!managed) throw new Error("受管 Python 3.12 安装后未找到解释器");
    this.update("installing", 35, "Python 3.12 已就绪", onProgress);
    return { command: managed, args: [] as string[] };
  }

  private async ensureUv() {
    const binary = path.join(this.config.xhsRuntimeDir, process.platform === "win32" ? "uv.exe" : "uv");
    if (fs.existsSync(binary)) return binary;
    const target = uvAsset();
    const archive = path.join(this.config.xhsRuntimeDir, target.endsWith(".zip") ? "uv.zip" : "uv.tar.gz");
    await download(`https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/${target}`, archive);
    await run("tar", ["-xf", archive, "-C", this.config.xhsRuntimeDir], this.config.xhsInstallTimeoutMs);
    const found = await findFile(this.config.xhsRuntimeDir, process.platform === "win32" ? "uv.exe" : "uv");
    if (!found) throw new Error("uv 解压后未找到可执行文件");
    if (found !== binary) await fsp.copyFile(found, binary);
    if (process.platform !== "win32") await fsp.chmod(binary, 0o755);
    await fsp.rm(archive, { force: true });
    return binary;
  }

  private async ensureSource(onProgress?: (status: XhsRuntimeStatus) => void) {
    const sourceDir = path.join(this.config.xhsRuntimeDir, `XHS-Downloader-${XHS_COMMIT}`);
    if (fs.existsSync(path.join(sourceDir, "requirements.txt"))) return sourceDir;
    this.update("installing", 40, "下载 XHS-Downloader 2.7 固定源码", onProgress);
    const archive = path.join(this.config.xhsRuntimeDir, "xhs-source.zip");
    await download(`https://codeload.github.com/JoeanAmier/XHS-Downloader/zip/${XHS_COMMIT}`, archive);
    await run("tar", ["-xf", archive, "-C", this.config.xhsRuntimeDir], this.config.xhsInstallTimeoutMs);
    await fsp.rm(archive, { force: true });
    if (!fs.existsSync(path.join(sourceDir, "LICENSE"))) throw new Error("固定版本源码校验失败");
    return sourceDir;
  }

  private async startWorker() {
    if (await this.isHealthy()) return;
    this.status = { ...this.status, status: "installing", message: "正在启动本机解析服务" };
    const sourceDir = path.join(this.config.xhsRuntimeDir, `XHS-Downloader-${XHS_COMMIT}`);
    const workerScript = findProjectFile("scripts/xhs-provider-worker.py");
    this.worker = spawn(this.venvPython(), [workerScript], {
      cwd: sourceDir,
      env: { ...process.env, XHS_PROVIDER_PORT: String(this.config.xhsProviderPort), XHS_SOURCE_DIR: sourceDir },
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true
    });
    let stderr = "";
    this.worker.stderr?.on("data", (chunk) => {
      stderr = `${stderr}${String(chunk)}`.slice(-4000);
    });
    this.worker.once("exit", () => {
      this.worker = undefined;
      if (this.status.status === "ready") this.status = { ...this.status, status: "failed", message: "解析服务已停止" };
    });
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (await this.isHealthy()) {
        this.status = { ...this.status, status: "ready", installProgress: 100, message: "解析服务可用" };
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`解析服务启动超时${stderr ? `：${stderr.split("\n").at(-2) ?? stderr}` : ""}`);
  }

  private async isHealthy() {
    try {
      const response = await fetch(`${this.baseUrl()}/health`, { signal: AbortSignal.timeout(1500) });
      return response.ok;
    } catch {
      return false;
    }
  }

  private baseUrl() {
    return `http://127.0.0.1:${this.config.xhsProviderPort}`;
  }

  private venvDir() {
    return path.join(this.config.xhsRuntimeDir, "venv");
  }

  private venvPython() {
    return path.join(this.venvDir(), process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  }

  private update(
    status: XhsRuntimeStatus["status"],
    installProgress: number,
    message: string,
    callback?: (status: XhsRuntimeStatus) => void
  ) {
    this.status = { ...this.status, status, installProgress, message };
    callback?.(this.getStatus());
  }
}

async function findPython312() {
  const candidates =
    process.platform === "win32"
      ? [
          { command: "py", args: ["-3.12"] },
          { command: "python", args: [] }
        ]
      : [
          { command: "python3.12", args: [] },
          { command: "python3", args: [] },
          { command: "python", args: [] }
        ];
  for (const candidate of candidates) {
    try {
      const output = await run(
        candidate.command,
        [...candidate.args, "-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"],
        5000
      );
      if (output.trim() === "3.12") return candidate;
    } catch {
      // Continue with another command or install a managed interpreter.
    }
  }
  return undefined;
}

async function findManagedPython(root: string) {
  const names = process.platform === "win32" ? ["python.exe"] : ["python3.12", "python3", "python"];
  for (const name of names) {
    const found = await findFile(root, name);
    if (found) return found;
  }
  return undefined;
}

async function findFile(root: string, name: string): Promise<string | undefined> {
  const entries = await fsp.readdir(root, { withFileTypes: true }).catch(() => []);
  const direct = entries.find((entry) => entry.isFile() && entry.name === name);
  if (direct) return path.join(root, direct.name);
  for (const entry of entries) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFile(candidate, name);
      if (nested) return nested;
    }
  }
  return undefined;
}

function findProjectFile(relativePath: string) {
  const candidates = [path.resolve(process.cwd(), relativePath), path.resolve(process.cwd(), "..", relativePath)];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`找不到项目文件：${relativePath}`);
  return found;
}

function uvAsset() {
  if (process.platform === "win32") return "uv-x86_64-pc-windows-msvc.zip";
  if (process.platform === "darwin" && process.arch === "arm64") return "uv-aarch64-apple-darwin.tar.gz";
  if (process.platform === "darwin") return "uv-x86_64-apple-darwin.tar.gz";
  return process.arch === "arm64" ? "uv-aarch64-unknown-linux-gnu.tar.gz" : "uv-x86_64-unknown-linux-gnu.tar.gz";
}

async function download(url: string, target: string) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`下载失败（HTTP ${response.status}）`);
  await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(target));
}

function run(command: string, args: string[], timeoutMs: number, extraEnv: Record<string, string> = {}) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...extraEnv },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on("data", (chunk) => (stdout += String(chunk)));
    child.stderr.on("data", (chunk) => (stderr += String(chunk)));
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `${command} 执行失败（退出码 ${code ?? "unknown"}）`));
    });
  });
}
