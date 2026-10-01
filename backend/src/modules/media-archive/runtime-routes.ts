/** 平台运行时状态只暴露可用性与固定错误码，不返回本地路径、浏览器参数或 Cookie。 */
import type { FastifyInstance } from "fastify";
import { DouyinRuntimeStatusSchema, apiSuccessSchema, ok } from "@toolbox/shared";
import type { DouyinRuntimeManager } from "./douyin-runtime";

export function registerMediaArchiveRuntimeRoutes(app: FastifyInstance, runtime: DouyinRuntimeManager) {
  app.get(
    "/api/v1/tools/media-archive/runtime/douyin",
    { schema: { response: { 200: apiSuccessSchema(DouyinRuntimeStatusSchema) } } },
    async () => ok(await runtime.status())
  );
}
