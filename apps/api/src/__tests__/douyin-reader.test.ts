/** 匿名作品读取回归：隔离浏览器响应，验证精确作品匹配、失败分类与有界取消，不访问平台。 */
import { EventEmitter } from "node:events";
import type { Page, Response } from "playwright-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readDouyinWork } from "../domains/content-archive/providers/douyin/douyin-reader";

const id = "7464977705159691570";
const otherId = "7594644721835798635";
const canonicalUrl = `https://www.douyin.com/video/${id}`;
const shortUrl = "https://v.douyin.com/D_DcsZsE5O8/";
function detail(contentId = id) {
  return { awemeId: contentId, desc: "匿名作品", video: { playAddr: ["https://media.example.com/video.mp4"] } };
}
function html(contentId = id) {
  return `<script>self.__pace_f.push(${JSON.stringify([1, "7:" + JSON.stringify(detail(contentId))])})</script>`;
}
function api(
  options: {
    id?: string;
    status?: number;
    url?: string;
    headers?: Record<string, string>;
    body?: () => Promise<Buffer>;
  } = {}
) {
  const contentId = options.id ?? id;
  return {
    url: () => options.url ?? `https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${contentId}`,
    status: () => options.status ?? 200,
    headers: () => options.headers ?? {},
    body: vi.fn(
      options.body ??
        (async () =>
          Buffer.from(JSON.stringify({ status_code: 0, aweme_detail: { ...detail(contentId), aweme_id: contentId } })))
    )
  };
}
function fixture() {
  const events = new EventEmitter();
  const goto = vi.fn(async (_url: string) => undefined as { status: () => number } | undefined);
  const url = vi.fn(() => canonicalUrl);
  const content = vi.fn(async () => html());
  const page = Object.assign(events, { goto, url, content });
  return { page: page as unknown as Page, events, goto, url, content };
}
afterEach(() => vi.useRealTimers());

