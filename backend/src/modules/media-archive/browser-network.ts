/** 受管浏览器的 HTTPS 隧道：每个连接独立校验 DNS，并直连已验证 IP，保留原 TLS Host/SNI。 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { createServer, type IncomingMessage } from "node:http";
import { connect, type Socket } from "node:net";
import type { Duplex } from "node:stream";
import { assertPublicRemoteUrl, type AddressResolver, type ResolvedAddress } from "../../security/remote-fetch";

export async function createBrowserNetwork(
  options: {
    resolver?: AddressResolver;
    dial?: (address: ResolvedAddress) => Socket;
    maxConnections?: number;
    timeoutMs?: number;
  } = {}
) {
  const resolver = options.resolver ?? ((host) => lookup(host, { all: true, verbatim: true }));
  const dial = options.dial ?? ((address) => connect({ host: address.address, family: address.family, port: 443 }));
  const maxConnections = options.maxConnections ?? 128;
  const timeoutMs = options.timeoutMs ?? 120_000;
  if (
    !Number.isSafeInteger(maxConnections) ||
    maxConnections < 1 ||
    maxConnections > 256 ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 600_000
  )
    throw new Error("浏览器网络额度无效");
  const username = randomBytes(16).toString("hex");
  const password = randomBytes(32).toString("hex");
  const expectedAuth = Buffer.from(`Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`);
  const sockets = new Set<Duplex>();
  const metrics = { established: 0, challenged: 0, rejected: 0, failed: 0 };
  let active = 0;
  let stopped = false;
  const authenticated = (request: IncomingMessage) => {
    const value = request.headers["proxy-authorization"];
    if (typeof value !== "string") return false;
    const actual = Buffer.from(value);
    return actual.length === expectedAuth.length && timingSafeEqual(actual, expectedAuth);
  };
  const server = createServer({ maxHeaderSize: 8192 }, (request, response) => {
    // 明文 HTTP 不转发，因此 Cookie/登录信息不会在降级链接中泄漏。
    const status = authenticated(request) ? 403 : 407;
    if (status === 407) response.setHeader("Proxy-Authenticate", 'Basic realm="local-archive"');
    response.writeHead(status, { Connection: "close" });
    response.end();
    if (status === 407) metrics.challenged++;
    else metrics.rejected++;
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.setTimeout(timeoutMs, () => socket.destroy());
    socket.on("error", () => undefined);
    socket.once("close", () => sockets.delete(socket));
  });
  server.on("clientError", (_error, socket) => socket.destroy());
  const reject = (socket: Duplex, status: number) => {
    if (status === 407) metrics.challenged++;
    else metrics.rejected++;
    socket.end(
      `HTTP/1.1 ${status} Rejected\r\n${status === 407 ? 'Proxy-Authenticate: Basic realm="local-archive"\r\n' : ""}Connection: close\r\nContent-Length: 0\r\n\r\n`
    );
  };
  const tunnel = async (request: IncomingMessage, client: Duplex, head: Buffer) => {
    if (!authenticated(request)) return reject(client, 407);
    if (stopped || active >= maxConnections) return reject(client, 429);
    let target: URL;
    try {
      // CONNECT 只接受明确的 hostname:443，不允许路径、凭据、编码绕过或非 TLS 端口。
      if (!request.url || !/^[a-zA-Z0-9.-]+:443$/.test(request.url)) throw new Error("invalid target");
      target = new URL(`https://${request.url}`);
    } catch {
      return reject(client, 403);
    }
    active++;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        active--;
      }
    };
    client.once("close", release);
    let upstream: Socket | undefined;
    const timeout = setTimeout(() => {
      upstream?.destroy();
      client.destroy();
      release();
    }, timeoutMs);
    timeout.unref();
    try {
      // 不共享 hostname→IP 表。校验和 connect 消费同一份地址，DNS rebinding 无第二次解析机会。
      const addresses = await resolver(target.hostname);
      await assertPublicRemoteUrl(target, async () => addresses, true);
      if (stopped || client.destroyed) return;
      // 全部地址仍需通过校验；优先 IPv4，避免仅有 DNS 的 IPv6 在部分本机环境无法建连。
      upstream = dial(addresses.find((address) => address.family === 4) ?? addresses[0]);
      sockets.add(upstream);
      const remote = upstream;
      remote.setTimeout(timeoutMs, () => remote.destroy());
      remote.once("close", () => {
        sockets.delete(remote);
        clearTimeout(timeout);
        client.destroy();
        release();
      });
      remote.on("error", () => {
        metrics.failed++;
        client.destroy();
      });
      client.once("close", () => remote.destroy());
      remote.once("connect", () => {
        if (stopped || client.destroyed) return remote.destroy();
        metrics.established++;
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) remote.write(head);
        // 隧道不解密 TLS、不记录请求路径或 Cookie，原主机证书校验由 Chromium 完成。
        client.pipe(remote);
        remote.pipe(client);
      });
    } catch {
      reject(client, 403);
    } finally {
      if (!upstream) {
        clearTimeout(timeout);
        release();
      }
    }
  };
  server.on("connect", (request, client, head) => {
    void tunnel(request, client, head).catch(() => {
      metrics.failed++;
      client.destroy();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("浏览器网络监听失败");
  let closePromise: Promise<void> | undefined;
  return {
    proxy: { server: `http://127.0.0.1:${address.port}`, username, password, bypass: "<-loopback>" },
    // 禁止 QUIC/WebRTC 直连绕过代理；协议和 DNS 策略不是仅靠 page.route 的预检。
    args: ["--disable-quic", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"],
    status: () => ({ ...metrics, active }),
    close: () =>
      (closePromise ??= (async () => {
        stopped = true;
        const closing = [...sockets].map(
          (socket) =>
            new Promise<void>((resolve) => {
              if (socket.closed) return resolve();
              socket.once("close", resolve);
              socket.destroy();
            })
        );
        // 未完成 DNS 解析不能阻塞关闭；解析回来后 stopped 阻止建立任何新连接。
        await Promise.all(closing);
        await new Promise<void>((resolve) => server.close(() => resolve()));
      })())
  };
}
