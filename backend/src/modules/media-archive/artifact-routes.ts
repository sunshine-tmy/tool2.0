/** 双平台截帧/ZIP 共用实现；旧入口传入仅小红书的存储视图，不扩大旧客户端的平台权限。 */
import fs from "node:fs/promises";
import sharp from "sharp";
import { ZipArchive } from "archiver";
import type { FastifyInstance } from "fastify";
import type { FastifyMultipartBaseOptions } from "@fastify/multipart";
import {
  ApiFailureSchema,
  ContentArchiveItemSchema,
  XhsArchiveIdParamsSchema,
  XhsArchiveItemSchema,
  apiSuccessSchema,
  fail,
  ok,
  type ContentArchiveMedia,
  type XhsArchiveIdParams
} from "@toolbox/shared";
import { REQUEST_QUOTAS } from "../../security/request-quotas";
import { ContentArchiveStoreError } from "./store";
import { archiveExportDocuments, archiveMediaExportNames, archiveZipName, type ArchiveExportItem } from "./export";

const FRAME_MAX_BYTES = 20 * 1024 * 1024;
const FRAME_MAX_PIXELS = 40_000_000;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
type ArtifactStore<T extends ArchiveExportItem> = {
  get: (id: string) => Promise<T | undefined>;
  addVideoFrame: (
    id: string,
    input: { sourceMediaId: string; timestampMs: number; png: Buffer; width: number; height: number }
  ) => Promise<T>;
  mediaPath: (id: string, mediaId: string) => Promise<{ filePath: string; media: ContentArchiveMedia } | undefined>;
};

