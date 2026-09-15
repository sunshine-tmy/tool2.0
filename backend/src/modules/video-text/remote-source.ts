/**
 * 中文模块说明：视频文本分析领域，负责上传、转写任务、历史和导出
 */
import path from "node:path";
import type { AppConfig } from "../../config";
import { fetchRemoteResponse, type RemoteFetch } from "../../security/remote-fetch";

export function fetchRemoteVideo(sourceUrl: string, remoteFetch: RemoteFetch, config: AppConfig, range?: string) {
  const headers: Record<string, string> = {
    accept: "video/*,*/*",
    referer: refererFromUrl(sourceUrl),
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
  };
  if (range) headers.range = range;
  return fetchRemoteResponse(remoteFetch, sourceUrl, { headers }, config.remoteFetchTimeoutMs);
}

export function copyHeader(
  response: Response,
  reply: { header: (name: string, value: string) => unknown },
  name: string
) {
  const value = response.headers.get(name);
  if (value) reply.header(name, value);
}

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function fileNameFromUrl(value: string) {
  try {
    const baseName = path.basename(decodeURIComponent(new URL(value).pathname));
    return baseName && baseName.includes(".") ? baseName : "remote-video.mp4";
  } catch {
    return "remote-video.mp4";
  }
}

export function normalizeVideoMimeType(value: string | null) {
  const mimeType = value?.split(";")[0]?.trim().toLowerCase();
  return mimeType?.startsWith("video/") ? mimeType : "video/mp4";
}

export function parseContentLength(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function refererFromUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (hostname.includes("douyin") || hostname.includes("zjcdn.com") || hostname.includes("amemv.com")) {
      return "https://www.douyin.com/";
    }
    if (hostname.includes("xiaohongshu") || hostname.includes("xhscdn.com") || hostname.includes("xhslink.com")) {
      return "https://www.xiaohongshu.com/";
    }
    return `${url.protocol}//${url.hostname}/`;
  } catch {
    return "https://www.douyin.com/";
  }
}
