/** Public TikTok page data only: stable work identity, ordered images, no login or challenge bypass. */
import { createHash } from "node:crypto";
import type { ArchiveSource } from "../../core/provider";
import { ArchiveTaskError } from "../../core/provider";

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
const text = (value: unknown, limit = 100_000) => (typeof value === "string" ? value.slice(0, limit) : "");
const positive = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
const mediaDomains = [
  "tiktok.com",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokcdn-eu.com",
  "tiktokv.com",
  "muscdn.com",
  "byteoversea.com",
  "ibytedtos.com"
];

export function tikTokMediaUrls(value: unknown): string[] {
  const entries =
    typeof value === "string"
      ? [value]
      : Array.isArray(value)
        ? value
        : (object(value).urlList ?? object(value).UrlList);
  if (!Array.isArray(entries)) return [];
  return [
    ...new Set(
      entries.filter((entry): entry is string => {
        if (typeof entry !== "string" || entry.length > 16_384) return false;
        try {
          const url = new URL(entry);
          return (
            url.protocol === "https:" &&
            !url.username &&
            !url.password &&
            !url.port &&
            mediaDomains.some((domain) => url.hostname === domain || url.hostname.endsWith(`.${domain}`))
          );
        } catch {
          return false;
        }
      })
    )
  ].slice(0, 8);
}

export class TikTokShopVideoMissingError extends ArchiveTaskError {
  constructor() {
    super("TIKTOK_MEDIA_INVALID", "TikTok 商品视频未提供可下载的视频地址，备用解析未启用或未能取得视频");
  }
}

export function tikTokWorkIdentity(input: string) {
  const url = new URL(input);
  const match = /^\/@([A-Za-z0-9_.-]+)\/(video|photo)\/(\d{5,24})\/?$/.exec(url.pathname);
  return url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    !url.port &&
    ["tiktok.com", "www.tiktok.com", "m.tiktok.com"].includes(url.hostname) &&
    match
    ? { author: match[1], kind: match[2] as "video" | "photo", id: match[3] }
    : undefined;
}

