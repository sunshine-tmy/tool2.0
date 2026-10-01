/** 用隔离本机隧道验证 DNS 固定、鉴权、重定向目标复验和有界关闭，不连接在线平台。 */
import { once } from "node:events";
import { createServer, connect, type Socket } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserNetwork } from "../modules/media-archive/browser-network";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((close) => close()));
});
const publicAddress = { address: "93.184.216.34", family: 4 };
async function gateway(options: Parameters<typeof createBrowserNetwork>[0] = {}) {
  const network = await createBrowserNetwork({ resolver: async () => [publicAddress], ...options });
  cleanups.push(network.close);
  return network;
}
async function request(network: Awaited<ReturnType<typeof gateway>>, target: string, auth = true, method = "CONNECT") {
  const endpoint = new URL(network.proxy.server);
  const client = connect(Number(endpoint.port), endpoint.hostname);
  client.on("error", () => undefined);
  cleanups.push(async () => {
    client.destroy();
  });
  await once(client, "connect");
  const header = auth
    ? `Proxy-Authorization: Basic ${Buffer.from(`${network.proxy.username}:${network.proxy.password}`).toString("base64")}\r\n`
    : "";
  const response = new Promise<{ status: number; client: Socket }>((resolve, reject) => {
    let received = "";
    const timer = setTimeout(() => reject(new Error("测试隧道响应超时")), 1000);
    const data = (chunk: Buffer) => {
      received += chunk.toString();
      if (!received.includes("\r\n\r\n")) return;
      clearTimeout(timer);
      client.removeListener("data", data);
      resolve({ status: Number(received.split(" ")[1]), client });
    };
    client.on("data", data);
  });
  client.write(`${method} ${target} HTTP/1.1\r\nHost: ${target}\r\n${header}\r\n`);
  return response;
}
async function echoServer() {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("error", () => undefined);
    socket.once("close", () => sockets.delete(socket));
    socket.pipe(socket);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("测试服务监听失败");
  cleanups.push(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  return address.port;
}

describe("受管浏览器 DNS 固定 HTTPS 网关", () => {
  it("只在回环监听并要求临时代理令牌，未鉴权不能解析 DNS", async () => {
    const resolver = vi.fn(async () => [publicAddress]);
    const network = await gateway({ resolver });
    expect(new URL(network.proxy.server).hostname).toBe("127.0.0.1");
    expect(await request(network, "www.douyin.com:443", false)).toMatchObject({ status: 407 });
    expect(resolver).not.toHaveBeenCalled();
    expect(network.args).toContain("--disable-quic");
    expect(network.proxy.bypass).toBe("<-loopback>");
  });

  it.each([
    "localhost:443",
    "127.0.0.1:443",
    "www.douyin.com:80",
    "www.douyin.com:8080",
    "user@www.douyin.com:443",
    "www.douyin.com:443/path",
    "[::1]:443",
    "www.douyin.com%2f:443"
  ])("拒绝不安全 CONNECT 目标 %s", async (target) => {
    const dial = vi.fn();
    const network = await gateway({ dial });
    expect(await request(network, target)).toMatchObject({ status: 403 });
    expect(dial).not.toHaveBeenCalled();
  });

  it("DNS 返回任意私网地址时全部拒绝，不只挑选公网条目", async () => {
    const dial = vi.fn();
    const network = await gateway({
      resolver: async () => [publicAddress, { address: "192.168.1.1", family: 4 }],
      dial
    });
    expect(await request(network, "www.douyin.com:443")).toMatchObject({ status: 403 });
    expect(dial).not.toHaveBeenCalled();
  });

  it("连接消费已校验 IP，不把主机名交给第二次 DNS，并透明转发 TLS 字节", async () => {
    const port = await echoServer();
    const resolver = vi.fn(async () => [publicAddress]);
    const dial = vi.fn(() => connect(port, "127.0.0.1"));
    const network = await gateway({ resolver, dial });
    const { status, client } = await request(network, "www.douyin.com:443");
    expect(status).toBe(200);
    expect(resolver).toHaveBeenCalledOnce();
    expect(dial).toHaveBeenCalledWith(publicAddress);
    const received = once(client, "data");
    const bytes = Buffer.from([0x16, 0x03, 0x01, 0, 5, 1, 2, 3]);
    client.write(bytes);
    expect((await received)[0]).toEqual(bytes);
    expect(network.status()).toMatchObject({ established: 1, active: 1 });
    expect(JSON.stringify(network.status())).not.toContain(network.proxy.password);
  });

  it("后续同主机或重定向新主机的连接重新校验，DNS rebinding 到私网不建连", async () => {
    const port = await echoServer();
    const resolver = vi
      .fn()
      .mockResolvedValueOnce([publicAddress])
      .mockResolvedValue([{ address: "10.0.0.1", family: 4 }]);
    const dial = vi.fn(() => connect(port, "127.0.0.1"));
    const network = await gateway({ resolver, dial });
    expect(await request(network, "www.douyin.com:443")).toMatchObject({ status: 200 });
    expect(await request(network, "www.douyin.com:443")).toMatchObject({ status: 403 });
    expect(await request(network, "redirect.example.com:443")).toMatchObject({ status: 403 });
    expect(dial).toHaveBeenCalledOnce();
  });

  it("明文 HTTP 即使鉴权也不转发，防止降级时泄漏凭据", async () => {
    const dial = vi.fn();
    const network = await gateway({ dial });
    expect(await request(network, "http://www.douyin.com/", true, "GET")).toMatchObject({ status: 403 });
    expect(await request(network, "http://www.douyin.com/", false, "GET")).toMatchObject({ status: 407 });
    expect(dial).not.toHaveBeenCalled();
  });

  it("并发额度有界，关闭能终止活动隧道且可重复调用", async () => {
    const port = await echoServer();
    const network = await gateway({ dial: () => connect(port, "127.0.0.1"), maxConnections: 1 });
    const first = await request(network, "www.douyin.com:443");
    expect(first.status).toBe(200);
    expect(await request(network, "cdn.example.com:443")).toMatchObject({ status: 429 });
    const closed = once(first.client, "close");
    await network.close();
    await closed;
    await network.close();
    expect(network.status().active).toBe(0);
  });

  it("关闭时不会等待挂起 DNS，解析稍后完成也不再建连", async () => {
    let finish!: (value: (typeof publicAddress)[]) => void;
    const resolver = vi.fn(
      () =>
        new Promise<(typeof publicAddress)[]>((resolve) => {
          finish = resolve;
        })
    );
    const dial = vi.fn();
    const network = await gateway({ resolver, dial });
    const endpoint = new URL(network.proxy.server);
    const client = connect(Number(endpoint.port), endpoint.hostname);
    cleanups.push(async () => {
      client.destroy();
    });
    await once(client, "connect");
    client.write(
      `CONNECT www.douyin.com:443 HTTP/1.1\r\nProxy-Authorization: Basic ${Buffer.from(`${network.proxy.username}:${network.proxy.password}`).toString("base64")}\r\n\r\n`
    );
    await vi.waitFor(() => expect(resolver).toHaveBeenCalled());
    await network.close();
    finish([publicAddress]);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(dial).not.toHaveBeenCalled();
  });

  it("拨号错误及 DNS 错误不泄漏底层地址或凭据", async () => {
    const network = await gateway({
      resolver: async () => {
        throw new Error("secret DNS error");
      }
    });
    expect(await request(network, "www.douyin.com:443")).toMatchObject({ status: 403 });
    expect(network.status().rejected).toBe(1);
    const throwing = await gateway({
      dial: () => {
        throw new Error("secret connection error");
      }
    });
    expect(await request(throwing, "www.douyin.com:443")).toMatchObject({ status: 403 });
  });

  it.each([{ maxConnections: 0 }, { maxConnections: 257 }, { timeoutMs: 0 }, { timeoutMs: 600001 }])(
    "拒绝无效网络额度 %o",
    async (options) => {
      await expect(gateway(options)).rejects.toThrow("额度无效");
    }
  );
});
