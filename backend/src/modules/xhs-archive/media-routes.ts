/**
 * 中文模块说明：小红书归档领域，负责获取、媒体、翻译、运行时和恢复
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ZipArchive } from "archiver";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  ApiFailureSchema,
  XhsArchiveIdParamsSchema,
  XhsArchiveItemSchema,
  XhsArchiveMediaParamsSchema,
  XhsMediaQuerySchema,
  apiSuccessSchema,
  fail,
  normalizeXhsText,
  ok,
  parseXhsContentText,
  type XhsArchiveIdParams,
  type XhsArchiveItem,
  type XhsArchiveMedia,
  type XhsArchiveMediaParams,
  type XhsArchiveFrameCapture,
  type XhsMediaQuery
} from "@toolbox/shared";
import { REQUEST_QUOTAS } from "../../security/request-quotas";
import { XhsArchiveStoreError, type XhsArchiveStore } from "./store";
import { effectiveTranslation } from "./translation-service";

const XHS_FRAME_MAX_BYTES = 20 * 1024 * 1024;
const XHS_FRAME_MAX_PIXELS = 40_000_000;

type RegisterXhsMediaRoutesOptions = {
  app: FastifyInstance;
  store: XhsArchiveStore;
};

export function registerXhsMediaRoutes({ app, store }: RegisterXhsMediaRoutesOptions) {
  app.post<{ Params: XhsArchiveIdParams }>(
    "/api/v1/tools/xhs-archive/items/:id/frames",
    {
      bodyLimit: XHS_FRAME_MAX_BYTES + 64 * 1024,
      config: REQUEST_QUOTAS.lanUpload,
      schema: {
        params: XhsArchiveIdParamsSchema,
        response: {
          200: apiSuccessSchema(XhsArchiveItemSchema),
          400: ApiFailureSchema,
          404: ApiFailureSchema,
          413: ApiFailureSchema,
          415: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      let png: Buffer | undefined;
      const fields: Record<string, unknown> = {};
      for await (const part of request.parts({ limits: { fileSize: XHS_FRAME_MAX_BYTES, files: 1, fields: 2 } })) {
        if (part.type === "field") {
          fields[part.fieldname] = part.value;
          continue;
        }
        if (part.fieldname !== "file") {
          part.file.resume();
          continue;
        }
        png = await part.toBuffer();
        if (part.file.truncated || png.length > XHS_FRAME_MAX_BYTES) {
          return reply.code(413).send(fail("XHS_FRAME_TOO_LARGE", "截帧图片不能超过 20 MiB"));
        }
        if (part.mimetype !== "image/png") {
          return reply.code(415).send(fail("XHS_FRAME_FORMAT_INVALID", "截帧仅支持 PNG 图片"));
        }
      }
      if (!png) return reply.code(400).send(fail("XHS_FRAME_REQUIRED", "缺少截帧图片文件"));

      const timestampText = typeof fields.timestampMs === "string" ? fields.timestampMs : "";
      const sourceMediaId = typeof fields.sourceMediaId === "string" ? fields.sourceMediaId : "";
      const timestampMs = /^\d+$/.test(timestampText) ? Number(timestampText) : Number.NaN;
      if (!/^[A-Za-z0-9_-]{6,128}$/.test(sourceMediaId) || !Number.isSafeInteger(timestampMs) || timestampMs < 0) {
        return reply.code(400).send(fail("XHS_FRAME_METADATA_INVALID", "截帧来源或时间信息无效"));
      }
      const capture: XhsArchiveFrameCapture = { sourceMediaId, timestampMs };

      const imageMetadata = await sharp(png, { limitInputPixels: XHS_FRAME_MAX_PIXELS })
        .metadata()
        .catch(() => undefined);
      if (!imageMetadata) {
        return reply.code(415).send(fail("XHS_FRAME_IMAGE_INVALID", "截帧文件不是有效的 PNG 图片"));
      }
      if (imageMetadata.format !== "png" || !imageMetadata.width || !imageMetadata.height) {
        return reply.code(415).send(fail("XHS_FRAME_IMAGE_INVALID", "截帧文件不是有效的 PNG 图片"));
      }
      if (imageMetadata.width * imageMetadata.height > XHS_FRAME_MAX_PIXELS) {
        return reply.code(413).send(fail("XHS_FRAME_DIMENSIONS_TOO_LARGE", "截帧图片尺寸不能超过 4000 万像素"));
      }

      try {
        const item = await store.addVideoFrame(request.params.id, {
          sourceMediaId: capture.sourceMediaId,
          timestampMs: capture.timestampMs,
          png,
          width: imageMetadata.width,
          height: imageMetadata.height
        });
        return ok(item);
      } catch (error) {
        if (error instanceof XhsArchiveStoreError) {
          return reply.code(error.statusCode).send(fail(error.code, error.message));
        }
        throw error;
      }
    }
  );

  app.get<{ Params: XhsArchiveMediaParams; Querystring: XhsMediaQuery }>(
    "/api/v1/tools/xhs-archive/items/:id/media/:mediaId",
    {
      schema: {
        params: XhsArchiveMediaParamsSchema,
        querystring: XhsMediaQuerySchema,
        response: { 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const { id, mediaId } = request.params;
      const value = await store.mediaPath(id, mediaId);
      if (!value) return reply.code(404).send(fail("XHS_MEDIA_NOT_FOUND", "媒体文件不存在"));
      const stat = await fsp.stat(value.filePath).catch(() => undefined);
      if (!stat?.isFile()) return reply.code(404).send(fail("XHS_MEDIA_NOT_FOUND", "媒体文件不存在"));
      const download = request.query.download === "1";
      reply
        .header("accept-ranges", "bytes")
        .header("content-type", value.media.mimeType)
        .header("x-content-type-options", "nosniff");
      if (download) reply.header("content-disposition", disposition(value.media.fileName));
      return sendRange(reply, value.filePath, stat.size, request.headers.range);
    }
  );

  app.get<{ Params: XhsArchiveIdParams }>(
    "/api/v1/tools/xhs-archive/items/:id/download.zip",
    {
      config: REQUEST_QUOTAS.batchDownload,
      schema: { params: XhsArchiveIdParamsSchema, response: { 404: ApiFailureSchema } }
    },
    async (request, reply) => {
      const item = await store.get(request.params.id);
      if (!item) return reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
      const archive = new ZipArchive({ zlib: { level: 6 } });
      reply
        .header("content-type", "application/zip")
        .header(
          "content-disposition",
          disposition(`小红书-${safeName(normalizeXhsText(item.title))}-${item.id.slice(-6)}.zip`)
        );
      archive.append(contentText(item), { name: "内容-中文.txt" });
      if (item.translation?.status === "ready") {
        archive.append(englishContentText(item), { name: "Content-English.txt" });
        archive.append(bilingualContentText(item), { name: "内容-中英双语.txt" });
      }
      archive.append(
        JSON.stringify(
          {
            ...item,
            title: normalizeXhsText(item.title),
            description: item.description ? normalizeXhsText(item.description) : undefined,
            translation: item.translation
              ? {
                  ...item.translation,
                  effective: {
                    title: effectiveTranslation(item.translation.title),
                    description: effectiveTranslation(item.translation.description),
                    topics: item.translation.topics.map((topic) => ({
                      topicId: topic.topicId,
                      value: effectiveTranslation(topic)
                    }))
                  }
                }
              : undefined
          },
          null,
          2
        ),
        { name: "metadata.json" }
      );
      for (const media of item.media) {
        const value = await store.mediaPath(item.id, media.id);
        if (value && fs.existsSync(value.filePath)) archive.file(value.filePath, { name: exportName(media) });
      }
      void archive.finalize();
      return reply.send(archive);
    }
  );
}

function sendRange(reply: FastifyReply, file: string, size: number, header?: string) {
  if (!header) {
    reply.header("content-length", size);
    return reply.send(fs.createReadStream(file));
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match) return reply.code(416).header("content-range", `bytes */${size}`).send();
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= size)
    return reply.code(416).header("content-range", `bytes */${size}`).send();
  reply.code(206).headers({ "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1 });
  return reply.send(fs.createReadStream(file, { start, end }));
}

function disposition(name: string) {
  return `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

