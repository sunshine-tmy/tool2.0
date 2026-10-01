/** 中性归档 JSON 契约复用同一存储与任务服务；LAN 管理权限、CSRF、限流由全局安全层统一执行。 */
import type { FastifyInstance } from "fastify";
import {
  ApiFailureSchema,
  ContentArchiveCreateInputSchema,
  ContentArchiveItemSchema,
  ContentArchiveListQuerySchema,
  ContentArchiveListResponseSchema,
  ContentArchiveTaskSchema,
  TaskIdParamsSchema,
  XhsArchiveIdParamsSchema,
  XhsArchiveRemovalSchema,
  apiSuccessSchema,
  isContentArchiveCreateInput,
  fail,
  ok,
  type ContentArchiveCreateInput,
  type ContentArchiveListQuery,
  type TaskIdParams,
  type XhsArchiveIdParams
} from "@toolbox/shared";
import { REQUEST_QUOTAS } from "../../security/request-quotas";
import type { ContentArchiveStore } from "./store";
import type { ContentArchiveTaskService } from "./task-service";
import { ArchiveTaskError } from "./provider";
import { registerArchivePreviewRoutes } from "./media-preview-routes";
import { registerArchiveArtifactRoutes } from "./artifact-routes";

export function registerContentArchiveRoutes(
  app: FastifyInstance,
  store: ContentArchiveStore,
  service: ContentArchiveTaskService
) {
  registerArchivePreviewRoutes(app, store, "media-archive");
  registerArchiveArtifactRoutes(app, store, "media-archive");
  const failureResponses = {
    400: ApiFailureSchema,
    404: ApiFailureSchema,
    409: ApiFailureSchema,
    429: ApiFailureSchema,
    503: ApiFailureSchema
  };
  app.post<{ Body: ContentArchiveCreateInput }>(
    "/api/v1/tools/media-archive/items",
    {
      config: REQUEST_QUOTAS.remoteFetch,
      preValidation: async (request, reply) => {
        if (!isContentArchiveCreateInput(request.body))
          return reply.code(400).send(fail("ARCHIVE_INPUT_INVALID", "仅接受作品链接和平台选择，请检查输入"));
      },
      schema: {
        body: ContentArchiveCreateInputSchema,
        response: { 202: apiSuccessSchema(ContentArchiveTaskSchema), ...failureResponses }
      }
    },
    async (request, reply) => {
      try {
        return reply.code(202).send(ok(service.create(request.body.url, request.body.platform)));
      } catch (error) {
        if (error instanceof ArchiveTaskError)
          return reply.code(error.statusCode).send(fail(error.code, error.message));
        throw error;
      }
    }
  );
  app.get<{ Querystring: ContentArchiveListQuery }>(
    "/api/v1/tools/media-archive/items",
    {
      schema: {
        querystring: ContentArchiveListQuerySchema,
        response: { 200: apiSuccessSchema(ContentArchiveListResponseSchema) }
      }
    },
    async (request) => ok(await store.list(request.query))
  );
  app.get<{ Params: XhsArchiveIdParams }>(
    "/api/v1/tools/media-archive/items/:id",
    {
      schema: {
        params: XhsArchiveIdParamsSchema,
        response: { 200: apiSuccessSchema(ContentArchiveItemSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const item = await store.get(request.params.id);
      return item ? ok(item) : reply.code(404).send(fail("ARCHIVE_NOT_FOUND", "存档不存在"));
    }
  );
  app.post<{ Params: XhsArchiveIdParams }>(
    "/api/v1/tools/media-archive/items/:id/refresh",
    {
      config: REQUEST_QUOTAS.remoteFetch,
      schema: {
        params: XhsArchiveIdParamsSchema,
        response: { 202: apiSuccessSchema(ContentArchiveTaskSchema), ...failureResponses }
      }
    },
    async (request, reply) => {
      try {
        const task = await service.refresh(request.params.id);
        return task ? reply.code(202).send(ok(task)) : reply.code(404).send(fail("ARCHIVE_NOT_FOUND", "存档不存在"));
      } catch (error) {
        if (error instanceof ArchiveTaskError)
          return reply.code(error.statusCode).send(fail(error.code, error.message));
        throw error;
      }
    }
  );
  app.delete<{ Params: XhsArchiveIdParams }>(
    "/api/v1/tools/media-archive/items/:id",
    {
      schema: {
        params: XhsArchiveIdParamsSchema,
        response: { 200: apiSuccessSchema(XhsArchiveRemovalSchema), 404: ApiFailureSchema, 409: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const item = await store.get(request.params.id);
      if (!item) return reply.code(404).send(fail("ARCHIVE_NOT_FOUND", "存档不存在"));
      try {
        await service.remove(item.id);
      } catch (error) {
        if (error instanceof ArchiveTaskError)
          return reply.code(error.statusCode).send(fail(error.code, error.message));
        throw error;
      }
      return ok({ removed: true, mediaCount: item.media.length, releasedBytes: item.totalBytes });
    }
  );
  app.get<{ Params: TaskIdParams }>(
    "/api/v1/tools/media-archive/tasks/:taskId",
    {
      schema: {
        params: TaskIdParamsSchema,
        response: { 200: apiSuccessSchema(ContentArchiveTaskSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const task = service.get(request.params.taskId);
      return task ? ok(task) : reply.code(404).send(fail("ARCHIVE_TASK_NOT_FOUND", "获取任务不存在"));
    }
  );
  app.delete<{ Params: TaskIdParams }>(
    "/api/v1/tools/media-archive/tasks/:taskId",
    {
      schema: {
        params: TaskIdParamsSchema,
        response: { 200: apiSuccessSchema(ContentArchiveTaskSchema), ...failureResponses }
      }
    },
    async (request, reply) => {
      try {
        const task = await service.cancel(request.params.taskId);
        return task ? ok(task) : reply.code(404).send(fail("ARCHIVE_TASK_NOT_FOUND", "获取任务不存在"));
      } catch (error) {
        if (error instanceof ArchiveTaskError)
          return reply.code(error.statusCode).send(fail(error.code, error.message));
        throw error;
      }
    }
  );
}
