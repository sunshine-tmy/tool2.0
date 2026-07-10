import { beforeEach, describe, expect, it, vi } from "vitest";
import { VIDEO_TEXT_REQUEST_TIMEOUT_MS, videoTextApi } from "./api";

const httpMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn()
}));

vi.mock("../../services/http", () => ({
  ApiRequest: () => (_target: object, _propertyKey: string | symbol, descriptor: PropertyDescriptor) => descriptor,
  httpClient: httpMock
}));

describe("video text api", () => {
  beforeEach(() => {
    httpMock.get.mockReset();
    httpMock.post.mockReset();
    httpMock.delete.mockReset();
  });

  it("allows long-running local transcription requests", () => {
    expect(VIDEO_TEXT_REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(30 * 60 * 1000);
  });

  it("lists analysis history with query params", async () => {
    httpMock.get.mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 5 });

    await videoTextApi.listHistory({ keyword: "coat", page: 2, pageSize: 5 });

    expect(httpMock.get).toHaveBeenCalledWith("/tools/video-text/history", {
      params: { keyword: "coat", page: 2, pageSize: 5 }
    });
  });

  it("creates a task from a remote video url", async () => {
    httpMock.post.mockResolvedValue({ task: { id: "task-1" }, result: null });

    await videoTextApi.createTaskFromUrl({
      url: "https://cdn.test/video.mp4",
      fileName: "默认视频.mp4"
    });

    expect(httpMock.post).toHaveBeenCalledWith(
      "/tools/video-text/tasks/from-url",
      {
        url: "https://cdn.test/video.mp4",
        fileName: "默认视频.mp4"
      },
      { timeout: VIDEO_TEXT_REQUEST_TIMEOUT_MS }
    );
  });

  it("loads and deletes a history result by id", async () => {
    httpMock.get.mockResolvedValue({ id: "task-1" });
    httpMock.delete.mockResolvedValue({ removed: true });

    await videoTextApi.getHistoryResult("task-1");
    await videoTextApi.deleteHistory("task-1");

    expect(httpMock.get).toHaveBeenCalledWith("/tools/video-text/history/task-1");
    expect(httpMock.delete).toHaveBeenCalledWith("/tools/video-text/history/task-1");
  });
});
