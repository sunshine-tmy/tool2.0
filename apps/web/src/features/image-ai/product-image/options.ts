export type Tool = "layout" | "pan" | "erase" | "restore";
export const tools: Array<{ label: string; value: Tool }> = [
  { label: "拖动商品", value: "layout" },
  { label: "平移视图", value: "pan" },
  { label: "擦除", value: "erase" },
  { label: "恢复", value: "restore" }
];
export const baseCheckOptions = [
  { label: "棋盘格（仅检查）", value: "" },
  { label: "白底（仅检查）", value: "#ffffff" },
  { label: "黑底（仅检查）", value: "#111111" },
  { label: "灰底（仅检查）", value: "#808080" }
];
export const backgroundOptions = [
  { label: "白底 / 自定义纯色", value: "color" },
  { label: "透明背景", value: "transparent" },
  { label: "自定义图片", value: "image" }
];
export const alignOptions = [
  { label: "水平垂直居中", value: "center" },
  { label: "底部居中", value: "bottom" }
];
export const presets = [
  { label: "方形 1600 × 1600", value: "1600x1600" },
  { label: "方形高清 2000 × 2000", value: "2000x2000" },
  { label: "竖版 1200 × 1600", value: "1200x1600" },
  { label: "横版 1600 × 1200", value: "1600x1200" },
  { label: "自定义", value: "custom" }
];
export const formatOptions = [
  { label: "PNG", value: "png" },
  { label: "JPEG", value: "jpeg" },
  { label: "WebP", value: "webp" }
];
