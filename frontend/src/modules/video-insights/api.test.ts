import { beforeEach, describe, expect, it, vi } from "vitest";
import { videoInsightsApi } from "./api";

const httpMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn()
}));

vi.mock("../../services/http", () => ({
  withApiError: (operation: () => Promise<unknown>) => operation(),
  httpClient: httpMock
}));

describe("video insights api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads a local video as multipart with an extended transcription timeout", async () => {
    httpMock.post.mockResolvedValue({ id: "insight-upload" });
    const file = new File(["video-bytes"], "demo.mp4", { type: "video/mp4" });

    await videoInsightsApi.upload(file);

    expect(httpMock.post).toHaveBeenCalledWith(
      "/tools/video-insights/upload",
      expect.any(FormData),
      expect.objectContaining({ timeout: 30 * 60 * 1000 })
    );
    const form = httpMock.post.mock.calls[0][1] as FormData;
    expect(form.get("file")).toMatchObject({ name: "demo.mp4", type: "video/mp4", size: 11 });
  });
});
