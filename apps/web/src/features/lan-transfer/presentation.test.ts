import { expect, it } from "vitest";
import { lanFileCategories } from "@toolbox/shared/lan";
import { categoryName } from "./presentation";

it("preserves every existing LAN category label and stable category order", () => {
  expect(lanFileCategories.map(categoryName)).toEqual([
    "图片",
    "视频",
    "音频",
    "文本",
    "PDF",
    "压缩包",
    "文档",
    "其他"
  ]);
  expect(lanFileCategories).toEqual(["image", "video", "audio", "text", "pdf", "archive", "document", "other"]);
});
