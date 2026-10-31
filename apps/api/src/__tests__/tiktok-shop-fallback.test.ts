import { afterEach, describe, expect, it, vi } from "vitest";
import { TikTokShopFallback } from "../domains/content-archive/providers/tiktok/shop-fallback";
import { createRemoteFetch } from "../security/remote-fetch";

const id = "7702068910153141505";
const canonical = `https://www.tiktok.com/@shop/video/${id}`;
const api = "https://www.tikwm.com/api/";
const video = "https://v16.tiktokcdn-us.com/video.mp4";
const ok = (data: object = { id, play: video }) => ({ code: 0, data });
function response(value: unknown, status = 200, url = api, headers: Record<string, string> = {}) {
  return Object.defineProperty(
    new Response(typeof value === "string" ? value : JSON.stringify(value), { status, headers }),
    "url",
    { value: url }
  );
}
const signal = () => new AbortController().signal;
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("TikTok shop fallback", () => {
  it("uses a fixed endpoint, deduplicates HD candidates and sends no credentials", async () => {
    const remote = vi
      .fn()
      .mockResolvedValue(response(ok({ id, hdplay: video, play: video, music: "https://evil.test/audio" })));
    expect(await new TikTokShopFallback(remote).resolveVideo(canonical, id, signal())).toEqual([video]);
    const url = new URL(remote.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe(api);
    expect([...url.searchParams]).toEqual([
      ["url", canonical],
      ["hd", "1"]
    ]);
    expect(remote.mock.calls[0][1].headers).toEqual({ accept: "application/json", "user-agent": "Mozilla/5.0" });
    const alternatives = new TikTokShopFallback(
      vi.fn().mockResolvedValue(response(ok({ id, hdplay: video, play: video + "?backup=1" })))
    );
    expect(await alternatives.resolveVideo(canonical, id, signal())).toEqual([video, video + "?backup=1"]);
  });
  it.each(["123456", Number(id), null])("rejects an unrelated or imprecise work identity: %s", async (other) => {
    const remote = vi.fn().mockResolvedValue(response(ok({ id: other, play: video })));
    await expect(new TikTokShopFallback(remote).resolveVideo(canonical, id, signal())).rejects.toMatchObject({
      code: "TIKTOK_IDENTITY_MISMATCH"
    });
  });
  it.each([
    "http://v16.tiktokcdn-us.com/video.mp4",
    "https://127.0.0.1/video.mp4",
    "https://v16.tiktokcdn-us.com.evil.test/video.mp4",
    "https://user:password@v16.tiktok.com/video.mp4",
    "https://v16.tiktok.com:444/video.mp4",
    "/video/media/play/secret",
    "https://evil.test/video.mp4",
    ""
  ])("rejects unsupported media destinations: %s", async (play) => {
    const remote = vi.fn().mockResolvedValue(response(ok({ id, play })));
    await expect(new TikTokShopFallback(remote).resolveVideo(canonical, id, signal())).rejects.toMatchObject({
      code: "TIKTOK_MEDIA_INVALID"
    });
  });
  it.each([
    response(ok(), 429),
    response(ok(), 503),
    response(ok(), 200, "https://evil.test/api/"),
    response(ok(), 200, "https://www.tikwm.com/login"),
    response("<html>login</html>"),
    response({ code: -1, msg: "SECRET signed-url token" }),
    response(ok({ id, play: video, images: ["image"] })),
    response(ok(), 200, api, { "content-length": String(2 * 1024 * 1024) }),
    response({ code: 0 }),
    response(null)
  ])("sanitizes failed, redirected or invalid provider responses %#", async (result) => {
    const remote = vi.fn().mockResolvedValue(result);
    const request = new TikTokShopFallback(remote).resolveVideo(canonical, id, signal());
    await expect(request).rejects.not.toThrow("SECRET");
    expect(remote).toHaveBeenCalledOnce();
  });
  it("cancels oversized streaming responses and never returns truncated data", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(1024 * 1024 + 1));
      },
      cancel
    });
    const result = Object.defineProperty(new Response(body), "url", { value: api });
    const remote = vi.fn().mockResolvedValue(result);
    await expect(new TikTokShopFallback(remote).resolveVideo(canonical, id, signal())).rejects.toMatchObject({
      code: "TIKTOK_SHOP_FALLBACK_FAILED"
    });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("aborts a stalled response body promptly and releases its reader", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"code":'));
      },
      cancel
    });
    const result = Object.defineProperty(new Response(body), "url", { value: api });
    const remote = vi.fn().mockResolvedValue(result);
    const controller = new AbortController();
    const pending = new TikTokShopFallback(remote).resolveVideo(canonical, id, controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(result.body?.locked).toBe(true));
    controller.abort();
    await rejected;
    await vi.waitFor(() => expect(result.body?.locked).toBe(false));
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("does not let canceled queued requests bypass the serial rate limit", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let finish!: (value: Response) => void;
    const starts: number[] = [];
    const remote = vi
      .fn()
      .mockImplementationOnce(() => {
        starts.push(Date.now());
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      })
      .mockImplementationOnce(async () => {
        starts.push(Date.now());
        return response(ok());
      });
    const client = new TikTokShopFallback(remote);
    const first = client.resolveVideo(canonical, id, signal());
    await vi.advanceTimersByTimeAsync(0);
    const controller = new AbortController();
    const canceled = client.resolveVideo(canonical, id, controller.signal);
    const rejection = expect(canceled).rejects.toMatchObject({ name: "AbortError" });
    const third = client.resolveVideo(canonical, id, signal());
    controller.abort();
    await rejection;
    expect(remote).toHaveBeenCalledOnce();
    finish(response(ok()));
    await first;
    await vi.advanceTimersByTimeAsync(1099);
    expect(remote).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(await third).toEqual([video]);
    expect(starts).toEqual([0, 1100]);
  });
  it("releases the request queue even if canceling the previous body never settles", async () => {
    const controller = new AbortController();
    const body = new ReadableStream({
      start(stream) {
        stream.enqueue(new TextEncoder().encode('{"code":'));
      },
      cancel() {
        return new Promise<void>(() => undefined);
      }
    });
    const result = Object.defineProperty(new Response(body), "url", { value: api });
    const remote = vi.fn().mockResolvedValueOnce(result).mockResolvedValueOnce(response(ok()));
    const client = new TikTokShopFallback(remote);
    const first = client.resolveVideo(canonical, id, controller.signal);
    const rejected = expect(first).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(result.body?.locked).toBe(true));
    controller.abort();
    await rejected;
    expect(await client.resolveVideo(canonical, id, signal())).toEqual([video]);
    expect(remote).toHaveBeenCalledTimes(2);
  });
  it("keeps private-address DNS protection on the fixed parser host", async () => {
    const resolver = vi.fn().mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    const client = new TikTokShopFallback(createRemoteFetch({ resolver, requireHttps: true }));
    await expect(client.resolveVideo(canonical, id, signal())).rejects.toMatchObject({
      code: "TIKTOK_SHOP_FALLBACK_FAILED"
    });
    expect(resolver).toHaveBeenCalledWith("www.tikwm.com");
  });
  it("does not request invalid identities, photo links or an already canceled operation", async () => {
    const remote = vi.fn();
    const client = new TikTokShopFallback(remote);
    for (const url of [
      canonical.replace(id, "123456"),
      canonical.replace("/video/", "/photo/"),
      "https://evil.test/video/123456"
    ])
      await expect(client.resolveVideo(url, id, signal())).rejects.toMatchObject({ code: "TIKTOK_IDENTITY_MISMATCH" });
    const controller = new AbortController();
    controller.abort();
    expect(() => client.resolveVideo(canonical, id, controller.signal)).toThrow();
    expect(remote).not.toHaveBeenCalled();
  });
});
