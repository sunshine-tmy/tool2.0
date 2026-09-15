import fs from "node:fs";
import path from "node:path";
import type { XhsRuntimeStatus } from "@toolbox/shared";
import type { AppConfig } from "../../config";
import { XhsRuntimeInstallGateway, XHS_COMMIT } from "./runtime-install-gateway";
import { XhsProviderProcess } from "./runtime-process";

/** Coordinates runtime state while installation and process concerns stay in gateways. */
export class XhsRuntimeManager {
  private readonly installer: XhsRuntimeInstallGateway;
  private readonly provider: XhsProviderProcess;
  private installPromise?: Promise<void>;
  private status: XhsRuntimeStatus = {
    status: "not-installed",
    installProgress: 0,
    message: "首次获取时自动安装解析环境",
    version: `XHS-Downloader 2.7 (${XHS_COMMIT.slice(0, 8)})`,
    authenticated: false
  };

  constructor(private readonly config: AppConfig) {
    this.installer = new XhsRuntimeInstallGateway(config, (next) => this.update(next));
    this.provider = new XhsProviderProcess(config, (status, message) => this.update({ status, message }));
    if (config.xhsProviderUrl) {
      this.status = { ...this.status, status: "ready", installProgress: 100, message: "已连接外部解析服务" };
    } else if (
      fs.existsSync(path.join(config.xhsRuntimeDir, ".installed-commit")) &&
      fs.existsSync(this.installer.venvPython()) &&
      fs.existsSync(path.join(this.installer.venvDir(), "pyvenv.cfg"))
    ) {
      this.status = { ...this.status, status: "ready", installProgress: 100, message: "解析环境已安装" };
    }
  }

  getStatus() {
    return { ...this.status };
  }

  async ensureReady(onProgress?: (status: XhsRuntimeStatus) => void) {
    if (this.config.xhsProviderUrl) return this.config.xhsProviderUrl.replace(/\/$/, "");
    if (await this.provider.isHealthy()) return this.provider.baseUrl;
    if (!this.installPromise) {
      this.installPromise = this.installer.install().finally(() => {
        this.installPromise = undefined;
      });
    }
    try {
      await this.installPromise;
    } catch (error) {
      this.update({ status: "failed", message: error instanceof Error ? error.message : "解析环境安装失败" });
      throw error;
    }
    try {
      await this.provider.start(this.installer.runtimeSourceDir(), this.installer.venvPython());
      onProgress?.(this.getStatus());
    } catch (error) {
      this.update({ status: "failed", message: error instanceof Error ? error.message : "解析服务启动失败" });
      throw error;
    }
    return this.provider.baseUrl;
  }

  async stop() {
    await this.provider.stop();
  }

  private update(next: Partial<XhsRuntimeStatus>) {
    this.status = { ...this.status, ...next };
  }
}
