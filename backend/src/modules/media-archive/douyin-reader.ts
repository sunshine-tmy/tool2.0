/** 抖音匿名作品读取：只消费受管浏览器的真实 SSR/API，不保存媒体、会话或生产元数据。 */
import { setTimeout as delay } from "node:timers/promises";
import type { Page, Response } from "playwright-core";
import { identifyArchiveLink } from "@toolbox/shared";
import { DouyinSourceError, readDouyinApiResponse, readDouyinPage, type DouyinSource } from "./douyin-source";

const MAX_BODY_BYTES = 4 * 1024 * 1024;

/**
 * 页面由调用方拥有：本函数只释放自己的监听和等待，不关闭其他使用者的页面。
 * 调用方必须在任务取消/结束时关闭受管浏览器；signal 同时限定导航、读取和等待的总时长。
 * 不主动调用平台 API、不生成签名、不读取 Cookie；验证或登录要求按失败返回。
 */
export async function readDouyinWork(
  page: Page,
  input: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<{ source: DouyinSource; via: "normal-browser-api" | "normal-browser-ssr" }> {
  const link = identifyArchiveLink(input, "douyin");
  if (!link.ok || new URL(link.url).protocol !== "https:")
    throw new DouyinSourceError("DOUYIN_PARSE_FAILED", "请提供有效的 HTTPS 抖音作品链接");
  const timeoutMs = options.timeoutMs ?? 90_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000)
    throw new RangeError("作品读取超时必须在 1–120000 毫秒内");
  options.signal?.throwIfAborted();
  const lifetime = new AbortController();
  const signal = AbortSignal.any([lifetime.signal, ...(options.signal ? [options.signal] : [])]);
  const timer = setTimeout(() => lifetime.abort(new DOMException("作品读取超时", "TimeoutError")), timeoutMs);
  let active = true;
  let expectedId = /^\/(?:video|note)\/(\d+)\/?$/.exec(new URL(link.url).pathname)?.[1];
  const originalId = expectedId;
  const sources = new Map<string, DouyinSource>();
  const errors = new Map<string, DouyinSourceError>();
  let pending = 0;
  let candidates = 0;

  const received = (response: Response) => {
    let url: URL;
    try {
      url = new URL(response.url());
    } catch {
      return;
    }
    const id = url.searchParams.get("aweme_id");
    if (
      !active ||
      signal.aborted ||
      url.protocol !== "https:" ||
      url.hostname !== "www.douyin.com" ||
      url.port ||
      url.pathname !== "/aweme/v1/web/aweme/detail/" ||
      !id ||
      !/^\d{5,24}$/.test(id) ||
      (expectedId && id !== expectedId) ||
      pending >= 4 ||
      candidates >= 16
    )
      return;
    candidates++;
    pending++;
    // 不等待全部后台响应：某个 body() 停滞不能拖住已成功解析或已取消的任务。
    void (async () => {
      try {
        if (response.status() === 429)
          throw new DouyinSourceError("DOUYIN_RATE_LIMITED", "抖音请求过于频繁，请稍后重试");
        if (response.status() === 401) throw new DouyinSourceError("DOUYIN_AUTH_REQUIRED", "抖音要求登录后查看此作品");
        if (response.status() !== 200) return;
        const length = Number(response.headers()["content-length"]);
        if (Number.isFinite(length) && length > MAX_BODY_BYTES)
          throw new DouyinSourceError("DOUYIN_RESPONSE_TOO_LARGE", "抖音作品响应超过解析上限");
        const body = await response.body();
        if (!active || signal.aborted) return;
        if (body.length > MAX_BODY_BYTES)
          throw new DouyinSourceError("DOUYIN_RESPONSE_TOO_LARGE", "抖音作品响应超过解析上限");
        const source = readDouyinApiResponse(JSON.parse(body.toString("utf8")), id);
        sources.set(id, source);
      } catch (error) {
        if (active && !signal.aborted && error instanceof DouyinSourceError) errors.set(id, error);
      } finally {
        pending--;
      }
    })();
  };
  page.on("response", received);
  let aborted: (() => void) | undefined;
  const cancellation = new Promise<never>((_resolve, reject) => {
    aborted = () => reject(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) aborted();
  });
  try {
    return await Promise.race([
      cancellation,
      (async () => {
        const navigation = await page.goto(link.url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
        signal.throwIfAborted();
        if (navigation?.status() === 429)
          throw new DouyinSourceError("DOUYIN_RATE_LIMITED", "抖音请求过于频繁，请稍后重试");
        if (navigation?.status() === 401)
          throw new DouyinSourceError("DOUYIN_AUTH_REQUIRED", "抖音要求登录后查看此作品");
        if (navigation?.status() === 404)
          throw new DouyinSourceError("DOUYIN_CONTENT_UNAVAILABLE", "此抖音作品不存在或已不可访问");
        const resolved = new URL(page.url());
        const resolvedId = /^\/(?:video|note)\/(\d{5,24})\/?$/.exec(resolved.pathname)?.[1];
        if (
          resolved.protocol !== "https:" ||
          resolved.username ||
          resolved.password ||
          resolved.port ||
          !["www.douyin.com", "douyin.com"].includes(resolved.hostname) ||
          !resolvedId ||
          (originalId && originalId !== resolvedId)
        )
          throw new DouyinSourceError("DOUYIN_PARSE_FAILED", "链接没有落到对应的合法抖音作品页");
        expectedId = resolvedId;
        const deadline = Date.now() + Math.min(30_000, timeoutMs);
        do {
          signal.throwIfAborted();
          const source = readDouyinPage(await page.content(), expectedId);
          signal.throwIfAborted();
          if (source) return { source, via: "normal-browser-ssr" as const };
          const apiSource = sources.get(expectedId);
          if (apiSource) return { source: apiSource, via: "normal-browser-api" as const };
          if (navigation?.status() === 403)
            throw new DouyinSourceError("DOUYIN_CONTENT_UNAVAILABLE", "抖音拒绝访问此作品，请稍后重试");
          // 错误只属于当前作品；推荐请求的限流/权限失败不能污染本次归档。
          const error = errors.get(expectedId);
          if (error) throw error;
          await delay(Math.min(500, Math.max(1, deadline - Date.now())), undefined, { signal });
        } while (Date.now() < deadline);
        throw new DouyinSourceError("DOUYIN_CONTENT_UNAVAILABLE", "普通浏览器没有返回可归档作品");
      })()
    ]);
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    if (error instanceof DouyinSourceError) throw error;
    // Playwright 原始异常可能携带分享令牌、路径或代理凭据，不作为 API/日志消息暴露。
    throw new DouyinSourceError("DOUYIN_PARSE_FAILED", "抖音作品读取失败，请稍后重试");
  } finally {
    active = false;
    clearTimeout(timer);
    page.off("response", received);
    if (aborted) signal.removeEventListener("abort", aborted);
    lifetime.abort(new DOMException("作品读取已结束", "AbortError"));
    sources.clear();
    errors.clear();
  }
}
