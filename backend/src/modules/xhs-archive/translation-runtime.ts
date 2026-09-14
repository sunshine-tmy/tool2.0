import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import type { XhsTranslationRuntimeStatus } from "@toolbox/shared";
import type { AppConfig } from "../../config";
import { terminateChildProcess } from "../../lifecycle/child-process";

const MODEL_REVISION = "cf109095479db38d6df799875e34039d4938aaa6";
const MODEL_ID = "Helsinki-NLP/opus-mt-zh-en";
const DEFAULT_RELEASE_MODEL_URL =
  "https://github.com/sunshine-tmy/tool2.0/releases/download/xhs-translation-v1/opus-mt-zh-en-ct2-int8-cf109095.tar.gz";
const COMMUNITY_MODEL_REPOSITORY = "gaudi/opus-mt-zh-en-ctranslate2";
const COMMUNITY_MODEL_REVISION = "05d8fc158397bae0c65b8d46c858b6c18e094c12";
const COMMUNITY_MODEL_FILES: Array<{ name: string; size?: number; sha256?: string }> = [
  { name: "config.json", size: 215 },
  { name: "generation_config.json", size: 293 },
  {
    name: "model.bin",
    size: 155502615,
    sha256: "a188bc45bce24635a1eb0cc42ad0b43afdad806b86af9beb3065bba11f3b212c"
  },
  { name: "shared_vocabulary.json", size: 1303998 },
  {
    name: "source.spm",
    size: 804677,
    sha256: "e27a3a1b539f4959ec72ea60e453f49156289f95d4e6000b29332efc45616203"
  },
  {
    name: "target.spm",
    size: 806530,
    sha256: "6a881f4717cd7265f53fea54fd3dc689c767c05338fac7a4590f3088cb2d7855"
  },
  { name: "tokenizer_config.json", size: 44 },
  { name: "vocab.json", size: 1617902 }
];
const PYTHON_REQUIREMENTS = [
  "ctranslate2==4.8.2",
  "sentencepiece==0.2.2",
  "fastapi==0.141.1",
  "uvicorn==0.52.4",
  "pydantic==2.13.5"
];

export class XhsTranslationRuntime {
  private worker?: ChildProcess;
  private installPromise?: Promise<void>;
  private status: XhsTranslationRuntimeStatus = {
    status: "not-installed",
    version: "CTranslate2 4.8.2 / SentencePiece 0.2.2",
    modelId: MODEL_ID,
    modelRevision: MODEL_REVISION,
    providerUrl: undefined,
    message: "首次翻译时自动安装本地翻译环境",
    installProgress: 0
  };

  constructor(private readonly config: AppConfig) {
    if (config.xhsTranslationProviderUrl) {
      this.status = {
        ...this.status,
        status: "ready",
        providerUrl: config.xhsTranslationProviderUrl,
        installProgress: 100,
        message: "已连接本地翻译服务"
      };
    } else if (fs.existsSync(this.markerPath()) && this.isModelInstalled()) {
      this.status = { ...this.status, status: "ready", installProgress: 100, message: "翻译环境已安装" };
    }
  }

  getStatus(): XhsTranslationRuntimeStatus {
    return { ...this.status };
  }

  async ensureReady(onProgress?: (status: XhsTranslationRuntimeStatus) => void): Promise<string> {
    if (this.config.xhsTranslationProviderUrl) return this.config.xhsTranslationProviderUrl.replace(/\/$/, "");
    if (await this.isHealthy()) return this.baseUrl();
    if (!this.installPromise) {
      this.installPromise = this.install(onProgress).finally(() => {
        this.installPromise = undefined;
      });
    }
    await this.installPromise;
    await this.startWorker();
    return this.baseUrl();
  }

  async stop() {
    if (!this.worker || this.worker.killed) return;
    const worker = this.worker;
    this.worker = undefined;
    await terminateChildProcess(worker);
  }

