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
  const baseName = normalizeFileBase(media.label) || media.type;
  const extension = extractExtension(media.url) || fallbackExtensions[media.type];
  return `${baseName}.${extension}`;
}

export function createShortVideoDownloadUrl(media: ShortVideoMedia, apiBase = apiBaseUrl) {
  const params = new URLSearchParams({
    url: media.url,
    filename: createShortVideoDownloadName(media)
  });
  return `${apiBase.replace(/\/$/, "")}/tools/short-video/download?${params.toString()}`;
}

export function triggerShortVideoDownload(media: ShortVideoMedia, options: ShortVideoDownloadOptions = {}) {
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
