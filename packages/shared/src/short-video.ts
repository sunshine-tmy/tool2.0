/**
 * 中文模块说明：共享契约层，负责跨前后端复用的类型、Schema、响应和领域常量
 */
import { Type, type Static } from "@sinclair/typebox";

export const ShortVideoPlatformSchema = Type.Union([
  Type.Literal("auto"),
  Type.Literal("douyin"),
  Type.Literal("xiaohongshu"),
  Type.Literal("tiktok"),
  Type.Literal("unknown")
]);

export const ShortVideoRequestedPlatformSchema = Type.Union([
  Type.Literal("auto"),
  Type.Literal("douyin"),
  Type.Literal("xiaohongshu"),
  Type.Literal("tiktok")
]);

export const ShortVideoMediaSchema = Type.Object(
  {
    type: Type.Union([Type.Literal("video"), Type.Literal("image")]),
    url: Type.String({ minLength: 1 }),
    label: Type.String({ minLength: 1 }),
    quality: Type.Optional(Type.String()),
    width: Type.Optional(Type.Number({ minimum: 0 })),
    height: Type.Optional(Type.Number({ minimum: 0 })),
    bitRate: Type.Optional(Type.Number({ minimum: 0 })),
    durationMs: Type.Optional(Type.Number({ minimum: 0 }))
  },
  { additionalProperties: false }
);

export const ShortVideoAuthorSchema = Type.Object(
  {
    name: Type.Optional(Type.String()),
    id: Type.Optional(Type.String()),
    avatarUrl: Type.Optional(Type.String())
  },
  { additionalProperties: false }
);

export const ShortVideoMusicSchema = Type.Object(
  {
    title: Type.Optional(Type.String()),
    author: Type.Optional(Type.String()),
    avatarUrl: Type.Optional(Type.String()),
    url: Type.Optional(Type.String())
  },
  { additionalProperties: false }
);

export const ShortVideoParseResultSchema = Type.Object(
  {
    platform: Type.Union([
      Type.Literal("douyin"),
      Type.Literal("xiaohongshu"),
      Type.Literal("tiktok"),
      Type.Literal("unknown")
    ]),
    sourceUrl: Type.String({ minLength: 1 }),
    type: Type.String({ minLength: 1 }),
    title: Type.String({ minLength: 1 }),
    description: Type.Optional(Type.String()),
    author: Type.Optional(ShortVideoAuthorSchema),
    coverUrl: Type.Optional(Type.String()),
    media: Type.Array(ShortVideoMediaSchema),
    music: Type.Optional(ShortVideoMusicSchema),
    provider: Type.Union([Type.Literal("bugpk"), Type.Literal("tiktok-oembed"), Type.Literal("xhs-downloader")]),
    embedUrl: Type.Optional(Type.String()),
    providerMessage: Type.Optional(Type.String()),
    cacheStatus: Type.Optional(Type.String()),
    warnings: Type.Array(Type.String())
  },
  { additionalProperties: false }
);

export const ShortVideoParseInputSchema = Type.Object(
  {
    input: Type.String({ maxLength: 4096 }),
    platform: Type.Optional(ShortVideoRequestedPlatformSchema)
  },
  { additionalProperties: false }
);

export const ShortVideoDownloadQuerySchema = Type.Object(
  {
    url: Type.String({ minLength: 1, maxLength: 4096 }),
    filename: Type.Optional(Type.String({ maxLength: 255 }))
  },
  { additionalProperties: false }
);

export type ShortVideoPlatform = Static<typeof ShortVideoPlatformSchema>;
export type ShortVideoMedia = Static<typeof ShortVideoMediaSchema>;
export type ShortVideoAuthor = Static<typeof ShortVideoAuthorSchema>;
export type ShortVideoMusic = Static<typeof ShortVideoMusicSchema>;
export type ShortVideoParseResult = Static<typeof ShortVideoParseResultSchema>;
export type ShortVideoParseInput = Static<typeof ShortVideoParseInputSchema>;

type ProviderResponse = {
  code?: unknown;
  msg?: unknown;
  platform?: unknown;
  cache_status?: unknown;
  data?: unknown;
};

type ProviderData = {
  type?: unknown;
  title?: unknown;
  desc?: unknown;
  author?: unknown;
  userId?: unknown;
  avatar?: unknown;
  cover?: unknown;
  coverUrl?: unknown;
  url?: unknown;
  images?: unknown;
  imgurl?: unknown;
  video_backup?: unknown;
  music?: unknown;
  duration?: unknown;
};

type ProviderVideoBackup = {
  label?: unknown;
  quality?: unknown;
  url?: unknown;
  width?: unknown;
  height?: unknown;
  bit_rate?: unknown;
};

