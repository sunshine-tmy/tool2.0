import type { FastifyInstance, FastifyReply } from "fastify";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import {
  ApiFailureSchema,
  XhsArchiveIdParamsSchema,
  XhsArchiveRemovalSchema,
  TikTokProfileInputSchema,
  TikTokProfileStartSchema,
  TikTokProfileJobSchema,
  TikTokProfileListSchema,
  TikTokProfilePageSchema,
  ARCHIVE_IMPORT_ROW_LABELS,
  apiSuccessSchema,
  ok,
  fail,
  type TikTokProfileStart
} from "@toolbox/shared";
import type { TikTokProfileService } from "./service";
import { ArchiveTaskError } from "../core/provider";
import { archiveImportCsv } from "../batch/spreadsheet";
import { REQUEST_QUOTAS } from "../../../security/request-quotas";

export function registerTikTokProfileRoutes(app: FastifyInstance, service: TikTokProfileService) {
  const base = "/api/v1/tools/media-archive/tiktok-profiles";
  const errors = { 400: ApiFailureSchema, 404: ApiFailureSchema, 409: ApiFailureSchema, 429: ApiFailureSchema };
  const handle = async (reply: FastifyReply, run: () => unknown | Promise<unknown>) => {
    try {
      const value = await run();
      return value === undefined ? reply.code(404).send(fail("TIKTOK_PROFILE_NOT_FOUND", "主页任务不存在")) : ok(value);
    } catch (error) {
      if (error instanceof ArchiveTaskError) return reply.code(error.statusCode).send(fail(error.code, error.message));
      throw error;
    }
  };
  app.get(base, { schema: { response: { 200: apiSuccessSchema(TikTokProfileListSchema) } } }, async () =>
    ok(service.list())
  );
  app.post<{ Body: { url: string } }>(
    base,
    {
      config: REQUEST_QUOTAS.remoteFetch,
      preValidation: async (request, reply) => {
        if (!Value.Check(TikTokProfileInputSchema, request.body))
          return reply
            .code(400)
            .send(fail("TIKTOK_PROFILE_INPUT_INVALID", "仅接受 TikTok 主页链接，不接受 Cookie 或登录凭据"));
      },
      schema: { body: TikTokProfileInputSchema, response: { 200: apiSuccessSchema(TikTokProfileJobSchema), ...errors } }
    },
    (request, reply) => handle(reply, () => service.create(request.body.url))
  );
  app.get<{ Params: { id: string } }>(
    `${base}/:id`,
    {
      schema: {
        params: XhsArchiveIdParamsSchema,
        response: { 200: apiSuccessSchema(TikTokProfileJobSchema), ...errors }
      }
    },
    (request, reply) => handle(reply, () => service.get(request.params.id))
  );
  app.get<{ Params: { id: string }; Querystring: { page?: number } }>(
    `${base}/:id/works`,
    {
      schema: {
        params: XhsArchiveIdParamsSchema,
        querystring: Type.Object(
          { page: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })) },
          { additionalProperties: false }
        ),
        response: { 200: apiSuccessSchema(TikTokProfilePageSchema), ...errors }
      }
    },
    (request, reply) => handle(reply, () => service.page(request.params.id, request.query.page))
  );
  app.post<{ Params: { id: string }; Body: TikTokProfileStart }>(
    `${base}/:id/archive`,
    {
      bodyLimit: 512 * 1024,
      config: REQUEST_QUOTAS.translationBatch,
      preValidation: async (request, reply) => {
        if (!Value.Check(TikTokProfileStartSchema, request.body))
          return reply.code(400).send(fail("TIKTOK_PROFILE_INPUT_INVALID", "请选择有效的作品、已有归档处理方式及分组"));
      },
      schema: {
        params: XhsArchiveIdParamsSchema,
        body: TikTokProfileStartSchema,
        response: { 200: apiSuccessSchema(TikTokProfileJobSchema), ...errors }
      }
    },
    (request, reply) => handle(reply, () => service.start(request.params.id, request.body))
  );
  for (const action of ["discover", "cancel", "retry"] as const)
    app.post<{ Params: { id: string } }>(
      `${base}/:id/${action}`,
      {
        config: action === "discover" ? REQUEST_QUOTAS.remoteFetch : REQUEST_QUOTAS.lanUpload,
        schema: {
          params: XhsArchiveIdParamsSchema,
          response: { 200: apiSuccessSchema(TikTokProfileJobSchema), ...errors }
        }
      },
      (request, reply) => handle(reply, () => service[action](request.params.id))
    );
  app.delete<{ Params: { id: string } }>(
    `${base}/:id`,
    {
      schema: {
        params: XhsArchiveIdParamsSchema,
        response: { 200: apiSuccessSchema(XhsArchiveRemovalSchema), ...errors }
      }
    },
    (request, reply) =>
      handle(reply, async () => {
        await service.remove(request.params.id);
        return { removed: true, mediaCount: 0, releasedBytes: 0 };
      })
  );
  app.get<{ Params: { id: string } }>(
    `${base}/:id/results.csv`,
    { schema: { params: XhsArchiveIdParamsSchema } },
    async (request, reply) => {
      try {
        const rows = service.results(request.params.id);
        return reply
          .header("content-type", "text/csv; charset=utf-8")
          .header("cache-control", "no-store")
          .header("content-disposition", `attachment; filename="tiktok-profile-${request.params.id}.csv"`)
          .send(
            archiveImportCsv([
              ["作品ID", "作品链接", "标题", "发布时间", "状态", "进度", "原因", "错误码", "归档ID"],
              ...rows.map((row) => [
                row.id,
                row.url,
                row.title,
                row.createdAt,
                row.outcome ? ARCHIVE_IMPORT_ROW_LABELS[row.outcome.status] : "未选择归档",
                row.outcome?.progress ?? 0,
                row.outcome?.message,
                row.outcome?.errorCode,
                row.outcome?.archiveId
              ])
            ])
          );
      } catch (error) {
        if (error instanceof ArchiveTaskError)
          return reply.code(error.statusCode).send(fail(error.code, error.message));
        throw error;
      }
    }
  );
}
