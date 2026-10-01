/** 小红书现有作品字段映射；保留分享令牌和原规范化规则，短视频模块也复用该纯函数。 */
import { normalizeXhsText, parseXhsContentText, type XhsArchiveItem, type XhsArchiveMedia } from "@toolbox/shared";
import { ArchiveTaskError } from "../media-archive/provider";

export function extractXhsUrl(value: string) {
  const match = value.match(/https?:\/\/(?:www\.)?(?:xiaohongshu\.com|xhslink\.com|xhslink\.cn)\/[^\s"<>]+/i);
  if (!match) return undefined;
  try {
    const url = new URL(match[0].replace(/[，。；！？、）\]}]+$/, ""));
    if (
      ![
        "xiaohongshu.com",
        "www.xiaohongshu.com",
        "xhslink.com",
        "www.xhslink.com",
        "xhslink.cn",
        "www.xhslink.cn"
      ].includes(url.hostname.toLowerCase())
    )
      return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}
function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
function list(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && /^https?:\/\//.test(entry))
    : typeof value === "string" && /^https?:\/\//.test(value)
      ? [value]
      : [];
}
export function normalizeXhsProviderItem(value: unknown, source: string) {
  const raw = record(value);
  const noteId = String(raw["作品ID"] ?? raw.id ?? "").trim();
  if (!noteId) throw new ArchiveTaskError("XHS_PARSE_FAILED", "解析结果缺少笔记 ID");
  const downloads = list(raw["下载地址"] ?? raw.downloads);
  const lives = list(raw["动图地址"] ?? raw.livePhotos);
  const rawType = String(raw["作品类型"] ?? raw.type ?? "");
  const type = lives.length
    ? "live-photo"
    : /视频|video/i.test(rawType)
      ? "video"
      : downloads.length
        ? "image"
        : "unknown";
  const description = normalizeXhsText(String(raw["作品描述"] ?? raw.description ?? "")).trim() || undefined;
  return {
    noteId,
    type: type as XhsArchiveItem["type"],
    title: normalizeXhsText(String(raw["作品标题"] ?? raw.title ?? "未命名小红书内容")).trim() || "未命名小红书内容",
    description,
    topics: parseXhsContentText(description).topics,
    canonicalUrl: String(raw["作品链接"] ?? raw.url ?? extractXhsUrl(source) ?? ""),
    author: {
      id: String(raw["作者ID"] ?? raw.authorId ?? "") || undefined,
      name: String(raw["作者昵称"] ?? raw.authorName ?? "") || undefined
    },
    publishedAt: normalizeDate(raw["发布时间"] ?? raw.publishedAt),
    media: [
      ...downloads.map((url, index) => ({
        url,
        index,
        kind: (/视频|video/i.test(rawType) ? "video" : "image") as XhsArchiveMedia["kind"]
      })),
      ...lives.map((url, offset) => ({ url, index: downloads.length + offset, kind: "live-photo" as const }))
    ]
  };
}
function normalizeDate(value: unknown) {
  if (!value) return undefined;
  const date = new Date(typeof value === "number" && value < 10_000_000_000 ? value * 1000 : String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}
