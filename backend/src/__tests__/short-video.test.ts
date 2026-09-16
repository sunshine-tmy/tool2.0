/**
 * 中文模块说明：测试 backend/src/__tests__/short-video.test.ts 中的稳定行为、边界条件和回归场景
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";

const originalFetch = globalThis.fetch;
const publicTestResolver = async () => [{ address: "93.184.216.34", family: 4 }];
let storageRoot: string;

beforeEach(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-short-video-"));
  process.env.STORAGE_ROOT = storageRoot;
  process.env.SHORT_VIDEO_PARSE_API_URL = "https://provider.test/api/v1/short_videos";
  process.env.SHORT_VIDEO_PARSE_TIMEOUT_MS = "5000";
  process.env.SHORT_VIDEO_PARSE_RETRIES = "0";
  process.env.SHORT_VIDEO_XHS_LOCAL_FALLBACK = "false";
  process.env.XHS_RUNTIME_DIR = path.join(storageRoot, "xhs-runtime");
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  delete process.env.STORAGE_ROOT;
  delete process.env.SHORT_VIDEO_PARSE_API_URL;
  delete process.env.SHORT_VIDEO_PARSE_TIMEOUT_MS;
  delete process.env.SHORT_VIDEO_PARSE_RETRIES;
  delete process.env.SHORT_VIDEO_XHS_LOCAL_FALLBACK;
  delete process.env.XHS_RUNTIME_DIR;
  delete process.env.XHS_PROVIDER_URL;
  vi.restoreAllMocks();
  await fs.rm(storageRoot, { recursive: true, force: true });
});

describe("short video api", () => {
  it("parses a supported share url through the configured provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "解析成功",
          platform: "douyin",
          data: {
            type: "video",
            title: "Public video",
            desc: "Public video description",
            author: { name: "creator", id: "100", avatar: "https://cdn.test/avatar.jpg" },
            cover: "https://cdn.test/cover.jpg",
            url: "https://cdn.test/video.mp4",
            images: []
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    globalThis.fetch = fetchMock;

    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/short-video/parse",
      payload: {
        input: "分享链接 https://v.douyin.com/abc123/",
        platform: "auto"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toMatchObject({
      platform: "douyin",
      title: "Public video",
      sourceUrl: "https://v.douyin.com/abc123/",
      provider: "bugpk"
    });
    expect(body.data.media).toEqual([expect.objectContaining({ type: "video", url: "https://cdn.test/video.mp4" })]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://provider.test/api/v1/short_videos?url=https%3A%2F%2Fv.douyin.com%2Fabc123%2F",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("migrates the retired BugPk v1 endpoint from existing environment files", async () => {
    process.env.SHORT_VIDEO_PARSE_API_URL = "https://api.bugpk.com/api/v1/short_videos";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          platform: "douyin",
          data: { type: "video", title: "Migrated", url: "https://cdn.test/video.mp4" }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    globalThis.fetch = fetchMock;

    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/short-video/parse",
      payload: { input: "https://v.douyin.com/abc123/" }
    });

    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.bugpk.com/api/short_videos?url=https%3A%2F%2Fv.douyin.com%2Fabc123%2F",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    await app.close();
  });

  it("uses BugPk's dedicated Xiaohongshu endpoint and normalizes its image fields", async () => {
    process.env.SHORT_VIDEO_PARSE_API_URL = "https://api.bugpk.com/api/short_videos";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "解析成功",
          platform: "xiaohongshu",
          data: {
            type: "image",
            title: "XHS note",
            author: "creator",
            userId: "creator-id",
            avatar: "https://cdn.test/avatar.jpg",
            cover: "https://cdn.test/cover.jpg",
            imgurl: ["https://cdn.test/image-1.jpg"]
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    globalThis.fetch = fetchMock;

    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/short-video/parse",
      payload: { input: "https://www.xiaohongshu.com/discovery/item/abc123" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      platform: "xiaohongshu",
      title: "XHS note",
      author: { name: "creator", id: "creator-id" },
      media: [{ type: "image", url: "https://cdn.test/image-1.jpg" }]
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.bugpk.com/api/xhsjx?url=https%3A%2F%2Fwww.xiaohongshu.com%2Fdiscovery%2Fitem%2Fabc123",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    await app.close();
  });

  it("falls back to the local XHS runtime when the public provider cannot parse the note", async () => {
    process.env.SHORT_VIDEO_XHS_LOCAL_FALLBACK = "true";
    process.env.XHS_PROVIDER_URL = "https://xhs-provider.test";
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://provider.test/api/v1/short_videos")) {
        return new Response(JSON.stringify({ code: 404, msg: "未找到有效内容" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (url === "https://xhs-provider.test/extract") {
        return new Response(
          JSON.stringify({
            success: true,
            items: [
              {
                作品ID: "note-local",
                作品标题: "本机解析结果",
                作品描述: "本机解析正文",
                作品类型: "视频",
                作者ID: "author-local",
                作者昵称: "本机作者",
                下载地址: ["https://cdn.test/local-video.mp4"]
              }
            ]
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/short-video/parse",
      payload: { input: "https://www.xiaohongshu.com/discovery/item/note-local" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      provider: "xhs-downloader",
      title: "本机解析结果",
      author: { id: "author-local", name: "本机作者" },
      media: [{ type: "video", url: "https://cdn.test/local-video.mp4" }]
    });
    await app.close();
  });

  it("asks for Xiaohongshu login when both public and anonymous local parsing fail", async () => {
    process.env.SHORT_VIDEO_XHS_LOCAL_FALLBACK = "true";
    process.env.XHS_PROVIDER_URL = "https://xhs-provider.test";
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith("https://provider.test/api/v1/short_videos")) {
        return new Response(JSON.stringify({ code: 404, msg: "未找到有效内容" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (url === "https://xhs-provider.test/extract") {
        return new Response(JSON.stringify({ success: true, items: [{}] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as typeof fetch;

    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/short-video/parse",
      payload: { input: "https://www.xiaohongshu.com/discovery/item/login-required" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "SHORT_VIDEO_XHS_AUTH_REQUIRED" },
      message: "小红书限制了未登录访问，请登录小红书后自动重试"
    });
    await app.close();
  });

  it("rejects unsupported hosts before calling the provider", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/short-video/parse",
      payload: {
        input: "https://example.com/video/1"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("UNSUPPORTED_SHORT_VIDEO_URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed parse and download requests at the schema boundary", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    const app = await createApp({ remoteAddressResolver: publicTestResolver });

    const invalidParse = await app.inject({
      method: "POST",
      url: "/api/v1/tools/short-video/parse",
      payload: { platform: "auto" }
    });
    const invalidDownload = await app.inject({ method: "GET", url: "/api/v1/tools/short-video/download" });

    expect(invalidParse.statusCode).toBe(400);
    expect(invalidParse.json()).toMatchObject({
      success: false,
      error: { code: "REQUEST_INVALID" },
      requestId: expect.any(String)
    });
    expect(invalidDownload.statusCode).toBe(400);
    expect(invalidDownload.json().error.code).toBe("REQUEST_INVALID");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses TikTok share links and normalizes downloadable media", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          msg: "解析成功",
          platform: "tiktok",
          data: {
            type: "video",
            title: "TikTok demo",
            author: { name: "creator", id: "creator-id", avatar: "https://cdn.test/avatar.jpeg" },
            cover: "https://cdn.test/cover.webp",
            url: "https://cdn.test/tiktok.mp4"
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    globalThis.fetch = fetchMock;

    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/short-video/parse",
      payload: {
        input: "https://www.tiktok.com/@creator/video/123456789",
        platform: "tiktok"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      platform: "tiktok",
      title: "TikTok demo",
      provider: "bugpk",
      media: [{ type: "video", url: "https://cdn.test/tiktok.mp4" }]
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://provider.test/api/v1/short_videos?url=https%3A%2F%2Fwww.tiktok.com%2F%40creator%2Fvideo%2F123456789",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("rejects an explicit platform that does not match the share link", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/short-video/parse",
      payload: {
        input: "https://www.tiktok.com/@creator/video/123456789",
        platform: "douyin"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("SHORT_VIDEO_PLATFORM_MISMATCH");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caches repeated parse results for the same application instance", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 200,
          platform: "tiktok",
          data: { type: "video", title: "Cached TikTok", url: "https://cdn.test/cached.mp4" }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    globalThis.fetch = fetchMock;
    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const payload = { input: "https://vm.tiktok.com/abc123/", platform: "auto" };

    const first = await app.inject({ method: "POST", url: "/api/v1/tools/short-video/parse", payload });
    const second = await app.inject({ method: "POST", url: "/api/v1/tools/short-video/parse", payload });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json().data.cacheStatus).toBe("local-hit");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to TikTok official oEmbed when downloadable media parsing fails", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 400, msg: "媒体解析暂不可用" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            title: "Official TikTok preview",
            author_name: "creator",
            author_url: "https://www.tiktok.com/@creator",
            html: '<blockquote data-video-id="123456789"></blockquote>'
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );

    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/short-video/parse",
      payload: { input: "https://www.tiktok.com/@creator/video/123456789" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      platform: "tiktok",
      provider: "tiktok-oembed",
      title: "Official TikTok preview",
      embedUrl: "https://www.tiktok.com/player/v1/123456789",
      media: []
    });
  });

  it("retries transient provider failures once", async () => {
    process.env.SHORT_VIDEO_PARSE_RETRIES = "1";
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("temporary network failure"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 200,
            platform: "tiktok",
            data: { type: "video", title: "Retry success", url: "https://cdn.test/retry.mp4" }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
    globalThis.fetch = fetchMock;

    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/short-video/parse",
      payload: { input: "https://www.tiktok.com/@creator/video/123456789" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.title).toBe("Retry success");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns provider failures as clear bad requests", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 400, msg: "无法解析链接", data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/short-video/parse",
      payload: {
        input: "https://www.xiaohongshu.com/explore/abc",
        platform: "xiaohongshu"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      success: false,
      error: { code: "SHORT_VIDEO_PARSE_FAILED" }
    });
  });

  it("downloads remote media as a local attachment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("video-bytes", {
        status: 200,
        headers: { "content-type": "video/mp4", "content-length": "11" }
      })
    );
    globalThis.fetch = fetchMock;

    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/tools/short-video/download?url=${encodeURIComponent(
        "https://cdn.test/video.mp4"
      )}&filename=${encodeURIComponent("Public Video.mp4")}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("video/mp4");
    expect(response.headers["content-length"]).toBe("11");
    expect(response.headers["content-disposition"]).toContain('filename="Public Video.mp4"');
    expect(response.body).toBe("video-bytes");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cdn.test/video.mp4",
      expect.objectContaining({
        headers: expect.objectContaining({ accept: "*/*" })
      })
    );
  });

  it("supports unicode download filenames without crashing", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("video-bytes", {
        status: 200,
        headers: { "content-type": "video/mp4" }
      })
    );

    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/tools/short-video/download?url=${encodeURIComponent(
        "https://cdn.test/video.mp4"
      )}&filename=${encodeURIComponent("默认视频.mp4")}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-disposition"]).toContain('filename="video.mp4"');
    expect(response.headers["content-disposition"]).toContain(
      "filename*=UTF-8''%E9%BB%98%E8%AE%A4%E8%A7%86%E9%A2%91.mp4"
    );
    expect(response.body).toBe("video-bytes");
  });

  it("keeps parsing available after a proxied media stream times out", async () => {
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).startsWith("https://cdn.test/")) {
        return new Response(
          new ReadableStream({
            start(controller) {
              setTimeout(() => controller.error(new DOMException("The operation timed out", "TimeoutError")), 5);
            }
          }),
          { status: 200, headers: { "content-type": "video/mp4" } }
        );
      }

      return new Response(
        JSON.stringify({
          code: 200,
          data: {
            type: "video",
            title: "Recovered parse",
            url: "https://cdn.test/video.mp4"
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    const app = await createApp({ remoteAddressResolver: publicTestResolver });
    await app.inject({
      method: "GET",
      url: `/api/v1/tools/short-video/download?url=${encodeURIComponent("https://cdn.test/video.mp4")}`
    });

    const retry = await app.inject({
      method: "POST",
      url: "/api/v1/tools/short-video/parse",
      payload: { input: "https://v.douyin.com/abc123/" }
    });

    expect(retry.statusCode).toBe(200);
    expect(retry.json().data.title).toBe("Recovered parse");
  });
});
