/** 图片压缩预设统一控制质量和默认导出格式，手动选择格式后仍由页面状态覆盖。 */
import type { ImageToolResponse } from "./api";

export type ImageCompressionPresetValue = "balanced" | "clear" | "small";

export const imageCompressionPresets: ReadonlyArray<{
  label: string;
  value: ImageCompressionPresetValue;
  quality: number;
  format: ImageToolResponse["outputFormat"];
}> = [
  { label: "均衡", value: "balanced", quality: 78, format: "png" },
  { label: "高清", value: "clear", quality: 88, format: "png" },
  { label: "极小", value: "small", quality: 60, format: "png" }
];

export function findImageCompressionPreset(value: ImageCompressionPresetValue) {
  return imageCompressionPresets.find((preset) => preset.value === value);
}
