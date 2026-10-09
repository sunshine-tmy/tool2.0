/** 抖音匿名解析的浏览器生命周期：每次使用全新临时上下文，网络受控。 */
import { chromium, type Browser, type BrowserContext } from "playwright-core";
import { createBrowserNetwork } from "./browser-network";

export class DouyinBrowserError extends Error {
  constructor(
    readonly code: "DOUYIN_BROWSER_UNAVAILABLE",
    message: string
  ) {
    super(message);
    this.name = "DouyinBrowserError";
  }
}

export async function openDouyinBrowser(options: { executablePath: string; headless?: boolean; signal?: AbortSignal }) {
  options.signal?.throwIfAborted();
  let network: Awaited<ReturnType<typeof createBrowserNetwork>> | undefined;
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let closePromise: Promise<void> | undefined;
  const close = () =>
    (closePromise ??= Promise.resolve().then(async () => {
      options.signal?.removeEventListener("abort", aborted);
      try {
        if (browser) await browser.close();
        else await context?.close();
      } finally {
        await network?.close();
      }
    }));
  const aborted = () => {
    void close().catch(() => undefined);
  };
  try {
    options.signal?.throwIfAborted();
    network = await createBrowserNetwork();
    browser = await chromium.launch({
      executablePath: options.executablePath,
      headless: options.headless ?? true,
      proxy: network.proxy,
      args: network.args
    });
    context = await browser.newContext({ acceptDownloads: false, serviceWorkers: "block" });
    if (options.signal?.aborted) {
      await close();
      options.signal.throwIfAborted();
    }
    options.signal?.addEventListener("abort", aborted, { once: true });
    context.on("close", aborted);
    return {
      context,
      browserVersion: browser.version() || "unknown",
      networkStatus: network.status,
      close
    };
  } catch (error) {
    await close().catch(() => undefined);
    if (options.signal?.aborted) throw error;
    // 浏览器错误可能带本地路径或代理参数；外部只接收稳定错误，不回传原始凭据。
    throw new DouyinBrowserError("DOUYIN_BROWSER_UNAVAILABLE", "抖音浏览器启动失败，请检查已安装的浏览器能力后重试");
  }
}
