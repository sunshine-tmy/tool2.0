/**
 * 中文模块说明：测试 frontend/src/modules/lan-transfer/upload-queue.test.ts 中的稳定行为、边界条件和回归场景
 */
import { describe, expect, it } from "vitest";
import { removeUploadItem } from "./upload-queue";
import type { UploadItem } from "./types";

describe("upload queue helpers", () => {
  it("removes the canceled upload item from the visible queue", () => {
    const target: UploadItem = {
      id: "upload-1",
      name: "big.mp4",
      size: 100,
      progress: 40,
      status: "uploading"
    };
    const other: UploadItem = {
      id: "upload-2",
      name: "small.mp3",
      size: 20,
      progress: 10,
      status: "uploading"
    };

    expect(removeUploadItem([target, other], target)).toEqual([other]);
  });
});
