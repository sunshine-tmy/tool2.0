import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";

const originalFetch = globalThis.fetch;
let storageRoot: string;

beforeEach(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-short-video-"));
  process.env.STORAGE_ROOT = storageRoot;
  process.env.SHORT_VIDEO_PARSE_API_URL = "https://provider.test/api/short_videos";
  process.env.SHORT_VIDEO_PARSE_TIMEOUT_MS = "5000";
});

afterEach(async () => {
  globalThis.fetch = originalFetch;
  delete process.env.STORAGE_ROOT;
  delete process.env.SHORT_VIDEO_PARSE_API_URL;
  delete process.env.SHORT_VIDEO_PARSE_TIMEOUT_MS;
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

    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/tools/short-video/parse",
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
    expect(body.data.media).toEqual([
      expect.objectContaining({ type: "video", url: "https://cdn.test/video.mp4" })
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://provider.test/api/short_videos?url=https%3A%2F%2Fv.douyin.com%2Fabc123%2F",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("rejects unsupported hosts before calling the provider", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/tools/short-video/parse",
      payload: {
        input: "https://example.com/video/1"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("UNSUPPORTED_SHORT_VIDEO_URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns provider failures as clear bad requests", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 400, msg: "无法解析链接", data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const app = await createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/tools/short-video/parse",
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

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: `/api/tools/short-video/download?url=${encodeURIComponent(
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

    const app = await createApp();
    const response = await app.inject({
      method: "GET",
      url: `/api/tools/short-video/download?url=${encodeURIComponent(
        "https://cdn.test/video.mp4"
      )}&filename=${encodeURIComponent("默认视频.mp4")}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-disposition"]).toContain('filename="video.mp4"');
    expect(response.headers["content-disposition"]).toContain("filename*=UTF-8''%E9%BB%98%E8%AE%A4%E8%A7%86%E9%A2%91.mp4");
    expect(response.body).toBe("video-bytes");
  });
});
