/**
 * 中文模块说明：测试 packages/shared/src/__tests__/system-operations.test.ts 中的稳定行为、边界条件和回归场景
 */
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { CleanupInspectionSchema, CleanupResultsSchema, ImageCompressResultSchema } from "../system-operations";

describe("system operation schemas", () => {
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
});