describe("受管浏览器匿名读取", () => {
  it("SSR 成功立即返回白名单 DTO 并移除监听，不把会话落盘", async () => {
    const f = fixture();
    const result = await readDouyinWork(f.page, shortUrl);
    expect(result).toMatchObject({ via: "normal-browser-ssr", source: { platform: "douyin", contentId: id } });
    expect(f.events.listenerCount("response")).toBe(0);
    expect(Object.keys(result.source)).not.toContain("cookie");
  });

  it("SSR 为空时只接收当前作品的正常浏览器 API", async () => {
    const f = fixture();
    f.content.mockResolvedValue("<html></html>");
    f.goto.mockImplementation(async () => {
      f.events.emit("response", api({ id: otherId }));
      f.events.emit("response", api());
      return undefined;
    });
    expect(await readDouyinWork(f.page, shortUrl)).toMatchObject({
      via: "normal-browser-api",
      source: { contentId: id }
    });
    expect(f.events.listenerCount("response")).toBe(0);
  });

  it("推荐请求的限流不能污染当前作品的成功解析", async () => {
    const f = fixture();
    f.content.mockResolvedValue("");
    f.goto.mockImplementation(async () => {
      f.events.emit("response", api({ id: otherId, status: 429 }));
      f.events.emit("response", api());
      return undefined;
    });
    expect(await readDouyinWork(f.page, shortUrl)).toMatchObject({ source: { contentId: id } });
  });

  it.each([
    "Unable to retrieve content because the page is navigating and changing the content.",
    "Execution context was destroyed, most likely because of a navigation."
  ])("页面导航中的临时读取失败可恢复：%s", async (message) => {
    vi.useFakeTimers();
    const f = fixture();
    f.content.mockRejectedValueOnce(new Error(message));
    const pending = readDouyinWork(f.page, shortUrl);
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toMatchObject({ via: "normal-browser-ssr", source: { contentId: id } });
    expect(f.content).toHaveBeenCalledTimes(2);
    expect(f.events.listenerCount("response")).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("页面跳转不会覆盖当前作品 API 返回的权限限制", async () => {
    const f = fixture();
    f.content.mockRejectedValue(new Error("Unable to retrieve content because the page is navigating"));
    f.goto.mockImplementation(async () => {
      f.events.emit(
        "response",
        api({
          body: async () =>
            Buffer.from(
              JSON.stringify({
                status_code: 0,
                aweme_detail: null,
                filter_detail: { aweme_id: id, detail_msg: "因作品权限设置，暂时无法查看" }
              })
            )
        })
      );
      return undefined;
    });
    await expect(readDouyinWork(f.page, shortUrl)).rejects.toMatchObject({
      code: "DOUYIN_CONTENT_UNAVAILABLE",
      message: "该抖音作品受访问权限限制，匿名归档无法获取。请使用公开可访问的作品链接。"
    });
    expect(f.events.listenerCount("response")).toBe(0);
  });

  it("导航期间连续读取失败仍受总时限约束", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.content.mockRejectedValue(new Error("Unable to retrieve content because the page is navigating"));
    const pending = readDouyinWork(f.page, shortUrl, { timeoutMs: 100 });
    const assertion = expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(f.events.listenerCount("response")).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("非导航原因的页面读取失败立即脱敏，不进入重试", async () => {
    const f = fixture();
    f.content.mockRejectedValue(new Error("Target closed C:/private ?token=secret"));
    await expect(readDouyinWork(f.page, shortUrl)).rejects.toMatchObject({
      code: "DOUYIN_PARSE_FAILED",
      message: "抖音作品读取失败，请稍后重试"
    });
    expect(f.content).toHaveBeenCalledTimes(1);
  });

  it.each([
    [429, "DOUYIN_RATE_LIMITED"],
    [401, "DOUYIN_CONTENT_UNAVAILABLE"],
    [404, "DOUYIN_CONTENT_UNAVAILABLE"],
    [403, "DOUYIN_CONTENT_UNAVAILABLE"]
  ])("导航状态 %i 保留稳定错误 %s", async (status, code) => {
    const f = fixture();
    f.content.mockResolvedValue("");
    f.goto.mockResolvedValue({ status: () => status });
    await expect(readDouyinWork(f.page, shortUrl)).rejects.toMatchObject({ code });
    expect(f.events.listenerCount("response")).toBe(0);
  });

  it.each([
    [429, "DOUYIN_RATE_LIMITED"],
    [401, "DOUYIN_CONTENT_UNAVAILABLE"]
  ])("当前作品 API 状态 %i 分类为 %s", async (status, code) => {
    const f = fixture();
    f.content.mockResolvedValue("");
    f.goto.mockImplementation(async () => {
      f.events.emit("response", api({ status }));
      return undefined;
    });
    await expect(readDouyinWork(f.page, canonicalUrl)).rejects.toMatchObject({ code });
  });

  it("403 安全验证页面优先分类，不当作作品内容处理", async () => {
    const f = fixture();
    f.goto.mockResolvedValue({ status: () => 403 });
    f.content.mockResolvedValue("<title>验证码中间页</title>");
    await expect(readDouyinWork(f.page, canonicalUrl)).rejects.toMatchObject({ code: "DOUYIN_CHALLENGE_REQUIRED" });
  });

  it.each([
    `http://www.douyin.com/video/${id}`,
    `https://www.douyin.com.evil.example/video/${id}`,
    `https://www.douyin.com:8443/video/${id}`,
    `https://user:secret@www.douyin.com/video/${id}`,
    "https://www.douyin.com/user/test",
    `https://www.douyin.com/video/${otherId}`
  ])("拒绝错误重定向和长链接作品替换：%s", async (resolved) => {
    const f = fixture();
    f.url.mockReturnValue(resolved);
    await expect(readDouyinWork(f.page, canonicalUrl)).rejects.toMatchObject({ code: "DOUYIN_PARSE_FAILED" });
  });

  it("HTTPS 及精确 API 主机限制在读取响应体之前执行", async () => {
    const f = fixture();
    const responses = [
      api({ url: "not a URL" }),
      api({ url: `http://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${id}` }),
      api({ url: `https://www.douyin.com.evil.example/aweme/v1/web/aweme/detail/?aweme_id=${id}` }),
      api({ url: `https://www.douyin.com:8443/aweme/v1/web/aweme/detail/?aweme_id=${id}` }),
      api({ url: "https://www.douyin.com/aweme/v1/web/aweme/detail/" }),
      api({ id: otherId })
    ];
    f.goto.mockImplementation(async () => {
      responses.forEach((response) => f.events.emit("response", response));
      return undefined;
    });
    await readDouyinWork(f.page, canonicalUrl);
    responses.forEach((response) => expect(response.body).not.toHaveBeenCalled());
  });

  it("过大 Content-Length 立即拒绝，不读取响应体", async () => {
    const f = fixture();
    const response = api({ headers: { "content-length": String(4 * 1024 * 1024 + 1) } });
    f.content.mockResolvedValue("");
    f.goto.mockImplementation(async () => {
      f.events.emit("response", response);
      return undefined;
    });
    await expect(readDouyinWork(f.page, canonicalUrl)).rejects.toMatchObject({ code: "DOUYIN_RESPONSE_TOO_LARGE" });
    expect(response.body).not.toHaveBeenCalled();
  });

  it("缺失长度时仍检查实际 API 字节数", async () => {
    const f = fixture();
    f.content.mockResolvedValue("");
    f.goto.mockImplementation(async () => {
      f.events.emit("response", api({ body: async () => Buffer.alloc(4 * 1024 * 1024 + 1) }));
      return undefined;
    });
    await expect(readDouyinWork(f.page, canonicalUrl)).rejects.toMatchObject({ code: "DOUYIN_RESPONSE_TOO_LARGE" });
  });

  it("停滞的后台响应最多同时读取四个，不能拖住有效 SSR", async () => {
    const f = fixture();
    const responses = Array.from({ length: 20 }, () => api({ body: () => new Promise<Buffer>(() => undefined) }));
    f.goto.mockImplementation(async () => {
      responses.forEach((response) => f.events.emit("response", response));
      return undefined;
    });
    await readDouyinWork(f.page, canonicalUrl);
    expect(responses.filter((response) => response.body.mock.calls.length)).toHaveLength(4);
    expect(f.events.listenerCount("response")).toBe(0);
  });

  it("任务取消无需等待停滞导航，监听立即释放且原始取消原因保留", async () => {
    const f = fixture();
    const abort = new AbortController();
    f.goto.mockImplementation(() => new Promise(() => undefined));
    const reason = new DOMException("用户取消", "AbortError");
    const pending = readDouyinWork(f.page, shortUrl, { signal: abort.signal });
    const assertion = expect(pending).rejects.toBe(reason);
    abort.abort(reason);
    await assertion;
    expect(f.events.listenerCount("response")).toBe(0);
  });

  it("总时限覆盖停滞 content()，不是只限定首次导航", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.content.mockImplementation(() => new Promise(() => undefined));
    const pending = readDouyinWork(f.page, canonicalUrl, { timeoutMs: 100 });
    const assertion = expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(f.events.listenerCount("response")).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("读取结束后的迟到 body 不污染下一次解析", async () => {
    const f = fixture();
    let finish: ((body: Buffer) => void) | undefined;
    const response = api({
      body: () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    });
    f.goto.mockImplementation(async () => {
      f.events.emit("response", response as unknown as Response);
      return undefined;
    });
    await readDouyinWork(f.page, shortUrl);
    finish?.(Buffer.from(JSON.stringify({ status_code: 0, aweme_detail: detail() })));
    f.content.mockResolvedValue(html(otherId));
    f.url.mockReturnValue(`https://www.douyin.com/video/${otherId}`);
    f.goto.mockResolvedValue(undefined);
    expect(await readDouyinWork(f.page, shortUrl)).toMatchObject({ source: { contentId: otherId } });
    expect(f.events.listenerCount("response")).toBe(0);
  });

  it("浏览器原始异常脱敏，不泄漏令牌和本地路径", async () => {
    const f = fixture();
    f.goto.mockRejectedValue(new Error("proxy-password secret C:/private ?token=secret"));
    await expect(readDouyinWork(f.page, shortUrl)).rejects.toMatchObject({
      code: "DOUYIN_PARSE_FAILED",
      message: "抖音作品读取失败，请稍后重试"
    });
  });

  it("已取消、非作品或非法时限输入不触发导航", async () => {
    const f = fixture();
    const abort = new AbortController();
    abort.abort(new DOMException("已取消", "AbortError"));
    await expect(readDouyinWork(f.page, shortUrl, { signal: abort.signal })).rejects.toMatchObject({
      name: "AbortError"
    });
    await expect(readDouyinWork(f.page, "http://www.douyin.com/video/123456")).rejects.toMatchObject({
      code: "DOUYIN_PARSE_FAILED"
    });
    await expect(readDouyinWork(f.page, "https://evil.example/video/123456")).rejects.toMatchObject({
      code: "DOUYIN_PARSE_FAILED"
    });
    await expect(readDouyinWork(f.page, shortUrl, { timeoutMs: 120_001 })).rejects.toBeInstanceOf(RangeError);
    expect(f.goto).not.toHaveBeenCalled();
    expect(f.events.listenerCount("response")).toBe(0);
  });
});
