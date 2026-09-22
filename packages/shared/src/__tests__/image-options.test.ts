/**
 * 中文模块说明：测试 packages/shared/src/__tests__/image-options.test.ts 中的稳定行为、边界条件和回归场景
 */
import { describe, expect, it } from "vitest";
import { normalizeImageOptions } from "../image-options";

describe("image option normalization", () => {
  it("uses practical defaults when options are missing", () => {
    expect(normalizeImageOptions({})).toEqual({
      quality: 78,
      outputFormat: "png",
      width: undefined
    });
  });

  it("clamps quality and keeps valid width", () => {
    expect(normalizeImageOptions({ quality: 120, outputFormat: "jpeg", width: 1280 })).toEqual({
      quality: 95,
      outputFormat: "jpeg",
      width: 1280
    });
  });

  it("rejects unsupported output formats", () => {
    expect(() => normalizeImageOptions({ outputFormat: "bmp" })).toThrow("Unsupported image format");
  });
});
