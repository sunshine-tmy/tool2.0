/**
 * 中文模块说明：测试 frontend/src/modules/short-video/download.test.ts 中的稳定行为、边界条件和回归场景
 */
import { describe, expect, it } from "vitest";
import { createShortVideoDownloadName, createShortVideoDownloadUrl, triggerShortVideoDownload } from "./download";
import type { ShortVideoMedia } from "@toolbox/shared";

describe("short video downloads", () => {
  it("uses the media label and url extension for download names", () => {
    // 下载名称必须同时满足用户可读性和文件系统安全性。
    const media: ShortVideoMedia = {
      type: "video",
      label: "Default Video",
      url: "https://cdn.test/video.mp4?token=abc"
    };

    expect(createShortVideoDownloadName(media)).toBe("Default-Video.mp4");
  });

  it("falls back to a media type extension when the url has none", () => {
    const media: ShortVideoMedia = {
      type: "image",
      label: "Cover Image",
      url: "https://cdn.test/media/download"
    };

    expect(createShortVideoDownloadName(media)).toBe("Cover-Image.jpg");
  });

  it("creates a local backend download url for remote media", () => {
    // 浏览器不直接请求第三方媒体，统一通过本地后端代理执行安全校验和流式下载。
    const media: ShortVideoMedia = {
      type: "video",
      label: "Public Video",
      url: "https://cdn.test/video.mp4?token=abc"
    };

    expect(createShortVideoDownloadUrl(media, "https://tool.test/api/v1")).toBe(
      "https://tool.test/api/v1/tools/short-video/download?url=https%3A%2F%2Fcdn.test%2Fvideo.mp4%3Ftoken%3Dabc&filename=Public-Video.mp4"
    );
  });

  it("starts downloads through a hidden local download frame", () => {
    // 隐藏 iframe 避免把大文件读入 JS 内存，并验证定时清理不会遗留 DOM 节点。
    const media: ShortVideoMedia = {
      type: "video",
      label: "默认视频",
      url: "https://cdn.test/video.mp4"
    };
    const frameUrls: string[] = [];
    const removedFrameUrls: unknown[] = [];
    const scheduledTasks: Array<() => void> = [];

    triggerShortVideoDownload(media, {
      apiBase: "https://tool.test/api/v1",
      deps: {
        startFrameDownload: (url) => {
          frameUrls.push(url);
          return url;
        },
        removeFrameDownload: (frame) => removedFrameUrls.push(frame),
        scheduleCleanup: (task) => scheduledTasks.push(task)
      }
    });

    expect(frameUrls).toEqual([
      "https://tool.test/api/v1/tools/short-video/download?url=https%3A%2F%2Fcdn.test%2Fvideo.mp4&filename=%E9%BB%98%E8%AE%A4%E8%A7%86%E9%A2%91.mp4"
    ]);
    expect(removedFrameUrls).toEqual([]);
    scheduledTasks.forEach((task) => task());
    expect(removedFrameUrls).toEqual(frameUrls);
  });
});
