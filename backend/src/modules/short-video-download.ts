/**
 * 中文模块说明：短视频领域，负责 Provider 解析、缓存、下载和 SSRF 边界
 */
import type { FastifyReply } from "fastify";
import {
  assertRemoteResponseSize,
  fetchRemoteResponse,
  limitedResponseStream,
  type RemoteFetch
} from "../security/remote-fetch";
import type { AppConfig } from "../config";
import { fail } from "@toolbox/shared";

// 浏览器拖动进度条不需要无限制代理 CDN 内容；单次预览读取保持在 8 MiB 内，既能覆盖常见
// MP4 moov/关键帧，也避免恶意多 Range 或超大范围请求占用本机带宽和并发连接。
const MAX_PREVIEW_RANGE_BYTES = 8 * 1024 * 1024;

export class InvalidPreviewRangeError extends Error {}

export async function proxyShortVideoDownload(options: {
  reply: FastifyReply;
  config: AppConfig;
  remoteFetch: RemoteFetch;
  url: string;
  filename: string;
}) {
  return proxyShortVideoMedia({ ...options, disposition: "attachment" });
}

/**
 * 通过本地受控代理返回媒体预览。Range 请求会继续传给上游 CDN，播放器因此只拉取
 * 元数据和当前播放片段，不会让前端一次性读取整个大文件。
 */
export async function proxyShortVideoPreview(options: {
  reply: FastifyReply;
  config: AppConfig;
  remoteFetch: RemoteFetch;
  url: string;
  filename: string;
  mediaType: "video" | "image";
  range?: string;
}) {
  return proxyShortVideoMedia({ ...options, disposition: "inline" });
}

/**
 * 仅接受单一 bytes Range，并把开放结尾与后缀 Range 收敛为固定上限。
 * 代理不能安全判断远端总长度，因此不接受浏览器之外的多段 Range 组合请求。
 */
export function normalizePreviewRange(value: string | undefined) {
  if (!value) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!match || (!match[1] && !match[2])) throw new InvalidPreviewRangeError("预览 Range 格式无效");
  const start = match[1] ? Number(match[1]) : undefined;
  const end = match[2] ? Number(match[2]) : undefined;
  if ((start !== undefined && !Number.isSafeInteger(start)) || (end !== undefined && !Number.isSafeInteger(end))) {
    throw new InvalidPreviewRangeError("预览 Range 超出支持范围");
  }
  if (start !== undefined && end !== undefined) {
    if (end < start || end - start + 1 > MAX_PREVIEW_RANGE_BYTES) {
      throw new InvalidPreviewRangeError("单次预览读取不能超过 8 MiB");
    }
    return `bytes=${start}-${end}`;
  }
  if (start !== undefined) return `bytes=${start}-${start + MAX_PREVIEW_RANGE_BYTES - 1}`;
  if (end === undefined || end < 1 || end > MAX_PREVIEW_RANGE_BYTES) {
    throw new InvalidPreviewRangeError("单次预览读取不能超过 8 MiB");
  }
  return `bytes=-${end}`;
}

type ProxyShortVideoMediaOptions = {
  reply: FastifyReply;
  config: AppConfig;
  remoteFetch: RemoteFetch;
  url: string;
  filename: string;
  disposition: "attachment" | "inline";
  mediaType?: "video" | "image";
  range?: string;
};

