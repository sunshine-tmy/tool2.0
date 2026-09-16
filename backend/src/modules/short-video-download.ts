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
    if (hostname.includes("xiaohongshu") || hostname.includes("xhscdn") || hostname.includes("xhslink")) {
      return "https://www.xiaohongshu.com/";
    }
    if (hostname.includes("douyin") || hostname.includes("zjcdn") || hostname.includes("amemv")) {
      return "https://www.douyin.com/";
    }
    return `${url.protocol}//${url.hostname}/`;
  } catch {
    return "https://www.douyin.com/";
  }
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
