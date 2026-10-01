/** 翻译 HTTP 边界：双平台共用队列与事务，旧命名空间只允许小红书，批量补全尊重当前筛选。 */
import type { FastifyInstance } from "fastify";
import {
  ApiFailureSchema,
  TaskIdParamsSchema,
  XhsArchiveIdParamsSchema,
  XhsArchiveTranslationResultSchema,
  XhsTranslationBatchInputSchema,
  ContentTranslationBatchInputSchema,
  ContentTranslationEditInputSchema,
  ContentTranslationRequestSchema,
  ContentTranslationTaskSchema,
  isContentTranslationBatchInput,
  isContentTranslationRequest,
  isContentTranslationEditInput,
  isLegacyTranslationBatchInput,
  XhsTranslationNoopSchema,
  XhsTranslationRuntimeStatusSchema,
  apiSuccessSchema,
  fail,
  ok,
  type ContentArchiveItem,
  type ContentArchiveListQuery,
  type XhsArchiveItem,
  type ContentTranslationBatchInput,
  type XhsTranslationBatchInput,
  type ContentTranslationEditInput,
  type ContentTranslationRequest,
  type TaskIdParams,
  type XhsArchiveIdParams
} from "@toolbox/shared";
import { REQUEST_QUOTAS } from "../../security/request-quotas";
import { ArchiveTranslationError, type ContentArchiveTranslationService } from "./translation-service";
import { archiveTranslationSourceHash } from "./text";

type Item = ContentArchiveItem | XhsArchiveItem;
type RouteStore<T extends Item> = {
  get(id: string): Promise<T | undefined>;
  list(options: ContentArchiveListQuery): Promise<{ items: Array<Omit<T, "media">>; pageCount: number }>;
  updateTranslation(id: string, update: (item: T) => T): Promise<T | undefined>;
};
type Translation = Pick<ContentArchiveTranslationService, "enqueue" | "getTask" | "getRuntimeStatus">;

