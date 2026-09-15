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
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { FileMetadataRepository } from "../../database/file-metadata";
import type { TaskStore } from "../../tasks/task-store";
import { REQUEST_QUOTAS } from "../../security/request-quotas";
import type { RemoteFetch } from "../../security/remote-fetch";
import { XhsAuthManager } from "./auth";
import { registerXhsMediaRoutes } from "./media-routes";
import { XhsRuntimeManager } from "./runtime";
import { XhsArchiveStore } from "./store";
import { XhsArchiveTaskService, extractXhsUrl } from "./task-service";
import { registerXhsTranslationRoutes } from "./translation-routes";
import { XhsTranslationRuntime } from "./translation-runtime";
import { XhsTranslationService } from "./translation-service";

export async function registerXhsArchiveRoutes(options: {
  app: FastifyInstance;
  config: AppConfig;
  remoteFetch: RemoteFetch;
  database: ToolboxDatabase;
  taskStore: TaskStore;
  fileMetadata?: FileMetadataRepository;
}) {
  const { app, config, remoteFetch, database, taskStore, fileMetadata } = options;
  const store = new XhsArchiveStore(config, database, fileMetadata);
  const runtime = new XhsRuntimeManager(config);
  const auth = new XhsAuthManager(config);
  const translationRuntime = new XhsTranslationRuntime(config);
  const translation = new XhsTranslationService(config, store, translationRuntime, taskStore);
  const service = new XhsArchiveTaskService(config, remoteFetch, store, runtime, auth, translation, taskStore);
  await service.initialize();

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
        response: { 202: apiSuccessSchema(XhsArchiveTaskSchema), 400: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const { url: source } = request.body;
      if (!extractXhsUrl(source)) {
        return reply.code(400).send(fail("XHS_URL_INVALID", "请输入有效的小红书链接或分享文案"));
      }
      return reply.code(202).send(ok(service.create(source)));
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
        response: { 202: apiSuccessSchema(XhsArchiveTaskSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const task = await service.refresh(request.params.id);
      return task ? reply.code(202).send(ok(task)) : reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
    }
  );

  app.delete<{ Params: XhsArchiveIdParams }>(
    "/api/v1/tools/xhs-archive/items/:id",
    {
      schema: {
        params: XhsArchiveIdParamsSchema,
        response: { 200: apiSuccessSchema(XhsArchiveRemovalSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const item = await store.get(request.params.id);
      if (!item) return reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
      await store.remove(request.params.id);
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

  app.addHook("onClose", async () => service.close());
}
