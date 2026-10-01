/** 抖音运行时只解析签名 generation；资产可共享，会话、取消和并发占用独立，不自动安装或发现系统浏览器。 */
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
  openBrowser?: typeof openDouyinBrowser;
  readWork?: typeof readDouyinWork;
};
export class DouyinRuntimeManager {
  private operation?: { controller: AbortController; done: Promise<unknown> };
  private closed = false;
  private closing?: Promise<void>;

  constructor(
    private readonly components: Pick<ComponentManager, "resolveInstalledAsset" | "list">,
    private readonly options: RuntimeOptions = {}
  ) {}

  isActive() {
    return Boolean(this.operation);
  }

  /** 状态检查只校验本地资产，不启动浏览器、不访问平台；离线时仍能准确报告组件健康度。 */
  async status(): Promise<DouyinRuntimeStatus> {
    if (this.closed)
      return { platform: "douyin", mode: "anonymous", available: false, state: "stopped", message: "抖音运行时已关闭" };
    try {
      await this.resolveBrowser();
      if (this.closed) return this.status();
      return {
        platform: "douyin",
        mode: "anonymous",
        available: true,
        state: this.isActive() ? "busy" : "ready",
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
        message: failure.message,
        errorCode: failure.code
      };
    }
  }

  /** 一次只持有一个匿名浏览器；上层任务服务负责排队，运行时不建立第二套任务队列。 */
  async extract(input: string, options: { signal?: AbortSignal } = {}) {
    options.signal?.throwIfAborted();
    if (this.closed) throw new DouyinRuntimeError("DOUYIN_RUNTIME_STOPPED", "抖音运行时已关闭");
    if (this.operation) throw new DouyinRuntimeError("DOUYIN_RUNTIME_BUSY", "抖音获取正在运行，请稍后重试");
    const link = identifyArchiveLink(input, "douyin");
    if (!link.ok || new URL(link.url).protocol !== "https:")
      throw new DouyinSourceError("DOUYIN_PARSE_FAILED", "请提供有效的 HTTPS 抖音作品链接");
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, ...(options.signal ? [options.signal] : [])]);
    const timer = setTimeout(() => controller.abort(new DOMException("抖音读取超时", "TimeoutError")), 120_000);
    // 占用先于异步资产检查登记，确保重装/卸载不能在浏览器启动途中删除已选定的 generation。
    const done = Promise.resolve().then(() => this.run(link.url, signal));
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

  private async run(input: string, signal: AbortSignal) {
    let browser: Awaited<ReturnType<typeof openDouyinBrowser>> | undefined;
    let result: Awaited<ReturnType<typeof readDouyinWork>> | undefined;
    let failure: unknown;
    let failed = false;
    try {
      const executablePath = await this.resolveBrowser();
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
  if (
    error instanceof ComponentManagerError &&
    ["COMPONENT_NOT_FOUND", "COMPONENT_NOT_INSTALLED", "COMPONENT_DEPENDENCY_MISSING"].includes(error.code)
  )
    return new DouyinRuntimeError(
      "DOUYIN_COMPONENT_NOT_INSTALLED",
      "请先在能力管理中安装抖音匿名归档及其受管 Chromium 依赖"
    );
  return new DouyinRuntimeError("DOUYIN_COMPONENT_UNAVAILABLE", "抖音能力资产不可用或校验失败，请修复后重试");
}
