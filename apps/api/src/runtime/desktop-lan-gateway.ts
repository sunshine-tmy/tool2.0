/**
 * 中文模块说明：桌面版局域网安全网关，仅将获准的工具页面与 API 反向代理到 loopback 后端。
 */
import http, { type IncomingHttpHeaders, type Server, type ServerResponse } from "node:http";
import net from "node:net";
import { isPrivateLanIPv4 } from "../domains/lan-transfer/access";
import { listTools } from "@toolbox/shared";

const LAN_TOOL_API_PREFIXES = [...listTools().map((tool) => tool.apiNamespace), "/api/v1/tools/media-archive"];
const LAN_TOOL_PAGES = new Set(["/", ...listTools().map((tool) => tool.routePath), "/tools/xhs-archive"]);
const PUBLIC_ASSETS = new Set(["/favicon.ico", "/favicon-32x32.png", "/ecommerce-toolbox-icon-32.png"]);
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

export type DesktopLanGateway = {
  port: number;
  close(): Promise<void>;
};

/**
 * 从业务工具注册表生成允许列表，覆盖全部业务工具及其进度、媒体、下载路由；
 * 能力管理、维护、会话和其它 API 不转发。绑定所有 IPv4 网卡以便同一局域网访问，
 * 但只接受 RFC1918 与 loopback 客户端。
 */
export async function startDesktopLanGateway(
  upstreamOrigin: string,
  preferredPort: number
): Promise<DesktopLanGateway> {
  const upstream = new URL(upstreamOrigin);
  if (upstream.protocol !== "http:" || !isLoopbackHost(upstream.hostname)) {
    throw new Error("Desktop LAN gateway upstream must be a loopback HTTP origin");
  }

  // Windows 允许不同接口上的部分端口复用；绝不能让网关与它的 loopback 上游同端口。
  const preferred =
    Number.isInteger(preferredPort) &&
    preferredPort > 0 &&
    preferredPort <= 65535 &&
    preferredPort !== Number(upstream.port || 80)
      ? preferredPort
      : 0;
  let server: Server;
  let port: number;
  try {
    ({ server, port } = await listenGateway(upstream, preferred));
  } catch (error) {
    if (preferred === 0 || !isAddressInUse(error)) throw error;
    // A port collision (for example another local development service) must not disable desktop startup.
    ({ server, port } = await listenGateway(upstream, 0));
  }

  return {
    port,
    close: () => closeServer(server)
  };
}

export function isPrivateLanClientAddress(address: string | undefined) {
  if (!address) return false;
  const normalized = address.startsWith("::ffff:") ? address.slice("::ffff:".length) : address;
  if (normalized === "::1" || normalized === "127.0.0.1") return true;
  if (net.isIPv4(normalized)) {
    return isPrivateLanIPv4(normalized);
  }
  return false;
}

