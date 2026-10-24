/**
 * 中文模块说明：测试 packages/shared/src/__tests__/system-operations.test.ts 中的稳定行为、边界条件和回归场景
 */
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { CleanupInspectionSchema, CleanupResultsSchema } from "../system/cleanup";
import { ImageCompressResultSchema } from "../image/compress-result";

describe("system operation schemas", () => {
  it("retains negative savings for larger output while rejecting invalid result fields", () => {
    const grown = {
      task: {
        id: "image-task",
        toolId: "image-compress",
        status: "completed",
        progress: 100,
        createdAt: "2026-09-15T00:00:00.000Z",
        updatedAt: "2026-09-15T00:00:01.000Z"
      },
      downloadUrl: "/api/v1/files/image-task.png",
      originalName: "input.jpg",
      outputName: "image-task.png",
      outputFormat: "png",
      originalSize: 1024,
      outputSize: 2048,
      savedBytes: -1024,
      compressionRatio: 2,
      width: 800,
      height: 600
    };
    expect(Value.Check(ImageCompressResultSchema, grown)).toBe(true);
    for (const invalid of [
      { ...grown, extra: true },
      { ...grown, outputFormat: "gif" },
      { ...grown, width: 0 },
      { ...grown, downloadUrl: "https://example.invalid/image.png" }
    ]) {
      expect(Value.Check(ImageCompressResultSchema, invalid)).toBe(false);
    }
  });

  it("retains cleanup risk and stop confirmation fields without permissive extras", () => {
    const inspection = {
      id: "temp",
      label: "临时文件",
      risk: "low",
      requiresStop: false,
      defaults: true,
      files: 2,
      bytes: 128
    };
    expect(Value.Check(CleanupInspectionSchema, [inspection])).toBe(true);
    expect(Value.Check(CleanupInspectionSchema, [{ ...inspection, risk: "none" }])).toBe(false);
    expect(Value.Check(CleanupInspectionSchema, [{ ...inspection, requiresStop: undefined }])).toBe(false);
    expect(
      Value.Check(CleanupResultsSchema, [{ id: "temp", label: "临时文件", files: 2, bytes: 128, extra: true }])
    ).toBe(false);
  });

  it("validates image compression results", () => {
    expect(
      Value.Check(ImageCompressResultSchema, {
        task: {
          id: "image-task",
          toolId: "image-compress",
          status: "completed",
          progress: 100,
          outputPath: "image-task.webp",
          createdAt: "2026-09-15T00:00:00.000Z",
          updatedAt: "2026-09-15T00:00:01.000Z"
        },
        downloadUrl: "/api/v1/files/image-task.webp",
        originalName: "input.jpg",
        outputName: "image-task.webp",
        outputFormat: "webp",
        originalSize: 2048,
        outputSize: 1024,
        savedBytes: 1024,
        compressionRatio: 0.5,
        width: 800,
        height: 600
      })
    ).toBe(true);
  });

  it("distinguishes cleanup inspection and execution records", () => {
    expect(
      Value.Check(CleanupInspectionSchema, [
        {
          id: "temp",
          label: "临时文件",
          risk: "low",
          requiresStop: false,
          defaults: true,
          files: 2,
          bytes: 128
        }
      ])
    ).toBe(true);
    expect(Value.Check(CleanupResultsSchema, [{ id: "temp", label: "临时文件", files: 2, bytes: 128 }])).toBe(true);
  });

  it("accepts optional skip counts and rejects invalid skip values", () => {
    expect(Value.Check(CleanupResultsSchema, [{ id: "temp", label: "临时文件", files: 2, bytes: 128 }])).toBe(true);
    expect(
      Value.Check(CleanupResultsSchema, [
        { id: "temp", label: "临时文件", files: 1, bytes: 64, skippedFiles: 1, skippedBytes: 64 }
      ])
    ).toBe(true);
    expect(
      Value.Check(CleanupResultsSchema, [{ id: "temp", label: "临时文件", files: 2, bytes: 128, skippedFiles: 0 }])
    ).toBe(false);
  });
});
