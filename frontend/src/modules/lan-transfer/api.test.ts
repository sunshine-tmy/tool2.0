/**
 * 中文模块说明：测试 frontend/src/modules/lan-transfer/api.test.ts 中的稳定行为、边界条件和回归场景
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LanBatchRemovalSchema,
  LanFileListSchema,
  LanFileWithUrlsSchema,
  LanNoteListSchema,
  LanNoteSchema,
  LanRemovalSchema,
  LanUploadStatusSchema
} from "@toolbox/shared";
import { lanTransferApi } from "./api";

const httpMock = vi.hoisted(() => ({
  get: vi.fn(),
  getText: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  put: vi.fn(),
  postBlob: vi.fn()
}));

vi.mock("../../services/http", () => ({
  withApiError: (operation: () => Promise<unknown>) => operation(),
  httpClient: httpMock
}));

describe("LAN transfer text-image API", () => {
  beforeEach(() => vi.clearAllMocks());

  // multipart 字段名是前后端协议的一部分，除了请求路径还要验证多图片数量和文件元数据。
  it("publishes text and multiple images as multipart data", async () => {
    httpMock.post.mockResolvedValue({ id: "note-1" });
    const first = new File(["first"], "first.png", { type: "image/png" });
    const second = new File(["second"], "second.webp", { type: "image/webp" });

    await lanTransferApi.createNote({
      title: "设备信息",
      content: "验证码 246810",
      images: [first, second]
    });

    expect(httpMock.post).toHaveBeenCalledWith("/tools/lan-transfer/notes", LanNoteSchema, expect.any(FormData));
    const form = httpMock.post.mock.calls[0][2] as FormData;
    expect(form.get("title")).toBe("设备信息");
    expect(form.get("content")).toBe("验证码 246810");
    expect(form.getAll("images")).toHaveLength(2);
    expect(form.getAll("images")[0]).toMatchObject({ name: "first.png", type: "image/png" });
  });

  it("loads and manages LAN notes through the canonical namespace", async () => {
    httpMock.get.mockResolvedValue({ notes: [], pagination: { page: 1, pageSize: 20, total: 0, pageCount: 1 } });
    httpMock.patch.mockResolvedValue({ id: "note-1" });
    httpMock.delete.mockResolvedValue({ removed: true });

    await lanTransferApi.listNotes(2, 10);
    await lanTransferApi.updateNoteExpiry("note-1", 30);
    await lanTransferApi.deleteNote("note-1");
    await lanTransferApi.deleteNotes(["note-1", "note-2"]);

    expect(httpMock.get).toHaveBeenCalledWith("/tools/lan-transfer/notes", LanNoteListSchema, {
      params: { page: 2, pageSize: 10 }
    });
    expect(httpMock.patch).toHaveBeenCalledWith("/tools/lan-transfer/notes/note-1/expiry", LanNoteSchema, {
      days: 30
    });
    expect(httpMock.delete).toHaveBeenCalledWith("/tools/lan-transfer/notes/note-1", LanRemovalSchema);
    expect(httpMock.post).toHaveBeenCalledWith("/tools/lan-transfer/notes/batch-delete", LanBatchRemovalSchema, {
      ids: ["note-1", "note-2"]
    });
  });

  it("covers resumable upload, file listing, preview, expiry, deletion and download operations", async () => {
    for (const method of Object.values(httpMock)) method.mockResolvedValue({});
    const file = new File(["payload"], "payload.txt", { type: "text/plain" });
    const chunk = file.slice(0, 3);
    const progress = vi.fn();
    const controller = new AbortController();

    await lanTransferApi.getInfo();
    await lanTransferApi.unlock("246810");
    await lanTransferApi.uploadFile(file, progress);
    await lanTransferApi.createUploadSession({
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      chunkSize: 3,
      totalChunks: 3
    });
    await lanTransferApi.getUploadStatus("upload-1");
    await lanTransferApi.uploadChunk("upload-1", 0, chunk, progress, controller.signal);
    await lanTransferApi.completeUpload("upload-1");
    await lanTransferApi.cancelUpload("upload-1");
    await lanTransferApi.listFiles({ page: 2, pageSize: 10 });
    await lanTransferApi.getTextPreview("/tools/lan-transfer/files/file-1/preview");
    await lanTransferApi.updateExpiry("file-1", 30);
    await lanTransferApi.deleteFile("file-1");
    await lanTransferApi.deleteFiles(["file-1", "file-2"]);
    await lanTransferApi.downloadFiles(["file-1", "file-2"]);

    expect(httpMock.put).toHaveBeenCalledWith(
      "/tools/lan-transfer/uploads/upload-1/chunks/0",
      LanUploadStatusSchema,
      expect.any(FormData),
      expect.objectContaining({ onUploadProgress: progress, signal: controller.signal })
    );
    expect(httpMock.get).toHaveBeenCalledWith("/tools/lan-transfer/files", LanFileListSchema, {
      params: { page: 2, pageSize: 10 }
    });
    expect(httpMock.getText).toHaveBeenCalledWith("/tools/lan-transfer/files/file-1/preview");
    expect(httpMock.patch).toHaveBeenCalledWith("/tools/lan-transfer/files/file-1/expiry", LanFileWithUrlsSchema, {
      days: 30
    });
    expect(httpMock.postBlob).toHaveBeenCalledWith("/tools/lan-transfer/files/batch-download", {
      ids: ["file-1", "file-2"]
    });
  });
});
