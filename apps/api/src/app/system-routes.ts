/** Application assembly step; called directly on the original Fastify instance. */
/**
 * 中文模块说明：后端应用层，负责 Fastify 插件、路由、错误处理和健康检查装配
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { type FastifyInstance } from "fastify";
import {
  ApiFailureSchema,
  ApiHealthSchema,
  FileNameParamsSchema,
  LiveHealthSchema,
  ReadyHealthSchema,
  TaskIdParamsSchema,
  TaskListSchema,
  TaskSchema,
  ToolListSchema,
  apiSuccessSchema,
  fail,
  listTools,
  ok,
  type FileNameParams,
  type TaskIdParams
} from "@toolbox/shared";
import { type AppConfig } from "../config";
import { createTaskStore } from "../tasks/task-store";
import type { ToolboxDatabase } from "../database/toolbox-database";
export function registerSystemRoutes(
  app: FastifyInstance,
  config: AppConfig,
  database: ToolboxDatabase,
  taskStore: ReturnType<typeof createTaskStore>,
  requiredStorageDirectories: string[],
  taskEventStreams: Set<import("node:http").ServerResponse>
) {
  // 存活探针只回答进程是否能处理请求，不依赖数据库或业务目录，便于容器/启动器判断进程状态。
  app.get("/health/live", { schema: { response: { 200: apiSuccessSchema(LiveHealthSchema) } } }, async () =>
    ok({ status: "ok" as const })
  );

  app.get(
    "/health/ready",
    {
      schema: {
        response: { 200: apiSuccessSchema(ReadyHealthSchema), 503: ApiFailureSchema }
      }
    },
    async (_request, reply) => {
      // 就绪探针检查数据库和全部必需目录；任一依赖不可用时返回 503，避免流量进入半初始化服务。
      try {
        database.ready();
        await Promise.all(
          requiredStorageDirectories.map((directory) => fsp.access(directory, fs.constants.R_OK | fs.constants.W_OK))
        );
        return ok({ status: "ready" as const, database: "ok" as const, storage: "ok" as const });
      } catch {
        return reply.code(503).send(fail("NOT_READY", "Required storage is unavailable"));
      }
    }
  );

  app.get("/api/v1/health", { schema: { response: { 200: apiSuccessSchema(ApiHealthSchema) } } }, async () =>
    ok({
      status: "ok",
      name: "toolbox-api",
      deploymentMode: config.deploymentMode,
      xhsArchive: {
        providerConfigured: Boolean(config.xhsProviderUrl),
        translationProviderConfigured: Boolean(config.xhsTranslationProviderUrl)
      },
      imageAi: {
        deploymentUsage: config.deploymentUsage
      },
      edgeTts: {
        retentionDays: config.edgeTtsRetentionDays
      },
      chatterbox: {
        retentionDays: config.chatterboxRetentionDays
      }
    })
  );

  app.get("/api/v1/tools", { schema: { response: { 200: apiSuccessSchema(ToolListSchema) } } }, async () =>
    ok(listTools())
  );

  app.get("/api/v1/tasks", { schema: { response: { 200: apiSuccessSchema(TaskListSchema) } } }, async () =>
    ok(taskStore.list())
  );

  app.get<{ Params: TaskIdParams }>(
    "/api/v1/tasks/:taskId",
    {
      schema: {
        params: TaskIdParamsSchema,
        response: { 200: apiSuccessSchema(TaskSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      // SSE 连接只订阅指定任务，并在终态或客户端断开时释放心跳和订阅，防止长连接泄漏。
      const { taskId } = request.params;
      const task = taskStore.get(taskId);

      if (!task) {
        return reply.code(404).send(fail("TASK_NOT_FOUND", "Task not found"));
      }

      return ok(task);
    }
  );

  app.get<{ Params: TaskIdParams }>(
    "/api/v1/tasks/:taskId/events",
    { schema: { params: TaskIdParamsSchema, response: { 404: ApiFailureSchema } } },
    async (request, reply) => {
      const { taskId } = request.params;
      const task = taskStore.get(taskId);
      if (!task) return reply.code(404).send(fail("TASK_NOT_FOUND", "Task not found"));
      reply.hijack();
      reply.raw.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no"
      });
      taskEventStreams.add(reply.raw);
      const send = (value: typeof task) => reply.raw.write(`event: task\ndata: ${JSON.stringify(value)}\n\n`);
      send(task);
      // 重连时任务可能已经结束；发送终态后立即结束，不再保留订阅和心跳。
      if (task.status === "completed" || task.status === "failed") {
        taskEventStreams.delete(reply.raw);
        reply.raw.end();
        return;
      }
      const unsubscribe = taskStore.subscribe(taskId, (value) => {
        send(value);
        if (value.status === "completed" || value.status === "failed") reply.raw.end();
      });
      const heartbeat = setInterval(() => reply.raw.write(": keep-alive\n\n"), 15_000);
      reply.raw.on("close", () => {
        taskEventStreams.delete(reply.raw);
        clearInterval(heartbeat);
        unsubscribe();
      });
    }
  );

  app.get<{ Params: FileNameParams }>(
    "/api/v1/files/:fileName",
    { schema: { params: FileNameParamsSchema, response: { 404: ApiFailureSchema } } },
    async (request, reply) => {
      const { fileName } = request.params;
      const safeName = path.basename(fileName);
      const filePath = path.join(config.outputDir, safeName);

      try {
        const stat = await fsp.stat(filePath);
        if (!stat.isFile()) throw new Error("Not a file");
        reply.header("content-length", String(stat.size));
        reply.header("content-type", outputContentType(path.extname(safeName)));
        reply.header("content-disposition", contentDisposition(safeName));
        reply.header("x-content-type-options", "nosniff");
        return reply.send(fs.createReadStream(filePath));
      } catch {
        return reply.code(404).send(fail("FILE_NOT_FOUND", "File not found"));
      }
    }
  );
}
function outputContentType(extension: string) {
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "application/octet-stream";
}

function contentDisposition(fileName: string) {
  const normalized = fileName.replace(/[\r\n]/g, "").replace(/["\\]/g, "_");
  const ascii = normalized.replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(normalized)}`;
}
