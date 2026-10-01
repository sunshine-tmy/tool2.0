/** 导出只读取归档快照；平台清洗限于小红书，抖音原文和历史截帧不做二次规范化。 */
import path from "node:path";
import {
  normalizeXhsText,
  parseXhsContentText,
  resolveXhsTranslationField,
  type ArchivePlatform,
  type ContentArchiveMedia,
  type XhsArchiveItem
} from "@toolbox/shared";

export type ArchiveExportItem = Omit<XhsArchiveItem, "noteId"> & {
  platform?: ArchivePlatform;
  contentId?: string;
  noteId?: string;
  rawText?: string;
};

export function archiveExportDocuments(item: ArchiveExportItem) {
  const platform = item.platform ?? "xiaohongshu";
  const parsed = platform === "xiaohongshu" ? parseXhsContentText(item.description) : undefined;
  const title = platform === "xiaohongshu" ? normalizeXhsText(item.title) : item.title;
  const body = parsed?.body ?? item.rawText ?? item.description ?? "";
  const topics = item.topics.length ? item.topics : (parsed?.topics ?? []);
  const label = platform === "douyin" ? "抖音" : "小红书";
  const sourceTopics = topics.map((topic) => `#${topic.source}`).join(" ");
  const documents = [
    {
      name: "内容-中文.txt",
      text: [
        `标题：${title}`,
        `作者：${item.author?.name ?? ""}`,
        `平台：${label}`,
        `来源：${item.canonicalUrl}`,
        "",
        body,
        sourceTopics ? `\n话题：${sourceTopics}` : ""
      ].join("\n")
    },
    { name: "原始文案.txt", text: item.rawText ?? item.description ?? "" }
  ];
  const translation = item.translation;
  const effective = resolveXhsTranslationField;
  if (translation?.status === "ready") {
    const englishTopics = translation.topics.map((topic) => `#${effective(topic)}`).join(" ");
    documents.push(
      {
        name: "Content-English.txt",
        text: [
          `Title: ${effective(translation.title)}`,
          `Author: ${item.author?.name ?? ""}`,
          `Platform: ${platform}`,
          `Source: ${item.canonicalUrl}`,
          "",
          effective(translation.description),
          englishTopics ? `\nTopics: ${englishTopics}` : ""
        ].join("\n")
      },
      {
        name: "内容-中英双语.txt",
        text: [
          `标题：${title}`,
          `Title: ${effective(translation.title)}`,
          `作者：${item.author?.name ?? ""}`,
          `平台：${label}`,
          `来源：${item.canonicalUrl}`,
          "",
          "正文：",
          body,
          "",
          "Description:",
          effective(translation.description),
          sourceTopics ? `\n话题：${sourceTopics}` : "",
          englishTopics ? `Topics: ${englishTopics}` : ""
        ].join("\n")
      }
    );
  }
  documents.push({
    name: "metadata.json",
    text: JSON.stringify(
      {
        ...item,
        platform,
        contentId: item.contentId ?? item.noteId,
        title,
        description:
          platform === "xiaohongshu" && item.description ? normalizeXhsText(item.description) : item.description,
        translation: translation
          ? {
              ...translation,
              effective: {
                title: effective(translation.title),
                description: effective(translation.description),
                topics: translation.topics.map((topic) => ({ topicId: topic.topicId, value: effective(topic) }))
              }
            }
          : undefined
      },
      null,
      2
    )
  });
  return documents;
}

export function archiveZipName(item: ArchiveExportItem) {
  const platform = item.platform ?? "xiaohongshu";
  const title = platform === "xiaohongshu" ? normalizeXhsText(item.title) : item.title;
  const safe =
    Array.from(title)
      .map((character) => (character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? "-" : character))
      .join("")
      .trim()
      .slice(0, 60) || "内容";
  return `${platform === "douyin" ? "抖音" : "小红书"}-${safe}-${item.id.slice(-6)}.zip`;
}

/** 只使用领域标签/序号和受控扩展名；碰撞追加媒体 ID，避免不同封面或实况静态图覆盖同名条目。 */
export function archiveMediaExportNames(media: ContentArchiveMedia[]) {
  const used = new Set<string>();
  return media.map((entry) => {
    let name: string;
    if (entry.frameSourceMediaId && entry.frameTimestampMs !== undefined) {
      const milliseconds = entry.frameTimestampMs;
      const parts = [
        Math.floor(milliseconds / 3_600_000),
        Math.floor((milliseconds % 3_600_000) / 60_000),
        Math.floor((milliseconds % 60_000) / 1000)
      ].map((value) => String(value).padStart(2, "0"));
      name = `视频截帧-${String(entry.index + 1).padStart(3, "0")}-${parts.join("-")}-${String(milliseconds % 1000).padStart(3, "0")}.png`;
    } else {
      const label =
        entry.kind === "image" || entry.kind === "cover" ? "图片" : entry.kind === "live-photo" ? "实况" : "视频";
      const extension = path
        .extname(entry.fileName)
        .replace(/[^.\w]/g, "")
        .slice(0, 16);
      name = `${label}-${String(entry.index + 1).padStart(2, "0")}${extension}`;
    }
    if (used.has(name)) name = `${path.parse(name).name}-${entry.id}${path.extname(name)}`;
    used.add(name);
    return name;
  });
}
