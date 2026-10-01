/** 平台文本规则隔离，复制内容尊重人工译文，不把抖音字面标记当成 XHS 表情。 */
import { describe, expect, it } from "vitest";
import {
  archiveClipboardText,
  archiveDisplayText,
  archiveDisplayTitle,
  archivePlatformLabel,
  canEditTranslation
} from "./presentation";
import { archiveFixture, translationFixture } from "./__tests__/fixtures";
describe("多媒体归档展示文本", () => {
  it("只对 XHS 清洗表情和话题，话题无载荷时回退解析", () => {
    const item = archiveFixture();
    expect(archiveDisplayTitle(item)).toBe("日落🙂");
    expect(archiveDisplayText(item)).toEqual({ body: "晚霞", topics: [{ id: expect.any(String), source: "风景" }] });
    expect(archivePlatformLabel(item.platform)).toBe("小红书");
    const withTopics = { ...item, topics: [{ id: "provided", source: "既有话题" }] };
    expect(archiveDisplayText(withTopics).topics).toEqual(withTopics.topics);
  });
  it("抖音原文保留话题、空白和字面表情，缺省字段不编造", () => {
    const item = archiveFixture({ platform: "douyin", rawText: "  晚霞[微笑R]\n#风景  " });
    expect(archiveDisplayText(item).body).toBe(item.rawText);
    expect(archiveDisplayTitle(item)).toBe(item.title);
    expect(archivePlatformLabel(item.platform)).toBe("抖音");
    expect(archiveDisplayText({ ...item, rawText: undefined }).body).toBe(item.description);
    expect(archiveDisplayText({ ...item, rawText: undefined, description: undefined }).body).toBe("");
    expect(archiveDisplayText({ ...item, rawText: "" }).body).toBe("");
    expect(archiveDisplayText(archiveFixture({ description: undefined })).body).toBe("");
  });
  it("中文/英文/双语复制共享原文与人工修订，缺失译文不伪造", () => {
    const item = archiveFixture({ topics: [{ id: "topic-1", source: "风景" }], translation: translationFixture() });
    expect(archiveClipboardText(item, "zh")).toContain("标题：日落🙂\n\n晚霞\n\n话题：#风景");
    expect(archiveClipboardText(item, "en")).toContain("Title: My sunset\n\nGolden evening\n\nTopics: #Landscape");
    expect(archiveClipboardText(item, "both")).toBe(
      `${archiveClipboardText(item, "zh")}\n\n${archiveClipboardText(item, "en")}`
    );
    expect(archiveClipboardText(archiveFixture(), "en")).toBe("");
    expect(
      archiveClipboardText(archiveFixture({ platform: "douyin", rawText: "完整原文", description: undefined }), "zh")
    ).toContain("完整原文");
    const noTopics = archiveFixture({
      description: "正文",
      translation: { ...translationFixture(), topics: [], description: undefined }
    });
    expect(archiveClipboardText(noTopics, "zh")).not.toContain("话题：");
    expect(archiveClipboardText(noTopics, "en")).not.toContain("Topics:");
  });
  it.each(["ready", "stale", "queued", "installing", "translating", "failed"] as const)("编辑门禁 %s", (status) => {
    expect(canEditTranslation(archiveFixture({ translation: { ...translationFixture(), status } }))).toBe(
      ["ready", "stale"].includes(status)
    );
  });
  it("没有翻译时不可编辑", () => expect(canEditTranslation(archiveFixture())).toBe(false));
});
