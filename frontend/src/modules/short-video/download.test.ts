import { describe, expect, it } from "vitest";
import { createShortVideoDownloadName, createShortVideoDownloadUrl, triggerShortVideoDownload } from "./download";
import type { ShortVideoMedia } from "@toolbox/shared";

describe("short video downloads", () => {
  it("uses the media label and url extension for download names", () => {
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
    const media: ShortVideoMedia = {
      type: "video",
      label: "Public Video",
      url: "https://cdn.test/video.mp4?token=abc"
    };

    expect(createShortVideoDownloadUrl(media, "https://tool.test/api")).toBe(
      "https://tool.test/api/tools/short-video/download?url=https%3A%2F%2Fcdn.test%2Fvideo.mp4%3Ftoken%3Dabc&filename=Public-Video.mp4"
    );
  });

  it("starts downloads through a hidden local download frame", () => {
    const media: ShortVideoMedia = {
      type: "video",
      label: "默认视频",
      url: "https://cdn.test/video.mp4"
    };
    const frameUrls: string[] = [];
    const removedFrameUrls: unknown[] = [];
    const scheduledTasks: Array<() => void> = [];

    triggerShortVideoDownload(media, {
      apiBase: "https://tool.test/api",
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
      "https://tool.test/api/tools/short-video/download?url=https%3A%2F%2Fcdn.test%2Fvideo.mp4&filename=%E9%BB%98%E8%AE%A4%E8%A7%86%E9%A2%91.mp4"
    ]);
    expect(removedFrameUrls).toEqual([]);
    scheduledTasks.forEach((task) => task());
    expect(removedFrameUrls).toEqual(frameUrls);
  });
});
