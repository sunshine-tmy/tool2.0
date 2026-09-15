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