export function extractFirstUrl(text: string) {
  return text.match(/https?:\/\/[^\s"'<>，。]+/i)?.[0] ?? null;
}

export function detectShortVideoPlatform(url: string): ShortVideoPlatform {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") return "unknown";
    const hostname = parsedUrl.hostname.toLowerCase().replace(/\.$/, "");
    if (matchesDomain(hostname, "douyin.com") || matchesDomain(hostname, "iesdouyin.com")) {
      return "douyin";
    }
    if (matchesDomain(hostname, "xiaohongshu.com") || matchesDomain(hostname, "xhslink.com")) {
      return "xiaohongshu";
    }
    if (matchesDomain(hostname, "tiktok.com")) {
      return "tiktok";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

function matchesDomain(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function isSupportedShortVideoUrl(url: string) {
  return detectShortVideoPlatform(url) !== "unknown";
}

export function normalizeShortVideoProviderResult(
  response: ProviderResponse,
  context: { sourceUrl: string; requestedPlatform: ShortVideoPlatform }
): ShortVideoParseResult {
  const data = isRecord(response.data) ? (response.data as ProviderData) : {};
  const providerPlatform = normalizePlatform(asString(response.platform));
  const detectedPlatform = detectShortVideoPlatform(context.sourceUrl);
  const platform = providerPlatform === "unknown" ? detectedPlatform : providerPlatform;
  const description = asString(data.desc);
  const title = asString(data.title) || description || "未命名作品";
  const coverUrl = asString(data.cover) || asString(data.coverUrl) || undefined;
  const durationMs = asNumber(data.duration);
  const media: ShortVideoMedia[] = [];

  const videoUrl = asString(data.url);
  if (videoUrl) {
    media.push({
      type: "video",
      url: videoUrl,
      label: "默认视频",
      durationMs
    });
  }

  const images = [
    ...(Array.isArray(data.images) ? data.images : []),
    ...(Array.isArray(data.imgurl) ? data.imgurl : [])
  ];
  images.forEach((item, index) => {
    const url = asString(item);
    if (url) {
      media.push({
        type: "image",
        url,
        label: `图片 ${index + 1}`
      });
    }
  });

  const backups = Array.isArray(data.video_backup) ? data.video_backup : [];
  backups.forEach((item, index) => {
    if (!isRecord(item)) return;
    const backup = item as ProviderVideoBackup;
    const url = asString(backup.url);
    if (!url || media.some((mediaItem) => mediaItem.url === url)) return;
    media.push({
      type: "video",
      url,
      label: asString(backup.label) || `备用视频 ${index + 1}`,
      quality: asString(backup.quality) || undefined,
      width: asNumber(backup.width),
      height: asNumber(backup.height),
      bitRate: asNumber(backup.bit_rate),
      durationMs
    });
  });

  return {
    platform: platform === "auto" ? "unknown" : platform,
    sourceUrl: context.sourceUrl,
    type: asString(data.type) || "unknown",
    title,
    description: description || undefined,
    author: normalizeAuthor(data.author, data.userId, data.avatar),
    coverUrl,
    media,
    music: normalizeMusic(data.music),
    provider: "bugpk",
    providerMessage: asString(response.msg) || undefined,
    cacheStatus: asString(response.cache_status) || undefined,
    warnings: media.length ? [] : ["解析成功但未返回可用的视频或图片地址"]
  };
}

function normalizePlatform(value: string): ShortVideoPlatform {
  if (value === "douyin") return "douyin";
  if (value === "xiaohongshu" || value === "xhs") return "xiaohongshu";
  if (value === "tiktok") return "tiktok";
  if (value === "auto") return "auto";
  return "unknown";
}

function normalizeAuthor(value: unknown, fallbackId?: unknown, fallbackAvatar?: unknown): ShortVideoAuthor | undefined {
  if (typeof value === "string" || typeof value === "number") {
    const name = asString(value);
    const id = asString(fallbackId);
    const avatarUrl = asString(fallbackAvatar);
    if (!name && !id && !avatarUrl) return undefined;
    return { name: name || undefined, id: id || undefined, avatarUrl: avatarUrl || undefined };
  }
  if (!isRecord(value)) return undefined;
  const name = asString(value.name);
  const id = asString(value.id) || asString(fallbackId);
  const avatarUrl = asString(value.avatar) || asString(fallbackAvatar);
  if (!name && !id && !avatarUrl) return undefined;
  return { name: name || undefined, id: id || undefined, avatarUrl: avatarUrl || undefined };
}

function normalizeMusic(value: unknown): ShortVideoMusic | undefined {
  if (!isRecord(value)) return undefined;
  const title = asString(value.title);
  const author = asString(value.author);
  const avatarUrl = asString(value.avatar);
  const url = asString(value.url);
  if (!title && !author && !avatarUrl && !url) return undefined;
  return {
    title: title || undefined,
    author: author || undefined,
    avatarUrl: avatarUrl || undefined,
    url: url || undefined
  };
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
