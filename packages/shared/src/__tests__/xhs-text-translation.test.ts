import { describe, expect, it } from "vitest";
import { cleanXhsDescription, parseXhsContentText, resolveXhsTranslationField, xhsTopicId } from "../xhs-text";

describe("Xiaohongshu translation text helpers", () => {
  it("extracts explicit and plain topics while preserving the body", () => {
    const result = parseXhsContentText("正文第一段\n#宝宝起名[话题]# #母婴#");
    expect(result.body).toBe("正文第一段");
    expect(result.topics.map((topic) => topic.source)).toEqual(["宝宝起名", "母婴"]);
    expect(result.topics[0].id).toBe(xhsTopicId("宝宝起名"));
  });

  it("normalizes custom emoji before parsing topics", () => {
    expect(cleanXhsDescription("[彩虹R] 好看的内容 #生活[话题]#")).toBe("🌈 好看的内容");
  });

  it("prefers an edited translation without losing the machine result", () => {
    expect(resolveXhsTranslationField({ machine: "Machine translation", edited: " Human edit " })).toBe("Human edit");
    expect(resolveXhsTranslationField({ machine: "Machine translation" })).toBe("Machine translation");
  });
});
