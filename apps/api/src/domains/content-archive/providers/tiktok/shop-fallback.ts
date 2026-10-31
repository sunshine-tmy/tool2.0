/** Optional fixed-provider fallback; only a public canonical work URL leaves the application. */
import { setTimeout as delay } from "node:timers/promises";
import { assertRemoteResponseSize, type RemoteFetch } from "../../../../security/remote-fetch";
import { abortable, ArchiveTaskError } from "../../core/provider";
import { tikTokMediaUrls, tikTokWorkIdentity } from "./source";

const endpoint = "https://www.tikwm.com/api/";
const MAX_BYTES = 1024 * 1024;
const failure = () =>
  new ArchiveTaskError("TIKTOK_SHOP_FALLBACK_FAILED", "TikTok 商品视频备用解析暂不可用，请稍后重试", 503);

export class TikTokShopFallback {
  private pending: Promise<void> = Promise.resolve();
  private nextRequestAt = 0;

  constructor(private readonly remoteFetch: RemoteFetch) {}

  resolveVideo(canonical: string, expectedId: string, signal: AbortSignal): Promise<string[]> {
    signal.throwIfAborted();
    const identity = tikTokWorkIdentity(canonical);
    if (!identity || identity.id !== expectedId || identity.kind !== "video")
      return Promise.reject(new ArchiveTaskError("TIKTOK_IDENTITY_MISMATCH", "备用解析的作品身份不匹配"));
    // Keep queue ownership until the previous request settles, including canceled waiters.
    const operation = this.pending.then(async () => {
      signal.throwIfAborted();
      const wait = Math.max(0, this.nextRequestAt - Date.now());
      if (wait) await delay(wait, undefined, { signal });
      signal.throwIfAborted();
      this.nextRequestAt = Date.now() + 1100;
      return this.request(canonical, expectedId, signal);
    });
    this.pending = operation.then(
      () => undefined,
      () => undefined
    );
    return abortable(operation, signal);
  }

  private async request(canonical: string, expectedId: string, callerSignal: AbortSignal) {
    const signal = AbortSignal.any([callerSignal, AbortSignal.timeout(20_000)]);
    const url = new URL(endpoint);
    url.searchParams.set("url", canonical);
    url.searchParams.set("hd", "1");
    let response: Response | undefined;
    try {
      const transport = this.remoteFetch(url.toString(), {
        signal,
        headers: { accept: "application/json", "user-agent": "Mozilla/5.0" }
      });
      void transport.then(
        (late) => {
          if (signal.aborted) void late.body?.cancel().catch(() => undefined);
        },
        () => undefined
      );
      response = await abortable(transport, signal);
      if (response.status === 429)
        throw new ArchiveTaskError(
          "TIKTOK_SHOP_FALLBACK_RATE_LIMITED",
          "商品视频备用解析请求过于频繁，请稍后重试",
          429
        );
      // A redirected login, HTML service or arbitrary endpoint cannot become a trusted parser.
      const finalUrl = new URL(response.url);
      if (!response.ok || finalUrl.origin !== url.origin || finalUrl.pathname !== url.pathname) throw failure();
      assertRemoteResponseSize(response, MAX_BYTES);
      const reader = response.body?.getReader();
      if (!reader) throw failure();
      const abort = () => {
        void reader.cancel(signal.reason).catch(() => undefined);
      };
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
      const chunks: Buffer[] = [];
      let bytes = 0;
      try {
        while (true) {
          const { done, value } = await abortable(reader.read(), signal);
          signal.throwIfAborted();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > MAX_BYTES) throw failure();
          chunks.push(Buffer.from(value));
        }
      } finally {
        signal.removeEventListener("abort", abort);
        // An uncooperative body must not retain the serial queue after cancellation.
        void reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
      const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!value || typeof value !== "object" || !("code" in value) || value.code !== 0 || !("data" in value))
        throw failure();
      const data = value.data;
      if (!data || typeof data !== "object" || !("id" in data) || data.id !== expectedId)
        throw new ArchiveTaskError("TIKTOK_IDENTITY_MISMATCH", "备用解析返回了其他作品，未保存任何内容");
      if ("images" in data && Array.isArray(data.images) && data.images.length) throw failure();
      const urls = tikTokMediaUrls([
        "hdplay" in data ? data.hdplay : undefined,
        "play" in data ? data.play : undefined
      ]);
      if (!urls.length) throw new ArchiveTaskError("TIKTOK_MEDIA_INVALID", "商品视频备用解析未提供受支持的视频地址");
      return urls;
    } catch (error) {
      callerSignal.throwIfAborted();
      if (error instanceof ArchiveTaskError) throw error;
      throw failure();
    } finally {
      void response?.body?.cancel().catch(() => undefined);
    }
  }
}
