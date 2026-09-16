/**
 * 中文模块说明：短视频前端模块，负责链接解析、下载和历史操作
 */
import type { ShortVideoMedia } from "@toolbox/shared";
import { apiBaseUrl } from "../../config/runtime";

const fallbackExtensions: Record<ShortVideoMedia["type"], string> = {
  image: "jpg",
  video: "mp4"
};

type DownloadFrame = HTMLIFrameElement | string;

type ShortVideoDownloadDeps = {
  startFrameDownload: (url: string) => DownloadFrame;
  removeFrameDownload: (frame: DownloadFrame) => void;
  scheduleCleanup: (task: () => void) => void;
};

type ShortVideoDownloadOptions = {
  apiBase?: string;
  deps?: ShortVideoDownloadDeps;
};

export function createShortVideoDownloadName(media: ShortVideoMedia) {
  // 文件名只保留安全字符，并优先使用 URL 扩展名；无法识别时按媒体类型回退。
  const baseName = normalizeFileBase(media.label) || media.type;
  const extension = extractExtension(media.url) || fallbackExtensions[media.type];
  return `${baseName}.${extension}`;
}

export function createShortVideoDownloadUrl(media: ShortVideoMedia, apiBase = apiBaseUrl) {
  // 原始媒体 URL 作为查询参数交给后端下载代理，由后端执行 SSRF、响应大小和文件名校验。
  const params = new URLSearchParams({
    url: media.url,
    filename: createShortVideoDownloadName(media)
  });
  return `${apiBase.replace(/\/$/, "")}/tools/short-video/download?${params.toString()}`;
}

export function createShortVideoPreviewUrl(media: ShortVideoMedia, apiBase = apiBaseUrl) {
  // 预览同样经过本地代理：保留 Range、Referer 与 SSRF 校验，避免浏览器直连第三方 CDN 失败。
  const params = new URLSearchParams({
    url: media.url,
    filename: createShortVideoDownloadName(media),
    mediaType: media.type
  });
  return `${apiBase.replace(/\/$/, "")}/tools/short-video/preview?${params.toString()}`;
}

export function triggerShortVideoDownload(media: ShortVideoMedia, options: ShortVideoDownloadOptions = {}) {
  // 使用隐藏 iframe 触发跨域/大文件下载，不把视频内容读入前端内存；完成后定时移除 iframe。
  const deps = options.deps ?? browserDownloadDeps();
  const frame = deps.startFrameDownload(createShortVideoDownloadUrl(media, options.apiBase));
  deps.scheduleCleanup(() => deps.removeFrameDownload(frame));
}

function browserDownloadDeps(): ShortVideoDownloadDeps {
  return {
    startFrameDownload: (url) => {
      const frame = document.createElement("iframe");
      frame.src = url;
      frame.style.display = "none";
      frame.setAttribute("aria-hidden", "true");
      document.body.appendChild(frame);
      return frame;
    },
    removeFrameDownload: (frame) => {
      if (frame instanceof HTMLIFrameElement) {
        frame.remove();
      }
    },
    scheduleCleanup: (task) => {
      window.setTimeout(task, 30_000);
    }
  };
}

function normalizeFileBase(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-");
}

function extractExtension(value: string) {
  const path = extractPath(value);
  const match = path.match(/\.([a-z0-9]{1,8})$/i);
  return match?.[1]?.toLowerCase() ?? "";
}

function extractPath(value: string) {
  try {
    return new URL(value).pathname;
  } catch {
    return value.split("?")[0]?.split("#")[0] ?? value;
  }
}