function listenGateway(upstream: URL, port: number) {
  return new Promise<{ server: Server; port: number }>((resolve, reject) => {
    const server = http.createServer((request, response) => proxyAllowedRequest(request, response, upstream));
    const onError = (error: NodeJS.ErrnoException) => {
      server.removeListener("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.removeListener("error", onError);
      const address = server.address();
      if (!address || typeof address === "string") {
        void closeServer(server).finally(() => reject(new Error("LAN gateway did not bind a TCP port")));
        return;
      }
      resolve({ server, port: address.port });
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen({ host: "0.0.0.0", port, exclusive: true });
  });
}

function proxyAllowedRequest(request: http.IncomingMessage, response: ServerResponse, upstream: URL) {
  if (!isPrivateLanClientAddress(request.socket.remoteAddress)) {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    response.end("LAN access only");
    return;
  }

  const parsedUrl = safeRequestUrl(request);
  if (!parsedUrl) {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    response.end("Only same-origin LAN requests are allowed");
    return;
  }
  if (!isAllowedRoute(request.method ?? "GET", parsedUrl.pathname)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    response.end("Not found");
    return;
  }

  const headers = filterHeaders(request.headers);
  headers.host = upstream.host;
  // Same-origin requests need no CORS Origin header; remove it before forwarding to the loopback API.
  delete headers.origin;
  delete headers.forwarded;
  delete headers["x-real-ip"];
  for (const name of Object.keys(headers)) if (name.startsWith("x-forwarded-")) delete headers[name];
  headers["x-forwarded-for"] = request.socket.remoteAddress;
  const upstreamRequest = http.request(
    {
      hostname: upstream.hostname,
      port: upstream.port,
      method: request.method,
      path: parsedUrl.pathname + parsedUrl.search,
      headers
    },
    (upstreamResponse) => {
      const responseHeaders = sanitizeLanResponseHeaders(filterHeaders(upstreamResponse.headers));
      response.writeHead(upstreamResponse.statusCode ?? 502, responseHeaders);
      upstreamResponse.pipe(response);
    }
  );

  upstreamRequest.on("error", () => {
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.writeHead(502, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    response.end("Toolbox service is temporarily unavailable");
  });
  request.on("aborted", () => upstreamRequest.destroy());
  response.on("close", () => {
    if (!response.writableEnded) upstreamRequest.destroy();
  });
  request.pipe(upstreamRequest);
}

function isAllowedRoute(method: string, pathname: string) {
  if (!["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"].includes(method)) return false;
  if (method === "GET" || method === "HEAD") {
    if (
      LAN_TOOL_PAGES.has(pathname.replace(/\/+$/, "") || "/") ||
      pathname.startsWith("/assets/") ||
      PUBLIC_ASSETS.has(pathname)
    ) {
      return true;
    }
    if (["/api/v1/health", "/api/v1/tools", "/api/v1/lan-access", "/api/v1/tasks"].includes(pathname)) return true;
    if (/^\/api\/v1\/tasks\/[A-Za-z0-9_-]+(?:\/events)?$/.test(pathname)) return true;
    if (/^\/api\/v1\/files\/[^/]+$/.test(pathname)) return true;
  }
  if (method === "POST" && pathname === "/api/v1/lan-access/playback") return true;
  return LAN_TOOL_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** 只接收本机/私网 IP Host；先验证浏览器来源再剥离 Origin，避免跨站写入及 DNS 重绑定。 */
function safeRequestUrl(request: http.IncomingMessage): URL | undefined {
  try {
    const host = request.headers.host;
    if (!host) return;
    const origin = new URL(`http://${host}`);
    if (
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash ||
      !isPrivateLanClientAddress(origin.hostname) ||
      Number(origin.port || 80) !== request.socket.localPort
    )
      return;
    const target = request.url || "/";
    if (
      !target.startsWith("/") ||
      target.startsWith("//") ||
      target.includes("\u0000") ||
      /\\|%(?:2f|5c|00)/i.test(target.split("?", 1)[0]!)
    )
      return;
    const url = new URL(target, origin);
    if (url.origin !== origin.origin || url.hash) return;
    // 代理与后端必须对路径边界达成一致，不转发二次编码路径。
    if (/%25/i.test(url.pathname)) return;
    if (request.headers["sec-fetch-site"] === "cross-site") return;
    if (request.headers.origin && request.headers.origin !== origin.origin) return;
    return url;
  } catch {
    return;
  }
}

function filterHeaders(headers: IncomingHttpHeaders): IncomingHttpHeaders {
  const filtered: IncomingHttpHeaders = {};
  const connectionTokens = (headers.connection ?? "")
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  for (const [name, value] of Object.entries(headers)) {
    const normalized = name.toLowerCase();
    if (
      value === undefined ||
      HOP_BY_HOP_HEADERS.has(normalized) ||
      connectionTokens.includes(normalized) ||
      normalized === "host"
    ) {
      continue;
    }
    filtered[normalized] = value;
  }
  return filtered;
}

function sanitizeLanResponseHeaders(headers: IncomingHttpHeaders): IncomingHttpHeaders {
  const policy = headers["content-security-policy"];
  if (typeof policy === "string") {
    headers["content-security-policy"] = removeHttpsUpgradeDirective(policy);
  } else if (Array.isArray(policy)) {
    headers["content-security-policy"] = policy.map(removeHttpsUpgradeDirective);
  }

  // This gateway is deliberately HTTP-only; do not tell the phone to force TLS or request isolation
  // headers that browsers cannot honor for an untrusted private-IP origin.
  delete headers["strict-transport-security"];
  delete headers["cross-origin-opener-policy"];
  delete headers["origin-agent-cluster"];
  return headers;
}

function removeHttpsUpgradeDirective(policy: string) {
  return policy
    .split(";")
    .map((directive) => directive.trim())
    .filter((directive) => directive && directive.toLowerCase() !== "upgrade-insecure-requests")
    .join("; ");
}

function isLoopbackHost(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname.startsWith("127.");
}

function isAddressInUse(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EADDRINUSE";
}

function closeServer(server: Server) {
  if (!server.listening) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
