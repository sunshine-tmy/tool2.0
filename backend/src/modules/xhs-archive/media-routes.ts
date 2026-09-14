import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { ZipArchive } from "archiver";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  XhsArchiveIdParamsSchema,
  XhsArchiveMediaParamsSchema,
  XhsMediaQuerySchema,
  fail,
  normalizeXhsText,
  parseXhsContentText,
  type XhsArchiveIdParams,
  type XhsArchiveItem,
  type XhsArchiveMedia,
  type XhsArchiveMediaParams,
  type XhsMediaQuery
} from "@toolbox/shared";
import type { XhsArchiveStore } from "./store";
import { effectiveTranslation } from "./translation-service";

type RegisterXhsMediaRoutesOptions = {
  app: FastifyInstance;
  store: XhsArchiveStore;
};

export function registerXhsMediaRoutes({ app, store }: RegisterXhsMediaRoutesOptions) {
  app.get<{ Params: XhsArchiveMediaParams; Querystring: XhsMediaQuery }>(
    "/api/v1/tools/xhs-archive/items/:id/media/:mediaId",
    { schema: { params: XhsArchiveMediaParamsSchema, querystring: XhsMediaQuerySchema } },
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
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: { params: XhsArchiveIdParamsSchema }
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
