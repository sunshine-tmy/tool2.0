/**
 * 中文模块说明：测试 frontend/src/modules/video-text/remote-source.test.ts 中的稳定行为、边界条件和回归场景
 */
import { describe, expect, it } from "vitest";
import { createRemoteVideoPreviewUrl, getRemoteVideoSourceFromQuery } from "./remote-source";

describe("video text remote source query", () => {
  it("reads a remote video source from route query values", () => {
    expect(
      getRemoteVideoSourceFromQuery({
        remoteUrl: "https://cdn.test/video.mp4",
        fileName: "默认视频.mp4"
      })
    ).toEqual({
      url: "https://cdn.test/video.mp4",
      fileName: "默认视频.mp4"
    });
  });

  it("rejects non-http remote video sources", () => {
    expect(getRemoteVideoSourceFromQuery({ remoteUrl: "javascript:alert(1)", fileName: "bad.mp4" })).toBeNull();
  });

  it("falls back to the remote url filename", () => {
    expect(getRemoteVideoSourceFromQuery({ remoteUrl: "https://cdn.test/path/video%201.mp4" })).toEqual({
      url: "https://cdn.test/path/video%201.mp4",
      fileName: "video 1.mp4"
    });
  });

  it("creates a local preview proxy url for remote videos", () => {
    expect(createRemoteVideoPreviewUrl("https://cdn.test/video.mp4?token=abc", "https://tool.test/api/v1")).toBe(
      "https://tool.test/api/v1/tools/video-text/remote-video?url=https%3A%2F%2Fcdn.test%2Fvideo.mp4%3Ftoken%3Dabc"
    );
  });
});
