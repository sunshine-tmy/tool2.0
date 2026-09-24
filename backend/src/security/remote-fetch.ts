/**
 * 中文模块说明：后端应用层，负责 后端公共服务、配置或基础设施能力
 */
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import type { LookupAddress, LookupOptions } from "node:dns";
import { Readable, Transform } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { Agent, fetch as undiciFetch } from "undici";

const nativeGlobalFetch = globalThis.fetch;

export type ResolvedAddress = { address: string; family: number };
export type AddressResolver = (hostname: string) => Promise<ResolvedAddress[]>;
export type RemoteFetch = (url: string, init?: RequestInit) => Promise<Response>;
type PinnedLookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family: number
) => void;

/**
 * 只限制建立远程连接和接收响应头的时间。
 * 不要把超时信号继续绑定到响应 body，否则长时间媒体下载会在响应头超时后被误中止。
 */
export async function fetchRemoteResponse(
  remoteFetch: RemoteFetch,
  url: string,
  init: Omit<RequestInit, "signal">,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await remoteFetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Remote request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function createRemoteFetch(
  options: {
    resolver?: AddressResolver;
    fetchImpl?: typeof fetch;
    maxRedirects?: number;
    requireHttps?: boolean;
  } = {}
): RemoteFetch {
  const resolver = options.resolver ?? resolveAllAddresses;
  const maxRedirects = options.maxRedirects ?? 3;
  const requireHttps = options.requireHttps ?? false;
  const injectedFetch = options.fetchImpl ?? (globalThis.fetch !== nativeGlobalFetch ? globalThis.fetch : undefined);
  return async (input, init = {}) => {
    // 地址固定表和 Agent 必须是单个顶层请求私有的。若全局复用 hostname -> IP 表，并发请求
    // 同一域名时会相互覆盖已校验地址，重新引入 DNS rebinding 时间窗口。
    const pinnedAddresses = new Map<string, ResolvedAddress>();
    const dispatcher = injectedFetch
      ? undefined
      : new Agent({
          connect: {
            lookup: createPinnedLookup(pinnedAddresses)
          }
        });
    let current = new URL(input);

    // 重定向的每一跳都重新解析、重新做公网地址检查，并限制最大跳数。
    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      const addresses = await resolvePublicRemoteUrl(current, resolver, requireHttps);
      pinnedAddresses.set(normalizeHostname(current.hostname), addresses[0]);
      const response = (injectedFetch
        ? await injectedFetch(current.toString(), { ...init, redirect: "manual" })
        : await undiciFetch(current.toString(), {
            ...(init as Parameters<typeof undiciFetch>[1]),
            redirect: "manual",
            dispatcher
          })) as unknown as Response;
      if (!isRedirect(response.status)) return response;

      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) throw new Error("Remote redirect did not include a Location header");
      if (redirectCount === maxRedirects) throw new Error("Remote URL exceeded the redirect limit");
      current = new URL(location, current);
    }

    throw new Error("Remote URL exceeded the redirect limit");
  };
}

/**
 * 创建只允许使用已通过 SSRF 校验地址的 DNS 回调。
 * Node 24 的自动地址选择会要求 all=true 时返回对象数组，普通模式仍使用字符串地址。
 */
export function createPinnedLookup(pinnedAddresses: ReadonlyMap<string, ResolvedAddress>) {
  return (hostname: string, options: LookupOptions, callback: PinnedLookupCallback) => {
    const selected = pinnedAddresses.get(normalizeHostname(hostname));
    if (!selected) {
      callback(new Error("Remote hostname was not resolved through the SSRF policy"), "", 4);
      return;
    }
    if (options?.all) {
      callback(null, [{ address: selected.address, family: selected.family }], selected.family);
    } else {
      callback(null, selected.address, selected.family as 4 | 6);
    }
  };
}

export async function assertPublicRemoteUrl(
  url: URL,
  resolver: AddressResolver = resolveAllAddresses,
  requireHttps = false
) {
  await resolvePublicRemoteUrl(url, resolver, requireHttps);
}

async function resolvePublicRemoteUrl(url: URL, resolver: AddressResolver, requireHttps = false) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS remote URLs are allowed");
  }
  if (requireHttps && url.protocol !== "https:") throw new Error("HTTPS is required for every remote URL hop");
  if (url.username || url.password) throw new Error("Remote URLs cannot contain credentials");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error("Remote URLs can only use ports 80 and 443");
  }

  const hostname = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (!hostname || isLocalHostname(hostname)) throw new Error("Local network URLs are not allowed");

  const literalFamily = isIP(hostname);
  const addresses = literalFamily ? [{ address: hostname, family: literalFamily }] : await resolver(hostname);
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("Remote URL resolves to a private or reserved network address");
  }
  return addresses;
}

function normalizeHostname(hostname: string) {
  return hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
}

export function assertRemoteResponseSize(response: Response, maxBytes: number) {
  const rawLength = response.headers.get("content-length");
  if (!rawLength) return;
  const length = Number(rawLength);
  if (!Number.isSafeInteger(length) || length < 0 || length > maxBytes) {
    throw new Error(`Remote response exceeds the ${maxBytes} byte limit`);
  }
}

export function limitedResponseStream(response: Response, maxBytes: number) {
  if (!response.body) throw new Error("Remote response did not include a body");
  let received = 0;
  const source = Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>);
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > maxBytes) {
        callback(new Error(`Remote response exceeds the ${maxBytes} byte limit`));
        return;
      }
      callback(null, chunk);
    }
  });
  // Node 的 .pipe() 不会自动转发 Web Stream 的错误；显式转发给 Fastify，
  // 让请求生命周期处理异常，避免升级成未捕获的进程级错误。
  source.once("error", (error) => limiter.destroy(error));
  return source.pipe(limiter);
}

async function resolveAllAddresses(hostname: string) {
  return lookup(hostname, { all: true, verbatim: true });
}

function isRedirect(status: number) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isLocalHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan")
  );
}

function isPublicAddress(value: string) {
  const normalized = value.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized.startsWith("::ffff:")) return isPublicAddress(normalized.slice(7));
  if (isIP(normalized) === 4) return isPublicIpv4(normalized);
  if (isIP(normalized) === 6) return isPublicIpv6(normalized);
  return false;
}

function isPublicIpv4(value: string) {
  const [a, b] = value.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168)) return false;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
  if (a === 203 && b === 0) return false;
  return true;
}

function isPublicIpv6(value: string) {
  return !(
    value === "::" ||
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    /^fe[89ab]/.test(value) ||
    value.startsWith("ff") ||
    value.startsWith("2001:db8:")
  );
}
