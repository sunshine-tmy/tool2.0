/** 平台适配器边界：本机凭据、短链目标、匿名正文、错误分类与取消，不依赖在线作品。 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "../config";
import type { XhsRuntimeManager } from "../modules/xhs-archive/runtime";
import type { XhsAuthManager } from "../modules/xhs-archive/auth";
import type { DouyinRuntimeManager } from "../modules/media-archive/douyin-runtime";
import { xhsProvider, douyinProvider } from "../modules/media-archive/platform-providers";
import { abortable } from "../modules/media-archive/provider";
import { extractXhsUrl, normalizeXhsProviderItem } from "../modules/xhs-archive/provider-item";

const link = "https://www.xiaohongshu.com/explore/123456789?xsec_token=public";
const originalFetch = globalThis.fetch;
let cookie: ReturnType<typeof vi.fn>;
let ready: ReturnType<typeof vi.fn>;
let stop: ReturnType<typeof vi.fn>;
let remote: ReturnType<typeof vi.fn>;
let signal: AbortSignal;
let progress: ReturnType<typeof vi.fn>;
let config: ReturnType<typeof getConfig>;
function provider() {
  return xhsProvider(
    config,
    remote,
    { ensureReady: ready, stop } as unknown as XhsRuntimeManager,
    { cookieHeader: cookie } as unknown as XhsAuthManager
  );
}
function response(items: unknown[] = [{ id: "123456789", downloads: ["https://cdn.test/1.jpg"] }]) {
  return new Response(JSON.stringify({ success: true, items }));
}
beforeEach(() => {
  config = getConfig({
    dotenvPath: false,
    environment: { NODE_ENV: "test", XHS_PROVIDER_TOKEN: "local-worker-token" }
  });
  cookie = vi.fn(async () => "local-platform-cookie");
  ready = vi.fn(async () => "http://127.0.0.1:3215");
  stop = vi.fn(async () => undefined);
  remote = vi.fn();
  signal = new AbortController().signal;
  progress = vi.fn();
  globalThis.fetch = vi.fn(async () => response()) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("小红书平台读取网关", () => {
  it.each(["http://127.0.0.1:3215", "http://localhost:3215", "http://[::1]:3215"])(
    "%s 仅本机 Worker 可接收登录 Cookie 和 Worker Token",
    async (endpoint) => {
      ready.mockResolvedValue(endpoint);
      expect(await provider().extract(link, signal, progress)).toMatchObject({
        platform: "xiaohongshu",
        contentId: "123456789"
      });
      expect(cookie).toHaveBeenCalledOnce();
      const init = vi.mocked(globalThis.fetch).mock.calls[0][1]!;
      expect(JSON.parse(String(init.body))).toEqual({ url: link, cookie: "local-platform-cookie" });
      expect(init.headers).toHaveProperty("x-toolbox-worker-token", "local-worker-token");
      await provider().close();
      expect(stop).toHaveBeenCalledOnce();
    }
  );
  it("外部服务不读取 Cookie，也不发送本机 Worker Token", async () => {
    ready.mockResolvedValue("https://provider.test");
    await provider().extract(link, signal, progress);
    expect(cookie).not.toHaveBeenCalled();
    const init = vi.mocked(globalThis.fetch).mock.calls[0][1]!;
    expect(JSON.parse(String(init.body))).toEqual({ url: link, cookie: "" });
    expect(init.headers).not.toHaveProperty("x-toolbox-worker-token");
  });
  it.each(["xhslink.com", "www.xhslink.com", "xhslink.cn", "www.xhslink.cn"])(
    "%s 短链经安全网络网关解析，保留分享令牌且释放响应体",
    async (host) => {
      const resolved = response();
      Object.defineProperty(resolved, "url", { value: link });
      remote.mockResolvedValue(resolved);
      await provider().extract(`https://${host}/abc`, signal, progress);
      expect(remote.mock.calls[0][1].signal).toBe(signal);
      expect(resolved.body?.locked).toBe(false);
      expect(JSON.parse(String(vi.mocked(globalThis.fetch).mock.calls[0][1]?.body)).url).toBe(link);
    }
  );
  it.each(["https://evil.test/123", "https://xhslink.com/other", "https://www.xiaohongshu.com.evil.test/123"])(
    "短链最终地址 %s 不能交给 Worker",
    async (target) => {
      const resolved = response();
      Object.defineProperty(resolved, "url", { value: target });
      remote.mockResolvedValue(resolved);
      await expect(provider().extract("https://xhslink.cn/abc", signal, progress)).rejects.toMatchObject({
        code: "XHS_URL_INVALID"
      });
      expect(globalThis.fetch).not.toHaveBeenCalled();
    }
  );
  it.each([
    [{ success: false, detail: "not found secret cookie" }, "local", "XHS_CONTENT_UNAVAILABLE"],
    [{ success: false }, "local", "XHS_PARSE_FAILED"],
    [{ success: false }, "", "XHS_AUTH_REQUIRED"],
    [{ success: true, items: [{ id: "123456789" }] }, "local", "XHS_MEDIA_EMPTY"],
    [{ success: true, items: [{ id: "123456789" }] }, "", "XHS_AUTH_REQUIRED"],
    [{ success: true, items: [{}] }, "local", "XHS_PARSE_FAILED"]
  ])("解析失败保留分类但不回传上游敏感 detail", async (payload, session, code) => {
    cookie.mockResolvedValue(session);
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(payload))) as typeof fetch;
    await expect(provider().extract(link, signal, progress)).rejects.toMatchObject({ code });
    await expect(provider().extract(link, signal, progress)).rejects.not.toThrow("secret cookie");
  });
  it("读取环境被取消后忽略迟到进度且不读取凭据", async () => {
    const controller = new AbortController();
    let update!: (state: { installProgress: number; message: string }) => void;
    ready.mockImplementation((callback) => {
      update = callback;
      return new Promise(() => undefined);
    });
    const result = provider().extract(link, controller.signal, progress);
    controller.abort(new Error("用户取消"));
    await expect(result).rejects.toThrow("用户取消");
    update({ installProgress: 100, message: "迟到" });
    expect(progress).toHaveBeenCalledTimes(1);
    expect(cookie).not.toHaveBeenCalled();
  });
  it("原中文字段、实况顺序、发布时间和无效下载地址保持原规范", () => {
    const item = normalizeXhsProviderItem(
      {
        作品ID: 123,
        作品类型: "视频",
        作品标题: "标题",
        作品描述: "正文 #话题",
        下载地址: ["https://cdn.test/video.mp4", "javascript:bad"],
        动图地址: "https://cdn.test/live.mp4",
        发布时间: 1600000000,
        作者昵称: "作者"
      },
      link
    );
    expect(item).toMatchObject({ noteId: "123", type: "live-photo", publishedAt: "2020-09-13T12:26:40.000Z" });
    expect(item.media.map(({ index, kind }) => ({ index, kind }))).toEqual([
      { index: 0, kind: "video" },
      { index: 1, kind: "live-photo" }
    ]);
    expect(normalizeXhsProviderItem({ id: "123", publishedAt: "unavailable" }, link).publishedAt).toBe("unavailable");
    expect(extractXhsUrl("不含链接")).toBeUndefined();
  });
});
describe("匿名抖音与异步取消", () => {
  it("原文不经过小红书处理，话题稳定 ID，关闭委托受管运行时", async () => {
    const source = {
      platform: "douyin",
      contentId: "123456789",
      canonicalUrl: "https://www.douyin.com/video/123456789",
      type: "image",
      title: "标题",
      description: "原文[表情] #话题",
      tags: ["话题"],
      media: []
    };
    const extract = vi.fn(async (_url: string, _options: { signal?: AbortSignal }) => ({ source }));
    const close = vi.fn(async () => undefined);
    const adapter = douyinProvider({ extract, close } as unknown as DouyinRuntimeManager);
    const first = await adapter.extract(source.canonicalUrl, signal, progress);
    const second = await adapter.extract(source.canonicalUrl, signal, progress);
    expect(first.rawText).toBe(source.description);
    expect(first.topics).toEqual(second.topics);
    expect(first.topics[0].id).toHaveLength(16);
    expect(extract.mock.calls[0][1]).toEqual({ signal });
    await adapter.close();
    expect(close).toHaveBeenCalledOnce();
  });
  it("预先取消也观察已创建的异步拒绝，不泄漏监听器或未处理异常", async () => {
    const controller = new AbortController();
    controller.abort(new Error("取消"));
    await expect(abortable(Promise.reject(new Error("迟到拒绝")), controller.signal)).rejects.toThrow("取消");
    const active = new AbortController();
    const remove = vi.spyOn(active.signal, "removeEventListener");
    expect(await abortable(Promise.resolve(2), active.signal)).toBe(2);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });
});
