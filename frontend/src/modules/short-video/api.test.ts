import { beforeEach, describe, expect, it, vi } from "vitest";
import { shortVideoApi } from "./api";

const httpMock = vi.hoisted(() => ({
  post: vi.fn()
}));

vi.mock("../../services/http", () => ({
  ApiRequest: () => (_target: object, _propertyKey: string | symbol, descriptor: PropertyDescriptor) => descriptor,
  httpClient: httpMock
}));

describe("short video api", () => {
  beforeEach(() => {
    httpMock.post.mockReset();
  });

  it("submits parse requests through the local backend", async () => {
    httpMock.post.mockResolvedValue({ title: "demo", media: [] });

    await shortVideoApi.parse({
      input: "https://v.douyin.com/abc123/",
      platform: "douyin"
    });

    expect(httpMock.post).toHaveBeenCalledWith("/tools/short-video/parse", {
      input: "https://v.douyin.com/abc123/",
      platform: "douyin"
    });
  });
});
