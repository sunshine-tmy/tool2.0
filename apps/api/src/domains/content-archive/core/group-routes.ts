import type { FastifyInstance, FastifyReply } from "fastify";
import { Value } from "@sinclair/typebox/value";
import {
  ApiFailureSchema,
  ArchiveGroupSchema,
  ArchiveGroupInputSchema,
  ArchiveGroupListSchema,
  ArchiveGroupAssignmentSchema,
  ArchiveGroupAssignmentResultSchema,
  XhsArchiveIdParamsSchema,
  XhsArchiveRemovalSchema,
  apiSuccessSchema,
  fail,
  ok,
  type ArchiveGroupAssignment
} from "@toolbox/shared";
import type { ArchiveGroupStore } from "./groups";
import { ArchiveTaskError } from "./provider";
import { REQUEST_QUOTAS } from "../../../security/request-quotas";

export function registerArchiveGroupRoutes(app: FastifyInstance, groups: ArchiveGroupStore) {
  const base = "/api/v1/tools/media-archive/groups";
  const errors = { 400: ApiFailureSchema, 404: ApiFailureSchema, 409: ApiFailureSchema };
  const handle = (run: () => unknown, reply: FastifyReply) => {
    try {
      return ok(run());
    } catch (error) {
      if (error instanceof ArchiveTaskError) return reply.code(error.statusCode).send(fail(error.code, error.message));
      throw error;
    }
  };
  app.get(base, { schema: { response: { 200: apiSuccessSchema(ArchiveGroupListSchema) } } }, async () =>
    ok(groups.list())
  );
  for (const method of ["POST", "PATCH"] as const) {
    app.route<{ Body: { name: string }; Params: { id: string } }>({
      method,
      url: method === "POST" ? base : `${base}/:id`,
      config: REQUEST_QUOTAS.lanUpload,
      preValidation: async (request, reply) => {
        if (!Value.Check(ArchiveGroupInputSchema, request.body))
          return reply.code(400).send(fail("ARCHIVE_GROUP_INPUT_INVALID", "请填写有效的分组名称"));
      },
      schema: {
        body: ArchiveGroupInputSchema,
        ...(method === "PATCH" ? { params: XhsArchiveIdParamsSchema } : {}),
        response: { 200: apiSuccessSchema(ArchiveGroupSchema), ...errors }
      },
      handler: async (request, reply) =>
        handle(() => groups.save(request.body.name, method === "PATCH" ? request.params.id : undefined), reply)
    });
  }
  app.post<{ Body: ArchiveGroupAssignment }>(
    `${base}/assign`,
    {
      config: REQUEST_QUOTAS.lanUpload,
      preValidation: async (request, reply) => {
        if (!Value.Check(ArchiveGroupAssignmentSchema, request.body))
          return reply.code(400).send(fail("ARCHIVE_GROUP_INPUT_INVALID", "请选择有效分组和最多 100 个作品"));
      },
      schema: {
        body: ArchiveGroupAssignmentSchema,
        response: { 200: apiSuccessSchema(ArchiveGroupAssignmentResultSchema), ...errors }
      }
    },
    async (request, reply) => handle(() => groups.assign(request.body), reply)
  );
  app.delete<{ Params: { id: string } }>(
    `${base}/:id`,
    {
      schema: {
        params: XhsArchiveIdParamsSchema,
        response: { 200: apiSuccessSchema(XhsArchiveRemovalSchema), ...errors }
      }
    },
    async (request, reply) =>
      handle(() => {
        groups.remove(request.params.id);
        return { removed: true, mediaCount: 0, releasedBytes: 0 };
      }, reply)
  );
}