export function registerArchiveTranslationRoutes<T extends Item>(
  app: FastifyInstance,
  store: RouteStore<T>,
  translation: Translation,
  namespace: "xhs-archive" | "media-archive"
) {
  const prefix = `/api/v1/tools/${namespace}`;
  const legacy = namespace === "xhs-archive";
  const code = (value: string) => (legacy ? `XHS_${value}` : `ARCHIVE_${value.replace(/^ARCHIVE_/, "")}`);
  const task = (id: string) => {
    const value = translation.getTask(id, legacy ? "xiaohongshu" : undefined);
    return value
      ? { ...value, errorCode: value.errorCode?.replace(legacy ? /^ARCHIVE_/ : /^XHS_/, legacy ? "XHS_" : "ARCHIVE_") }
      : undefined;
  };
  const failures = { 400: ApiFailureSchema, 404: ApiFailureSchema, 409: ApiFailureSchema, 429: ApiFailureSchema };
  const createdResponses = {
    ...failures,
    200: apiSuccessSchema(XhsTranslationNoopSchema),
    202: apiSuccessSchema(ContentTranslationTaskSchema)
  };
  const batchSchema = legacy ? XhsTranslationBatchInputSchema : ContentTranslationBatchInputSchema;
  // AJV 会移除未知字段，必须在它之前拒绝含凭据/越界筛选的输入，不能静默接受。
  const validate =
    (check: (value: unknown) => boolean) =>
    async (request: { body: unknown }, reply: { code(status: number): { send(value: unknown): unknown } }) => {
      if (!check(request.body)) return reply.code(400).send(fail("REQUEST_INVALID", "翻译请求格式无效"));
    };
  app.get(
    `${prefix}/translation/runtime`,
    { schema: { response: { 200: apiSuccessSchema(XhsTranslationRuntimeStatusSchema) } } },
    async () => ok(await translation.getRuntimeStatus())
  );
  app.post<{ Params: XhsArchiveIdParams; Body: ContentTranslationRequest }>(
    `${prefix}/items/:id/translation`,
    {
      config: REQUEST_QUOTAS.translation,
      preValidation: validate(isContentTranslationRequest),
      schema: { params: XhsArchiveIdParamsSchema, body: ContentTranslationRequestSchema, response: createdResponses }
    },
    async (request, reply) => {
      if (!(await store.get(request.params.id)))
        return reply.code(404).send(fail(code("ARCHIVE_NOT_FOUND"), "存档不存在"));
      try {
        const value = await translation.enqueue([request.params.id], request.body.force === true);
        return value
          ? reply.code(202).send(ok(task(value.id)!))
          : ok({ status: "completed", message: "英文翻译已是最新" });
      } catch (error) {
        if (error instanceof ArchiveTranslationError)
          return reply
            .code(error.statusCode)
            .send(
              fail(error.code.replace(legacy ? /^ARCHIVE_/ : /^XHS_/, legacy ? "XHS_" : "ARCHIVE_"), error.message)
            );
        throw error;
      }
    }
  );
  app.get<{ Params: TaskIdParams }>(
    `${prefix}/translation/tasks/:taskId`,
    {
      schema: {
        params: TaskIdParamsSchema,
        response: { 200: apiSuccessSchema(ContentTranslationTaskSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const value = task(request.params.taskId);
      return value ? ok(value) : reply.code(404).send(fail(code("TRANSLATION_TASK_NOT_FOUND"), "翻译任务不存在"));
    }
  );
  app.post<{ Body: ContentTranslationBatchInput | XhsTranslationBatchInput }>(
    `${prefix}/translation/batches`,
    {
      config: REQUEST_QUOTAS.translationBatch,
      preValidation: validate(legacy ? isLegacyTranslationBatchInput : isContentTranslationBatchInput),
      schema: { body: batchSchema, response: createdResponses }
    },
    async (request, reply) => {
      let ids: string[] = [];
      if (request.body.mode === "selected") {
        ids = request.body.itemIds;
        for (const id of ids)
          if (!(await store.get(id))) return reply.code(404).send(fail(code("ARCHIVE_NOT_FOUND"), "所选存档不存在"));
      } else {
        const filter = "filter" in request.body ? request.body.filter : undefined;
        const first = await store.list({ ...filter, page: 1, pageSize: 50 });
        for (let page = 1; page <= first.pageCount && ids.length < 100; page++) {
          const result = page === 1 ? first : await store.list({ ...filter, page, pageSize: 50 });
          ids.push(
            ...result.items
              .filter(
                (item) =>
                  item.translation?.status !== "ready" ||
                  item.translation.sourceHash !== archiveTranslationSourceHash(item)
              )
              .map((item) => item.id)
          );
        }
        ids = ids.slice(0, 100);
      }
      try {
        const value = await translation.enqueue(ids, false);
        return value
          ? reply.code(202).send(ok(task(value.id)!))
          : ok({ status: "completed", message: "没有需要翻译的存档" });
      } catch (error) {
        if (error instanceof ArchiveTranslationError)
          return reply
            .code(error.statusCode)
            .send(
              fail(error.code.replace(legacy ? /^ARCHIVE_/ : /^XHS_/, legacy ? "XHS_" : "ARCHIVE_"), error.message)
            );
        throw error;
      }
    }
  );
  app.patch<{ Params: XhsArchiveIdParams; Body: ContentTranslationEditInput }>(
    `${prefix}/items/:id/translation`,
    {
      preValidation: validate(isContentTranslationEditInput),
      schema: {
        params: XhsArchiveIdParamsSchema,
        body: ContentTranslationEditInputSchema,
        response: { ...failures, 200: apiSuccessSchema(XhsArchiveTranslationResultSchema) }
      }
    },
    async (request, reply) => {
      try {
        const body = request.body;
        const updated = await store.updateTranslation(request.params.id, (current) => {
          const hash = archiveTranslationSourceHash(current),
            previous = current.translation;
          if (body.sourceHash !== hash)
            throw new ArchiveTranslationError(code("TRANSLATION_SOURCE_CHANGED"), "原文已变化，请重新翻译");
          if (!previous || previous.status !== "ready" || previous.sourceHash !== hash)
            throw new ArchiveTranslationError(
              code("TRANSLATION_NOT_READY"),
              "译文尚未就绪或已过期，请完成翻译后再编辑"
            );
          if (
            new Set(body.topics.map((topic) => topic.topicId)).size !== body.topics.length ||
            body.topics.some((topic) => !previous.topics.some((existing) => existing.topicId === topic.topicId))
          )
            throw new ArchiveTranslationError(code("TRANSLATION_TOPIC_INVALID"), "话题来源无效", 400);
          const editedAt = new Date().toISOString();
          return {
            ...current,
            translation: {
              ...previous,
              title: { ...previous.title, edited: body.title.edited.trim(), editedAt },
              description:
                previous.description && body.description
                  ? { ...previous.description, edited: body.description.edited.trim(), editedAt }
                  : previous.description,
              topics: previous.topics.map((topic) => {
                const input = body.topics.find((entry) => entry.topicId === topic.topicId);
                return input ? { ...topic, edited: input.edited.trim(), editedAt } : topic;
              })
            }
          };
        });
        return updated
          ? ok(updated.translation ?? null)
          : reply.code(404).send(fail(code("ARCHIVE_NOT_FOUND"), "存档不存在"));
      } catch (error) {
        if (error instanceof ArchiveTranslationError)
          return reply.code(error.statusCode).send(fail(error.code, error.message));
        throw error;
      }
    }
  );
  app.post<{ Params: XhsArchiveIdParams }>(
    `${prefix}/items/:id/translation/reset`,
    {
      schema: {
        params: XhsArchiveIdParamsSchema,
        response: { 200: apiSuccessSchema(XhsArchiveTranslationResultSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const updated = await store.updateTranslation(request.params.id, (current) =>
        current.translation
          ? {
              ...current,
              translation: {
                ...current.translation,
                title: { ...current.translation.title, edited: undefined, editedAt: undefined },
                description: current.translation.description
                  ? { ...current.translation.description, edited: undefined, editedAt: undefined }
                  : undefined,
                topics: current.translation.topics.map((topic) => ({
                  ...topic,
                  edited: undefined,
                  editedAt: undefined
                }))
              }
            }
          : current
      );
      return updated
        ? ok(updated.translation ?? null)
        : reply.code(404).send(fail(code("ARCHIVE_NOT_FOUND"), "存档不存在"));
    }
  );
}
