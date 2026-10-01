/** 平台文本边界：只有小红书使用其表情/话题清洗规则，抖音原文完整保留。 */
import { createHash } from "node:crypto";
import { parseXhsContentText, type ContentArchiveItem } from "@toolbox/shared";

export function archiveTranslationSourceHash(
  item: Pick<ContentArchiveItem, "platform" | "title" | "description" | "topics">
) {
  const parsed = item.platform === "xiaohongshu" ? parseXhsContentText(item.description) : undefined;
  const topics = (item.topics.length ? item.topics : (parsed?.topics ?? [])).map((topic) => topic.source.trim());
  return createHash("sha256")
    .update(
      JSON.stringify({
        title: item.title.trim(),
        body: parsed?.body ?? item.description ?? "",
        topics
      })
    )
    .digest("hex");
}
