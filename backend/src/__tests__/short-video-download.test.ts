/**
 * 中文模块说明：测试 backend/src/__tests__/short-video-download.test.ts 中的稳定行为、边界条件和回归场景
 */
import { describe, expect, it } from "vitest";
import { sanitizeDownloadFilename } from "../modules/short-video-download";

describe("short video download filename safety", () => {
  it("removes control characters and header separators before disposition encoding", () => {
    expect(sanitizeDownloadFilename("report\r\nX-Injected: yes?.mp4\u0000")).toBe("reportX-Injected yes.mp4");
  });

  it("falls back to a safe name when the input only contains separators", () => {
    expect(sanitizeDownloadFilename('\\/:*?"<>|\r\n')).toBe("short-video-media");
  });
});
