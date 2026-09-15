/**
 * 中文模块说明：后端应用层，负责 后端公共服务、配置或基础设施能力
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { fail } from "@toolbox/shared";

const minute = "1 minute";

export const REQUEST_QUOTAS = {
  login: { rateLimit: { max: 5, timeWindow: minute }, concurrencyLimit: 2 },
  lanUpload: { rateLimit: { max: 30, timeWindow: minute }, concurrencyLimit: 4 },
  lanChunk: { rateLimit: { max: 120, timeWindow: minute }, concurrencyLimit: 16 },
  batchDownload: { rateLimit: { max: 10, timeWindow: minute }, concurrencyLimit: 2 },
  remoteFetch: { rateLimit: { max: 10, timeWindow: minute }, concurrencyLimit: 4 },
  ai: { rateLimit: { max: 10, timeWindow: minute }, concurrencyLimit: 2 },
  translation: { rateLimit: { max: 20, timeWindow: minute }, concurrencyLimit: 2 },
  translationBatch: { rateLimit: { max: 5, timeWindow: minute }, concurrencyLimit: 1 },
  voice: { rateLimit: { max: 30, timeWindow: minute }, concurrencyLimit: 4 }
} as const;

export function registerConcurrencyQuotas(app: FastifyInstance) {
  const activeByRoute = new Map<string, number>();
  const acquired = new WeakMap<FastifyRequest, string>();

  app.addHook("preHandler", async (request, reply) => {
    const limit = request.routeOptions.config.concurrencyLimit;
    if (!limit) return;
    const route = `${request.method} ${request.routeOptions.url}`;
    const active = activeByRoute.get(route) ?? 0;
    if (active >= limit) {
      return reply
        .code(429)
        .send(fail("CONCURRENCY_LIMIT_EXCEEDED", "当前操作正在处理的请求过多，请稍后重试", { limit }));
    }
    activeByRoute.set(route, active + 1);
    acquired.set(request, route);
  });

  const release = (request: FastifyRequest) => {
    const route = acquired.get(request);
    if (!route) return;
    acquired.delete(request);
    const active = activeByRoute.get(route) ?? 1;
    if (active <= 1) activeByRoute.delete(route);
    else activeByRoute.set(route, active - 1);
  };
  app.addHook("onResponse", async (request) => release(request));
  app.addHook("onError", async (request) => release(request));
  app.addHook("onClose", async () => activeByRoute.clear());
}
