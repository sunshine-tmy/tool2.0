import { beforeEach, describe, expect, it, vi } from "vitest";
import { VIDEO_TEXT_REQUEST_TIMEOUT_MS, videoTextApi } from "./api";

const httpMock = vi.hoisted(() => ({
  get: vi.fn(),
  delete: vi.fn()
}));

vi.mock("../../services/http", () => ({
  ApiRequest: () => (_target: object, _propertyKey: string | symbol, descriptor: PropertyDescriptor) => descriptor,
  httpClient: httpMock
}));

describe("video text api", () => {
  beforeEach(() => {
    httpMock.get.mockReset();
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

  it("loads and deletes a history result by id", async () => {
    httpMock.get.mockResolvedValue({ id: "task-1" });
    httpMock.delete.mockResolvedValue({ removed: true });

    await videoTextApi.getHistoryResult("task-1");
    await videoTextApi.deleteHistory("task-1");

    expect(httpMock.get).toHaveBeenCalledWith("/tools/video-text/history/task-1");
    expect(httpMock.delete).toHaveBeenCalledWith("/tools/video-text/history/task-1");
  });
});
