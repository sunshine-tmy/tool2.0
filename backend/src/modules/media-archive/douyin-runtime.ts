/** 抖音运行时只解析签名 generation；网页首次归档可自动安装受信任能力，桌面端仍由能力管理显式安装。 */
import fs from "node:fs/promises";
import path from "node:path";
import { identifyArchiveLink, isDouyinAdapterManifest, type DouyinRuntimeStatus } from "@toolbox/shared";
import { ComponentManagerError, type ComponentManager } from "../components/component-manager";
import { openDouyinBrowser, DouyinBrowserError } from "./douyin-browser";
import { readDouyinWork } from "./douyin-reader";
import { DouyinSourceError } from "./douyin-source";

class DouyinRuntimeError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "DouyinRuntimeError";
  }
}

type RuntimeOptions = {
  platform?: NodeJS.Platform;
  arch?: string;
  installationMode?: "automatic" | "managed";
  installTimeoutMs?: number;
  openBrowser?: typeof openDouyinBrowser;
  readWork?: typeof readDouyinWork;
};
type RuntimeComponents = Pick<ComponentManager, "resolveInstalledAsset" | "list"> &
  Partial<Pick<ComponentManager, "startInstall" | "getJob" | "cancelJob">>;

const DOUYIN_INSTALL_ORDER = ["xhs-browser", "douyin-archive"] as const;

export class DouyinRuntimeManager {
  private operation?: { controller: AbortController; done: Promise<unknown> };
  private closed = false;
  private closing?: Promise<void>;

  constructor(
    private readonly components: RuntimeComponents,
    private readonly options: RuntimeOptions = {}
  ) {}

  isActive() {
    return Boolean(this.operation);
  }

  /** 状态检查只校验本地资产，不启动浏览器、不访问平台；离线时仍能准确报告组件健康度。 */
  async status(): Promise<DouyinRuntimeStatus> {
    const installMode = await this.getInstallMode().catch(() => undefined);
    if (this.closed)
      return {
        platform: "douyin",
        mode: "anonymous",
        available: false,
        state: "stopped",
        ...(installMode ? { installMode } : {}),
        message: "抖音运行时已关闭"
      };
    try {
      await this.resolveBrowser();
      if (this.closed) return this.status();
      return {
        platform: "douyin",
        mode: "anonymous",
        available: true,
        state: this.isActive() ? "busy" : "ready",
        ...(installMode ? { installMode } : {}),
        message: this.isActive() ? "正在读取抖音公开作品" : "匿名解析环境已就绪，仅支持公开可访问作品"
      };
    } catch (error) {
      if (this.closed) return this.status();
      const failure = normalizeRuntimeError(error);
      return {
        platform: "douyin",
        mode: "anonymous",
        available: false,
        state: failure.code === "DOUYIN_COMPONENT_NOT_INSTALLED" ? "not-installed" : "unavailable",
        ...(installMode ? { installMode } : {}),
        message:
          failure.code === "DOUYIN_COMPONENT_NOT_INSTALLED" && installMode === "automatic"
            ? "首次归档时会自动下载并校验抖音匿名能力与 Chromium，请保持网络畅通"
            : failure.code === "DOUYIN_COMPONENT_NOT_INSTALLED" && installMode === "managed"
              ? "请在桌面端能力管理中安装抖音匿名归档及其 Chromium 依赖"
              : failure.code === "DOUYIN_COMPONENT_NOT_INSTALLED" && installMode === "unavailable"
                ? "当前应用版本尚未内置抖音签名能力包，请在发布该能力后更新应用"
                : failure.message,
        errorCode: failure.code
      };
    }
  }

  /** 状态接口只在当前平台签名目录含齐组件时承诺自动安装或桌面托管安装。 */
  private async getInstallMode(): Promise<"automatic" | "managed" | "unavailable" | undefined> {
    if (!this.options.installationMode) return undefined;
    const platform = this.options.platform ?? process.platform;
    const arch = this.options.arch ?? process.arch;
    if (!((platform === "win32" && arch === "x64") || (platform === "darwin" && arch === "arm64")))
      return "unavailable";
    const packages = await this.components.list();
    return DOUYIN_INSTALL_ORDER.every((id) => packages.some((entry) => entry.id === id))
      ? this.options.installationMode
      : "unavailable";
  }

