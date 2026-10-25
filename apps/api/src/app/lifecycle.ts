/** Application assembly step; called directly on the original Fastify instance. */
import { type FastifyInstance } from "fastify";
import type { AppOptions } from "./options";
import type { AppServices } from "./services";
export function registerAppLifecycle(
  app: FastifyInstance,
  options: Pick<AppOptions, "onShutdownStage">,
  services: Pick<AppServices, "database" | "desktopCapabilityRuntime" | "douyinRuntime"> &
    Partial<Pick<AppServices, "tiktokRuntime">>
) {
  const { database, desktopCapabilityRuntime, douyinRuntime, tiktokRuntime } = services;
  const taskEventStreams = new Set<import("node:http").ServerResponse>();

  // Fastify 的 onClose 按后注册先执行：领域队列先退出，随后关闭共享运行时和数据库。
  // SSE 则在 preClose 结束连接，避免长连接阻塞服务关闭。
  app.addHook("onClose", async () => {
    options.onShutdownStage?.("database");
    database.close();
  });
  app.addHook("onClose", async () => {
    options.onShutdownStage?.("workers");
    await desktopCapabilityRuntime.close();
  });
  app.addHook("onClose", async () => douyinRuntime?.close());
  app.addHook("onClose", async () => tiktokRuntime?.close());
  app.addHook("preClose", async () => {
    options.onShutdownStage?.("tasks");
    for (const stream of taskEventStreams) stream.end();
    taskEventStreams.clear();
  });
  return taskEventStreams;
}
