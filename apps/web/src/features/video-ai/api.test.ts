// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from "vitest";
import { videoAiApi } from "./api";

const http = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../../shared/http/http", () => ({
  withApiError: (operation: () => Promise<unknown>) => operation(),
  httpClient: http
}));
beforeEach(() => vi.clearAllMocks());

it("sends saved-result references without uploading video bytes for detection or processing", async () => {
  const signal = new AbortController().signal;
  await videoAiApi.detect({ sourceTaskId: "saved_result" }, signal);
  await videoAiApi.create(
    {
      sourceTaskId: "saved_result",
      mode: "fast",
      manualRanges: [{ start: 0, end: 1, rects: [{ x: 0, y: 0, width: 1, height: 0.1 }] }]
    },
    signal
  );
  for (const call of http.post.mock.calls) {
    const form = call[2] as FormData;
    expect(form.get("sourceTaskId")).toBe("saved_result");
    expect(form.has("video")).toBe(false);
    expect(call[3].signal).toBe(signal);
  }
  expect((http.post.mock.calls[1][2] as FormData).get("mode")).toBe("fast");
  expect((http.post.mock.calls[1][2] as FormData).has("manualRanges")).toBe(true);
});

it("preserves normal file upload for new videos", async () => {
  const file = new File(["video"], "clip.mp4");
  await videoAiApi.detect(file);
  await videoAiApi.create({ file, mode: "delogo" });
  for (const call of http.post.mock.calls) {
    const form = call[2] as FormData;
    expect((form.get("video") as File).name).toBe("clip.mp4");
    expect(form.has("sourceTaskId")).toBe(false);
  }
});

it("selects the retained original for both detection and processing", async () => {
  await videoAiApi.detect({ sourceTaskId: "saved_result", sourceVersion: "original" });
  await videoAiApi.create({ sourceTaskId: "saved_result", sourceVersion: "original", mode: "delogo" });
  for (const call of http.post.mock.calls) expect((call[2] as FormData).get("sourceVersion")).toBe("original");
  expect(videoAiApi.inputUrl("saved_result")).toContain("/tasks/saved_result/input");
});
