/** 两个命名空间共用本地媒体流：不代理远程 URL，支持播放器与图片预览使用的 Range。 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  ApiFailureSchema,
  XhsArchiveMediaParamsSchema,
  XhsMediaQuerySchema,
  fail,
  type ContentArchiveMedia,
  type XhsArchiveMediaParams,
  type XhsMediaQuery
} from "@toolbox/shared";
import { REQUEST_QUOTAS } from "../../security/request-quotas";

type PreviewStore = {
  mediaPath: (id: string, mediaId: string) => Promise<{ filePath: string; media: ContentArchiveMedia } | undefined>;
};
export function registerArchivePreviewRoutes(
  app: FastifyInstance,
  store: PreviewStore,
  namespace: "xhs-archive" | "media-archive"
) {
  app.get<{ Params: XhsArchiveMediaParams; Querystring: XhsMediaQuery }>(
    `/api/v1/tools/${namespace}/items/:id/media/:mediaId`,
    {
      config: REQUEST_QUOTAS.mediaPreview,
      schema: {
        params: XhsArchiveMediaParamsSchema,
        querystring: XhsMediaQuerySchema,
        response: { 404: ApiFailureSchema, 429: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const value = await store.mediaPath(request.params.id, request.params.mediaId);
      const stat = value ? await fsp.stat(value.filePath).catch(() => undefined) : undefined;
      if (!value || !stat?.isFile())
        return reply
          .code(404)
          .send(
            fail(namespace === "xhs-archive" ? "XHS_MEDIA_NOT_FOUND" : "ARCHIVE_MEDIA_NOT_FOUND", "媒体文件不存在")
          );
      reply
        .header("accept-ranges", "bytes")
        .header("content-type", value.media.mimeType)
        .header("x-content-type-options", "nosniff");
      if (request.query.download === "1")
        reply.header(
          "content-disposition",
          `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(value.media.fileName)}`
        );
      return sendRange(reply, value.filePath, stat.size, request.headers.range);
    }
  );
}
function sendRange(reply: FastifyReply, file: string, size: number, header?: string) {
  if (!header) return reply.header("content-length", size).send(fs.createReadStream(file));
  const invalid = () => reply.code(416).header("content-range", `bytes */${size}`).send();
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return invalid();
  const suffix = !match[1];
  const first = Number(match[1] || match[2]);
  const last = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || (suffix && first <= 0)) return invalid();
  const start = suffix ? Math.max(0, size - first) : first;
  const end = suffix ? size - 1 : Math.min(last, size - 1);
  if (start < 0 || start >= size || end < start) return invalid();
  return reply
    .code(206)
    .headers({ "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1 })
    .send(fs.createReadStream(file, { start, end }));
}
