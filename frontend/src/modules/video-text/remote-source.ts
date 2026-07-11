export type RemoteVideoSource = {
  url: string;
  fileName: string;
};

type RouteQueryValue = string | string[] | null | undefined;

export function getRemoteVideoSourceFromQuery(query: {
  remoteUrl?: RouteQueryValue;
  fileName?: RouteQueryValue;
}): RemoteVideoSource | null {
  const url = firstQueryValue(query.remoteUrl);
  if (!isHttpUrl(url)) return null;

  return {
    url,
    fileName: firstQueryValue(query.fileName) || fileNameFromUrl(url)
  };
}

export function createRemoteVideoPreviewUrl(url: string, apiBase = apiBaseUrl) {
  const params = new URLSearchParams({ url });
  return `${apiBase.replace(/\/$/, "")}/tools/video-text/remote-video?${params.toString()}`;
}

function firstQueryValue(value: RouteQueryValue) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function fileNameFromUrl(value: string) {
  try {
    const parsed = new URL(value);
    const fileName = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() ?? "");
    return fileName || "remote-video.mp4";
  } catch {
    return "remote-video.mp4";
  }
}
import { apiBaseUrl } from "../../config/runtime";
