/**
 * 中文模块说明：共享契约层，负责跨前后端复用的类型、Schema、响应和领域常量
 */
import type { XhsArchiveItem, XhsArchiveTopic } from "./xhs-archive";

const XHS_EMOJI_MAP: Readonly<Record<string, string>> = {
  彩虹: "🌈",
  气球: "🎈",
  玫瑰: "🌹",
  合十: "🙏",
  微笑: "🙂",
  开心: "😄",
  大笑: "😆",
  笑哭: "😂",
  捂脸: "🤦",
  偷笑: "🤭",
  害羞: "😊",
  赞: "👍",
  点赞: "👍",
  鼓掌: "👏",
  爱心: "❤️",
  红色心形: "❤️",
  飞吻: "😘",
  亲亲: "😘",
  可爱: "🥰",
  酷: "😎",
  墨镜: "😎",
  惊讶: "😮",
  流泪: "😢",
  生气: "😠",
  抓狂: "😫",
  尴尬: "😅",
  汗颜: "😅",
  疑问: "❓",
  问号: "❓",
  吃瓜: "🍉",
  礼物: "🎁",
  星星: "⭐",
  闪亮: "✨",
  太阳: "☀️",
  月亮: "🌙",
  火: "🔥",
  烟花: "🎆",
  庆祝: "🎉",
  蛋糕: "🎂",
  咖啡: "☕",
  啤酒: "🍺",
  飞机: "✈️",
  相机: "📷",
  音乐: "🎵",
  话筒: "🎤",
  灯泡: "💡",
  奖杯: "🏆",
  拳头: "✊",
  加油: "💪",
  OK: "👌",
  doge: "🐶"
};

/** Converts known Xiaohongshu custom emoji placeholders to portable Unicode emoji. */
export function normalizeXhsText(value: string): string {
  return value.replace(/\[([^\x5b\x5d\r\n]+?)R\]/g, (placeholder, name: string) => {
    return XHS_EMOJI_MAP[name.trim()] ?? placeholder;
  });
}

export function parseXhsContentText(value: string | undefined): { body: string; topics: XhsArchiveTopic[] } {
  const normalized = normalizeXhsText(value ?? "");
  const topics: string[] = [];
  let body = normalized.replace(/#([^#\r\n]+?)\[话题\](?:#|(?=\s|$))/g, (_match, name: string) => {
    const topic = name.trim();
    if (topic && !topics.includes(topic)) topics.push(topic);
    return "";
  });
  body = body.replace(/(^|[\s])#([\p{L}\p{N}_-]{1,80})(?:#|(?=$|[\s]))/gu, (_match, prefix: string, name: string) => {
    const topic = name.trim();
    if (topic && !topics.includes(topic)) topics.push(topic);
    return prefix;
  });
  body = body
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  return {
    body,
    topics: topics.map((source) => ({ id: xhsTopicId(source), source }))
  };
}

export function xhsTopicId(source: string): string {
  let hash = 2166136261;
  for (const character of source.trim()) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `topic-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function resolveXhsTranslationField(field?: { machine: string; edited?: string }): string {
  return field?.edited?.trim() || field?.machine || "";
}

export function cleanXhsDescription(value: string | undefined): string {
  return parseXhsContentText(value).body;
}

export type XhsTranslationSegment = {
  kind: "title" | "description" | "topic";
  source: string;
  topicId?: string;
  index?: number;
};

export function prepareXhsTranslationSegments(
  item: Pick<XhsArchiveItem, "title" | "description" | "topics">
): XhsTranslationSegment[] {
  const parsed = parseXhsContentText(item.description);
  const topics = item.topics.length ? item.topics : parsed.topics;
  const segments: XhsTranslationSegment[] = [{ kind: "title", source: normalizeXhsText(item.title).trim() }];
  if (parsed.body) {
    parsed.body.split(/\r?\n/).forEach((source, index) => {
      if (source.trim()) segments.push({ kind: "description", source, index });
    });
  }
  topics.forEach((topic, index) => {
    if (topic.source.trim()) segments.push({ kind: "topic", source: topic.source.trim(), topicId: topic.id, index });
  });
  return segments;
}
