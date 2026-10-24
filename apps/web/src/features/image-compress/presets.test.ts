/** 验证切换任意压缩预设都默认导出 PNG，避免质量档位意外改变用户格式偏好。 */
import { describe, expect, it } from "vitest";
import { findImageCompressionPreset, imageCompressionPresets } from "./presets";

describe("图片压缩预设", () => {
  it.each(imageCompressionPresets)("$label 预设默认使用 PNG", (preset) => {
    expect(findImageCompressionPreset(preset.value)).toEqual(preset);
    expect(preset.format).toBe("png");
  });
});
