/** Owned ephemeral browser. Every HTTPS tunnel pins a verified public IP, including through a configured proxy. */
import http from "node:http";
import https from "node:https";
import type { Socket } from "node:net";
import fs from "node:fs/promises";
import { chromium } from "playwright-core";
import type { ComponentManager } from "../../../../modules/components/component-manager";
import type { ResolvedAddress } from "../../../../security/remote-fetch";
import { createBrowserNetwork } from "../douyin/browser-network";
import { resolveProxyPublicAddress } from "./proxy-fetch";
import { resolveTikTokProxy } from "./transport";
import { ArchiveTaskError } from "../../core/provider";

export function connectProfileProxy(proxy: string, address: ResolvedAddress, signal: AbortSignal): Promise<Socket> {
  const endpoint = new URL(proxy),
    target = `${address.family === 6 ? `[${address.address}]` : address.address}:443`;
  return new Promise((resolve, reject) => {
    const request = (endpoint.protocol === "https:" ? https : http).request(endpoint, {
      method: "CONNECT",
      path: target,
      agent: false,
      maxHeaderSize: 8192,
      headers: { host: target },
      signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)])
    });
    request.once("connect", (response, socket, head) => {
      if (response.statusCode !== 200 || signal.aborted) {
        socket.destroy();
        reject(new Error("PROFILE_PROXY_TUNNEL_FAILED"));
        return;
      }
      if (head.length) socket.unshift(head);
      resolve(socket);
    });
    request.once("error", reject);
    request.end();
  });
}

export async function resolveProfileBrowser(
  components: Pick<ComponentManager, "resolveInstalledAsset" | "list">,
  platform = process.platform
) {
  try {
    if ((await components.list()).some((state) => state.id === "xhs-browser" && state.activeJobId))
      throw new ArchiveTaskError("TIKTOK_PROFILE_BROWSER_BUSY", "归档浏览器正在安装或修复，请稍后重试", 409);
    let asset = "browser/chrome.exe";
    if (platform === "darwin") {
      const descriptor = await components.resolveInstalledAsset("xhs-browser", "browser/browser-launcher.json");
      if ((await fs.stat(descriptor.path)).size > 4096) throw new Error("BROWSER_DESCRIPTOR_INVALID");
      const value: unknown = JSON.parse(await fs.readFile(descriptor.path, "utf8"));
      if (
        !value ||
        typeof value !== "object" ||
        Object.keys(value).length !== 1 ||
        !("executableAssetPath" in value) ||
        typeof value.executableAssetPath !== "string" ||
        !/^browser\/[^\\:]+$/.test(value.executableAssetPath) ||
        value.executableAssetPath
          .split("/")
          .some((part) => !part || part === "." || part === ".." || Array.from(part).some((c) => c.charCodeAt(0) < 32))
      )
        throw new Error("BROWSER_DESCRIPTOR_INVALID");
      asset = value.executableAssetPath;
    } else if (platform !== "win32") throw new Error("BROWSER_PLATFORM_UNSUPPORTED");
    const browser = await components.resolveInstalledAsset("xhs-browser", asset);
    if (browser.manifest.version !== "1.63.0-chromium-1243") throw new Error("BROWSER_VERSION_UNSUPPORTED");
    return browser.path;
  } catch (error) {
    if (error instanceof ArchiveTaskError) throw error;
    throw new ArchiveTaskError(
      "TIKTOK_PROFILE_BROWSER_UNAVAILABLE",
      "请先在能力管理中安装或修复归档浏览器（Chromium）；单条 TikTok 归档不受影响",
      409
    );
  }
}

export async function openProfileBrowser(options: {
  executablePath: string;
  proxy?: string;
  signal: AbortSignal;
  headless?: boolean;
}) {
  options.signal.throwIfAborted();
  const proxy = await resolveTikTokProxy({ explicit: options.proxy });
  options.signal.throwIfAborted();
  const network = await createBrowserNetwork(
    proxy
      ? {
          resolver: (host) => resolveProxyPublicAddress(host, proxy, options.signal),
          connectTunnel: (address, signal) =>
            connectProfileProxy(proxy, address, AbortSignal.any([signal, options.signal]))
        }
      : {}
  );
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      options.signal.removeEventListener("abort", aborted);
      try {
        await browser?.close();
      } finally {
        await network.close();
      }
    })());
  const aborted = () => {
    void close().catch(() => undefined);
  };
  try {
    browser = await chromium.launch({
      executablePath: options.executablePath,
      headless: options.headless ?? false,
      proxy: network.proxy,
      // Match the installed Playwright interactive-browser entry; keep the public-IP tunnel and manual verification.
      args: [...network.args, "--disable-blink-features=AutomationControlled"]
    });
    const context = await browser.newContext({ acceptDownloads: false, serviceWorkers: "block" });
    if (options.signal.aborted) {
      await close();
      options.signal.throwIfAborted();
    }
    options.signal.addEventListener("abort", aborted, { once: true });
    await context.route("**/*", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        (request.isNavigationRequest() &&
          request.frame() === request.frame().page().mainFrame() &&
          !["www.tiktok.com", "tiktok.com"].includes(url.hostname)) ||
        request.resourceType() === "media"
      )
        return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    context.on("page", (popup) => {
      if (popup !== page) void popup.close().catch(() => undefined);
    });
    page.on("download", (download) => {
      void download.cancel();
    });
    return { page, close };
  } catch (error) {
    await close().catch(() => undefined);
    if (options.signal.aborted) throw options.signal.reason;
    if (error instanceof ArchiveTaskError) throw error;
    throw new ArchiveTaskError(
      "TIKTOK_PROFILE_BROWSER_FAILED",
      "主页浏览器启动失败，请检查归档浏览器和 TikTok 代理配置后重试",
      409
    );
  }
}
