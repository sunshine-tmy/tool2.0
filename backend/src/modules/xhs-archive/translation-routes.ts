/**
 * 中文模块说明：小红书归档领域，负责获取、媒体、翻译、运行时和恢复
 */
import type { FastifyInstance } from "fastify";
import {
  ApiFailureSchema,
  TaskIdParamsSchema,
  XhsArchiveIdParamsSchema,
  XhsArchiveTranslationResultSchema,
  XhsTranslationBatchInputSchema,
  XhsTranslationEditInputSchema,
  XhsTranslationNoopSchema,
  XhsTranslationRequestSchema,
  XhsTranslationRuntimeStatusSchema,
  XhsTranslationTaskSchema,
  apiSuccessSchema,
  fail,
  ok,
  type TaskIdParams,
  type XhsArchiveIdParams,
  type XhsArchiveItem,
  type XhsTranslationBatchInput,
  type XhsTranslationEditInput,
  type XhsTranslationRequest
} from "@toolbox/shared";
import { REQUEST_QUOTAS } from "../../security/request-quotas";
import type { XhsArchiveStore } from "./store";
import { type XhsTranslationService, translationSourceHash } from "./translation-service";

type RegisterXhsTranslationRoutesOptions = {
  app: FastifyInstance;
  store: XhsArchiveStore;
  translation: XhsTranslationService;
};

export function registerXhsTranslationRoutes({ app, store, translation }: RegisterXhsTranslationRoutesOptions) {
  app.get(
    "/api/v1/tools/xhs-archive/translation/runtime",
    { schema: { response: { 200: apiSuccessSchema(XhsTranslationRuntimeStatusSchema) } } },
    async () => ok(await translation.getRuntimeStatus())
  );

  app.post<{ Params: XhsArchiveIdParams; Body: XhsTranslationRequest }>(
    "/api/v1/tools/xhs-archive/items/:id/translation",
    {
      config: REQUEST_QUOTAS.translation,
      schema: {
        params: XhsArchiveIdParamsSchema,
        body: XhsTranslationRequestSchema,
        response: {
          200: apiSuccessSchema(XhsTranslationNoopSchema),
          202: apiSuccessSchema(XhsTranslationTaskSchema),
          404: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;
      if (!(await store.get(id))) return reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
      const task = await translation.translateOne(id, request.body.force === true);
      return task ? reply.code(202).send(ok(task)) : ok({ status: "completed", message: "英文翻译已是最新" });
    }
  );

  app.get<{ Params: TaskIdParams }>(
    "/api/v1/tools/xhs-archive/translation/tasks/:taskId",
    {
      schema: {
        params: TaskIdParamsSchema,
        response: { 200: apiSuccessSchema(XhsTranslationTaskSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const task = translation.getTask(request.params.taskId);
      return task ? ok(task) : reply.code(404).send(fail("XHS_TRANSLATION_TASK_NOT_FOUND", "翻译任务不存在"));
    }
  );

  app.post<{ Body: XhsTranslationBatchInput }>(
    "/api/v1/tools/xhs-archive/translation/batches",
    {
      config: REQUEST_QUOTAS.translationBatch,
      schema: {
        body: XhsTranslationBatchInputSchema,
        response: {
          200: apiSuccessSchema(XhsTranslationNoopSchema),
          202: apiSuccessSchema(XhsTranslationTaskSchema),
          404: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      const { mode } = request.body;
      let ids: string[] = [];
      if (mode === "selected") {
        ids = request.body.itemIds;
        for (const id of ids) {
          if (!(await store.get(id))) return reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", `存档不存在：${id}`));
        }
      } else if (mode === "missing-or-stale") {
        const all = await store.list({ page: 1, pageSize: 50 });
        for (let page = 1; page <= all.pageCount; page += 1) {
          const values = page === 1 ? all : await store.list({ page, pageSize: 50 });
          ids.push(
            ...values.items
              .filter(
                (item) =>
                  item.translation?.status !== "ready" ||
                  item.translation.sourceHash !== translationSourceHashFromList(item)
              )
              .map((item) => item.id)
          );
        }
        ids = ids.slice(0, 100);
      }
      const task = await translation.enqueue(ids, false);
      return task ? reply.code(202).send(ok(task)) : ok({ status: "completed", message: "没有需要翻译的存档" });
    }
  );

  app.patch<{ Params: XhsArchiveIdParams; Body: XhsTranslationEditInput }>(
    "/api/v1/tools/xhs-archive/items/:id/translation",
    {
      schema: {
        params: XhsArchiveIdParamsSchema,
        body: XhsTranslationEditInputSchema,
        response: {
          200: apiSuccessSchema(XhsArchiveTranslationResultSchema),
          404: ApiFailureSchema,
          409: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      const { id } = request.params;
      const item = await store.get(id);
      if (!item) return reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
      const body = request.body;
      const currentHash = translationSourceHash(item);
      if (body.sourceHash !== currentHash)
        return reply.code(409).send(fail("XHS_TRANSLATION_SOURCE_CHANGED", "中文内容已变化，请重新翻译"));
      const updated = await store.updateTranslation(id, (current) => {
        const previous = current.translation;
        if (!previous) return current;
        return {
          ...current,
          translation: {
            ...previous,
            status: "ready",
            title: {
              ...previous.title,
              edited: body.title.edited.trim(),
              editedAt: new Date().toISOString()
            },
            description:
              previous.description && body.description
                ? {
                    ...previous.description,
                    edited: body.description.edited.trim(),
                    editedAt: new Date().toISOString()
                  }
                : previous.description,
            topics: previous.topics.map((topic) => {
              const input = body.topics.find((entry) => entry.topicId === topic.topicId);
              return input ? { ...topic, edited: input.edited.trim(), editedAt: new Date().toISOString() } : topic;
            })
          }
        };
      });
      return updated
        ? ok(updated.translation ?? null)
        : reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
    }
  );

  app.post<{ Params: XhsArchiveIdParams }>(
    "/api/v1/tools/xhs-archive/items/:id/translation/reset",
    {
      schema: {
        params: XhsArchiveIdParamsSchema,
        response: { 200: apiSuccessSchema(XhsArchiveTranslationResultSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const { id } = request.params;
      const updated = await store.updateTranslation(id, (current) =>
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
        : reply.code(404).send(fail("XHS_ARCHIVE_NOT_FOUND", "存档不存在"));
    }
  );
}

function translationSourceHashFromList(item: Pick<XhsArchiveItem, "title" | "description" | "topics">) {
  return translationSourceHash(item);
}
