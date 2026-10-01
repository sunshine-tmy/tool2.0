/** 平台文本边界：只有小红书使用其表情/话题清洗规则，抖音原文完整保留。 */
import { createHash } from "node:crypto";
import { parseXhsContentText, type ContentArchiveItem } from "@toolbox/shared";

type TranslationSourceItem = Pick<ContentArchiveItem, "title" | "description" | "topics" | "rawText"> & {
  platform?: ContentArchiveItem["platform"];
};

/** 保留旧小红书的哈希输入；抖音以完整原文为事实源，不清洗平台专有标记。 */
export function archiveTranslationSource(item: TranslationSourceItem) {
  const parsed = (item.platform ?? "xiaohongshu") === "xiaohongshu" ? parseXhsContentText(item.description) : undefined;
  return {
    title: item.title.trim(),
    body: parsed?.body ?? item.rawText ?? item.description ?? "",
    topics: item.topics.length ? item.topics : (parsed?.topics ?? [])
  };
}

export function archiveTranslationSourceHash(item: TranslationSourceItem) {
  const source = archiveTranslationSource(item);
  return createHash("sha256")
    .update(
      JSON.stringify({
        title: source.title,
        body: source.body,
        topics: source.topics.map((topic) => topic.source.trim()),
        // 抖音原始正文与展示正文都参与版本判定，任一刷新变化都不能被迟到译文覆盖。
        ...(item.platform === "douyin" ? { description: item.description ?? "" } : {})
      })
    )
    .digest("hex");
}
