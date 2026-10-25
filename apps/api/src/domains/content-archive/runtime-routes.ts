/** 平台运行时状态只暴露可用性与固定错误码，不返回本地路径、浏览器参数或 Cookie。 */
import type { FastifyInstance } from "fastify";
import { DouyinRuntimeStatusSchema, apiSuccessSchema, ok } from "@toolbox/shared";
import type { DouyinRuntimeManager } from "./providers/douyin/douyin-runtime";
import { TikTokRuntimeStatusSchema } from "@toolbox/shared/archive";
import type { TikTokRuntime } from "./providers/tiktok/runtime";

export function registerMediaArchiveRuntimeRoutes(
  app: FastifyInstance,
  runtime: DouyinRuntimeManager,
  tiktok?: TikTokRuntime
) {
  app.get(
    "/api/v1/tools/media-archive/runtime/douyin",
    { schema: { response: { 200: apiSuccessSchema(DouyinRuntimeStatusSchema) } } },
    async () => ok(await runtime.status())
  );
  if (tiktok)
    app.get(
      "/api/v1/tools/media-archive/runtime/tiktok",
      { schema: { response: { 200: apiSuccessSchema(TikTokRuntimeStatusSchema) } } },
      async () => ok(await tiktok.status())
    );
}
