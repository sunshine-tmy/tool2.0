import { describe, expect, it } from "vitest";
import { removeUploadItem } from "./upload-queue";
import type { UploadItem } from "./types";

describe("upload queue helpers", () => {
  it("removes the canceled upload item from the visible queue", () => {
    const target: UploadItem = {
      name: "big.mp4",
      progress: 40,
      status: "uploading"
    };
    const other: UploadItem = {
      name: "small.mp3",
      progress: 10,
      status: "uploading"
    };

    expect(removeUploadItem([target, other], target)).toEqual([other]);
  });
});
