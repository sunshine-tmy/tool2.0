/** Application assembly step; called directly on the original Fastify instance. */
import { type FastifyInstance } from "fastify";
import { fail } from "@toolbox/shared";
import { safeErrorLogFields, safeRequestLogPath } from "../security/log-sanitization";

export function registerResponsePolicy(app: FastifyInstance) {
  // 统一把 requestId 注入 JSON 响应，确保前端能把提示、日志和审计事件关联到同一次请求。
  app.addHook("preSerialization", async (request, _reply, payload) => {
    if (typeof payload !== "object" || payload === null) return payload;
    const value = payload as Record<string, unknown>;
    return typeof value.success === "boolean" ? { ...value, requestId: request.id } : payload;
  });

  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("x-request-id", request.id);
    return payload;
  });

  app.setNotFoundHandler((request, reply) => {
    request.log.info(
      { requestId: request.id, method: request.method, route: safeRequestLogPath(request.url) },
      "route not found"
    );
    return reply.code(404).send(fail("ROUTE_NOT_FOUND", "请求的接口不存在"));
  });

  app.setErrorHandler((error, request, reply) => {
    // 错误日志保留结构化字段，具体响应只暴露稳定错误码，避免泄漏堆栈、绝对路径或凭据。
    request.log.error(
      {
        error: safeErrorLogFields(error),
        requestId: request.id,
        route: request.routeOptions.url ?? safeRequestLogPath(request.url)
      },
      "request failed"
    );
    const reported = error as unknown as {
      statusCode?: number;
      code?: string;
      message?: string;
      details?: unknown;
    };
    if (reported.statusCode === 429 || reported.code === "RATE_LIMIT_EXCEEDED") {
      return reply
        .code(429)
        .send(fail("RATE_LIMIT_EXCEEDED", reported.message || "请求过于频繁，请稍后重试", reported.details));
    }
    const normalized = error instanceof Error ? error : new Error("Unknown request error");
    const reportedStatus = (normalized as Error & { statusCode?: number }).statusCode;
    const statusCode = reportedStatus && reportedStatus >= 400 ? reportedStatus : 500;
    if (
      reported.code &&
      [
        "APP_SHUTTING_DOWN",
        "DIAGNOSTICS_BUSY",
        "MAINTENANCE_BUSY",
        "CONFIRMATION_REQUIRED",
        "INVALID_TARGET",
        "DIAGNOSTIC_NOT_FOUND",
        "DESKTOP_REQUIRED"
      ].includes(reported.code)
    )
      return reply.code(statusCode).send(fail(reported.code, normalized.message));
    return reply
      .code(statusCode)
      .send(
        fail(
          statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_INVALID",
          statusCode >= 500 ? "Internal server error" : normalized.message
        )
      );
  });
}
