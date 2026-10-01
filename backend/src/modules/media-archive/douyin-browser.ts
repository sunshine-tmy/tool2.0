/** 抖音独立浏览器生命周期：只使用自有平台 Profile，网络受控，不导出或复用其他平台 Cookie。 */
import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type BrowserContext } from "playwright-core";
import { createBrowserNetwork } from "./browser-network";

const profiles = new Set<string>();
export class DouyinBrowserError extends Error {
  constructor(
    readonly code: "DOUYIN_PROFILE_INVALID" | "DOUYIN_PROFILE_BUSY" | "DOUYIN_BROWSER_UNAVAILABLE",
    message: string
  ) {
    super(message);
    this.name = "DouyinBrowserError";
  }
}

export async function openDouyinBrowser(options: {
  executablePath: string;
  profileRoot?: string;
  headless?: boolean;
  signal?: AbortSignal;
}) {
  options.signal?.throwIfAborted();
  let profileKey: string | undefined;
  let profileDirectory: string | undefined;
  if (options.profileRoot) {
    try {
      const root = path.resolve(options.profileRoot);
      await fs.mkdir(root, { recursive: true, mode: 0o700 });
      const actualRoot = await fs.realpath(root);
      if (path.relative(root, actualRoot))
        throw new DouyinBrowserError("DOUYIN_PROFILE_INVALID", "抖音浏览器根目录不能通过链接指向其他配置目录");
      // CLI/运行时选择根目录，平台子目录固定，绝不读取旧 XHS 或日常 Chrome Profile。
      const directory = path.join(actualRoot, "douyin-archive");
      const marker = path.join(directory, ".toolbox-platform.json");
      try {
        await fs.mkdir(directory, { mode: 0o700 });
        await fs.writeFile(marker, JSON.stringify({ platform: "douyin", protocolVersion: 1 }), {
          flag: "wx",
          mode: 0o600
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (path.relative(actualRoot, await fs.realpath(directory)) !== "douyin-archive")
          throw new DouyinBrowserError("DOUYIN_PROFILE_INVALID", "抖音浏览器目录不能指向其他配置目录");
        // 未经本项目登记的既有目录不自动接管，避免误读用户或其他平台会话。
        try {
          if ((await fs.stat(marker)).size > 512) throw new Error("marker too large");
          const value: unknown = JSON.parse(await fs.readFile(marker, "utf8"));
          if (
            !value ||
            typeof value !== "object" ||
            (value as { platform?: unknown }).platform !== "douyin" ||
            (value as { protocolVersion?: unknown }).protocolVersion !== 1
          )
            throw new Error("invalid marker");
        } catch {
          throw new DouyinBrowserError("DOUYIN_PROFILE_INVALID", "抖音浏览器目录未登记或平台信息不符");
        }
      }
      profileKey = process.platform === "win32" ? directory.toLowerCase() : directory;
      if (profiles.has(profileKey))
        throw new DouyinBrowserError("DOUYIN_PROFILE_BUSY", "抖音登录或获取正在使用浏览器，请稍后重试");
      profileDirectory = directory;
      profiles.add(profileKey);
    } catch (error) {
      if (error instanceof DouyinBrowserError) throw error;
      throw new DouyinBrowserError("DOUYIN_PROFILE_INVALID", "抖音浏览器目录无法安全创建或读取，请检查配置后重试");
    }
  }
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
        try {
          await network?.close();
        } finally {
          if (profileKey) profiles.delete(profileKey);
        }
      }
    }));
  const aborted = () => {
    void close().catch(() => undefined);
  };
  try {
    options.signal?.throwIfAborted();
    network = await createBrowserNetwork();
    const launch = {
      executablePath: options.executablePath,
      headless: options.headless ?? true,
      proxy: network.proxy,
      args: network.args
    };
    if (profileDirectory) {
      // 此目录只有明确的平台标记才会被复用；持久化仅由 Chromium 自己管理。
      context = await chromium.launchPersistentContext(profileDirectory, {
        ...launch,
        acceptDownloads: false,
        serviceWorkers: "block"
      });
    } else {
      browser = await chromium.launch(launch);
      context = await browser.newContext({ acceptDownloads: false, serviceWorkers: "block" });
    }
    if (options.signal?.aborted) {
      await close();
      options.signal.throwIfAborted();
    }
    options.signal?.addEventListener("abort", aborted, { once: true });
    context.on("close", aborted);
    return {
      context,
      browserVersion: (browser ?? context.browser())?.version() ?? "unknown",
      networkStatus: network.status,
      close
    };
  } catch (error) {
    await close().catch(() => undefined);
    if (error instanceof DouyinBrowserError || options.signal?.aborted) throw error;
    // 浏览器错误可能带本地路径或代理参数；外部只接收稳定错误，不回传原始凭据。
    throw new DouyinBrowserError("DOUYIN_BROWSER_UNAVAILABLE", "抖音浏览器启动失败，请检查已安装的浏览器能力后重试");
  }
}
