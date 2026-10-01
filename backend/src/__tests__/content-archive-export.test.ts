/** 平台文本、用户译文和截帧命名必须与归档身份一致，不把抖音原文套用小红书清洗。 */
import { describe, expect, it } from "vitest";
import type { ContentArchiveItem, ContentArchiveMedia } from "@toolbox/shared";
import { archiveExportDocuments, archiveMediaExportNames, archiveZipName } from "../modules/media-archive/export";

function fixture(platform: ContentArchiveItem["platform"] = "douyin"): ContentArchiveItem {
  return {
    id: "archive_123456",
    platform,
    contentId: "123456789",
    type: "video",
    title: "[彩虹R]标题",
    description: "[彩虹R]原始文案 #话题[话题]#",
    rawText: platform === "douyin" ? "[彩虹R]原始文案 #话题[话题]#" : undefined,
    topics: [{ id: "topic_123456", source: "话题" }],
    sourceUrl: "https://www.douyin.com/video/123456789",
    canonicalUrl: "https://www.douyin.com/video/123456789",
    media: [],
    status: "ready",
    warnings: [],
    totalBytes: 0,
    fetchedAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z"
  };
}
const documents = (item: ContentArchiveItem) =>
  Object.fromEntries(archiveExportDocuments(item).map((entry) => [entry.name, entry.text]));
const media = (overrides: Partial<ContentArchiveMedia> = {}): ContentArchiveMedia => ({
  id: "media_123456",
  kind: "image",
  index: 0,
  fileName: "original.jpg",
  mimeType: "image/jpeg",
  size: 1,
  checksum: "1".repeat(64),
  previewUrl: "/preview",
  downloadUrl: "/download",
  ...overrides
});

describe("归档导出文档与命名", () => {
  it.each(["xiaohongshu", "douyin"] as const)("%s 元数据含平台/作品 ID，原始文本始终独立保留", (platform) => {
    const item = fixture(platform),
      result = documents(item),
      metadata = JSON.parse(result["metadata.json"]);
    expect(metadata).toMatchObject({ platform, contentId: "123456789" });
    expect(result["原始文案.txt"]).toBe(item.description);
    expect(result["内容-中文.txt"]).toContain(`平台：${platform === "douyin" ? "抖音" : "小红书"}`);
    expect(metadata.title).toBe(platform === "douyin" ? item.title : "🌈标题");
    if (platform === "douyin") {
      expect(result["内容-中文.txt"]).toContain(item.rawText);
      expect(metadata.description).toBe(item.description);
    }
    expect(result["Content-English.txt"]).toBeUndefined();
  });
  it("旧小红书快照保留 noteId 并补充导出身份，无需重写旧清单", () => {
    const { platform: _platform, contentId, rawText: _raw, ...rest } = fixture("xiaohongshu");
    const legacy = { ...rest, noteId: contentId };
    const metadata = JSON.parse(archiveExportDocuments(legacy).find((entry) => entry.name === "metadata.json")!.text);
    expect(metadata).toMatchObject({ noteId: contentId, contentId, platform: "xiaohongshu" });
    expect(archiveZipName(legacy)).toBe("小红书-🌈标题-123456.zip");
  });
  it("导出优先手工译文，双语内容不覆盖机器译文或编辑痕迹", () => {
    const item = fixture();
    item.translation = {
      status: "ready",
      sourceHash: "1".repeat(64),
      sourceLanguage: "zh-CN",
      targetLanguage: "en",
      provider: "opus-mt",
      modelId: "Helsinki-NLP/opus-mt-zh-en",
      modelRevision: "revision",
      title: { source: item.title, machine: "Machine title", edited: "Edited title" },
      description: { source: item.description!, machine: "Machine description", edited: "Edited description" },
      topics: [{ topicId: "topic_123456", source: "话题", machine: "Machine topic", edited: "Edited topic" }]
    };
    const before = structuredClone(item),
      result = documents(item);
    expect(result["Content-English.txt"]).toContain("Edited title");
    expect(result["Content-English.txt"]).toContain("Edited description");
    expect(result["内容-中英双语.txt"]).toContain(item.rawText);
    expect(JSON.parse(result["metadata.json"]).translation.effective).toEqual({
      title: "Edited title",
      description: "Edited description",
      topics: [{ topicId: "topic_123456", value: "Edited topic" }]
    });
    expect(item).toEqual(before);
    item.translation.status = "stale";
    expect(documents(item)["Content-English.txt"]).toBeUndefined();
    expect(JSON.parse(documents(item)["metadata.json"]).translation.title.edited).toBe("Edited title");
  });
  it("空正文/作者/话题和机器翻译缺省字段可导出", () => {
    const item = fixture("xiaohongshu");
    item.description = undefined;
    item.topics = [];
    item.title = "";
    expect(documents(item)["原始文案.txt"]).toBe("");
    expect(archiveZipName(item)).toBe("小红书-内容-123456.zip");
    expect(documents(item)["内容-中文.txt"]).not.toContain("话题：");
  });
  it("同序号的封面和静态图不重名，实况/视频及截帧标签保持独立", () => {
    expect(
      archiveMediaExportNames([
        media(),
        media({ id: "cover_123456", kind: "cover" }),
        media({ id: "live_123456", kind: "live-photo", fileName: "live.mp4" }),
        media({ id: "video_123456", kind: "video", fileName: "video.mp4" }),
        media({
          id: "frame_123456",
          frameSourceMediaId: "video_123456",
          frameTimestampMs: 3_661_234,
          fileName: "frame.png"
        }),
        media({
          id: "frame_654321",
          frameSourceMediaId: "video_123456",
          frameTimestampMs: 3_661_234,
          fileName: "frame2.png"
        })
      ])
    ).toEqual([
      "图片-01.jpg",
      "图片-01-cover_123456.jpg",
      "实况-01.mp4",
      "视频-01.mp4",
      "视频截帧-001-01-01-01-234.png",
      "视频截帧-001-01-01-01-234-frame_654321.png"
    ]);
  });
  it("ZIP 文件名/扩展名不泄露路径或产生 CRLF，保留抖音原始标题", () => {
    const item = fixture();
    item.title = "[彩虹R]../../标题\r\n/文件";
    expect(archiveZipName(item)).toBe("抖音-[彩虹R]..-..-标题---文件-123456.zip");
    expect(archiveMediaExportNames([media({ fileName: "unsafe.jp\r\ng" })])).toEqual(["图片-01.jpg"]);
  });
});