export function normalizeTikTokItem(value: unknown, expectedId: string, shopVideoUrls?: string[]): ArchiveSource {
  const item = object(value);
  if (item.id !== expectedId || !/^\d{5,24}$/.test(expectedId))
    throw new ArchiveTaskError("TIKTOK_IDENTITY_MISMATCH", "TikTok 返回的作品与请求不一致，未保存任何内容");
  const author = object(item.author);
  if (
    [item.privateItem, item.forFriend, item.secret, item.isProhibited, item.takeDown, author.privateAccount].some(
      (v) => v === true || v === 1
    )
  )
    throw new ArchiveTaskError("TIKTOK_CONTENT_UNAVAILABLE", "该 TikTok 作品不支持匿名公开访问");
  const post = object(item.imagePost);
  const images = post.images;
  const media: ArchiveSource["media"] = [];
  if (Array.isArray(images)) {
    if (!images.length || images.length > 100)
      throw new ArchiveTaskError("TIKTOK_MEDIA_INVALID", "TikTok 图集为空或超过归档数量上限");
    for (const [index, value] of images.entries()) {
      const image = object(value);
      const urls = tikTokMediaUrls(image.imageURL);
      if (!urls.length)
        throw new ArchiveTaskError("TIKTOK_MEDIA_INVALID", "TikTok 图集缺少可下载图片，未保存不完整图集");
      media.push({
        kind: "image",
        index,
        urls,
        width: positive(image.imageWidth),
        height: positive(image.imageHeight)
      });
    }
  } else {
    const video = object(item.video);
    // Public pages can expose structured addresses or explicit source entries instead of a string.
    // Only read playback fields; music, covers and caption URLs cannot stand in for the video.
    const playAddr = Array.isArray(video.playAddr)
      ? video.playAddr.map((entry) => (typeof entry === "string" ? entry : object(entry).src))
      : video.playAddr;
    const alternatives = Array.isArray(video.bitrateInfo)
      ? video.bitrateInfo.flatMap((entry) => tikTokMediaUrls(object(entry).PlayAddr))
      : [];
    let urls = [
      ...new Set([
        ...tikTokMediaUrls(playAddr),
        ...tikTokMediaUrls(video.downloadAddr),
        ...alternatives,
        ...tikTokMediaUrls(video.PlayAddrStruct)
      ])
    ].slice(0, 8);
    const useShopFallback = !urls.length && (item.isECVideo === 1 || item.isECVideo === true);
    if (useShopFallback) {
      if (shopVideoUrls === undefined) throw new TikTokShopVideoMissingError();
      urls = tikTokMediaUrls(shopVideoUrls);
    }
    if (!urls.length)
      throw new ArchiveTaskError(
        "TIKTOK_MEDIA_INVALID",
        "TikTok 已返回作品信息，但未提供可下载的视频地址；请在普通浏览器确认这条作品能否实际播放，并检查 TikTok 代理的出口地区后重试"
      );
    media.push({
      kind: "video",
      index: 0,
      urls,
      ...(useShopFallback ? { requireVideoTrack: true as const } : {}),
      width: positive(video.width),
      height: positive(video.height),
      durationMs: positive(video.duration) ? Math.round(Number(video.duration) * 1000) : undefined
    });
    const cover = tikTokMediaUrls(video.originCover).length
      ? tikTokMediaUrls(video.originCover)
      : tikTokMediaUrls(video.cover);
    if (cover.length) media.push({ kind: "cover", index: 1, urls: cover });
  }
  const description = text(item.desc);
  const tags = [
    ...new Set(
      [
        ...(Array.isArray(item.textExtra) ? item.textExtra.map((v) => text(object(v).hashtagName, 100)) : []),
        ...(Array.isArray(item.challenges) ? item.challenges.map((v) => text(object(v).title, 100)) : []),
        ...[...description.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((match) => match[1].slice(0, 100))
      ].filter(Boolean)
    )
  ].slice(0, 100);
  const username = /^[A-Za-z0-9_.-]+$/.test(text(author.uniqueId)) ? text(author.uniqueId) : "_";
  const time = Number(item.createTime);
  return {
    platform: "tiktok",
    contentId: expectedId,
    canonicalUrl: `https://www.tiktok.com/@${username}/${Array.isArray(images) ? "photo" : "video"}/${expectedId}`,
    type: Array.isArray(images) ? "image" : "video",
    title: (text(post.title, 500) || description.trim().split(/\r?\n/)[0] || `TikTok ${expectedId}`).slice(0, 500),
    description,
    rawText: description,
    topics: tags.map((source) => ({ id: createHash("sha256").update(source).digest("hex").slice(0, 16), source })),
    author: { id: text(author.id, 256), name: text(author.nickname, 256) || username },
    ...(Number.isFinite(time) && time > 0 && time < 253402300800
      ? { publishedAt: new Date(time * 1000).toISOString() }
      : {}),
    media
  };
}

export function readTikTokPage(html: string, expectedId: string, shopVideoUrls?: string[]): ArchiveSource | undefined {
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const id = /\bid\s*=\s*["']([^"']+)["']/i.exec(match[1])?.[1];
    if (
      !["__UNIVERSAL_DATA_FOR_REHYDRATION__", "SIGI_STATE", "sigi-persisted-data", "__NEXT_DATA__"].includes(id ?? "")
    )
      continue;
    let data: JsonObject;
    try {
      data = object(JSON.parse(match[2]));
    } catch {
      continue;
    }
    const scope = object(data.__DEFAULT_SCOPE__);
    const detail = object(scope["webapp.video-detail"] ?? scope["webapp.reflow.video.detail"]);
    const status = detail.statusCode;
    if (typeof status === "number" && status !== 0)
      throw new ArchiveTaskError(
        status === 10216 ? "TIKTOK_AUTH_REQUIRED" : "TIKTOK_CONTENT_UNAVAILABLE",
        "TikTok 未开放此作品的匿名访问，请检查作品是否公开或已被删除"
      );
    const value =
      object(detail.itemInfo).itemStruct ??
      object(data.ItemModule)[expectedId] ??
      object(object(object(data.props).pageProps).itemInfo).itemStruct;
    if (value !== undefined) return normalizeTikTokItem(value, expectedId, shopVideoUrls);
  }
  return undefined;
}
