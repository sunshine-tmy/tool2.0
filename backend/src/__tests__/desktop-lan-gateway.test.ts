/**
 * 中文模块说明：验证桌面局域网网关只代理传输页面与 API，并限制客户端网络范围。
 */
import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { isPrivateLanIPv4 } from "../modules/lan-transfer/access";
import { isPrivateLanClientAddress, startDesktopLanGateway } from "../runtime/desktop-lan-gateway";

describe("desktop LAN gateway", () => {
  let upstream: http.Server | undefined;
  let gateway: Awaited<ReturnType<typeof startDesktopLanGateway>> | undefined;

  afterEach(async () => {
    await gateway?.close();
    gateway = undefined;
    if (upstream?.listening) await closeServer(upstream);
    upstream = undefined;
  });

  it("proxies approved LAN tool pages and APIs without exposing management or unrelated routes", async () => {
    const requests: Array<{ method?: string; url?: string; origin?: string; body: string }> = [];
    upstream = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        requests.push({
          method: request.method,
          url: request.url,
          origin: request.headers.origin,
          body: Buffer.concat(chunks).toString("utf8")
        });
        response.setHeader("content-type", "application/json");
        response.setHeader("content-security-policy", "default-src 'self'; upgrade-insecure-requests; img-src 'self'");
        response.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains");
        response.setHeader("cross-origin-opener-policy", "same-origin");
        response.setHeader("origin-agent-cluster", "?1");
        response.setHeader("set-cookie", "toolbox_lan_session=test; HttpOnly; Path=/api");
        response.writeHead(201);
        response.end(JSON.stringify({ path: request.url }));
      });
    });
    const upstreamOrigin = await listen(upstream);
    gateway = await startDesktopLanGateway(upstreamOrigin, 0);

    const page = await fetch(`http://127.0.0.1:${gateway.port}/tools/lan-transfer`, {
      headers: { accept: "text/html" }
    });
    expect(page.status).toBe(201);
    expect(page.headers.get("content-security-policy")).toBe("default-src 'self'; img-src 'self'");
    expect(page.headers.get("strict-transport-security")).toBeNull();
    expect(page.headers.get("cross-origin-opener-policy")).toBeNull();
    expect(page.headers.get("origin-agent-cluster")).toBeNull();

    let transferCookie: string | null = null;
    for (const apiPath of [
      "/api/v1/tools/lan-transfer/files",
      "/api/v1/tools/image-ai/health",
      "/api/v1/tools/video-text/history",
      "/api/v1/tools/edge-tts/chatterbox/health",
      "/api/v1/tools/xhs-archive/items"
    ]) {
      const payload = await fetch(`http://127.0.0.1:${gateway.port}${apiPath}`, {
        method: apiPath.endsWith("/files") ? "POST" : "GET",
        headers: {
          origin: `http://127.0.0.1:${gateway.port}`,
          ...(apiPath.endsWith("/files") ? { "content-type": "application/json" } : {})
        },
        ...(apiPath.endsWith("/files") ? { body: JSON.stringify({ value: "transfer" }) } : {})
      });
      expect(payload.status).toBe(201);
      expect(await payload.json()).toEqual({ path: apiPath });
      if (apiPath.endsWith("/files")) transferCookie = payload.headers.get("set-cookie");
    }
    expect(transferCookie).toContain("toolbox_lan_session=test");
    expect(requests[1]).toMatchObject({
      method: "POST",
      origin: undefined,
      body: JSON.stringify({ value: "transfer" })
    });
    const denied = await fetch(`http://127.0.0.1:${gateway.port}/api/v1/components`);
    const deniedSession = await fetch(`http://127.0.0.1:${gateway.port}/api/v1/session`);
    const deniedOtherTool = await fetch(`http://127.0.0.1:${gateway.port}/api/v1/tools/short-video/parse`);
    const hiddenPage = await fetch(`http://127.0.0.1:${gateway.port}/settings`, {
      headers: { accept: "text/html" }
    });
    expect(denied.status).toBe(404);
    expect(deniedSession.status).toBe(404);
    expect(deniedOtherTool.status).toBe(404);
    expect(hiddenPage.status).toBe(404);
    expect(requests).toHaveLength(6);

    for (const pagePath of ["/tools/image-ai", "/tools/video-text", "/tools/edge-tts", "/tools/xhs-archive"]) {
      const modulePage = await fetch(`http://127.0.0.1:${gateway.port}${pagePath}`, {
        headers: { accept: "text/html" }
      });
      expect(modulePage.status).toBe(201);
      expect(await modulePage.json()).toEqual({ path: pagePath });
    }
    expect(requests).toHaveLength(10);
  });

  it("accepts only RFC1918 IPv4 interfaces and clients (plus loopback for local diagnostics)", () => {
    expect(isPrivateLanIPv4("10.24.1.5")).toBe(true);
    expect(isPrivateLanIPv4("172.16.0.1")).toBe(true);
    expect(isPrivateLanIPv4("172.31.255.254")).toBe(true);
    expect(isPrivateLanIPv4("192.168.1.241")).toBe(true);
    expect(isPrivateLanIPv4("172.32.0.1")).toBe(false);
    expect(isPrivateLanIPv4("8.8.8.8")).toBe(false);
    expect(isPrivateLanIPv4("169.254.1.1")).toBe(false);
    expect(isPrivateLanIPv4("192.168.1.999")).toBe(false);
    expect(isPrivateLanClientAddress("::ffff:192.168.1.12")).toBe(true);
    expect(isPrivateLanClientAddress("127.0.0.1")).toBe(true);
    expect(isPrivateLanClientAddress("::1")).toBe(true);
    expect(isPrivateLanClientAddress("8.8.8.8")).toBe(false);
    expect(isPrivateLanClientAddress(undefined)).toBe(false);
  });
});

function listen(server: http.Server) {
  return new Promise<string>((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      server.removeAllListeners("error");
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("Test upstream did not bind a TCP port"));
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function closeServer(server: http.Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
