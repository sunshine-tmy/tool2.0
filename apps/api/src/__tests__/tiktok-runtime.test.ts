import { describe, expect, it, vi } from "vitest";
import { TikTokRuntime } from "../domains/content-archive/providers/tiktok/runtime";
import {
  normalizeTikTokProxy,
  resolveTikTokProxy,
  windowsTikTokProxy
} from "../domains/content-archive/providers/tiktok/transport";

const id = "7700458638191627540";
const canonical = `https://www.tiktok.com/@shop/photo/${id}`;
const payload = {
  id,
  desc: "商品",
  author: { uniqueId: "shop" },
  imagePost: { images: [1, 2, 3].map((i) => ({ imageURL: { urlList: [`https://p16.tiktokcdn-us.com/${i}.webp`] } })) }
};
const page = (item: unknown) =>
  `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">${JSON.stringify({ __DEFAULT_SCOPE__: { "webapp.video-detail": { statusCode: 0, itemInfo: { itemStruct: item } } } })}</script>`;
function response(body: string, url = canonical, status = 200, headers: Record<string, string> = {}) {
  return Object.defineProperty(new Response(body, { status, headers }), "url", { value: url });
}

describe("TikTok anonymous runtime", () => {
  it("resolves a photo short link, reads the public work detail and preserves image order", async () => {
    const remote = vi
      .fn()
      .mockResolvedValueOnce(
        response('<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">{"__DEFAULT_SCOPE__":{}}</script>')
      )
      .mockResolvedValueOnce(response(page(payload), canonical.replace("/photo/", "/video/")));
    const runtime = new TikTokRuntime({ remoteFetch: remote });
    expect(await runtime.status()).toMatchObject({ available: true, state: "ready" });
    const result = await runtime.extract("https://vt.tiktok.com/ZSgQrHRPU/", new AbortController().signal);
    expect(result.contentId).toBe(id);
    expect(result.media.map((m) => m.urls[0])).toEqual([1, 2, 3].map((n) => `https://p16.tiktokcdn-us.com/${n}.webp`));
    expect(remote.mock.calls[1][0]).toBe(canonical.replace("/photo/", "/video/"));
    expect(remote.mock.calls[0][1].headers).not.toHaveProperty("cookie");
    await runtime.close();
    expect(await runtime.status()).toMatchObject({ available: false, state: "stopped" });
    await expect(runtime.extract(canonical, new AbortController().signal)).rejects.toMatchObject({
      code: "TIKTOK_RUNTIME_STOPPED"
    });
  });
  it.each([401, 403, 404, 410, 451, 429, 503])("does not retry access-denied or failed pages: %s", async (status) => {
    const remote = vi.fn().mockResolvedValue(response("restricted", canonical, status));
    const runtime = new TikTokRuntime({ remoteFetch: remote });
    await expect(runtime.extract(canonical, new AbortController().signal)).rejects.toMatchObject({
      code:
        status === 429 ? "TIKTOK_RATE_LIMITED" : status === 503 ? "TIKTOK_NETWORK_ERROR" : "TIKTOK_CONTENT_UNAVAILABLE"
    });
    expect(remote).toHaveBeenCalledTimes(1);
    await runtime.close();
  });
  it("fails once when a public item has metadata but no video, without probing synthesized playback URLs", async () => {
    const remote = vi.fn().mockResolvedValue(
      response(
        page({
          id,
          author: { uniqueId: "shop" },
          video: {
            playAddr: "",
            downloadAddr: "",
            videoID: "not-a-download-address",
            cover: "https://p16.tiktokcdn-us.com/cover.jpg"
          }
        }),
        canonical.replace("/photo/", "/video/")
      )
    );
    const runtime = new TikTokRuntime({ remoteFetch: remote });
    await expect(
      runtime.extract(canonical.replace("/photo/", "/video/"), new AbortController().signal)
    ).rejects.toMatchObject({
      code: "TIKTOK_MEDIA_INVALID",
      message: expect.stringContaining("普通浏览器")
    });
    expect(remote).toHaveBeenCalledTimes(1);
    expect(runtime.isActive()).toBe(false);
    await runtime.close();
  });
  it("rejects redirected identities and login destinations before accepting any data", async () => {
    for (const url of ["https://www.tiktok.com/login", canonical.replace(id, "7700596613189963029")]) {
      const runtime = new TikTokRuntime({ remoteFetch: vi.fn().mockResolvedValue(response(page(payload), url)) });
      await expect(runtime.extract(canonical, new AbortController().signal)).rejects.toMatchObject({
        code: "TIKTOK_URL_INVALID"
      });
      await runtime.close();
    }
  });
  it("cancels and closes promptly even when an injected transport ignores abort", async () => {
    const remote = vi.fn(() => new Promise<Response>(() => undefined));
    const runtime = new TikTokRuntime({ remoteFetch: remote });
    const controller = new AbortController();
    const operation = runtime.extract(canonical, controller.signal);
    expect(runtime.isActive()).toBe(true);
    const failure = expect(operation).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await failure;
    const second = runtime.extract(canonical, new AbortController().signal);
    const stopped = expect(second).rejects.toMatchObject({ code: "TIKTOK_RUNTIME_STOPPED" });
    await runtime.close();
    await stopped;
    expect(runtime.isActive()).toBe(false);
  });
  it("enforces request deadlines, page bounds, public data and safe error messages", async () => {
    const runtime = new TikTokRuntime({
      timeoutMs: 5,
      remoteFetch: vi.fn(() => new Promise<Response>(() => undefined))
    });
    await expect(runtime.extract(canonical, new AbortController().signal)).rejects.toMatchObject({
      code: "TIKTOK_REQUEST_TIMEOUT"
    });
    await runtime.close();
    for (const remote of [
      vi.fn().mockRejectedValue(new Error("SECRET proxy password")),
      vi.fn().mockResolvedValue(response("x", canonical, 200, { "content-length": String(5 * 1024 * 1024) })),
      vi.fn().mockResolvedValue(response("captcha without data"))
    ]) {
      const instance = new TikTokRuntime({ remoteFetch: remote });
      await expect(instance.extract(canonical, new AbortController().signal)).rejects.not.toThrow("SECRET");
      await instance.close();
    }
  });
});

