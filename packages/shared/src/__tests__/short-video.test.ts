import { describe, expect, it } from "vitest";
import { detectShortVideoPlatform, extractFirstUrl, normalizeShortVideoProviderResult } from "../short-video";

describe("short video helpers", () => {
  it("extracts the first url from shared text", () => {
    expect(extractFirstUrl("复制这段话 https://v.douyin.com/abc123/ 打开看看")).toBe("https://v.douyin.com/abc123/");
  });

  it("detects supported platforms from public share urls", () => {
    expect(detectShortVideoPlatform("https://v.douyin.com/abc123/")).toBe("douyin");
    expect(detectShortVideoPlatform("https://www.xiaohongshu.com/explore/abc")).toBe("xiaohongshu");
    expect(detectShortVideoPlatform("https://www.tiktok.com/@creator/video/123456789")).toBe("tiktok");
    expect(detectShortVideoPlatform("https://vm.tiktok.com/abc123/")).toBe("tiktok");
    expect(detectShortVideoPlatform("https://vt.tiktok.com/abc123/")).toBe("tiktok");
    expect(detectShortVideoPlatform("https://example.com/watch/1")).toBe("unknown");
  });

  it("does not accept lookalike platform domains", () => {
    expect(detectShortVideoPlatform("https://evildouyin.com/video/1")).toBe("unknown");
    expect(detectShortVideoPlatform("https://douyin.com.attacker.test/video/1")).toBe("unknown");
    expect(detectShortVideoPlatform("https://evilxiaohongshu.com/explore/1")).toBe("unknown");
    expect(detectShortVideoPlatform("https://eviltiktok.com/video/1")).toBe("unknown");
    expect(detectShortVideoPlatform("https://tiktok.com.attacker.test/video/1")).toBe("unknown");
    expect(detectShortVideoPlatform("ftp://tiktok.com/video/1")).toBe("unknown");
  });

  it("normalizes TikTok provider responses", () => {
    const result = normalizeShortVideoProviderResult(
      {
        code: 200,
        platform: "tiktok",
        data: {
          type: "video",
          title: "TikTok demo",
          author: { name: "creator", id: "creator-id", avatar: "https://cdn.test/avatar.jpeg" },
          cover: "https://cdn.test/cover.webp",
          url: "https://cdn.test/video.mp4"
        }
      },
      {
        sourceUrl: "https://www.tiktok.com/@creator/video/123456789",
        requestedPlatform: "auto"
      }
    );

    expect(result).toMatchObject({
      platform: "tiktok",
      title: "TikTok demo",
      author: { name: "creator", id: "creator-id" },
      coverUrl: "https://cdn.test/cover.webp",
      media: [{ type: "video", url: "https://cdn.test/video.mp4" }]
    });
  });

  it("normalizes provider video and image media into a stable result shape", () => {
    const result = normalizeShortVideoProviderResult(
      {
        code: 200,
        msg: "ok",
        platform: "xiaohongshu",
        data: {
          type: "video",
          title: "",
          desc: "A public note",
          author: { name: "creator", id: "u1", avatar: "https://cdn.test/a.jpg" },
          cover: "https://cdn.test/cover.jpg",
          url: "https://cdn.test/video.mp4",
          images: ["https://cdn.test/image.jpg"],
          video_backup: [
            {
              label: "720p",
              quality: "720p",
              url: "https://cdn.test/video-720.mp4",
              width: 720,
              height: 1280,
              bit_rate: 900000
            }
          ]
        }
      },
      {
        sourceUrl: "https://www.xiaohongshu.com/explore/abc",
        requestedPlatform: "auto"
      }
    );

    expect(result).toMatchObject({
      platform: "xiaohongshu",
      sourceUrl: "https://www.xiaohongshu.com/explore/abc",
      type: "video",
      title: "A public note",
      author: {
        name: "creator",
        id: "u1",
        avatarUrl: "https://cdn.test/a.jpg"
      },
      coverUrl: "https://cdn.test/cover.jpg"
    });
    expect(result.media).toEqual([
      expect.objectContaining({ type: "video", url: "https://cdn.test/video.mp4", label: "默认视频" }),
      expect.objectContaining({ type: "image", url: "https://cdn.test/image.jpg", label: "图片 1" }),
      expect.objectContaining({ type: "video", url: "https://cdn.test/video-720.mp4", quality: "720p" })
    ]);
  });
});
