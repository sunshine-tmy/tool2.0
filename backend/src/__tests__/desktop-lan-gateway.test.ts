/**
 * 中文模块说明：验证桌面局域网网关只代理传输页面与 API，并限制客户端网络范围。
 */
import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { listTools } from "@toolbox/shared";
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
      "/api/v1/tools/edge-tts/chatterbox/health",
      "/api/v1/tools/audio-library/items",
      "/api/v1/tools/xhs-archive/items",
      "/api/v1/tools/media-archive/items",
      "/api/v1/tools/image-compress/tasks",
      "/api/v1/tasks/task-123/events",
      "/api/v1/files/result.webp",
      "/api/v1/lan-access",
      "/api/v1/tools"
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
    const deniedOtherTool = await fetch(`http://127.0.0.1:${gateway.port}/api/v1/diagnostics`);
    const hiddenPage = await fetch(`http://127.0.0.1:${gateway.port}/settings`, {
      headers: { accept: "text/html" }
    });
    expect(denied.status).toBe(404);
    expect(deniedSession.status).toBe(404);
    expect(deniedOtherTool.status).toBe(404);
    expect(hiddenPage.status).toBe(404);
    expect(requests).toHaveLength(12);

    for (const pagePath of ["/", ...listTools().map((tool) => tool.routePath), "/tools/xhs-archive"]) {
      const modulePage = await fetch(`http://127.0.0.1:${gateway.port}${pagePath}`, {
        headers: { accept: "text/html" }
      });
      expect(modulePage.status).toBe(201);
      expect(await modulePage.json()).toEqual({ path: pagePath });
    }
    expect(requests).toHaveLength(20);
  });

  it("rejects cross-site, forged Host and ambiguous paths before forwarding", async () => {
    let count = 0;
    upstream = http.createServer((_request, response) => {
      count++;
      response.end("ok");
    });
    gateway = await startDesktopLanGateway(await listen(upstream), 0);
    const origin = `http://127.0.0.1:${gateway.port}`;
    for (const headers of [
      { origin: "https://evil.example" },
      { "sec-fetch-site": "cross-site" },
      { host: `evil.example:${gateway.port}` },
      { host: "127.0.0.1:1" }
    ])
      expect(await rawStatus(`${origin}/api/v1/tools/audio-library/items`, headers)).toBe(403);
    for (const path of [
      "/api/v1/tools/media-archive%2f..%2fcomponents",
      "/api/v1/tools/media-archive/%252e%252e/components"
    ])
      expect((await fetch(origin + path)).status).toBe(403);
    for (const path of [
      "/api/v1/components",
      "/api/v1/diagnostics/actions",
      "/api/v1/session",
      "/api/v1/tools/image-ai-evil/tasks",
      "/settings/diagnostics"
    ])
      expect((await fetch(origin + path, { method: "POST" })).status).toBe(404);
    expect(count).toBe(0);
  });

  it("streams multipart uploads, Range media and task events through the actual fallback port", async () => {
    upstream = http.createServer((request, response) => {
      if (request.url?.endsWith("/events")) {
        response.writeHead(200, { "content-type": "text/event-stream" });
        response.end('data: {"progress":1}\n\n');
      } else if (request.headers.range) {
        response.writeHead(206, { "content-range": "bytes 1-3/5", "accept-ranges": "bytes" });
        response.end("bcd");
      } else {
        const chunks: Buffer[] = [];
        request.on("data", (chunk: Buffer) => chunks.push(chunk));
        request.on("end", () =>
          response.end(
            JSON.stringify({
              body: Buffer.concat(chunks).toString(),
              contentType: request.headers["content-type"],
              forwarded: request.headers["x-forwarded-for"],
              real: request.headers["x-real-ip"],
              origin: request.headers.origin
            })
          )
        );
      }
    });
    const upstreamOrigin = await listen(upstream);
    const occupiedPort = Number(new URL(upstreamOrigin).port);
    gateway = await startDesktopLanGateway(upstreamOrigin, occupiedPort);
    expect(gateway.port).not.toBe(occupiedPort);
    const origin = `http://127.0.0.1:${gateway.port}`;
    const form = new FormData();
    form.set("file", new Blob(["image-payload"]), "photo.png");
    const upload = await fetch(`${origin}/api/v1/tools/image-compress/tasks`, {
      method: "POST",
      body: form,
      headers: { origin, "x-forwarded-for": "8.8.8.8", "x-real-ip": "8.8.8.8" }
    });
    expect(await upload.json()).toMatchObject({
      contentType: expect.stringContaining("multipart/form-data"),
      body: expect.stringContaining("image-payload"),
      forwarded: "127.0.0.1"
    });
    const media = await fetch(`${origin}/api/v1/files/result.mp4`, { headers: { range: "bytes=1-3" } });
    expect(media.status).toBe(206);
    expect(media.headers.get("content-range")).toBe("bytes 1-3/5");
    expect(await media.text()).toBe("bcd");
    const events = await fetch(`${origin}/api/v1/tasks/task-123/events`);
    expect(events.headers.get("content-type")).toBe("text/event-stream");
    expect(await events.text()).toContain('data: {"progress":1}');
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

function rawStatus(url: string, headers: http.OutgoingHttpHeaders) {
  return new Promise<number | undefined>((resolve, reject) => {
    const request = http.request(url, { method: "POST", headers }, (response) => {
      response.resume();
      response.on("end", () => resolve(response.statusCode));
    });
    request.on("error", reject);
    request.end();
  });
}
