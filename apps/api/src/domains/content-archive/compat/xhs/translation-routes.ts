/** 小红书兼容入口只传入过滤存储视图，所有翻译路由与中性入口共用实现。 */
import type { FastifyInstance } from "fastify";
import type { XhsArchiveStore } from "./store";
import type { ContentArchiveTranslationService } from "../../core/translation-service";
import { registerArchiveTranslationRoutes } from "../../core/translation-routes";

export function registerXhsTranslationRoutes({
  app,
  store,
  translation
}: {
  app: FastifyInstance;
  store: XhsArchiveStore;
  translation: Pick<ContentArchiveTranslationService, "enqueue" | "getTask" | "getRuntimeStatus">;
}) {
  registerArchiveTranslationRoutes(app, store, translation, "xhs-archive");
}
