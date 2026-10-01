/** 小红书媒体兼容入口只传入平台过滤视图；截帧、导出与 Range 均复用多媒体归档实现。 */
import type { FastifyInstance } from "fastify";
import type { XhsArchiveStore } from "./store";
import { registerArchiveArtifactRoutes } from "../media-archive/artifact-routes";
import { registerArchivePreviewRoutes } from "../media-archive/media-preview-routes";

export function registerXhsMediaRoutes({ app, store }: { app: FastifyInstance; store: XhsArchiveStore }) {
  registerArchiveArtifactRoutes(app, store, "xhs-archive");
  registerArchivePreviewRoutes(app, store, "xhs-archive");
}
