import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImageCompressResultSchema } from "@toolbox/shared";
import { imageCompressApi } from "./api";

const httpMock = vi.hoisted(() => ({ post: vi.fn(), postBlob: vi.fn() }));

vi.mock("../../services/http", () => ({
  withApiError: (operation: () => Promise<unknown>) => operation(),
  httpClient: httpMock
}));

describe("image compression api", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uploads one image and downloads selected results", async () => {
    httpMock.post.mockResolvedValue({});
    httpMock.postBlob.mockResolvedValue({ blob: new Blob() });
    const form = new FormData();
    const progress = vi.fn();

    await imageCompressApi.upload(form, progress);
    await imageCompressApi.downloadAll([{ taskId: "task-1", fileName: "result.webp" }]);

    expect(httpMock.post).toHaveBeenCalledWith("/tools/image-compress", ImageCompressResultSchema, form, {
      onUploadProgress: progress
    });
    expect(httpMock.postBlob).toHaveBeenCalledWith("/tools/image-compress/download.zip", {
      files: [{ taskId: "task-1", fileName: "result.webp" }]
    });
  });
});
