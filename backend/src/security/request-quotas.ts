/**
 * 中文模块说明：后端应用层，负责 后端公共服务、配置或基础设施能力
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { fail } from "@toolbox/shared";

const minute = "1 minute";

export const REQUEST_QUOTAS = {
  // 不同资源按成本设置独立限流和并发额度，避免单个上传或模型任务耗尽整个服务容量。
  login: { rateLimit: { max: 5, timeWindow: minute }, concurrencyLimit: 2 },
  lanUpload: { rateLimit: { max: 30, timeWindow: minute }, concurrencyLimit: 4 },
  lanChunk: { rateLimit: { max: 120, timeWindow: minute }, concurrencyLimit: 16 },
  batchDownload: { rateLimit: { max: 10, timeWindow: minute }, concurrencyLimit: 2 },
  remoteFetch: { rateLimit: { max: 10, timeWindow: minute }, concurrencyLimit: 4 },
  // 浏览器会为视频元数据、Range 分片和拖动进度条并发发起多个只读请求，不能复用解析/下载的低额度。
  mediaPreview: { rateLimit: { max: 240, timeWindow: minute }, concurrencyLimit: 8 },
  ai: { rateLimit: { max: 10, timeWindow: minute }, concurrencyLimit: 2 },
  translation: { rateLimit: { max: 20, timeWindow: minute }, concurrencyLimit: 2 },
  translationBatch: { rateLimit: { max: 5, timeWindow: minute }, concurrencyLimit: 1 },
  voice: { rateLimit: { max: 30, timeWindow: minute }, concurrencyLimit: 4 }
} as const;

export function registerConcurrencyQuotas(app: FastifyInstance) {
  const activeByRoute = new Map<string, number>();
  const acquired = new WeakMap<FastifyRequest, string>();

  app.addHook("preHandler", async (request, reply) => {
    // 额度以“HTTP 方法 + 注册路由”为键，动态路由参数不会把同一类请求拆成多个桶。
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
    // onResponse/onError 均会释放占用，WeakMap 令同一请求最多释放一次。
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
