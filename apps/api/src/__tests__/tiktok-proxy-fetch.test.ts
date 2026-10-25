import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ destroy: vi.fn(), request: vi.fn(), fetch: vi.fn(), agents: vi.fn() }));
vi.mock("undici", () => ({
  ProxyAgent: class {
    constructor(options: unknown) {
      mocks.agents(options);
    }
    destroy() {
      mocks.destroy();
      return Promise.resolve();
    }
  },
  request: mocks.request,
  fetch: mocks.fetch
}));
import {
  createPinnedTikTokProxyFetch,
  resolveProxyPublicAddress
} from "../domains/content-archive/providers/tiktok/proxy-fetch";

const proxy = "http://127.0.0.1:7897/";
const address = { address: "93.184.216.34", family: 4 };
afterEach(() => vi.clearAllMocks());
function remoteResponse(status = 200, headers: Record<string, string> = {}, bytes = Buffer.from("ok")) {
  const body = Readable.from([bytes]);
  return { statusCode: status, headers, body };
}
describe("TikTok pinned proxy transport", () => {
  it("pins the CONNECT target while preserving TLS SNI/Host and removing credentials", async () => {
    const resolver = vi.fn().mockResolvedValue([address]);
    mocks.request.mockResolvedValue(remoteResponse(200, { "content-type": "text/plain" }));
    const response = await createPinnedTikTokProxyFetch(proxy, { resolver })("https://www.tiktok.com/work?q=1", {
      headers: { cookie: "secret", authorization: "secret", "proxy-authorization": "secret" }
    });
    expect(response.url).toBe("https://www.tiktok.com/work?q=1");
    expect(await response.text()).toBe("ok");
    const [target, init] = mocks.request.mock.calls[0];
    expect(String(target)).toBe("https://93.184.216.34/work?q=1");
    expect(init.headers).toEqual({ host: "www.tiktok.com", "accept-encoding": "identity" });
    expect(mocks.agents).toHaveBeenCalledWith({ uri: proxy, requestTls: { servername: "www.tiktok.com" } });
    expect(mocks.destroy).toHaveBeenCalledTimes(1);
  });
  it("decodes a compressed response and disposes cancelled, aborted and failed streams", async () => {
    const remote = createPinnedTikTokProxyFetch(proxy, { resolver: async () => [address] });
    mocks.request.mockResolvedValueOnce(remoteResponse(200, { "content-encoding": "gzip" }, gzipSync("decoded")));
    expect(await (await remote("https://www.tiktok.com/")).text()).toBe("decoded");
    const pending = new Readable({ read() {} });
    mocks.request.mockResolvedValueOnce({ statusCode: 200, headers: {}, body: pending });
    const controller = new AbortController();
    const response = await remote("https://www.tiktok.com/", { signal: controller.signal });
    const read = response.text();
    controller.abort();
    await expect(read).rejects.toBeDefined();
    expect(pending.destroyed).toBe(true);
    mocks.request.mockResolvedValueOnce(remoteResponse());
    await (await remote("https://www.tiktok.com/")).body!.cancel();
    mocks.request.mockRejectedValueOnce(new Error("connect failed"));
    await expect(remote("https://www.tiktok.com/")).rejects.toThrow("connect failed");
    expect(mocks.destroy).toHaveBeenCalledTimes(4);
  });
  it("validates every redirect, rejects private/downgraded targets and cancels redirect bodies", async () => {
    const resolver = vi.fn(async (host: string) => [
      { ...address, address: host === "bad.test" ? "127.0.0.1" : address.address }
    ]);
    const fetchPinned = vi.fn(
      async () => new Response("redirect", { status: 302, headers: { location: "https://bad.test/" } })
    );
    const remote = createPinnedTikTokProxyFetch(proxy, { resolver, fetchPinned });
    await expect(remote("https://www.tiktok.com/")).rejects.toThrow("private or reserved");
    expect(fetchPinned).toHaveBeenCalledTimes(1);
    fetchPinned.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "http://www.tiktok.com/" } })
    );
    await expect(remote("https://www.tiktok.com/")).rejects.toThrow("HTTPS");
    for (const url of ["https://user:pass@www.tiktok.com/", "https://www.tiktok.com:8443/", "https://127.0.0.1/"])
      await expect(remote(url)).rejects.toThrow();
  });
  it("keeps validated addresses private to each concurrent request and supports public literal IPs", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const resolver = vi
      .fn()
      .mockImplementationOnce(async () => {
        await gate;
        return [address];
      })
      .mockResolvedValueOnce([{ address: "1.1.1.1", family: 4 }]);
    const fetchPinned = vi.fn(async (_url: URL, _address: { address: string; family: number }) => new Response("ok"));
    const remote = createPinnedTikTokProxyFetch(proxy, { resolver, fetchPinned });
    const first = remote("https://www.tiktok.com/first");
    await remote("https://www.tiktok.com/second");
    release();
    await first;
    expect(fetchPinned.mock.calls.map((call) => call[1].address)).toEqual(["1.1.1.1", address.address]);
    await remote("https://8.8.8.8/");
    expect(fetchPinned.mock.calls.at(-1)?.[1]).toEqual({ address: "8.8.8.8", family: 4 });
  });
  it("bounds redirects and aborts before resolving a cancelled request", async () => {
    const resolver = vi.fn().mockResolvedValue([address]);
    const remote = createPinnedTikTokProxyFetch(proxy, {
      resolver,
      fetchPinned: async () => new Response(null, { status: 302, headers: { location: "/again" } })
    });
    await expect(remote("https://www.tiktok.com/")).rejects.toThrow("redirect limit");
    const controller = new AbortController();
    controller.abort();
    resolver.mockClear();
    await expect(remote("https://www.tiktok.com/", { signal: controller.signal })).rejects.toBeDefined();
    expect(resolver).not.toHaveBeenCalled();
  });
});
describe("proxy-side public DNS", () => {
  it("uses bounded HTTPS DNS without automatic redirects and releases the dispatcher", async () => {
    mocks.fetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          Status: 0,
          Answer: [
            { type: 5, data: "alias" },
            { type: 1, data: address.address }
          ]
        })
      )
    );
    expect(await resolveProxyPublicAddress("www.tiktok.com", proxy)).toEqual([address]);
    expect(mocks.fetch.mock.calls[0][0]).toBe("https://1.1.1.1/dns-query?name=www.tiktok.com&type=A");
    expect(mocks.fetch.mock.calls[0][1].redirect).toBe("error");
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
  it.each([
    { Status: 2 },
    { Status: 0, Answer: [] },
    { Status: 0, Answer: [{ type: 1, data: "127.0.0.1" }] },
    {
      Status: 0,
      Answer: [
        { type: 1, data: address.address },
        { type: 1, data: "10.0.0.1" }
      ]
    },
    { Status: 0, Answer: [{ type: 1, data: "not-an-ip" }] }
  ])("rejects invalid or nonpublic DNS results: %j", async (data) => {
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify(data)));
    await expect(resolveProxyPublicAddress("www.tiktok.com", proxy)).rejects.toThrow();
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
  it("bounds malformed/oversized/error DNS responses", async () => {
    for (const response of [
      new Response("bad"),
      new Response("x".repeat(65537)),
      new Response("failed", { status: 503 })
    ]) {
      mocks.fetch.mockResolvedValueOnce(response);
      await expect(resolveProxyPublicAddress("www.tiktok.com", proxy)).rejects.toThrow();
    }
    expect(mocks.destroy).toHaveBeenCalledTimes(3);
  });
});