function safeName(value: string) {
  return (
    value
      .split("")
      .map((character) => (character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? "-" : character))
      .join("")
      .trim()
      .slice(0, 60) || "内容"
  );
}

function exportName(media: XhsArchiveMedia) {
  if (media.frameSourceMediaId && media.frameTimestampMs !== undefined) {
    const milliseconds = media.frameTimestampMs;
    const hours = Math.floor(milliseconds / 3_600_000);
    const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
    const seconds = Math.floor((milliseconds % 60_000) / 1_000);
    const remainder = milliseconds % 1_000;
    const time = [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join("-");
    return `视频截帧-${String(media.index + 1).padStart(3, "0")}-${time}-${String(remainder).padStart(3, "0")}.png`;
  }
  const ext = path.extname(media.fileName);
  const label =
    media.kind === "image" || media.kind === "cover" ? "图片" : media.kind === "live-photo" ? "实况" : "视频";
  return `${label}-${String(media.index + 1).padStart(2, "0")}${ext}`;
}

function contentText(item: XhsArchiveItem) {
  const parsed = parseXhsContentText(item.description);
  return [
    `标题：${normalizeXhsText(item.title)}`,
    `作者：${item.author?.name ?? ""}`,
    `来源：${item.canonicalUrl}`,
    "",
    parsed.body,
    parsed.topics.length ? `\n话题：${parsed.topics.map((topic) => `#${topic.source}`).join(" ")}` : ""
  ].join("\n");
}

function englishContentText(item: XhsArchiveItem) {
  const translation = item.translation;
  if (!translation) return "";
  const topics = translation.topics.map((topic) => `#${effectiveTranslation(topic)}`).join(" ");
  return [
    `Title: ${effectiveTranslation(translation.title)}`,
    `Author: ${item.author?.name ?? ""}`,
    `Source: ${item.canonicalUrl}`,
    "",
    effectiveTranslation(translation.description),
    topics ? `\nTopics: ${topics}` : ""
  ].join("\n");
}

function bilingualContentText(item: XhsArchiveItem) {
  const translation = item.translation;
  if (!translation) return contentText(item);
  const parsed = parseXhsContentText(item.description);
  const sourceTopics = item.topics.length ? item.topics : parsed.topics;
  return [
    `标题：${item.title}`,
    `Title: ${effectiveTranslation(translation.title)}`,
    `作者：${item.author?.name ?? ""}`,
    `来源：${item.canonicalUrl}`,
    "",
    "正文：",
    parsed.body,
    "",
    "Description:",
    effectiveTranslation(translation.description),
    sourceTopics.length ? `\n话题：${sourceTopics.map((topic) => `#${topic.source}`).join(" ")}` : "",
    sourceTopics.length
      ? `Topics: ${translation.topics.map((topic) => `#${effectiveTranslation(topic)}`).join(" ")}`
      : ""
  ].join("\n");
}
