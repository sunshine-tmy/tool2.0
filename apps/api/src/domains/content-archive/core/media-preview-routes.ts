/** 两个命名空间共用本地媒体流：不代理远程 URL，支持播放器与图片预览使用的 Range。 */
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
import { REQUEST_QUOTAS } from "../../../security/request-quotas";
import { sendFileRange } from "../../../core/media/file-range";

type PreviewStore = {
  mediaPath: (id: string, mediaId: string) => Promise<{ filePath: string; media: ContentArchiveMedia } | undefined>;
  pinMedia?: (file: string) => () => void;
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
      const release = value ? store.pinMedia?.(value.filePath) : undefined;
      if (release) reply.raw.once("close", release);
      const stat = value ? await fsp.stat(value.filePath).catch(() => undefined) : undefined;
      if (!value || !stat?.isFile()) {
        release?.();
        return reply
          .code(404)
          .send(
            fail(namespace === "xhs-archive" ? "XHS_MEDIA_NOT_FOUND" : "ARCHIVE_MEDIA_NOT_FOUND", "媒体文件不存在")
          );
      }
      reply
        .header("accept-ranges", "bytes")
        .header("content-type", value.media.mimeType)
        .header("x-content-type-options", "nosniff");
      if (value.media.audioEdit) reply.header("cache-control", "no-store");
      if (request.query.download === "1")
        reply.header(
          "content-disposition",
          `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(value.media.fileName)}`
        );
      return sendArchiveRange(reply, value.filePath, stat.size, request.headers.range, release);
    }
  );
}
export function sendArchiveRange(
  reply: FastifyReply,
  file: string,
  size: number,
  header?: string,
  release?: () => void
) {
  return sendFileRange(reply, file, size, header, release);
}