  /** 一次只持有一个匿名浏览器；上层任务服务负责排队，运行时不建立第二套任务队列。 */
  async extract(
    input: string,
    options: { signal?: AbortSignal; onInstallProgress?: (progress: number, message: string) => void } = {}
  ) {
    options.signal?.throwIfAborted();
    if (this.closed) throw new DouyinRuntimeError("DOUYIN_RUNTIME_STOPPED", "抖音运行时已关闭");
    if (this.operation) throw new DouyinRuntimeError("DOUYIN_RUNTIME_BUSY", "抖音获取正在运行，请稍后重试");
    const link = identifyArchiveLink(input, "douyin");
    if (!link.ok || new URL(link.url).protocol !== "https:")
      throw new DouyinSourceError("DOUYIN_PARSE_FAILED", "请提供有效的 HTTPS 抖音作品链接");
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, ...(options.signal ? [options.signal] : [])]);
    const runtimeTimeout =
      this.options.installationMode === "automatic"
        ? (this.options.installTimeoutMs ?? 20 * 60_000) + 120_000
        : 120_000;
    const timer = setTimeout(() => controller.abort(new DOMException("抖音读取超时", "TimeoutError")), runtimeTimeout);
    // 占用先于异步资产检查登记，确保重装/卸载不能在浏览器启动途中删除已选定的 generation。
    const done = Promise.resolve().then(() => this.run(link.url, signal, options.onInstallProgress));
    const operation = { controller, done };
    this.operation = operation;
    try {
      return await done;
    } finally {
      clearTimeout(timer);
      if (this.operation === operation) this.operation = undefined;
    }
  }

  /** 卸载前临时停止，不永久禁用对象；之后重新安装即可使用。应用退出使用 close() 永久拒绝新任务。 */
  async stop() {
    const operation = this.operation;
    if (!operation) return;
    operation.controller.abort(new DOMException("抖音运行时已停止", "AbortError"));
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        operation.done.catch(() => undefined),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new DouyinRuntimeError("DOUYIN_STOP_TIMEOUT", "抖音浏览器未在限定时间内停止")),
            5000
          );
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  close() {
    this.closed = true;
    return (this.closing ??= this.stop());
  }

  private async run(
    input: string,
    signal: AbortSignal,
    onInstallProgress?: (progress: number, message: string) => void
  ) {
    let browser: Awaited<ReturnType<typeof openDouyinBrowser>> | undefined;
    let result: Awaited<ReturnType<typeof readDouyinWork>> | undefined;
    let failure: unknown;
    let failed = false;
    try {
      const executablePath = await this.resolveBrowserForTask(signal, onInstallProgress);
      signal.throwIfAborted();
      // 不传 profileRoot，绝不读取持久化登录目录、Cookie 或 XHS 环境变量。
      browser = await (this.options.openBrowser ?? openDouyinBrowser)({ executablePath, headless: true, signal });
      signal.throwIfAborted();
      if (browser.browserVersion !== "153.0.8010.12")
        throw new DouyinRuntimeError("DOUYIN_RUNTIME_INCOMPATIBLE", "浏览器版本与抖音适配器不兼容，请修复能力包");
      const page = await browser.context.newPage();
      signal.throwIfAborted();
      result = await (this.options.readWork ?? readDouyinWork)(page, input, { signal });
      signal.throwIfAborted();
    } catch (error) {
      failed = true;
      failure = signal.aborted
        ? signal.reason
        : error instanceof DouyinBrowserError
          ? new DouyinRuntimeError(error.code, error.message)
          : error instanceof DouyinSourceError
            ? error
            : normalizeRuntimeError(error);
    } finally {
      try {
        await browser?.close();
      } catch {
        // 关闭失败不能对外暴露浏览器原始参数，也不能把尚未释放的运行时当成成功。
        this.closed = true;
        failed = true;
        failure = new DouyinRuntimeError("DOUYIN_BROWSER_UNAVAILABLE", "抖音浏览器关闭失败，请重启应用后重试");
      }
    }
    if (failed) throw failure;
    return result!;
  }

  /** 网页任务复用应用内签名目录安装，依赖必须先装；任何下载都由 ComponentManager 校验签名与摘要。 */
  private async resolveBrowserForTask(signal: AbortSignal, onProgress?: (progress: number, message: string) => void) {
    try {
      return await this.resolveBrowser();
    } catch (error) {
      const failure = normalizeRuntimeError(error);
      if (this.options.installationMode !== "automatic" || failure.code !== "DOUYIN_COMPONENT_NOT_INSTALLED")
        throw failure;
    }

    const packages = await this.components.list();
    if (!DOUYIN_INSTALL_ORDER.every((id) => packages.some((entry) => entry.id === id)))
      throw new DouyinRuntimeError(
        "DOUYIN_COMPONENT_NOT_INSTALLED",
        "当前版本尚未内置抖音签名能力包，请更新应用后重试"
      );
    if (
      packages.some(
        (entry) => DOUYIN_INSTALL_ORDER.includes(entry.id as (typeof DOUYIN_INSTALL_ORDER)[number]) && entry.activeJobId
      )
    )
      throw new DouyinRuntimeError("DOUYIN_RUNTIME_BUSY", "归档浏览器能力正在安装或修复，请稍后重试");
    if (!this.components.startInstall || !this.components.getJob || !this.components.cancelJob)
      throw new DouyinRuntimeError("DOUYIN_INSTALL_FAILED", "当前运行时不支持安全的自动安装，请更新应用后重试");

    for (const [index, id] of DOUYIN_INSTALL_ORDER.entries()) {
      signal.throwIfAborted();
      const current = await this.components.list();
      const status = current.find((entry) => entry.id === id);
      if (!status) throw new DouyinRuntimeError("DOUYIN_COMPONENT_NOT_INSTALLED", "当前版本未提供完整的抖音签名能力包");
      if (status.activeJobId)
        throw new DouyinRuntimeError("DOUYIN_RUNTIME_BUSY", "归档浏览器能力正在安装或修复，请稍后重试");
      if (status.installed) continue;

      const start = 3 + index * 12;
      onProgress?.(start, index === 0 ? "正在准备受管 Chromium 浏览器" : "正在准备抖音匿名归档组件");
      let job: Awaited<ReturnType<NonNullable<RuntimeComponents["startInstall"]>>>;
      try {
        job = await this.components.startInstall(id);
        await this.waitForInstall(job.id, id, start, signal, onProgress);
      } catch (error) {
        if (signal.aborted) throw signal.reason;
        throw normalizeAutoInstallError(error);
      }
    }
    signal.throwIfAborted();
    onProgress?.(28, "签名能力已安装，正在验证运行环境");
    return this.resolveBrowser();
  }

  /** 监听签名安装作业进度；用户取消时只中止下载阶段，提交/校验阶段安全完成后再释放运行时占用。 */
  private async waitForInstall(
    jobId: string,
    componentId: string,
    baseProgress: number,
    signal: AbortSignal,
    onProgress?: (progress: number, message: string) => void
  ) {
    let cancellationRequested = false;
    while (true) {
      const job = await this.components.getJob!(jobId);
      const terminal = ["completed", "failed", "cancelled"].includes(job.state);
      if (terminal) {
        signal.throwIfAborted();
        if (job.state !== "completed")
          throw new ComponentManagerError(
            (job.errorCode as ComponentManagerError["code"]) || "COMPONENT_INSTALL_FAILED",
            job.errorMessage || "签名能力安装失败"
          );
        return;
      }

      if (signal.aborted && !cancellationRequested && job.phase === "downloading") {
        try {
          await this.components.cancelJob!(jobId);
          cancellationRequested = true;
        } catch {
          // 安装阶段可能在取消请求抵达前切换；若仍处于可取消下载阶段，下轮继续尝试。
        }
      }
      if (!signal.aborted) {
        const phaseText =
          job.phase === "downloading"
            ? "正在下载并校验签名组件"
            : job.phase === "verifying"
              ? "正在校验签名组件"
              : job.phase === "extracting"
                ? "正在安装浏览器文件"
                : "正在启用归档能力";
        onProgress?.(
          Math.min(baseProgress + 10, baseProgress + Math.floor((job.progress.percentage / 100) * 10)),
          `${phaseText}（${job.progress.percentage}%）`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  private async resolveBrowser() {
    const platform = this.options.platform ?? process.platform;
    const arch = this.options.arch ?? process.arch;
    if (!((platform === "win32" && arch === "x64") || (platform === "darwin" && arch === "arm64")))
      throw new DouyinRuntimeError("DOUYIN_PLATFORM_UNSUPPORTED", "当前平台尚未提供抖音匿名归档能力包");
    const states = await this.components.list();
    if (states.some((state) => ["douyin-archive", "xhs-browser"].includes(state.id) && state.activeJobId))
      throw new DouyinRuntimeError("DOUYIN_RUNTIME_BUSY", "归档浏览器能力正在安装或修复，请稍后重试");
    const adapter = await this.components.resolveInstalledAsset("douyin-archive", "adapter/manifest.json");
    if ((await fs.stat(adapter.path)).size > 4096)
      throw new DouyinRuntimeError("DOUYIN_RUNTIME_INCOMPATIBLE", "抖音适配器描述超过大小上限");
    let descriptor: unknown;
    try {
      descriptor = JSON.parse(await fs.readFile(adapter.path, "utf8"));
    } catch {
      throw new DouyinRuntimeError("DOUYIN_RUNTIME_INCOMPATIBLE", "抖音适配器描述无法读取，请修复能力包");
    }
    if (!isDouyinAdapterManifest(descriptor) || !adapter.manifest.dependencyIds.includes("xhs-browser"))
      throw new DouyinRuntimeError("DOUYIN_RUNTIME_INCOMPATIBLE", "抖音适配器与应用协议不兼容，请更新或修复能力包");
    let executable = "browser/chrome.exe";
    if (platform === "darwin") {
      const launcher = await this.components.resolveInstalledAsset("xhs-browser", "browser/browser-launcher.json");
      if ((await fs.stat(launcher.path)).size > 4096)
        throw new DouyinRuntimeError("DOUYIN_RUNTIME_INCOMPATIBLE", "归档浏览器启动映射超过大小上限");
      let value: { executableAssetPath?: unknown };
      try {
        value = JSON.parse(await fs.readFile(launcher.path, "utf8"));
      } catch {
        throw new DouyinRuntimeError("DOUYIN_RUNTIME_INCOMPATIBLE", "归档浏览器启动映射无效");
      }
      if (
        !value ||
        typeof value !== "object" ||
        Object.keys(value).length !== 1 ||
        typeof value.executableAssetPath !== "string" ||
        !value.executableAssetPath.startsWith("browser/") ||
        value.executableAssetPath.includes("\\") ||
        path.posix.isAbsolute(value.executableAssetPath) ||
        value.executableAssetPath
          .split("/")
          .some(
            (part) =>
              !part ||
              part === "." ||
              part === ".." ||
              part.includes(":") ||
              [...part].some((char) => char.charCodeAt(0) < 32)
          )
      )
        throw new DouyinRuntimeError("DOUYIN_RUNTIME_INCOMPATIBLE", "归档浏览器启动映射越界或无效");
      executable = value.executableAssetPath;
    }
    const browser = await this.components.resolveInstalledAsset("xhs-browser", executable);
    if (browser.manifest.version !== "1.63.0-chromium-1243")
      throw new DouyinRuntimeError("DOUYIN_RUNTIME_INCOMPATIBLE", "归档浏览器包版本不兼容，请修复能力包");
    return browser.path;
  }
}

function normalizeRuntimeError(error: unknown) {
  if (error instanceof DouyinRuntimeError) return error;
  if (error instanceof ComponentManagerError) {
    if (["COMPONENT_NOT_FOUND", "COMPONENT_NOT_INSTALLED", "COMPONENT_DEPENDENCY_MISSING"].includes(error.code))
      return new DouyinRuntimeError("DOUYIN_COMPONENT_NOT_INSTALLED", "请安装抖音匿名归档能力及其受管 Chromium 依赖");
    if (error.code === "COMPONENT_OPERATION_CONFLICT" || error.code === "COMPONENT_IN_USE")
      return new DouyinRuntimeError("DOUYIN_RUNTIME_BUSY", "归档浏览器能力正在执行其他操作，请稍后重试");
    if (error.code === "COMPONENT_DISK_SPACE_LOW")
      return new DouyinRuntimeError("DOUYIN_DISK_SPACE_LOW", "磁盘空间不足，无法安装抖音归档能力");
  }
  return new DouyinRuntimeError("DOUYIN_COMPONENT_UNAVAILABLE", "抖音能力资产不可用或校验失败，请修复后重试");
}

function normalizeAutoInstallError(error: unknown) {
  if (
    error instanceof ComponentManagerError &&
    ["COMPONENT_INSTALL_FAILED", "COMPONENT_MANIFEST_INVALID"].includes(error.code)
  )
    return new DouyinRuntimeError(
      "DOUYIN_INSTALL_FAILED",
      "抖音能力包下载、签名或文件校验失败，请检查网络并更新应用后重试"
    );
  return normalizeRuntimeError(error);
}
