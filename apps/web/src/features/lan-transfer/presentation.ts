import type { LanFileCategory } from "@toolbox/shared/lan";

export function categoryName(category: LanFileCategory) {
  const names: Record<LanFileCategory, string> = {
    image: "图片",
    video: "视频",
    audio: "音频",
    text: "文本",
    pdf: "PDF",
    archive: "压缩包",
    document: "文档",
    other: "其他"
  };
  return names[category];
}