export function registerArchiveArtifactRoutes<T extends ArchiveExportItem>(
  app: FastifyInstance,
  store: ArtifactStore<T>,
  namespace: "xhs-archive" | "media-archive"
) {
  const prefix = `/api/v1/tools/${namespace}/items/:id`;
  const code = (value: string) => `${namespace === "xhs-archive" ? "XHS" : "ARCHIVE"}_${value}`;
  app.post<{ Params: XhsArchiveIdParams }>(
    `${prefix}/frames`,
    {
      bodyLimit: FRAME_MAX_BYTES + 64 * 1024,
      config: REQUEST_QUOTAS.lanUpload,
      schema: {
        params: XhsArchiveIdParamsSchema,
        response: {
          200: apiSuccessSchema(namespace === "xhs-archive" ? XhsArchiveItemSchema : ContentArchiveItemSchema),
          400: ApiFailureSchema,
          404: ApiFailureSchema,
          413: ApiFailureSchema,
          415: ApiFailureSchema,
          429: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      let png: Buffer | undefined;
      const fields: Record<string, unknown> = {};
      const multipartOptions: FastifyMultipartBaseOptions = {
        throwFileSizeLimit: false,
        limits: { fileSize: FRAME_MAX_BYTES, files: 1, fields: 2 }
      };
      for await (const part of request.parts(multipartOptions)) {
        if (part.type === "field") {
          fields[part.fieldname] = part.value;
          continue;
        }
        if (part.fieldname !== "file") {
          part.file.resume();
          continue;
        }
        png = await part.toBuffer();
        if (part.file.truncated || png.length > FRAME_MAX_BYTES)
          return reply.code(413).send(fail(code("FRAME_TOO_LARGE"), "截帧图片不能超过 20 MiB"));
        if (part.mimetype !== "image/png")
          return reply.code(415).send(fail(code("FRAME_FORMAT_INVALID"), "截帧仅支持 PNG 图片"));
      }
      if (!png) return reply.code(400).send(fail(code("FRAME_REQUIRED"), "缺少截帧图片文件"));
      const timestampText = typeof fields.timestampMs === "string" ? fields.timestampMs : "";
      const sourceMediaId = typeof fields.sourceMediaId === "string" ? fields.sourceMediaId : "";
      const timestampMs = /^\d+$/.test(timestampText) ? Number(timestampText) : Number.NaN;
      if (!/^[A-Za-z0-9_-]{6,128}$/.test(sourceMediaId) || !Number.isSafeInteger(timestampMs) || timestampMs < 0)
        return reply.code(400).send(fail(code("FRAME_METADATA_INVALID"), "截帧来源或时间信息无效"));
      if (!png.subarray(0, 8).equals(PNG_SIGNATURE))
        return reply.code(415).send(fail(code("FRAME_IMAGE_INVALID"), "截帧文件不是有效的 PNG 图片"));
      // metadata 不解码像素。只对签名正确的 PNG 读尺寸，先拒绝超像素，再以原上限进行实际解码。
      const metadata = await sharp(png, { limitInputPixels: false })
        .metadata()
        .catch(() => undefined);
      if (!metadata || metadata.format !== "png" || !metadata.width || !metadata.height)
        return reply.code(415).send(fail(code("FRAME_IMAGE_INVALID"), "截帧文件不是有效的 PNG 图片"));
      if (metadata.width * metadata.height > FRAME_MAX_PIXELS)
        return reply.code(413).send(fail(code("FRAME_DIMENSIONS_TOO_LARGE"), "截帧图片尺寸不能超过 4000 万像素"));
      const decoded = await sharp(png, { limitInputPixels: FRAME_MAX_PIXELS, failOn: "warning" })
        .stats()
        .then(
          () => true,
          () => false
        );
      if (!decoded) return reply.code(415).send(fail(code("FRAME_IMAGE_INVALID"), "截帧 PNG 像素数据已损坏"));
      try {
        return ok(
          await store.addVideoFrame(request.params.id, {
            sourceMediaId,
            timestampMs,
            png,
            width: metadata.width,
            height: metadata.height
          })
        );
      } catch (error) {
        if (error instanceof ContentArchiveStoreError)
          return reply
            .code(error.statusCode)
            .send(
              fail(namespace === "xhs-archive" ? error.code : error.code.replace(/^XHS_/, "ARCHIVE_"), error.message)
            );
        throw error;
      }
    }
  );

  app.get<{ Params: XhsArchiveIdParams }>(
    `${prefix}/download.zip`,
    {
      config: REQUEST_QUOTAS.batchDownload,
      schema: {
        params: XhsArchiveIdParamsSchema,
        response: { 404: ApiFailureSchema, 409: ApiFailureSchema, 429: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const item = await store.get(request.params.id);
      if (!item)
        return reply
          .code(404)
          .send(fail(namespace === "xhs-archive" ? "XHS_ARCHIVE_NOT_FOUND" : "ARCHIVE_NOT_FOUND", "存档不存在"));
      const files: string[] = [];
      for (const media of item.media) {
        const value = await store.mediaPath(item.id, media.id);
        const stat = value ? await fs.stat(value.filePath).catch(() => undefined) : undefined;
        if (!value || !stat?.isFile() || stat.size !== media.size)
          return reply.code(409).send(fail(code("EXPORT_MEDIA_MISSING"), "媒体文件缺失或大小不符，无法导出完整存档"));
        files.push(value.filePath);
      }
      const archive = new ZipArchive({ zlib: { level: 6 } });
      // 流式文件可能在预检后消失；不能忽略 warning 后把缺媒体的 ZIP 宣称为完整成功。
      archive.on("warning", () => archive.destroy(new Error("ARCHIVE_EXPORT_READ_FAILED")));
      reply.raw.once("close", () => archive.destroy());
      const names = archiveMediaExportNames(item.media);
      for (const document of archiveExportDocuments(item)) archive.append(document.text, { name: document.name });
      files.forEach((file, index) => archive.file(file, { name: names[index] }));
      reply
        .header("content-type", "application/zip")
        .header(
          "content-disposition",
          `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(archiveZipName(item))}`
        );
      void archive.finalize().catch(() => archive.destroy(new Error("ARCHIVE_EXPORT_FAILED")));
      return reply.send(archive);
    }
  );
}
