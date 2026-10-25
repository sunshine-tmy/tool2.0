/** TikTok-only proxy selection; never changes the system proxy or routes other platforms through it. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createRemoteFetch, type AddressResolver, type RemoteFetch } from "../../../../security/remote-fetch";
import { ArchiveTaskError } from "../../core/provider";
import { createPinnedTikTokProxyFetch } from "./proxy-fetch";

const exec = promisify(execFile);
export function normalizeTikTokProxy(value: string): string | undefined {
  if (value.trim().toLowerCase() === "direct") return undefined;
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error("invalid");
    return url.toString();
  } catch {
    throw new ArchiveTaskError(
      "TIKTOK_PROXY_INVALID",
      "TikTok 代理配置无效，请使用不含账号、密码和路径的 HTTP(S) 代理地址"
    );
  }
}

export function windowsTikTokProxy(value: string): string | undefined {
  const entries = value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  const endpoint =
    entries.find((part) => part.startsWith("https="))?.slice(6) ??
    entries.find((part) => part.startsWith("http="))?.slice(5) ??
    entries.find((part) => !part.includes("="));
  return endpoint ? normalizeTikTokProxy(/^https?:\/\//i.test(endpoint) ? endpoint : `http://${endpoint}`) : undefined;
}

export async function resolveTikTokProxy(
  options: {
    explicit?: string;
    environment?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
    readSystem?: () => Promise<string>;
  } = {}
) {
  if (options.explicit?.trim()) return normalizeTikTokProxy(options.explicit.trim());
  const env = options.environment ?? process.env;
  const value = env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy;
  if (value?.trim()) return normalizeTikTokProxy(value.trim());
  if ((options.platform ?? process.platform) !== "win32") return undefined;
  const read =
    options.readSystem ??
    (async () => {
      const result = await exec(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "$p=Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -ErrorAction SilentlyContinue;if($p.ProxyEnable -eq 1){[Console]::Write([string]$p.ProxyServer)}"
        ],
        { windowsHide: true, timeout: 5000, maxBuffer: 8192 }
      );
      return result.stdout.trim();
    });
  return windowsTikTokProxy(await read().catch(() => ""));
}

export function createTikTokTransport(
  options: { proxy?: string; resolver?: AddressResolver; resolveProxy?: () => Promise<string | undefined> } = {}
): RemoteFetch {
  let selected: Promise<RemoteFetch> | undefined;
  let expires = 0;
  return async (url, init) => {
    if (!selected || Date.now() >= expires) {
      expires = Date.now() + 30_000;
      selected = (options.resolveProxy?.() ?? resolveTikTokProxy({ explicit: options.proxy })).then((proxyUrl) =>
        proxyUrl
          ? createPinnedTikTokProxyFetch(proxyUrl, { resolver: options.resolver })
          : createRemoteFetch({ requireHttps: true, maxRedirects: 5, resolver: options.resolver })
      );
    }
    return (await selected)(url, init);
  };
}
