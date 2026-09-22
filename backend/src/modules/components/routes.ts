/** 中文模块说明：能力包管理 API，只接收目录中的能力 id，禁止 renderer 提供下载地址或本机命令。 */
import type { FastifyInstance } from "fastify";
import {
  ApiFailureSchema,
  ComponentIdParamsSchema,
  ComponentPackageListSchema,
  ComponentPackageStatusSchema,
  apiSuccessSchema,
  fail,
  ok,
  type ComponentIdParams
} from "@toolbox/shared";
import { ComponentManager, ComponentManagerError } from "./component-manager";

export function registerComponentRoutes(app: FastifyInstance, manager: ComponentManager) {
  app.get(
    "/api/v1/components",
    { schema: { response: { 200: apiSuccessSchema(ComponentPackageListSchema) } } },
    async () => ok(await manager.list())
  );

  app.post<{ Params: ComponentIdParams }>(
    "/api/v1/components/:componentId/install",
    {
      schema: {
        params: ComponentIdParamsSchema,
        response: {
          200: apiSuccessSchema(ComponentPackageStatusSchema),
          404: ApiFailureSchema,
          422: ApiFailureSchema,
          500: ApiFailureSchema
        }
      }
    },
    async (request, reply) => {
      try {
        return ok(await manager.install(request.params.componentId));
      } catch (error) {
        if (error instanceof ComponentManagerError) {
          const statusCode =
            error.code === "COMPONENT_NOT_FOUND" ? 404 : error.code === "COMPONENT_MANIFEST_INVALID" ? 422 : 500;
          return reply.code(statusCode).send(fail(error.code, error.message));
        }
        return reply.code(500).send(fail("COMPONENT_INSTALL_FAILED", "能力包安装失败"));
      }
    }
  );
}
