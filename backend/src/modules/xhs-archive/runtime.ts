/**
 * 中文模块说明：小红书归档领域，负责获取、媒体、翻译、运行时和恢复
 */
import fs from "node:fs";
import path from "node:path";
import type { XhsRuntimeStatus } from "@toolbox/shared";
import type { AppConfig } from "../../config";
import { ComponentManager, ComponentManagerError } from "../components/component-manager";
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

  constructor(
    private readonly config: AppConfig,
    private readonly components?: ComponentManager
  ) {
    this.installer = new XhsRuntimeInstallGateway(config, (next) => this.update(next));
    this.provider = new XhsProviderProcess(config, (status, message) => this.update({ status, message }));
    if (config.desktopManagedCapabilities) {
      this.status = {
        ...this.status,
        message: "请在桌面设置的能力管理中安装小红书归档运行时"
      };
    } else if (config.xhsProviderUrl) {
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

  async refreshCapabilityStatus() {
    if (!this.config.desktopManagedCapabilities || !this.components) return this.getStatus();
    try {
      const statuses = await this.components.list();
      const installed = statuses.find((item) => item.id === "xhs-archive")?.installed;
      if (!installed) {
        this.update({
          status: "not-installed",
          installProgress: 0,
          message: "请在桌面设置的能力管理中安装小红书归档运行时"
        });
      } else if (await this.provider.isHealthy()) {
        this.update({ status: "ready", installProgress: 100, message: "小红书解析服务可用" });
      } else {
        this.update({ status: "ready", installProgress: 100, message: "小红书归档能力已安装，首次获取时启动本机服务" });
      }
    } catch {
      // 能力目录异常时不把已保存的存档误判为损坏；实际任务会返回明确的运行时错误。
    }
    return this.getStatus();
  }

  async ensureReady(onProgress?: (status: XhsRuntimeStatus) => void) {
    if (!this.config.desktopManagedCapabilities && this.config.xhsProviderUrl) {
      return this.config.xhsProviderUrl.replace(/\/$/, "");
    }
    if (!this.config.desktopManagedCapabilities && (await this.provider.isHealthy())) return this.provider.baseUrl;
    if (this.config.desktopManagedCapabilities) {
      if (!this.components) {
        throw new XhsRuntimeError("XHS_ARCHIVE_NOT_INSTALLED", "请在桌面设置中安装小红书归档能力后重试");
      }
      try {
        const [python, sourceAnchor] = await Promise.all([
          this.components.resolveInstalledPython("xhs-archive"),
          this.components.resolveInstalledAsset("xhs-archive", "source/requirements.txt")
        ]);
        if (await this.provider.isHealthy()) return this.provider.baseUrl;
        this.update({ status: "installing", message: "正在启动已安装的小红书归档运行时" });
        await this.provider.start(path.dirname(sourceAnchor.path), python.path);
        onProgress?.(this.getStatus());
        return this.provider.baseUrl;
      } catch (error) {
        if (
          error instanceof ComponentManagerError &&
          ["COMPONENT_NOT_FOUND", "COMPONENT_NOT_INSTALLED", "COMPONENT_DEPENDENCY_MISSING"].includes(error.code)
        ) {
          this.update({
            status: "not-installed",
            installProgress: 0,
            message: "请在桌面设置的能力管理中安装小红书归档运行时"
          });
          throw new XhsRuntimeError("XHS_ARCHIVE_NOT_INSTALLED", this.status.message);
        }
        this.update({ status: "failed", message: error instanceof Error ? error.message : "解析服务启动失败" });
        throw error;
      }
    }
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

export class XhsRuntimeError extends Error {
  constructor(
    readonly code: "XHS_ARCHIVE_NOT_INSTALLED",
    message: string
  ) {
    super(message);
    this.name = "XhsRuntimeError";
  }
}
