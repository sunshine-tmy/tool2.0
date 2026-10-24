/** 展示/复制的平台边界：XHS 表情与话题清洗不应用于抖音原文。 */
import {
  normalizeXhsText,
  parseXhsContentText,
  resolveXhsTranslationField,
  type ContentArchiveItem
} from "@toolbox/shared";

export function archivePlatformLabel(platform: ContentArchiveItem["platform"]) {
  return platform === "douyin" ? "抖音" : "小红书";
}

export function canEditTranslation(item: ContentArchiveItem) {
  return Boolean(item.translation && ["ready", "stale"].includes(item.translation.status));
}

export function archiveDisplayTitle(item: Pick<ContentArchiveItem, "platform" | "title">) {
  return item.platform === "xiaohongshu" ? normalizeXhsText(item.title) : item.title;
}

export function archiveDisplayText(item: Pick<ContentArchiveItem, "platform" | "description" | "rawText" | "topics">) {
  const parsed = item.platform === "xiaohongshu" ? parseXhsContentText(item.description) : undefined;
  return {
    body: parsed?.body ?? item.rawText ?? item.description ?? "",
    topics: item.topics.length ? item.topics : (parsed?.topics ?? [])
  };
}

export function archiveClipboardText(item: ContentArchiveItem, language: "zh" | "en" | "both") {
  const source = archiveDisplayText(item);
  const chinese = [
    `标题：${archiveDisplayTitle(item)}`,
    "",
    source.body,
    source.topics.length ? `\n话题：${source.topics.map((topic) => `#${topic.source}`).join(" ")}` : ""
  ].join("\n");
  const translation = item.translation;
  const english = translation
    ? [
        `Title: ${resolveXhsTranslationField(translation.title)}`,
        "",
        resolveXhsTranslationField(translation.description),
        translation.topics.length
          ? `\nTopics: ${translation.topics.map((topic) => `#${resolveXhsTranslationField(topic)}`).join(" ")}`
          : ""
      ].join("\n")
    : "";
  return language === "zh" ? chinese : language === "en" ? english : `${chinese}\n\n${english}`;
}
