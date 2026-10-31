/** Anonymous public HTTPS reads; no Python, browser package, session cookies or platform API signatures. */
import { identifyArchiveLink, type TikTokRuntimeStatus } from "@toolbox/shared/archive";
import {
  assertRemoteResponseSize,
  limitedResponseStream,
  type AddressResolver,
  type RemoteFetch
} from "../../../../security/remote-fetch";
import {
  abortable,
  ArchiveTaskError,
  type ArchiveProgress,
  type ArchiveProvider,
  type ArchiveSource
} from "../../core/provider";
import { readTikTokPage, tikTokWorkIdentity, TikTokShopVideoMissingError } from "./source";
import { createTikTokTransport } from "./transport";
import { TikTokShopFallback } from "./shop-fallback";

const MAX_PAGE_BYTES = 4 * 1024 * 1024;
export class TikTokRuntime implements ArchiveProvider {
  readonly platform = "tiktok" as const;
  readonly remoteFetch: RemoteFetch;
  private readonly operations = new Map<AbortController, Promise<ArchiveSource>>();
  private closed = false;
  private closing?: Promise<void>;
  private readonly shopFallback?: TikTokShopFallback;
  constructor(
    options: {
      proxy?: string;
      resolver?: AddressResolver;
      remoteFetch?: RemoteFetch;
      timeoutMs?: number;
      shopFallback?: "tikwm" | "off";
    } = {}
  ) {
    this.remoteFetch = options.remoteFetch ?? createTikTokTransport(options);
    this.timeoutMs = options.timeoutMs ?? 60_000;
    if (options.shopFallback !== "off") this.shopFallback = new TikTokShopFallback(this.remoteFetch);
  }
  private readonly timeoutMs: number;
  isActive() {
    return this.operations.size > 0;
  }
  async status(): Promise<TikTokRuntimeStatus> {
    return {
      platform: "tiktok",
      mode: "anonymous",
      available: !this.closed,
      state: this.closed ? "stopped" : this.isActive() ? "busy" : "ready",
      message: this.closed
        ? "TikTok 获取服务已关闭"
        : `无需额外能力包；仅获取公开作品；${this.shopFallback ? "商品视频缺少地址时使用 TikWM 备用解析，会发送该公开作品链接" : "商品视频备用解析已关闭"}，网络可用性以实际获取结果为准`
    };
  }
  extract(input: string, signal: AbortSignal, progress: ArchiveProgress = () => undefined): Promise<ArchiveSource> {
    const link = identifyArchiveLink(input, "tiktok");
    if (!link.ok) return Promise.reject(new ArchiveTaskError("TIKTOK_URL_INVALID", link.message));
    if (this.closed) return Promise.reject(new ArchiveTaskError("TIKTOK_RUNTIME_STOPPED", "TikTok 获取服务已关闭"));
    signal.throwIfAborted();
    const controller = new AbortController();
    const combined = AbortSignal.any([signal, controller.signal]);
    const timer = setTimeout(
      () => controller.abort(new DOMException("TikTok 读取超时", "TimeoutError")),
      this.timeoutMs
    );
    const operation = abortable(this.read(link.url, combined, progress), combined)
      .catch((error: unknown) => {
        if (signal.aborted) throw signal.reason;
        if (error instanceof ArchiveTaskError) throw error;
        if (this.closed) throw new ArchiveTaskError("TIKTOK_RUNTIME_STOPPED", "TikTok 获取服务已关闭");
        if (combined.aborted)
          throw new ArchiveTaskError("TIKTOK_REQUEST_TIMEOUT", "TikTok 获取超时，请检查代理或网络后重试");
        throw new ArchiveTaskError(
          "TIKTOK_NETWORK_ERROR",
          "无法读取 TikTok 公开作品，请检查网络、代理或平台访问限制后重试"
        );
      })
      .finally(() => {
        clearTimeout(timer);
        this.operations.delete(controller);
      });
    this.operations.set(controller, operation);
    return operation;
  }
  close(): Promise<void> {
    this.closed = true;
    return (this.closing ??= (async () => {
      for (const controller of this.operations.keys())
        controller.abort(new DOMException("TikTok 获取已停止", "AbortError"));
      await Promise.allSettled(this.operations.values());
    })());
  }
  private async read(input: string, signal: AbortSignal, progress: ArchiveProgress) {
    progress("parsing", 12, "正在匿名读取 TikTok 公开作品");
    const original = tikTokWorkIdentity(input);
    const page = await this.page(input, signal);
    const identity = tikTokWorkIdentity(page.url);
    if (!identity || (original && original.id !== identity.id))
      throw new ArchiveTaskError("TIKTOK_URL_INVALID", "TikTok 短链未跳转到对应的公开作品页");
    let source = await this.readSource(page.html, identity.id, page.url, signal, progress);
    // Public photo pages currently return only the app shell. The ordinary video URL for the same
    // public work exposes its imagePost data; never attempt this after an access-denied response.
    if (!source && identity.kind === "photo" && page.html.includes('id="__UNIVERSAL_DATA_FOR_REHYDRATION__"')) {
      const alternate = new URL(page.url);
      alternate.pathname = alternate.pathname.replace("/photo/", "/video/");
      const detail = await this.page(alternate.toString(), signal);
      if (tikTokWorkIdentity(detail.url)?.id !== identity.id)
        throw new ArchiveTaskError("TIKTOK_IDENTITY_MISMATCH", "TikTok 返回了其他作品，未保存任何内容");
      source = await this.readSource(detail.html, identity.id, detail.url, signal, progress);
    }
    signal.throwIfAborted();
    if (!source)
      throw new ArchiveTaskError(
        "TIKTOK_CONTENT_UNAVAILABLE",
        "TikTok 未返回可归档的公开内容，可能要求登录、验证或限制了访问"
      );
    progress("parsing", 35, `已读取 TikTok ${source.type === "image" ? "图集" : "视频"}，准备下载媒体`);
    return source;
  }
  private async readSource(html: string, id: string, url: string, signal: AbortSignal, progress: ArchiveProgress) {
    try {
      return readTikTokPage(html, id);
    } catch (error) {
      if (!(error instanceof TikTokShopVideoMissingError) || !this.shopFallback) throw error;
      signal.throwIfAborted();
      const canonical = new URL(url);
      canonical.pathname = canonical.pathname.replace("/photo/", "/video/");
      canonical.search = "";
      canonical.hash = "";
      progress("parsing", 24, "商品视频缺少地址，正在通过 TikWM 备用解析公开作品链接");
      const urls = await this.shopFallback.resolveVideo(canonical.toString(), id, signal);
      signal.throwIfAborted();
      // Reuse official metadata and the original identity/access checks; only video candidates change.
      return readTikTokPage(html, id, urls);
    }
  }
  private async page(url: string, signal: AbortSignal) {
    const response = await this.remoteFetch(url, {
      signal,
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9"
      }
    });
    try {
      if (response.status === 429) throw new ArchiveTaskError("TIKTOK_RATE_LIMITED", "TikTok 请求过于频繁，请稍后重试");
      if ([401, 403, 404, 410, 451].includes(response.status))
        throw new ArchiveTaskError("TIKTOK_CONTENT_UNAVAILABLE", "该 TikTok 作品已删除、不可见或不允许匿名访问");
      if (!response.ok) throw new ArchiveTaskError("TIKTOK_NETWORK_ERROR", "TikTok 返回网络错误，请稍后重试");
      if (!tikTokWorkIdentity(response.url))
        throw new ArchiveTaskError("TIKTOK_URL_INVALID", "TikTok 链接未落到受支持的作品页，可能要求登录");
      assertRemoteResponseSize(response, MAX_PAGE_BYTES);
      const chunks: Buffer[] = [];
      const stream = limitedResponseStream(response, MAX_PAGE_BYTES);
      const abort = () =>
        stream.destroy(
          signal.reason instanceof Error ? signal.reason : new DOMException("TikTok 读取已取消", "AbortError")
        );
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
      try {
        for await (const chunk of stream) {
          signal.throwIfAborted();
          chunks.push(Buffer.from(chunk));
        }
      } finally {
        signal.removeEventListener("abort", abort);
        stream.destroy();
      }
      return { url: response.url, html: Buffer.concat(chunks).toString("utf8") };
    } finally {
      await response.body?.cancel().catch(() => undefined);
    }
  }
}
