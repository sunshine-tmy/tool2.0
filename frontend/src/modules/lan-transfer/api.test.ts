import { beforeEach, describe, expect, it, vi } from "vitest";
import { lanTransferApi } from "./api";

const httpMock = vi.hoisted(() => ({
  get: vi.fn(),
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

  it("publishes text and multiple images as multipart data", async () => {
    httpMock.post.mockResolvedValue({ id: "note-1" });
    const first = new File(["first"], "first.png", { type: "image/png" });
    const second = new File(["second"], "second.webp", { type: "image/webp" });

    await lanTransferApi.createNote({
      title: "设备信息",
      content: "验证码 246810",
      images: [first, second]
    });

    expect(httpMock.post).toHaveBeenCalledWith("/tools/lan-transfer/notes", expect.any(FormData));
    const form = httpMock.post.mock.calls[0][1] as FormData;
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

    expect(httpMock.get).toHaveBeenCalledWith("/tools/lan-transfer/notes", { params: { page: 2, pageSize: 10 } });
    expect(httpMock.patch).toHaveBeenCalledWith("/tools/lan-transfer/notes/note-1/expiry", { days: 30 });
    expect(httpMock.delete).toHaveBeenCalledWith("/tools/lan-transfer/notes/note-1");
  });
});
