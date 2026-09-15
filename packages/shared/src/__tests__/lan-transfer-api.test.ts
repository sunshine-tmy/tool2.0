/**
 * 中文模块说明：测试 packages/shared/src/__tests__/lan-transfer-api.test.ts 中的稳定行为、边界条件和回归场景
 */
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { LanFileListSchema, LanNoteSchema, LanTransferInfoSchema, LanUploadStatusSchema } from "../index";

describe("LAN transfer API schemas", () => {
  const file = {
    id: "file_123",
    originalName: "report.pdf",
    storedName: "file_123.pdf",
    mimeType: "application/pdf",
    extension: "pdf",
    size: 1024,
    category: "pdf",
    createdAt: "2026-09-15T00:00:00.000Z",
    expiresAt: "2026-09-22T00:00:00.000Z",
    downloadCount: 0,
    previewable: true
  };

  it("validates transfer information and paginated files", () => {
    expect(
      Value.Check(LanTransferInfoSchema, {
        lanUrls: ["http://192.168.1.2:5173/tools/lan-transfer"],
        retentionDays: 7,
        maxFileBytes: 1024,
        maxStorageBytes: 4096,
        usedBytes: 0,
        noteCount: 0,
        reservedUploadBytes: 0,
        pinRequired: true,
        guestMode: "upload-only",
        authenticated: false
      })
    ).toBe(true);
    expect(
      Value.Check(LanFileListSchema, {
        files: [{ ...file, previewUrl: "/preview", downloadUrl: "/download" }],
        pagination: { page: 1, pageSize: 20, total: 1, pageCount: 1 }
      })
    ).toBe(true);
  });

  it("validates note image URLs and rejects incomplete note images", () => {
    const note = {
      id: "note_123",
      content: "hello",
      images: [
        {
          id: "image_123",
          originalName: "photo.png",
          storedName: "note_123-image_123.png",
          mimeType: "image/png",
          extension: "png",
          size: 128,
          previewUrl: "/preview",
          downloadUrl: "/download"
        }
      ],
      createdAt: "2026-09-15T00:00:00.000Z",
      expiresAt: "2026-09-22T00:00:00.000Z"
    };
    expect(Value.Check(LanNoteSchema, note)).toBe(true);
    expect(Value.Check(LanNoteSchema, { ...note, images: [{ ...note.images[0], previewUrl: undefined }] })).toBe(false);
  });

  it("validates resumable upload progress", () => {
    expect(
      Value.Check(LanUploadStatusSchema, {
        uploadId: "upload_123",
        originalName: "video.mp4",
        mimeType: "video/mp4",
        size: 2048,
        chunkSize: 1024,
        totalChunks: 2,
        uploadedChunks: [0],
        uploadedBytes: 1024,
        createdAt: "2026-09-15T00:00:00.000Z",
        updatedAt: "2026-09-15T00:00:01.000Z"
      })
    ).toBe(true);
  });
});