  private async install(onProgress?: (status: XhsTranslationRuntimeStatus) => void) {
    try {
      await fsp.mkdir(this.config.xhsTranslationRuntimeDir, { recursive: true });
      this.update("installing", 5, "检查翻译运行时", onProgress);
      const python =
        (await findPython312()) ?? (await findManagedPython(path.join(this.config.xhsRuntimeDir, "python")));
      if (!python) throw new Error("未找到 Python 3.12，请先安装 Python 3.12 后重试");
      const venv = this.venvDir();
      const venvPython = this.venvPython();
      if (!fs.existsSync(venvPython) || !fs.existsSync(path.join(venv, "pyvenv.cfg"))) {
        await run(python.command, [...python.args, "-m", "venv", venv], this.config.xhsTranslationInstallTimeoutMs);
      }
      this.update("installing", 35, "安装 CTranslate2 翻译依赖", onProgress);
      const requirements = path.join(this.config.xhsTranslationRuntimeDir, "requirements.txt");
      await fsp.writeFile(requirements, `${PYTHON_REQUIREMENTS.join("\n")}\n`, "utf8");
      const uv = findUv(this.config.xhsRuntimeDir);
      await run(
        uv ?? venvPython,
        uv
          ? ["pip", "install", "--python", venvPython, "-r", requirements]
          : ["-m", "pip", "install", "--disable-pip-version-check", "-r", requirements],
        this.config.xhsTranslationInstallTimeoutMs
      );
      if (!this.isModelInstalled()) {
        this.update("installing", 55, "下载并校验 OPUS-MT 模型", onProgress);
        await this.downloadModel(onProgress);
      }
      await fsp.writeFile(this.markerPath(), `${MODEL_REVISION}\n`, "utf8");
      this.update("ready", 100, "翻译环境已安装", onProgress);
    } catch (error) {
      this.update(
        "failed",
        this.status.installProgress,
        error instanceof Error ? error.message : "翻译环境安装失败",
        onProgress
      );
      throw error;
    }
  }

