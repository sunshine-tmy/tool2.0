export type ShortVideoPlatform = "auto" | "douyin" | "xiaohongshu" | "unknown";

export type ShortVideoMedia = {
  type: "video" | "image";
  url: string;
  label: string;
  quality?: string;
  width?: number;
  height?: number;
  bitRate?: number;
  durationMs?: number;
};

export type ShortVideoAuthor = {
  name?: string;
  id?: string;
  avatarUrl?: string;
};

export type ShortVideoMusic = {
  title?: string;
  author?: string;
  avatarUrl?: string;
  url?: string;
};

export type ShortVideoParseResult = {
  platform: Exclude<ShortVideoPlatform, "auto">;
  sourceUrl: string;
  type: string;
  title: string;
  description?: string;
  author?: ShortVideoAuthor;
  coverUrl?: string;
  media: ShortVideoMedia[];
  music?: ShortVideoMusic;
  provider: "bugpk";
  providerMessage?: string;
  cacheStatus?: string;
  warnings: string[];
};

export type ShortVideoParseInput = {
  input: string;
  platform?: Exclude<ShortVideoPlatform, "unknown">;
};

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
  cover?: unknown;
  coverUrl?: unknown;
  url?: unknown;
  images?: unknown;
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
    const hostname = new URL(url).hostname.toLowerCase().replace(/\.$/, "");
    if (matchesDomain(hostname, "douyin.com") || matchesDomain(hostname, "iesdouyin.com")) {
      return "douyin";
    }
    if (matchesDomain(hostname, "xiaohongshu.com") || matchesDomain(hostname, "xhslink.com")) {
      return "xiaohongshu";
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

  const images = Array.isArray(data.images) ? data.images : [];
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
    author: normalizeAuthor(data.author),
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
  if (value === "auto") return "auto";
  return "unknown";
}

function normalizeAuthor(value: unknown): ShortVideoAuthor | undefined {
  if (!isRecord(value)) return undefined;
  const name = asString(value.name);
  const id = asString(value.id);
  const avatarUrl = asString(value.avatar);
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