describe("TikTok proxy selection", () => {
  it("respects explicit, environment, Windows system and direct selection without mutating settings", async () => {
    const readSystem = vi.fn().mockResolvedValue("http=127.0.0.1:7001;https=127.0.0.1:7002");
    expect(
      await resolveTikTokProxy({
        explicit: "http://127.0.0.1:7003",
        environment: { HTTPS_PROXY: "http://127.0.0.1:7004" },
        readSystem
      })
    ).toBe("http://127.0.0.1:7003/");
    expect(await resolveTikTokProxy({ explicit: "direct", readSystem })).toBeUndefined();
    expect(readSystem).not.toHaveBeenCalled();
    expect(await resolveTikTokProxy({ environment: { HTTPS_PROXY: "http://127.0.0.1:7004" }, readSystem })).toBe(
      "http://127.0.0.1:7004/"
    );
    expect(await resolveTikTokProxy({ platform: "win32", environment: {}, readSystem })).toBe("http://127.0.0.1:7002/");
    expect(await resolveTikTokProxy({ platform: "darwin", environment: {}, readSystem })).toBeUndefined();
    expect(windowsTikTokProxy("127.0.0.1:7897")).toBe("http://127.0.0.1:7897/");
  });
  it.each([
    "socks5://127.0.0.1:7897",
    "http://user:password@127.0.0.1:7897",
    "http://127.0.0.1:7897/path",
    "http://127.0.0.1:7897/?secret=x",
    "invalid"
  ])("rejects unsupported proxies without exposing credentials: %s", (proxy) => {
    expect(() => normalizeTikTokProxy(proxy)).toThrow("TikTok 代理配置无效");
  });
});
