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
  const { reply, config, remoteFetch, url, filename } = options;
  try {
    const response = await fetchRemoteResponse(
      remoteFetch,
      url,
      {
        headers: {
          accept: "*/*",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
        }
      },
      config.remoteFetchTimeoutMs
    );
    if (!response.ok || !response.body) {
      return reply.code(502).send(fail("SHORT_VIDEO_DOWNLOAD_FAILED", `媒体下载失败：${response.status}`));
    }
    assertRemoteResponseSize(response, config.remoteMediaMaxBytes);
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const contentLength = response.headers.get("content-length");
    reply.header("content-type", contentType);
    reply.header("content-disposition", createAttachmentDisposition(filename));
    if (contentLength) reply.header("content-length", contentLength);
    return reply.send(limitedResponseStream(response, config.remoteMediaMaxBytes));
  } catch (error) {
    const message = error instanceof Error ? error.message : "媒体下载失败";
    return reply.code(502).send(fail("SHORT_VIDEO_DOWNLOAD_FAILED", message));
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

function createAttachmentDisposition(filename: string) {
  return `attachment; filename="${toAsciiDownloadFilename(filename)}"; filename*=UTF-8''${encodeRFC5987Value(filename)}`;
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
