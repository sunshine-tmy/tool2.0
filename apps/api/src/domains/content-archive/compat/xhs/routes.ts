/** Legacy HTTP adapters only; the domain assembly owns initialization and shutdown. */
import {
  ApiFailureSchema,
  TaskIdParamsSchema,
  XhsArchiveCreateInputSchema,
  XhsArchiveIdParamsSchema,
  XhsArchiveItemSchema,
  XhsArchiveListQuerySchema,
  XhsArchiveListResponseSchema,
  XhsArchiveRemovalSchema,
  XhsArchiveTaskSchema,
  XhsAuthSessionParamsSchema,
  XhsAuthSessionSchema,
  XhsRuntimeStatusSchema,
  apiSuccessSchema,
  fail,
  ok,
  type TaskIdParams,
  type XhsArchiveCreateInput,
  type XhsArchiveIdParams,
  type XhsArchiveListQuery,
  type XhsAuthSessionParams
} from "@toolbox/shared";
import type { FastifyInstance } from "fastify";
import { REQUEST_QUOTAS } from "../../../../security/request-quotas";
import type { XhsAuthManager } from "../../providers/xiaohongshu/auth";
import { registerXhsMediaRoutes } from "./media-routes";
import type { XhsArchiveStore } from "./store";
import { extractXhsUrl, type XhsArchiveTaskService } from "./task-service";
import { registerXhsTranslationRoutes } from "./translation-routes";
import type { ContentArchiveTranslationService } from "../../core/translation-service";
import { ArchiveTaskError } from "../../core/provider";
import { ContentArchiveStoreError } from "../../core/store";

export function registerLegacyXhsArchiveRoutes({
  app,
  store,
  service,
  auth,
  translation
}: {
  app: FastifyInstance;
  store: XhsArchiveStore;
  service: XhsArchiveTaskService;
  auth: XhsAuthManager;
  translation: ContentArchiveTranslationService;
}) {
  app.get(
    "/api/v1/tools/xhs-archive/runtime",
    { schema: { response: { 200: apiSuccessSchema(XhsRuntimeStatusSchema) } } },
    async () => ok(await service.runtimeStatus())
  );

  registerXhsTranslationRoutes({ app, store, translation });

  app.post<{ Body: XhsArchiveCreateInput }>(
    "/api/v1/tools/xhs-archive/items",
    {
      config: REQUEST_QUOTAS.remoteFetch,
      schema: {
        body: XhsArchiveCreateInputSchema,
        response: {
          202: apiSuccessSchema(XhsArchiveTaskSchema),
          400: ApiFailureSchema,
          429: ApiFailureSchema,
          503: ApiFailureSchema,
          507: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      const { url: source } = request.body;
      if (!extractXhsUrl(source)) {
        return reply.code(400).send(fail("XHS_URL_INVALID", "请输入有效的小红书链接或分享文案"));
      }
      try {
        return reply.code(202).send(ok(service.create(source)));
      } catch (error) {
        if (error instanceof ArchiveTaskError || error instanceof ContentArchiveStoreError)
          return reply.code(error.statusCode).send(fail(error.code.replace(/^ARCHIVE_/, "XHS_"), error.message));
        throw error;
      }
    }
  );

  app.get<{ Params: TaskIdParams }>(
    "/api/v1/tools/xhs-archive/tasks/:taskId",
    {
      schema: {
        params: TaskIdParamsSchema,
        response: { 200: apiSuccessSchema(XhsArchiveTaskSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const task = service.get(request.params.taskId);
      return task ? ok(task) : reply.code(404).send(fail("XHS_TASK_NOT_FOUND", "获取任务不存在"));
    }
  );

  app.get<{ Querystring: XhsArchiveListQuery }>(
    "/api/v1/tools/xhs-archive/items",
    {
      schema: {
        querystring: XhsArchiveListQuerySchema,
        response: { 200: apiSuccessSchema(XhsArchiveListResponseSchema) }
      }
    },
    async (request) => ok(await store.list(request.query))
  );

  app.get<{ Params: XhsArchiveIdParams }>(
    "/api/v1/tools/xhs-archive/items/:id",
    {
      schema: {
        params: XhsArchiveIdParamsSchema,
        response: { 200: apiSuccessSchema(XhsArchiveItemSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const item = await store.get(request.params.id);
      return item ? ok(item) : reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
    }
  );

  app.post<{ Params: XhsArchiveIdParams }>(
    "/api/v1/tools/xhs-archive/items/:id/refresh",
    {
      config: REQUEST_QUOTAS.remoteFetch,
      schema: {
        params: XhsArchiveIdParamsSchema,
        response: {
          202: apiSuccessSchema(XhsArchiveTaskSchema),
          404: ApiFailureSchema,
          400: ApiFailureSchema,
          429: ApiFailureSchema,
          503: ApiFailureSchema,
          507: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const task = await service.refresh(request.params.id);
        return task
          ? reply.code(202).send(ok(task))
          : reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
      } catch (error) {
        if (error instanceof ArchiveTaskError || error instanceof ContentArchiveStoreError)
          return reply.code(error.statusCode).send(fail(error.code.replace(/^ARCHIVE_/, "XHS_"), error.message));
        throw error;
      }
    }
  );

  app.delete<{ Params: XhsArchiveIdParams }>(
    "/api/v1/tools/xhs-archive/items/:id",
    {
      schema: {
        params: XhsArchiveIdParamsSchema,
        response: { 200: apiSuccessSchema(XhsArchiveRemovalSchema), 404: ApiFailureSchema, 409: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const item = await store.get(request.params.id);
      if (!item) return reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
      try {
        await service.content.remove(request.params.id);
      } catch (error) {
        if (error instanceof ArchiveTaskError || error instanceof ContentArchiveStoreError)
          return reply.code(error.statusCode).send(fail(error.code.replace(/^ARCHIVE_/, "XHS_"), error.message));
        throw error;
      }
      return ok({ removed: true, mediaCount: item.media.length, releasedBytes: item.totalBytes });
    }
  );

  registerXhsMediaRoutes({ app, store });

  app.post(
    "/api/v1/tools/xhs-archive/auth/start",
    { config: REQUEST_QUOTAS.login, schema: { response: { 200: apiSuccessSchema(XhsAuthSessionSchema) } } },
    async () => ok(auth.start())
  );
  app.get<{ Params: XhsAuthSessionParams }>(
    "/api/v1/tools/xhs-archive/auth/:sessionId",
    {
      schema: {
        params: XhsAuthSessionParamsSchema,
        response: { 200: apiSuccessSchema(XhsAuthSessionSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const session = auth.get(request.params.sessionId);
      return session ? ok(session) : reply.code(404).send(fail("XHS_AUTH_SESSION_NOT_FOUND", "登录会话不存在"));
    }
  );
}
