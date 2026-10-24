/** 桌面业务共享地址：使用网关绑定后的端口；不推断防火墙或其他设备的实际可达性。 */
import { Type } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";
import { LanApplicationAccessSchema, EmptyResultSchema, apiSuccessSchema, listTools, ok } from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { DiagnosticsService } from "../../modules/diagnostics/service";
import { getLanWebUrls } from "../../domains/lan-transfer/access";

export function registerLanApplicationAccess(app: FastifyInstance, config: AppConfig, diagnostics: DiagnosticsService) {
  app.get(
    "/api/v1/lan-access",
    { schema: { response: { 200: apiSuccessSchema(LanApplicationAccessSchema) } } },
    async (_request, reply) => {
      reply.header("cache-control", "no-store");
      const port = config.lanTransferWebPort;
      const urls = getLanWebUrls(port).map((url) => new URL("/", url).toString());
      const status = port <= 0 ? "unavailable" : urls.length ? "ready" : "no-network";
      return ok({
        status,
        urls,
        port,
        toolCount: listTools().length,
        message:
          status === "ready"
            ? "同一可信局域网内可使用全部业务模块；依赖的能力需先在主机安装并就绪。"
            : status === "no-network"
              ? "未检测到可用的局域网 IPv4 地址，请连接局域网后刷新。"
              : "局域网服务未能启动，请在主机检查诊断或重启桌面应用。"
      });
    }
  );
  // 远程播放只上报忙碌状态，不开放本机诊断、日志、环境恢复或进程控制。
  app.post(
    "/api/v1/lan-access/playback",
    {
      schema: {
        body: Type.Object(
          { clientId: Type.String({ pattern: "^[A-Za-z0-9-]{1,80}$" }), active: Type.Boolean() },
          { additionalProperties: false }
        ),
        response: { 200: apiSuccessSchema(EmptyResultSchema) }
      }
    },
    async (request) => {
      const body = request.body as { clientId: string; active: boolean };
      diagnostics.setPlayback(`lan-${body.clientId}`, body.active);
      return ok(null);
    }
  );
}
