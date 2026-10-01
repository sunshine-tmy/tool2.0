/**
 * 中文模块说明：测试 backend/src/__tests__/remote-fetch.test.ts 中的稳定行为、边界条件和回归场景
 */
import { describe, expect, it, vi } from "vitest";
import { once } from "node:events";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { connect as openTcpConnection } from "node:net";
import type { Duplex } from "node:stream";
import { fetch as undiciFetch } from "undici";
import {
  assertPublicRemoteUrl,
  createPinnedDispatcher,
  createPinnedLookup,
  createRemoteFetch,
  fetchRemoteResponse,
  limitedResponseStream
} from "../security/remote-fetch";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";

const publicResolver = async () => [{ address: "93.184.216.34", family: 4 }];

function createConnectProxy(destinationPort: number) {
  const connectedTargets: string[] = [];
  const sockets = new Set<Duplex>();
  const server = createServer();
  server.on("connection", (socket) => sockets.add(socket));
  server.on("connect", (request, clientSocket, head) => {
    connectedTargets.push(request.url ?? "");
    const upstream = openTcpConnection(destinationPort, "127.0.0.1");
    sockets.add(clientSocket);
    sockets.add(upstream);
    upstream.once("connect", () => {
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      clientSocket.pipe(upstream);
      upstream.pipe(clientSocket);
    });
    upstream.on("error", () => clientSocket.destroy());
    clientSocket.on("error", () => upstream.destroy());
  });
  return { connectedTargets, server, sockets };
}

