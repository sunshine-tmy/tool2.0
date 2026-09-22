/**
 * 中文模块说明：小红书归档领域，负责获取、媒体、翻译、运行时和恢复
 */
import fs from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import type { XhsRuntimeStatus } from "@toolbox/shared";
import type { AppConfig } from "../../config";
import { terminateChildProcess } from "../../lifecycle/child-process";
import { workerAuthHeaders } from "../../security/worker-auth";

type StatusCallback = (status: XhsRuntimeStatus["status"], message: string) => void;

/** Owns the local provider process and its health/readiness lifecycle. */
export class XhsProviderProcess {
  private worker?: ChildProcess;
  private stopping = false;

  constructor(
    private readonly config: AppConfig,
    private readonly onStatus: StatusCallback
  ) {}

  get baseUrl() {
    return `http://127.0.0.1:${this.config.xhsProviderPort}`;
  }

  async isHealthy() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: workerAuthHeaders(this.config.xhsProviderToken),
        signal: AbortSignal.timeout(1500)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async start(sourceDir: string, venvPython: string) {
    if (await this.isHealthy()) return;
    this.stopping = false;
    this.onStatus("installing", "正在启动本机解析服务");
    const workerScript = path.join(this.config.runtime.scriptsRoot, "xhs-provider-worker.py");
    if (!fs.existsSync(workerScript)) throw new Error("找不到小红书解析 Worker 脚本");
    this.worker = spawn(venvPython, [workerScript], {
      cwd: sourceDir,
      env: {
        ...process.env,
        XHS_PROVIDER_PORT: String(this.config.xhsProviderPort),
        XHS_PROVIDER_TOKEN: this.config.xhsProviderToken ?? "",
        XHS_SOURCE_DIR: sourceDir
      },
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true
    });
    let stderr = "";
    this.worker.stderr?.on("data", (chunk) => {
      stderr = `${stderr}${String(chunk)}`.slice(-4000);
    });
    this.worker.once("exit", () => {
      this.worker = undefined;
      if (!this.stopping) this.onStatus("failed", "解析服务已停止");
    });
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (await this.isHealthy()) {
        this.onStatus("ready", "解析服务可用");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`解析服务启动超时${stderr ? `：${stderr.split("\n").at(-2) ?? stderr}` : ""}`);
  }

  async stop() {
    if (!this.worker || this.worker.killed) return;
    const worker = this.worker;
    this.worker = undefined;
    this.stopping = true;
    try {
      await terminateChildProcess(worker);
    } finally {
      this.stopping = false;
    }
  }
}
