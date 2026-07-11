import { describe, expect, it } from "vitest";
import { classifyLanFile, isLanFilePreviewable, normalizeLanFileQuery } from "../lan-file";
import { getToolById } from "../tools";

describe("lan file contracts", () => {
  it.each([
    ["photo.JPG", "image/jpeg", "image"],
    ["clip.mp4", "video/mp4", "video"],
    ["voice.mp3", "audio/mpeg", "audio"],
    ["notes.txt", "text/plain", "text"],
    ["catalog.pdf", "application/pdf", "pdf"],
    ["archive.zip", "application/zip", "archive"],
    ["sheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "document"],
    ["unknown.bin", "application/octet-stream", "other"]
  ] as const)("classifies %s as %s", (fileName, mimeType, expected) => {
    expect(classifyLanFile(fileName, mimeType)).toBe(expected);
  });

  it("marks browser-native file categories as previewable", () => {
    expect(isLanFilePreviewable("image")).toBe(true);
    expect(isLanFilePreviewable("video")).toBe(true);
    expect(isLanFilePreviewable("audio")).toBe(true);
    expect(isLanFilePreviewable("text")).toBe(true);
    expect(isLanFilePreviewable("pdf")).toBe(true);
    expect(isLanFilePreviewable("archive")).toBe(false);
  });

  it("normalizes query defaults and rejects unsupported enum values", () => {
    expect(normalizeLanFileQuery({})).toEqual({
      keyword: "",
      category: undefined,
      extension: "",
      sortBy: "createdAt",
      sortOrder: "desc",
      page: 1,
      pageSize: 10
    });

    expect(
      normalizeLanFileQuery({
        keyword: " report ",
        category: "video",
        extension: ".MP4",
        sortBy: "size",
        sortOrder: "asc"
      })
    ).toEqual({
      keyword: "report",
      category: "video",
      extension: "mp4",
      sortBy: "size",
      sortOrder: "asc",
      page: 1,
      pageSize: 10
    });
  });

  it("normalizes pagination values", () => {
    expect(
      normalizeLanFileQuery({
        page: "3",
        pageSize: "20"
      })
    ).toMatchObject({
      page: 3,
      pageSize: 20
    });

    expect(
      normalizeLanFileQuery({
        page: "-1",
        pageSize: "999"
      })
    ).toMatchObject({
      page: 1,
      pageSize: 10
    });
  });

  it("exposes the LAN transfer tool as ready", () => {
    expect(getToolById("lan-transfer")?.status).toBe("ready");
  });
});
