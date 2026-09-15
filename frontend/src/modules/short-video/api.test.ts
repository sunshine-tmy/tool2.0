/**
 * 中文模块说明：测试 frontend/src/modules/short-video/api.test.ts 中的稳定行为、边界条件和回归场景
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShortVideoParseResultSchema } from "@toolbox/shared";
import { shortVideoApi } from "./api";

const httpMock = vi.hoisted(() => ({
  post: vi.fn()
}));

vi.mock("../../services/http", () => ({
  withApiError: (operation: () => Promise<unknown>) => operation(),
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

    expect(httpMock.post).toHaveBeenCalledWith("/tools/short-video/parse", ShortVideoParseResultSchema, {
      input: "https://v.douyin.com/abc123/",
      platform: "douyin"
    });
  });

  it("submits TikTok parse requests", async () => {
    httpMock.post.mockResolvedValue({ title: "TikTok demo", media: [] });

    await shortVideoApi.parse({
      input: "https://www.tiktok.com/@creator/video/123456789",
      platform: "tiktok"
    });

    expect(httpMock.post).toHaveBeenCalledWith("/tools/short-video/parse", ShortVideoParseResultSchema, {
      input: "https://www.tiktok.com/@creator/video/123456789",
      platform: "tiktok"
    });
  });
});