async function closeTestServer(server: Server, sockets: Set<Duplex>) {
  for (const socket of sockets) socket.destroy();
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe("safe remote fetch", () => {
  it("returns the Node 24 lookup shape for scalar and all-address callbacks", () => {
    const lookup = createPinnedLookup(new Map([["media.example", { address: "93.184.216.34", family: 4 }]]));
    const callback = vi.fn();

    lookup("media.example", { all: true }, callback);
    expect(callback).toHaveBeenLastCalledWith(null, [{ address: "93.184.216.34", family: 4 }], 4);

    lookup("media.example", { all: false }, callback);
    expect(callback).toHaveBeenLastCalledWith(null, "93.184.216.34", 4);
  });

  it("connects to the pinned TCP address while preserving the original HTTP host", async () => {
    let observedHost: string | undefined;
    const server = createServer((request, response) => {
      observedHost = request.headers.host;
      response.end("pinned");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Local test server did not bind a TCP port");
    const dispatcher = createPinnedDispatcher(new Map([["pinned.example", { address: "127.0.0.1", family: 4 }]]));

    try {
      const response = await undiciFetch(`http://pinned.example:${address.port}/resource`, { dispatcher });
      await expect(response.text()).resolves.toBe("pinned");
      expect(observedHost).toBe(`pinned.example:${address.port}`);
    } finally {
      await dispatcher.close();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("rejects a private DNS answer before the production pinned dispatcher can send a request", async () => {
    const resolver = vi.fn(async () => [{ address: "127.0.0.1", family: 4 }]);
    const remoteFetch = createRemoteFetch({ resolver });

    await expect(remoteFetch("http://media.example/resource")).rejects.toThrow(/private or reserved/i);
    expect(resolver).toHaveBeenCalledWith("media.example");
  });

  it.each([
    "http://127.0.0.1/resource",
    "http://192.88.99.1/resource",
    "http://10.0.0.1/resource",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/resource",
    "http://[::ffff:192.168.1.1]/resource",
    "http://localhost/resource",
    "http://user:password@example.com/resource",
    "http://example.com:8080/resource"
  ])("rejects private or unsafe target %s", async (value) => {
    await expect(assertPublicRemoteUrl(new URL(value), publicResolver)).rejects.toThrow();
  });

  it.each([
    "http://[::ffff:c0a8:0101]/resource",
    "http://[64:ff9b::c0a8:0101]/resource",
    "http://[64:ff9b:1::c0a8:0101]/resource",
    "http://[100::1]/resource",
    "http://[2001::1]/resource",
    "http://[2002:c0a8:0101::1]/resource",
    "http://[3fff::1]/resource",
    "http://[5f00::1]/resource"
  ])("rejects special-purpose IPv6 target %s", async (value) => {
    await expect(assertPublicRemoteUrl(new URL(value), publicResolver)).rejects.toThrow();
  });

  it("allows an ordinary global-unicast IPv6 address and rejects mapped private DNS answers", async () => {
    await expect(assertPublicRemoteUrl(new URL("https://[2606:4700:4700::1111]/resource"))).resolves.toBeUndefined();
    await expect(
      assertPublicRemoteUrl(new URL("https://media.example/resource"), async () => [
        { address: "::ffff:c0a8:0101", family: 6 }
      ])
    ).rejects.toThrow(/private or reserved/i);
  });

  it("parses IPv6 DNS answers with dotted tails, expanded groups and interface scope safely", async () => {
    const resolver = vi.fn(async (hostname: string) => {
      if (hostname === "dotted.example") return [{ address: "2606:4700::192.0.2.1", family: 6 }];
      if (hostname === "expanded.example") return [{ address: "2606:4700:4700:0:0:0:0:1111", family: 6 }];
      return [{ address: "fe80::1%eth0", family: 6 }];
    });

    await expect(assertPublicRemoteUrl(new URL("https://dotted.example/resource"), resolver)).resolves.toBeUndefined();
    await expect(
      assertPublicRemoteUrl(new URL("https://expanded.example/resource"), resolver)
    ).resolves.toBeUndefined();
    await expect(assertPublicRemoteUrl(new URL("https://scoped.example/resource"), resolver)).rejects.toThrow(
      /private or reserved/i
    );
  });

  it("rejects hostnames when DNS returns any private address", async () => {
    await expect(
      assertPublicRemoteUrl(new URL("https://media.example/video.mp4"), async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "192.168.1.5", family: 4 }
      ])
    ).rejects.toThrow(/private or reserved/i);
  });

  it("revalidates every redirect target", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }));
    const remoteFetch = createRemoteFetch({ resolver: publicResolver, fetchImpl });

    await expect(remoteFetch("https://media.example/video.mp4")).rejects.toThrow(/private|local/i);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("resolves each redirect hostname before connecting", async () => {
    const resolver = vi.fn(async (hostname: string) => {
      if (hostname === "media.example" || hostname === "cdn.example") {
        return [{ address: "93.184.216.34", family: 4 }];
      }
      throw new Error(`unexpected hostname: ${hostname}`);
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "https://cdn.example/video.mp4" } })
      )
      .mockResolvedValueOnce(new Response("media"));
    const remoteFetch = createRemoteFetch({ resolver, fetchImpl });

    await expect(remoteFetch("https://media.example/video.mp4")).resolves.toMatchObject({ status: 200 });
    expect(resolver).toHaveBeenNthCalledWith(1, "media.example");
    expect(resolver).toHaveBeenNthCalledWith(2, "cdn.example");
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://cdn.example/video.mp4",
      expect.objectContaining({ redirect: "manual" })
    );
  });

  it("validates each real HTTP redirect hop before forwarding through the configured proxy", async () => {
    const origin = createServer((request, response) => {
      response.setHeader("connection", "close");
      if (request.headers.host === "origin.example") {
        response.writeHead(302, { location: "http://cdn.example/final.mp4" });
        response.end();
        return;
      }
      response.end("downloaded");
    });
    const originSockets = new Set<Duplex>();
    origin.on("connection", (socket) => originSockets.add(socket));
    origin.listen(0, "127.0.0.1");
    await once(origin, "listening");

    const originAddress = origin.address();
    if (!originAddress || typeof originAddress === "string") throw new Error("Local origin did not bind a TCP port");
    const proxy = createConnectProxy(originAddress.port);
    proxy.server.listen(0, "127.0.0.1");
    await once(proxy.server, "listening");

    const address = proxy.server.address();
    if (!address || typeof address === "string") throw new Error("Local proxy did not bind a TCP port");
    const resolver = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);
    const remoteFetch = createRemoteFetch({
      resolver,
      proxyUrl: `http://127.0.0.1:${address.port}`
    });

    try {
      const response = await remoteFetch("http://origin.example/video.mp4");
      await expect(response.text()).resolves.toBe("downloaded");
      expect(proxy.connectedTargets).toEqual(["origin.example:80", "cdn.example:80"]);
      expect(resolver).toHaveBeenNthCalledWith(1, "origin.example");
      expect(resolver).toHaveBeenNthCalledWith(2, "cdn.example");
    } finally {
      await Promise.all([closeTestServer(proxy.server, proxy.sockets), closeTestServer(origin, originSockets)]);
    }
  });

  it("does not establish a second real proxy tunnel after a redirect to a private address", async () => {
    let requestCount = 0;
    const origin = createServer((_request, response) => {
      requestCount += 1;
      response.setHeader("connection", "close");
      response.writeHead(302, { location: "http://127.0.0.1/admin" });
      response.end();
    });
    const originSockets = new Set<Duplex>();
    origin.on("connection", (socket) => originSockets.add(socket));
    origin.listen(0, "127.0.0.1");
    await once(origin, "listening");

    const originAddress = origin.address();
    if (!originAddress || typeof originAddress === "string") throw new Error("Local origin did not bind a TCP port");
    const proxy = createConnectProxy(originAddress.port);
    proxy.server.listen(0, "127.0.0.1");
    await once(proxy.server, "listening");

    const address = proxy.server.address();
    if (!address || typeof address === "string") throw new Error("Local proxy did not bind a TCP port");
    const remoteFetch = createRemoteFetch({
      resolver: publicResolver,
      proxyUrl: `http://127.0.0.1:${address.port}`
    });

    try {
      await expect(remoteFetch("http://origin.example/video.mp4")).rejects.toThrow(/private|local/i);
      expect(requestCount).toBe(1);
      expect(proxy.connectedTargets).toEqual(["origin.example:80"]);
    } finally {
      await Promise.all([closeTestServer(proxy.server, proxy.sockets), closeTestServer(origin, originSockets)]);
    }
  });

  it("rejects an HTTPS downgrade on a redirect when the caller requires HTTPS", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://cdn.example/file" } }));
    const remoteFetch = createRemoteFetch({ resolver: publicResolver, fetchImpl, requireHttps: true });

    await expect(remoteFetch("https://github.com/example/tool/releases/download/v1/file.zip")).rejects.toThrow(
      /HTTPS is required/
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("follows bounded HTTPS redirects when HTTPS is required", async () => {
    const resolver = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://cdn.example/file" } }))
      .mockResolvedValueOnce(new Response("asset"));
    const remoteFetch = createRemoteFetch({ resolver, fetchImpl, requireHttps: true });

    await expect(remoteFetch("https://github.com/example/tool/releases/download/v1/file.zip")).resolves.toMatchObject({
      status: 200
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(resolver).toHaveBeenNthCalledWith(2, "cdn.example");
  });

  it("stops a redirect chain after the configured limit", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 302, headers: { location: "/next" } }));
    const remoteFetch = createRemoteFetch({ resolver: publicResolver, fetchImpl, requireHttps: true, maxRedirects: 1 });

    await expect(remoteFetch("https://github.com/example/tool/releases/download/v1/file.zip")).rejects.toThrow(
      /redirect limit/
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("uses the timeout only until remote response headers arrive", async () => {
    let requestSignal: AbortSignal | undefined;
    const response = await fetchRemoteResponse(
      async (_url, init) => {
        requestSignal = init?.signal ?? undefined;
        return new Response("media");
      },
      "https://media.example/video.mp4",
      {},
      10
    );

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(requestSignal?.aborted).toBe(false);
    await expect(response.text()).resolves.toBe("media");
  });

  it("forwards aborted remote body errors to the capped stream", async () => {
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("partial"));
          queueMicrotask(() => controller.error(new DOMException("The operation timed out", "TimeoutError")));
        }
      })
    );
    await expect(
      pipeline(
        limitedResponseStream(response, 1024),
        new Writable({
          write(_chunk, _encoding, callback) {
            callback();
          }
        })
      )
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });
});
