/** 中文模块说明：集中限制请求和异常日志字段，避免查询令牌、用户文本及本机路径进入日志。 */

/** Fastify 默认请求序列化器会记录 req.url，因此完整遮蔽该字段后只记录安全路由模板。 */
export const LOG_REDACTION_PATHS = [
  "req.url",
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers.x-csrf-token",
  "req.headers.x-lan-transfer-pin",
  "req.headers.x-toolbox-worker-token",
  "pin",
  "text",
  "path"
] as const;

/** 去掉查询串和片段，并限制长度；调用方应优先传入 Fastify 的路由模板。 */
export function safeRequestLogPath(requestUrl: string): string {
  const boundary = requestUrl.search(/[?#]/u);
  const path = boundary === -1 ? requestUrl : requestUrl.slice(0, boundary);
  return path.slice(0, 2_048) || "/";
}

/** 只保留可用于排查问题的稳定类型、错误码和 HTTP 状态，不写入 message 或 stack。 */
export function safeErrorLogFields(error: unknown): { type: string; code?: string; statusCode?: number } {
  if (typeof error !== "object" || error === null) return { type: "Error" };

  const value = error as { name?: unknown; code?: unknown; statusCode?: unknown };
  const type =
    typeof value.name === "string" && /^[A-Za-z][A-Za-z0-9_.]{0,63}$/u.test(value.name) ? value.name : "Error";
  const code = typeof value.code === "string" && /^[A-Z][A-Z0-9_]{0,79}$/u.test(value.code) ? value.code : undefined;
  const statusCode =
    Number.isInteger(value.statusCode) && Number(value.statusCode) >= 400 && Number(value.statusCode) <= 599
      ? Number(value.statusCode)
      : undefined;

  return {
    type,
    ...(code ? { code } : {}),
    ...(statusCode ? { statusCode } : {})
  };
}
