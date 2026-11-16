/** Application assembly step; called directly on the original Fastify instance. */
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { type FastifyInstance } from "fastify";
import { type AppConfig } from "../config";
import { fail } from "@toolbox/shared/common";
import { registerConcurrencyQuotas } from "../security/request-quotas";
import type { ToolboxDatabase } from "../database/toolbox-database";
export async function registerBasePlugins(app: FastifyInstance, config: AppConfig, _database: ToolboxDatabase) {
  // 基础插件集中在应用装配层注册，领域路由只关心业务，不重复配置跨域、Cookie、限流和 multipart。
  await app.register(cookie);
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      code: "RATE_LIMIT_EXCEEDED",
      error: "Too Many Requests",
      message: "请求过于频繁，请稍后重试",
      details: { limit: context.max, retryAfter: context.after }
    })
  });
  registerConcurrencyQuotas(app);
  // 安全响应头和精确 CORS 白名单同时启用；LAN 模式也不允许任意来源携带凭据调用接口。
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:"],
        mediaSrc: ["'self'", "blob:"],
        connectSrc: ["'self'"]
      }
    },
    crossOriginResourcePolicy: { policy: "same-site" }
  });

  await app.register(cors, {
    origin(origin, callback) {
      callback(null, !origin || config.corsOrigins.includes(origin));
    },
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Range", "X-Lan-Transfer-Pin", "X-Request-Id"],
    exposedHeaders: ["Content-Disposition", "Content-Length", "Content-Range", "Accept-Ranges", "X-Request-Id"],
    credentials: true
  });
  await app.register(multipart, {
    limits: {
      fileSize: config.lanTransferMaxFileBytes,
      files: 10
    },
    throwFileSizeLimit: false
  });
  // Preserve origin checks for browser writes without requiring an admin session.
  app.addHook("preHandler", async (request, reply) => {
    const origin = request.headers.origin;
    if (config.deploymentMode === "lan" && !["GET", "HEAD", "OPTIONS"].includes(request.method) && origin && !config.corsOrigins.includes(origin)) {
      return reply.code(403).send(fail("ORIGIN_NOT_ALLOWED", "请求来源未获允许"));
    }
  });
}
