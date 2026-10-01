/** 媒体只流式写入受控 staging；每跳继续使用校验 IP 的 RemoteFetch，不附带平台 Cookie。 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { nanoid } from "nanoid";
import sharp from "sharp";
import type { ContentArchiveMedia, ArchivePlatform } from "@toolbox/shared";
import type { AppConfig } from "../../config";
import { assertRemoteResponseSize, limitedResponseStream, type RemoteFetch } from "../../security/remote-fetch";
import { abortable, ArchiveTaskError, type ArchiveSource } from "./provider";

export class ArchiveDownloadGateway {
  constructor(
    private readonly config: AppConfig,
    private readonly remoteFetch: RemoteFetch
  ) {
    // libvips 的 WebP 文件缓存会在 metadata() 完成后持有句柄，阻止 Windows 原子移动目录。
    // 仅禁用文件句柄缓存，保留内存/运算缓存；不能在单个请求结束时恢复，以免并发任务重新加锁。
    if (process.platform === "win32") sharp.cache({ files: 0 });
  }
  async download(
    source: ArchiveSource["media"][number],
    platform: ArchivePlatform,
    directory: string,
    itemId: string,
    signal: AbortSignal
  ): Promise<ContentArchiveMedia> {
    // CDN 备用地址仅在本媒体失败时尝试，每个请求仍完整通过 DNS/重定向安全检查。
    for (const url of source.urls.slice(0, 8)) {
      signal.throwIfAborted();
      const id = nanoid(12);
      const temporary = path.join(directory, `${id}.downloading`);
      let response: Response | undefined;
      const controller = new AbortController();
      try {
        const requestSignal = AbortSignal.any([signal, controller.signal]);
        const timer = setTimeout(
          () => controller.abort(new DOMException("媒体连接超时", "TimeoutError")),
          this.config.remoteFetchTimeoutMs
        );
        try {
          response = await abortable(
            this.remoteFetch(url, {
              headers: {
                referer: platform === "douyin" ? "https://www.douyin.com/" : "https://www.xiaohongshu.com/",
                "user-agent": "Mozilla/5.0"
              },
              signal: requestSignal
            }),
            requestSignal
          );
        } finally {
          clearTimeout(timer);
        }
        if (!response.ok) throw new Error("MEDIA_HTTP_ERROR");
        assertRemoteResponseSize(response, this.config.remoteMediaMaxBytes);
        const hash = createHash("sha256");
        const hasher = new Transform({
          transform(chunk, _encoding, callback) {
            hash.update(chunk);
            callback(null, chunk);
          }
        });
        await pipeline(
          limitedResponseStream(response, this.config.remoteMediaMaxBytes),
          hasher,
          fs.createWriteStream(temporary, { flags: "wx" }),
          { signal }
        );
        signal.throwIfAborted();
        const stat = await fsp.stat(temporary);
        if (!stat.size) throw new Error("MEDIA_EMPTY");
        const length = response.headers.get("content-length");
        if (length && !response.headers.get("content-encoding") && Number(length) !== stat.size)
          throw new Error("MEDIA_TRUNCATED");
        let mimeType = (response.headers.get("content-type") || defaultMime(source.kind))
          .split(";")[0]
          .trim()
          .toLowerCase();
        if (
          platform === "xiaohongshu" &&
          !/^(?:image\/(?:jpeg|png|webp|gif|avif)|video\/(?:mp4|quicktime)|application\/octet-stream)$/.test(mimeType)
        )
          throw new Error("MEDIA_FORMAT_INVALID");
        if (mimeType === "application/octet-stream") mimeType = defaultMime(source.kind);
        let width = source.width,
          height = source.height;
        if (platform === "douyin") {
          if (source.kind === "image" || source.kind === "cover") {
            const image = await sharp(temporary, { limitInputPixels: 40_000_000 }).metadata();
            const formats: Record<string, string> = {
              jpeg: "image/jpeg",
              png: "image/png",
              webp: "image/webp",
              gif: "image/gif",
              avif: "image/avif"
            };
            if (!image.format || !formats[image.format] || !image.width || !image.height)
              throw new Error("MEDIA_FORMAT_INVALID");
            mimeType = formats[image.format];
            width = image.width;
            height = image.height;
          } else {
            const handle = await fsp.open(temporary, "r");
            const header = Buffer.alloc(12);
            try {
              await handle.read(header, 0, 12, 0);
            } finally {
              await handle.close();
            }
            if (header.subarray(4, 8).toString() !== "ftyp") throw new Error("MEDIA_FORMAT_INVALID");
            mimeType = "video/mp4";
          }
        }
        const extension = extensionFor(mimeType, source.kind);
        const fileName = `${String(source.index + 1).padStart(3, "0")}-${id}.${extension}`;
        await fsp.rename(temporary, path.join(directory, fileName));
        return {
          id,
          kind: source.kind,
          index: source.index,
          fileName,
          mimeType,
          size: stat.size,
          checksum: hash.digest("hex"),
          width,
          height,
          durationMs: source.durationMs,
          previewUrl: `/api/v1/tools/media-archive/items/${itemId}/media/${id}`,
          downloadUrl: `/api/v1/tools/media-archive/items/${itemId}/media/${id}?download=1`
        };
      } catch {
        await response?.body?.cancel().catch(() => undefined);
        await fsp.rm(temporary, { force: true }).catch(() => undefined);
        signal.throwIfAborted();
      } finally {
        // 下游大小限制、写盘失败或格式校验失败时也关闭 CDN 连接；锁定的 body.cancel() 并不可靠。
        controller.abort();
      }
    }
    // 不向用户回传 CDN URL、原生网络异常或本地路径。
    throw new ArchiveTaskError("ARCHIVE_MEDIA_DOWNLOAD_FAILED", "媒体下载或格式校验失败");
  }
}
function defaultMime(kind: ContentArchiveMedia["kind"]) {
  return kind === "video" || kind === "live-photo" ? "video/mp4" : "image/jpeg";
}
function extensionFor(mime: string, kind: ContentArchiveMedia["kind"]) {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
    "video/mp4": "mp4",
    "video/quicktime": "mov"
  };
  return extensions[mime] ?? (kind === "image" || kind === "cover" ? "jpg" : "mp4");
}