async function proxyShortVideoMedia(options: ProxyShortVideoMediaOptions) {
  const { reply, config, remoteFetch, url, filename, disposition, mediaType, range } = options;
  const failureCode = disposition === "inline" ? "SHORT_VIDEO_PREVIEW_FAILED" : "SHORT_VIDEO_DOWNLOAD_FAILED";
  const failureLabel = disposition === "inline" ? "媒体预览失败" : "媒体下载失败";
  try {
    const response = await fetchRemoteResponse(
      remoteFetch,
      url,
      {
        headers: createRemoteMediaHeaders(url, range)
      },
      config.remoteFetchTimeoutMs
    );
    if (!response.ok || !response.body) {
      return reply.code(502).send(fail(failureCode, `${failureLabel}：${response.status}`));
    }
    assertRemoteResponseSize(response, config.remoteMediaMaxBytes);
    const contentType = selectMediaContentType(response.headers.get("content-type"), mediaType);
    if (!contentType) {
      return reply.code(502).send(fail(failureCode, "远程地址未返回可预览的媒体内容"));
    }
    reply.code(response.status === 206 ? 206 : 200);
    reply.header("content-type", contentType);
    reply.header("content-disposition", createContentDisposition(filename, disposition));
    reply.header("x-content-type-options", "nosniff");
    if (disposition === "inline") reply.header("accept-ranges", "bytes");
    copyResponseHeader(response, reply, "content-length");
    if (disposition === "inline") copyResponseHeader(response, reply, "content-range");
    return reply.send(limitedResponseStream(response, config.remoteMediaMaxBytes));
  } catch (error) {
    const message = error instanceof Error ? error.message : failureLabel;
    return reply.code(502).send(fail(failureCode, message));
  }
}

export function sanitizeDownloadFilename(value: string) {
  const filename = Array.from(value.trim())
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127;
    })
    .join("")
    .replace(/[\\/:*?"<>|]+/g, "")
    .slice(0, 160);
  return filename || "short-video-media";
}

function createRemoteMediaHeaders(url: string, range?: string) {
  const headers: Record<string, string> = {
    accept: "*/*",
    referer: refererFromMediaUrl(url),
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
  };
  if (range) headers.range = range;
  return headers;
}

function refererFromMediaUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    // 小红书 CDN 会校验来源页；经本地代理转发后仍保留平台规定的 Referer。
    if (hostnameMatches(hostname, ["xiaohongshu.com", "xhscdn.com", "xhslink.com", "xhslink.cn"])) {
      return "https://www.xiaohongshu.com/";
    }
    if (hostnameMatches(hostname, ["douyin.com", "zjcdn.com", "amemv.com"])) {
      return "https://www.douyin.com/";
    }
    return `${url.protocol}//${url.hostname}/`;
  } catch {
    return "https://www.douyin.com/";
  }
}

function hostnameMatches(hostname: string, domains: string[]) {
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function selectMediaContentType(value: string | null, expectedType?: "video" | "image") {
  const contentType = value?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (!expectedType) return contentType || "application/octet-stream";
  if (contentType.startsWith(`${expectedType}/`)) return contentType;
  // 部分 CDN 仅返回 application/octet-stream；强制为媒体 MIME 后浏览器不会把响应当作可执行文档。
  if (contentType === "application/octet-stream" || !contentType) {
    return expectedType === "video" ? "video/mp4" : "image/jpeg";
  }
  return null;
}

function copyResponseHeader(response: Response, reply: FastifyReply, name: string) {
  const value = response.headers.get(name);
  if (value) reply.header(name, value);
}

function createContentDisposition(filename: string, disposition: "attachment" | "inline") {
  return `${disposition}; filename="${toAsciiDownloadFilename(filename)}"; filename*=UTF-8''${encodeRFC5987Value(filename)}`;
}

function toAsciiDownloadFilename(filename: string) {
  const extension = filename.match(/\.([a-z0-9]{1,8})$/i)?.[0] ?? "";
  const withoutExtension = extension ? filename.slice(0, -extension.length) : filename;
  const asciiBase = withoutExtension
    .replace(/[^\x20-\x7E]+/g, "")
    .replace(/[\\/:*?"<>|]+/g, "")
    .trim();
  return `${asciiBase || fallbackAsciiBase(extension)}${extension}`;
}

function fallbackAsciiBase(extension: string) {
  return extension.toLowerCase() === ".mp4" ? "video" : "short-video-media";
}

function encodeRFC5987Value(value: string) {
  return encodeURIComponent(value).replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}
