import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { ok, fail, apiSuccessSchema, VideoEditorProjectSchema, VideoEditorProjectDetailSchema } from "@toolbox/shared";
import { VideoEditorProjects } from "./projects";
import { VideoEditError } from "../content-archive/video-edit/renderer";
import { ContentArchiveStoreError } from "../content-archive/core/store";
const root = "/api/v1/tools/video-editor/projects";
const params = Type.Object({ id: Type.String({ pattern: "^[A-Za-z0-9_-]{1,80}$" }) });
export function registerVideoEditorProjects(app: FastifyInstance, projects: VideoEditorProjects) {
  const run = async <T>(reply: import("fastify").FastifyReply, action: () => Promise<T> | T) => {
    try {
      return ok(await action());
    } catch (error) {
      if (error instanceof VideoEditError || error instanceof ContentArchiveStoreError)
        return reply.code(error.statusCode).send(fail(error.code, error.message));
      throw error;
    }
  };
  app.get(root, { schema: { response: { 200: apiSuccessSchema(Type.Array(VideoEditorProjectSchema)) } } }, (_, reply) =>
    run(reply, () => projects.list())
  );
  const create = Type.Object(
    { itemId: Type.String({ maxLength: 80 }), mediaId: Type.String({ maxLength: 80 }) },
    { additionalProperties: false }
  );
  app.post<{ Body: { itemId: string; mediaId: string } }>(
    root,
    {
      schema: { body: create, response: { 200: apiSuccessSchema(VideoEditorProjectSchema) } },
      preValidation: async (request, reply) => {
        if (!Value.Check(create, request.body))
          return reply.code(400).send(fail("EDITOR_INPUT_INVALID", "请选择视频素材"));
      }
    },
    (req, reply) =>
      run(reply, () =>
        req.body.itemId.startsWith("editor_")
          ? projects.adopt(req.body.itemId, req.body.mediaId)
          : projects.fromArchive(req.body.itemId, req.body.mediaId)
      )
  );
  app.get<{ Params: { id: string } }>(
    `${root}/:id`,
    { schema: { params, response: { 200: apiSuccessSchema(VideoEditorProjectDetailSchema) } } },
    (req, reply) => run(reply, () => projects.detail(req.params.id))
  );
  app.put<{ Params: { id: string }; Body: { name: string } }>(
    `${root}/:id`,
    {
      schema: {
        params,
        body: Type.Object({ name: Type.String({ minLength: 1, maxLength: 500 }) }, { additionalProperties: false })
      }
    },
    (req, reply) => run(reply, () => projects.rename(req.params.id, req.body.name.trim() || "未命名工程"))
  );
  app.post<{ Params: { id: string } }>(`${root}/:id/copy`, { schema: { params } }, (req, reply) =>
    run(reply, () => projects.copy(req.params.id))
  );
  app.delete<{ Params: { id: string } }>(`${root}/:id`, { schema: { params } }, (req, reply) =>
    run(reply, () => projects.remove(req.params.id))
  );
  app.post<{ Params: { id: string }; Body: { revision: number } }>(
    `${root}/:id/sync`,
    {
      schema: { params, body: Type.Object({ revision: Type.Integer({ minimum: 1 }) }, { additionalProperties: false }) }
    },
    (req, reply) => run(reply, () => projects.sync(req.params.id, req.body.revision))
  );
}