  private async downloadModel(onProgress?: (status: XhsTranslationRuntimeStatus) => void) {
    const archive = path.join(this.config.xhsTranslationRuntimeDir, "model.tar.gz");
    let response: Response;
    try {
      response = await fetch(this.config.xhsTranslationModelUrl, {
        redirect: "follow",
        signal: AbortSignal.timeout(this.config.xhsTranslationInstallTimeoutMs)
      });
    } catch (error) {
      if (this.config.xhsTranslationModelUrl === DEFAULT_RELEASE_MODEL_URL) {
        this.update("installing", 55, "固定模型包连接失败，切换到已固定的本地恢复源", onProgress);
        await this.downloadCommunityModel(onProgress);
        return;
      }
      throw modelDownloadError("无法连接翻译模型下载地址", error);
    }
    if (response.status === 404 && this.config.xhsTranslationModelUrl === DEFAULT_RELEASE_MODEL_URL) {
      this.update("installing", 55, "固定模型包暂不可用，切换到已固定的本地恢复源", onProgress);
      await this.downloadCommunityModel(onProgress);
      return;
    }
    if (!response.ok || !response.body)
      throw new XhsTranslationRuntimeError(
        response.status === 404 ? "XHS_TRANSLATION_MODEL_NOT_FOUND" : "XHS_TRANSLATION_MODEL_DOWNLOAD_FAILED",
        response.status === 404
          ? "翻译模型资源不存在，请检查 XHS_TRANSLATION_MODEL_URL 或发布固定模型包"
          : `翻译模型下载失败（HTTP ${response.status}）`
      );
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > 1024 * 1024 * 1024) throw new Error("翻译模型超过1GiB限制");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > 1024 * 1024 * 1024) throw new Error("翻译模型超过1GiB限制");
    if (this.config.xhsTranslationModelSha256) {
      const digest = createHash("sha256").update(bytes).digest("hex");
      if (digest.toLowerCase() !== this.config.xhsTranslationModelSha256.toLowerCase())
        throw new Error("翻译模型校验失败");
    }
    await fsp.writeFile(archive, bytes);
    const staging = path.join(this.config.xhsTranslationRuntimeDir, "model-staging");
    await fsp.rm(staging, { recursive: true, force: true });
    await fsp.mkdir(staging, { recursive: true });
    const listing = await run("tar", ["-tzf", archive], this.config.xhsTranslationInstallTimeoutMs);
    if (listing.split(/\r?\n/).some((entry) => path.isAbsolute(entry) || entry.split("/").includes("..")))
      throw new Error("翻译模型包包含越界路径");
    await run("tar", ["-xzf", archive, "-C", staging], this.config.xhsTranslationInstallTimeoutMs);
    const children = await fsp.readdir(staging, { withFileTypes: true });
    const nested = children.find(
      (entry) => entry.isDirectory() && fs.existsSync(path.join(staging, entry.name, "model.bin"))
    );
    const candidate = fs.existsSync(path.join(staging, "model.bin"))
      ? staging
      : nested
        ? path.join(staging, nested.name)
        : path.join(staging, "model");
    if (!fs.existsSync(path.join(candidate, "model.bin")))
      throw new XhsTranslationRuntimeError("XHS_TRANSLATION_MODEL_INVALID", "翻译模型包内容不完整");
    const manifest = JSON.parse(
      await fsp.readFile(path.join(candidate, "manifest.json"), "utf8").catch(() => "{}")
    ) as { revision?: string; files?: Record<string, { size?: number; sha256?: string }> };
    if (manifest.revision !== MODEL_REVISION)
      throw new XhsTranslationRuntimeError("XHS_TRANSLATION_MODEL_INVALID", "翻译模型清单缺失或版本不匹配");
    for (const [name, expected] of Object.entries(manifest.files ?? {})) {
      const file = path.resolve(candidate, name);
      if (!file.startsWith(`${path.resolve(candidate)}${path.sep}`))
        throw new XhsTranslationRuntimeError("XHS_TRANSLATION_MODEL_INVALID", "翻译模型清单包含越界路径");
      const bytes = await fsp.readFile(file).catch(() => undefined);
      if (
        !bytes ||
        (expected.size !== undefined && bytes.byteLength !== expected.size) ||
        (expected.sha256 && createHash("sha256").update(bytes).digest("hex") !== expected.sha256)
      )
        throw new XhsTranslationRuntimeError("XHS_TRANSLATION_MODEL_INVALID", "翻译模型文件校验失败");
    }
    await fsp.rm(this.modelDir(), { recursive: true, force: true });
    await fsp.rename(candidate, this.modelDir());
    await fsp.rm(staging, { recursive: true, force: true });
    await fsp.rm(archive, { force: true });
  }

  private async downloadCommunityModel(onProgress?: (status: XhsTranslationRuntimeStatus) => void) {
    const staging = path.join(this.config.xhsTranslationRuntimeDir, "model-staging");
    await fsp.rm(staging, { recursive: true, force: true });
    await fsp.mkdir(staging, { recursive: true });
    try {
      for (const [index, file] of COMMUNITY_MODEL_FILES.entries()) {
        const percentage = 55 + Math.round(((index + 1) / COMMUNITY_MODEL_FILES.length) * 20);
        this.update(
          "installing",
          percentage,
          `下载翻译模型文件（${index + 1}/${COMMUNITY_MODEL_FILES.length}）`,
          onProgress
        );
        const url = `https://huggingface.co/${COMMUNITY_MODEL_REPOSITORY}/resolve/${COMMUNITY_MODEL_REVISION}/${file.name}`;
        const target = path.join(staging, file.name);
        await downloadFixedModelFile(url, target, file.name, this.config.xhsTranslationInstallTimeoutMs);
        const bytes = await fsp.readFile(target);
        if (bytes.byteLength > 1024 * 1024 * 1024 || (file.size !== undefined && bytes.byteLength !== file.size))
          throw new XhsTranslationRuntimeError("XHS_TRANSLATION_MODEL_INVALID", `模型文件大小校验失败（${file.name}）`);
        if (file.sha256 && createHash("sha256").update(bytes).digest("hex") !== file.sha256)
          throw new XhsTranslationRuntimeError("XHS_TRANSLATION_MODEL_INVALID", `模型文件摘要校验失败（${file.name}）`);
      }
      const manifestFiles: Record<string, { size: number; sha256: string }> = {};
      for (const file of COMMUNITY_MODEL_FILES) {
        const bytes = await fsp.readFile(path.join(staging, file.name));
        manifestFiles[file.name] = {
          size: bytes.byteLength,
          sha256: createHash("sha256").update(bytes).digest("hex")
        };
      }
      await fsp.writeFile(
        path.join(staging, "manifest.json"),
        `${JSON.stringify(
          {
            modelId: MODEL_ID,
            revision: MODEL_REVISION,
            artifactSource: `https://huggingface.co/${COMMUNITY_MODEL_REPOSITORY}`,
            artifactRevision: COMMUNITY_MODEL_REVISION,
            quantization: "int8",
            files: manifestFiles
          },
          null,
          2
        )}\n`,
        "utf8"
      );
      await fsp.rm(this.modelDir(), { recursive: true, force: true });
      await fsp.rename(staging, this.modelDir());
    } finally {
      await fsp.rm(staging, { recursive: true, force: true });
    }
  }

  private async startWorker() {
    if (await this.isHealthy()) return;
    const script = findProjectFile("scripts/xhs-translation-worker.py");
    this.worker = spawn(this.venvPython(), [script], {
      cwd: path.dirname(script),
      env: {
        ...process.env,
        XHS_TRANSLATION_PORT: String(this.config.xhsTranslationProviderPort),
        XHS_TRANSLATION_MODEL_DIR: this.modelDir()
      },
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true
    });
    this.worker.once("exit", () => {
      this.worker = undefined;
      if (this.status.status === "ready") this.status = { ...this.status, status: "failed", message: "翻译服务已停止" };
    });
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (await this.isHealthy()) {
        this.status = { ...this.status, status: "ready", installProgress: 100, message: "本地翻译服务可用" };
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error("翻译服务启动超时");
  }

  private async isHealthy() {
    try {
      const response = await fetch(`${this.baseUrl()}/health`, { signal: AbortSignal.timeout(1500) });
      return response.ok;
    } catch {
      return false;
    }
  }

  private update(
    status: XhsTranslationRuntimeStatus["status"],
    installProgress: number,
    message: string,
    callback?: (status: XhsTranslationRuntimeStatus) => void
  ) {
    this.status = { ...this.status, status, installProgress, message };
    callback?.(this.getStatus());
  }
  private baseUrl() {
    return `http://127.0.0.1:${this.config.xhsTranslationProviderPort}`;
  }
  private venvDir() {
    return path.join(this.config.xhsTranslationRuntimeDir, "venv");
  }
  private venvPython() {
    return path.join(this.venvDir(), process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  }
  private modelDir() {
    return this.config.xhsTranslationModelDir;
  }
  private markerPath() {
    return path.join(this.config.xhsTranslationRuntimeDir, ".installed-model");
  }
  private isModelInstalled() {
    return ["model.bin", "source.spm", "target.spm", "manifest.json"].every((name) =>
      fs.existsSync(path.join(this.modelDir(), name))
    );
  }
}

