/**
 * 中文模块说明：小红书归档领域，负责获取、媒体、翻译、运行时和恢复
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { XhsRuntimeStatus } from "@toolbox/shared";
import type { AppConfig } from "../../config";
import { validateArchiveListing, validateExtractedDirectory } from "../../security/archive-safety";

export const XHS_COMMIT = "afaf2fb459980fccef9eec74e304a39af2c49cab";
const UV_VERSION = "0.8.17";

type ProgressCallback = (status: XhsRuntimeStatus) => void;

/** Installs and validates the pinned local XHS runtime without owning process state. */
export class XhsRuntimeInstallGateway {
  private progress = 0;

  constructor(
    private readonly config: AppConfig,
    private readonly update: ProgressCallback
  ) {}

  runtimeSourceDir() {
    return path.join(this.config.xhsRuntimeDir, `XHS-Downloader-${XHS_COMMIT}`);
  }

  venvDir() {
    return path.join(this.config.xhsRuntimeDir, "venv");
  }

  venvPython() {
    return path.join(this.venvDir(), process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  }

  async validateExistingSource() {
    await this.verifySource(this.runtimeSourceDir());
  }

  async install() {
    try {
      await fsp.mkdir(this.config.xhsRuntimeDir, { recursive: true });
      this.report("installing", 5, "检查 Python 3.12");
      const python = (await findPython312()) ?? (await this.installManagedPython());
      const sourceDir = await this.ensureSource();
      const venvPython = this.venvPython();
      const venvConfig = path.join(this.venvDir(), "pyvenv.cfg");
      if (!fs.existsSync(venvPython) || !fs.existsSync(venvConfig)) {
        await fsp.rm(this.venvDir(), { recursive: true, force: true });
        this.report("installing", 55, "创建隔离的 Python 环境");
        await run(python.command, [...python.args, "-m", "venv", this.venvDir()], this.config.xhsInstallTimeoutMs);
        if (!fs.existsSync(venvPython) || !fs.existsSync(venvConfig))
          throw new Error("隔离 Python 环境创建不完整，请重新尝试");
      }
      const marker = path.join(this.config.xhsRuntimeDir, ".installed-commit");
      const installed = await fsp.readFile(marker, "utf8").catch(() => "");
      if (installed.trim() !== XHS_COMMIT) {
        this.report("installing", 65, "安装固定版本解析依赖");
        const uv = await this.ensureUv();
        await run(
          uv,
          ["pip", "install", "--python", venvPython, "-r", path.join(sourceDir, "requirements.txt")],
          this.config.xhsInstallTimeoutMs,
          { UV_CACHE_DIR: path.join(this.config.xhsRuntimeDir, "cache") }
        );
        await fsp.writeFile(marker, `${XHS_COMMIT}\n`, "utf8");
      }
      await this.verifySource(sourceDir);
      this.report("ready", 100, "解析环境已安装");
    } catch (error) {
      this.report("failed", this.progress, error instanceof Error ? error.message : "解析环境安装失败");
      throw error;
    }
  }

  private async installManagedPython() {
    const pythonDir = path.join(this.config.xhsRuntimeDir, "python");
    const existing = await findManagedPython(pythonDir);
    if (existing) {
      this.report("installing", 35, "复用受管 Python 3.12");
      return { command: existing, args: [] as string[] };
    }
    this.report("installing", 15, "下载受管 Python 安装器");
    const uv = await this.ensureUv();
    await run(uv, ["python", "install", "3.12"], this.config.xhsInstallTimeoutMs, {
      UV_PYTHON_INSTALL_DIR: pythonDir
    });
    const managed = await findManagedPython(pythonDir);
    if (!managed) throw new Error("受管 Python 3.12 安装后未找到解释器");
    this.report("installing", 35, "Python 3.12 已就绪");
    return { command: managed, args: [] as string[] };
  }

  private async ensureUv() {
    const binary = path.join(this.config.xhsRuntimeDir, process.platform === "win32" ? "uv.exe" : "uv");
    if (fs.existsSync(binary)) return binary;
    const target = uvAsset();
    const archive = path.join(this.config.xhsRuntimeDir, target.endsWith(".zip") ? "uv.zip" : "uv.tar.gz");
    const staging = path.join(this.config.xhsRuntimeDir, "uv-staging");
    await fsp.rm(staging, { recursive: true, force: true });
    await fsp.mkdir(staging, { recursive: true });
    try {
      await download(`https://github.com/astral-sh/uv/releases/download/${UV_VERSION}/${target}`, archive);
      const listing = await run("tar", ["-tf", archive], this.config.xhsInstallTimeoutMs);
      validateArchiveListing(listing);
      await run("tar", ["-xf", archive, "-C", staging], this.config.xhsInstallTimeoutMs);
      await validateExtractedDirectory(staging);
      const found = await findFile(staging, process.platform === "win32" ? "uv.exe" : "uv");
      if (!found) throw new Error("uv 解压后未找到可执行文件");
      if (found !== binary) await fsp.copyFile(found, binary);
      if (process.platform !== "win32") await fsp.chmod(binary, 0o755);
      return binary;
    } finally {
      await fsp.rm(staging, { recursive: true, force: true });
      await fsp.rm(archive, { force: true });
    }
  }

  private async ensureSource() {
    const sourceDir = this.runtimeSourceDir();
    if (fs.existsSync(path.join(sourceDir, "requirements.txt"))) return sourceDir;
    this.report("installing", 40, "下载 XHS-Downloader 2.7 固定源码");
    const archive = path.join(this.config.xhsRuntimeDir, "xhs-source.zip");
    try {
      await download(`https://codeload.github.com/JoeanAmier/XHS-Downloader/zip/${XHS_COMMIT}`, archive);
      const listing = await run("tar", ["-tf", archive], this.config.xhsInstallTimeoutMs);
      validateArchiveListing(listing);
      await run("tar", ["-xf", archive, "-C", this.config.xhsRuntimeDir], this.config.xhsInstallTimeoutMs);
      await validateExtractedDirectory(sourceDir);
      await this.verifySource(sourceDir);
      return sourceDir;
    } finally {
      await fsp.rm(archive, { force: true });
    }
  }

  private async verifySource(sourceDir: string) {
    const required = ["LICENSE", "requirements.txt"];
    for (const file of required) {
      const target = path.join(sourceDir, file);
      const stat = await fsp.stat(target).catch(() => undefined);
      if (!stat?.isFile() || stat.size === 0) throw new Error("固定版本源码校验失败");
    }
    const digest = await digestFiles(sourceDir, required);
    const digestFile = path.join(this.config.xhsRuntimeDir, ".source-sha256");
    const previous = await fsp.readFile(digestFile, "utf8").catch(() => "");
    if (previous && previous.trim() !== digest) throw new Error("固定版本源码摘要校验失败");
    if (!previous) {
      await fsp.writeFile(digestFile, `${digest}\n`, "utf8");
    }
  }

  private report(status: XhsRuntimeStatus["status"], installProgress: number, message: string) {
    this.progress = installProgress;
    this.update({
      status,
      installProgress,
      message,
      version: `XHS-Downloader 2.7 (${XHS_COMMIT.slice(0, 8)})`,
      authenticated: false
    });
  }
}

async function digestFiles(root: string, files: string[]) {
  const digest = createHash("sha256");
  for (const file of files) digest.update(await fsp.readFile(path.join(root, file)));
  return digest.digest("hex");
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
    child.stdout.on("data", (chunk: Buffer) => (stdout += String(chunk)));
    child.stderr.on("data", (chunk: Buffer) => (stderr += String(chunk)));
    child.once("error", (error: Error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code: number | null) => {
      clearTimeout(timeout);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `${command} 执行失败（退出码 ${code ?? "unknown"}）`));
    });
  });
}