export class XhsTranslationRuntimeError extends Error {
  constructor(
    readonly code:
      "XHS_TRANSLATION_MODEL_NOT_FOUND" | "XHS_TRANSLATION_MODEL_DOWNLOAD_FAILED" | "XHS_TRANSLATION_MODEL_INVALID",
    message: string
  ) {
    super(message);
    this.name = "XhsTranslationRuntimeError";
  }
}

async function downloadFixedModelFile(url: string, target: string, name: string, timeoutMs: number): Promise<void> {
  await fsp.rm(target, { force: true });
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok || !response.body)
      throw new XhsTranslationRuntimeError(
        "XHS_TRANSLATION_MODEL_DOWNLOAD_FAILED",
        `恢复源模型文件下载失败（${name}，HTTP ${response.status}）`
      );
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > 1024 * 1024 * 1024)
      throw new XhsTranslationRuntimeError("XHS_TRANSLATION_MODEL_INVALID", `模型文件超过1GiB限制（${name}）`);
    await fsp.writeFile(target, Buffer.from(await response.arrayBuffer()));
    return;
  } catch (error) {
    if (error instanceof XhsTranslationRuntimeError || process.platform !== "win32") {
      await fsp.rm(target, { force: true });
      throw error instanceof XhsTranslationRuntimeError
        ? error
        : modelDownloadError(`无法下载模型文件（${name}）`, error);
    }
  }

  // Invoke-WebRequest follows the Windows system proxy/PAC settings that are
  // not inherited by Node's built-in fetch. The URL is a fixed, pinned model
  // source and the destination is a runtime staging path.
  try {
    const script = findProjectFile("scripts/download-fixed-model-file.ps1");
    await run(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        script,
        "-Url",
        url,
        "-Destination",
        target
      ],
      timeoutMs
    );
  } catch (error) {
    await fsp.rm(target, { force: true });
    throw modelDownloadError(`无法通过 Windows 系统网络下载模型文件（${name}）`, error);
  }
}

function modelDownloadError(message: string, error: unknown): XhsTranslationRuntimeError {
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
  const code =
    typeof cause === "object" && cause !== null && "code" in cause && typeof cause.code === "string"
      ? cause.code
      : undefined;
  return new XhsTranslationRuntimeError(
    "XHS_TRANSLATION_MODEL_DOWNLOAD_FAILED",
    code ? `${message}（${code}）` : message
  );
}

async function findPython312(): Promise<{ command: string; args: string[] } | undefined> {
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
      /* try next candidate */
    }
  }
  return undefined;
}

async function findManagedPython(root: string): Promise<{ command: string; args: string[] } | undefined> {
  const names = process.platform === "win32" ? ["python.exe"] : ["python3.12", "python3", "python"];
  const found = await findFile(root, names);
  return found ? { command: found, args: [] } : undefined;
}

async function findFile(root: string, names: string[]): Promise<string | undefined> {
  const entries = await fsp.readdir(root, { withFileTypes: true }).catch(() => []);
  const direct = entries.find((entry) => entry.isFile() && names.includes(entry.name));
  if (direct) return path.join(root, direct.name);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nested = await findFile(path.join(root, entry.name), names);
    if (nested) return nested;
  }
  return undefined;
}

function findProjectFile(relativePath: string) {
  const candidates = [path.resolve(process.cwd(), relativePath), path.resolve(process.cwd(), "..", relativePath)];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`找不到项目文件：${relativePath}`);
  return found;
}

function findUv(root: string) {
  const candidate = path.join(root, process.platform === "win32" ? "uv.exe" : "uv");
  return fs.existsSync(candidate) ? candidate : undefined;
}

async function run(command: string, args: string[], timeoutMs: number) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += String(chunk)));
    child.stderr.on("data", (chunk) => (stderr += String(chunk)));
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`命令超时：${command}`));
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `${command} 退出码 ${code}`));
    });
  });
}
