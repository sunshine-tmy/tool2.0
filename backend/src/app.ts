/**
 * 中文模块说明：后端应用层，负责 Fastify 插件、路由、错误处理和健康检查装配
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import fastify from "fastify";
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
import { getConfig, type AppConfig } from "./config";
import { registerImageCompressRoutes } from "./modules/image-compress/routes";
import { registerImageAiRoutes } from "./modules/image-ai/routes";
import { registerEdgeTtsRoutes } from "./modules/edge-tts";
import { registerChatterboxRoutes } from "./modules/chatterbox/routes";
import { registerLanTransferRoutes } from "./modules/lan-transfer";
import { registerShortVideoRoutes } from "./modules/short-video";
import { registerVideoTextRoutes } from "./modules/video-text";
import { registerXhsArchiveRoutes } from "./modules/xhs-archive/routes";
import { XhsAuthManager } from "./modules/xhs-archive/auth";
import { XhsRuntimeManager } from "./modules/xhs-archive/runtime";
import { XhsTranslationRuntime } from "./modules/xhs-archive/translation-runtime";
import { XhsArchiveStore } from "./modules/xhs-archive/store";
import { registerMaintenanceRoutes } from "./modules/maintenance";
import { bundledComponentCatalog } from "./modules/components/catalog";
import { ComponentManager, type ComponentManagerOptions } from "./modules/components/component-manager";
import { registerComponentRoutes } from "./modules/components/routes";
import { createTaskStore } from "./tasks/task-store";
import { createRemoteFetch, type AddressResolver } from "./security/remote-fetch";
import { registerAdminSecurity } from "./security/admin-session";
import { registerConcurrencyQuotas } from "./security/request-quotas";
import { openToolboxDatabase } from "./database/legacy-migration";
import { reconcileLanStorage } from "./database/storage-consistency";
import { FileMetadataRepository } from "./database/file-metadata";
import { reconcileFileMetadataStorage } from "./database/file-consistency";
import { reconcileDomainRecords } from "./database/domain-consistency";
import { registerFrontendAssets } from "./plugins/frontend-assets";
import { configureDesktopCapabilityRuntime } from "./runtime/desktop-capability-runtime";
import { createDesktopComponentSelfTest } from "./modules/components/desktop-component-self-test";

export async function createApp(options: { remoteAddressResolver?: AddressResolver; config?: AppConfig } = {}) {
  const app = fastify({
    logger:
      process.env.NODE_ENV === "test"
        ? false
        : {
            level: process.env.LOG_LEVEL?.trim() || "info",
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "req.headers.x-csrf-token",
                "req.headers.x-lan-transfer-pin",
                "req.headers.x-toolbox-worker-token",
                "pin",
                "text",
                "path"
              ],
              censor: "[REDACTED]"
            }
          },
    bodyLimit: 1024 * 1024,
    requestIdHeader: "x-request-id"
  });
  const config = options.config ?? getConfig();
  // 启动阶段先打开数据库并创建共享仓储，后续所有路由都复用这些实例，避免各模块各自维护连接。
  const { database } = await openToolboxDatabase(config);
  const fileMetadata = new FileMetadataRepository(database, config.storageRoot);
  const taskStore = createTaskStore(1000, database);
  const remoteFetch = createRemoteFetch({ resolver: options.remoteAddressResolver });
  const xhsStore = new XhsArchiveStore(config, database, fileMetadata);
  let stopCapabilityBeforeUninstall: (componentId: string) => Promise<void> = async () => undefined;
  let refreshDesktopCapabilities: NonNullable<ComponentManagerOptions["onAfterMutation"]> = async () => undefined;
  const xhsRuntimeServices: {
    runtime?: XhsRuntimeManager;
    auth?: XhsAuthManager;
    translationRuntime?: XhsTranslationRuntime;
  } = {};
  const componentManager = new ComponentManager({
    root: path.join(config.runtime.runtimeRoot, "packages"),
    catalog: bundledComponentCatalog,
    selfTest: config.desktopManagedCapabilities ? createDesktopComponentSelfTest() : undefined,
    onBeforeUninstall: async (componentId) => {
      await stopCapabilityBeforeUninstall(componentId);
      if (componentId === "xhs-archive") await xhsRuntimeServices.runtime?.stop();
      if (componentId === "xhs-translation") await xhsRuntimeServices.translationRuntime?.stop();
      if (componentId === "xhs-browser") await xhsRuntimeServices.auth?.stop();
    },
    onAfterMutation: (componentId, operation) => refreshDesktopCapabilities(componentId, operation),
    isInUse: (componentId, taskToolIds) =>
      taskStore
        .list()
        .some(
          (task) => taskToolIds.includes(task.toolId) && (task.status === "pending" || task.status === "running")
        ) ||
      (componentId === "xhs-browser" && Boolean(xhsRuntimeServices.auth?.isActive()))
  });
  const desktopCapabilityRuntime = await configureDesktopCapabilityRuntime(config, componentManager);
  stopCapabilityBeforeUninstall = desktopCapabilityRuntime.beforeUninstall;
  refreshDesktopCapabilities = desktopCapabilityRuntime.afterMutation;
  xhsRuntimeServices.runtime = new XhsRuntimeManager(config, componentManager);
  xhsRuntimeServices.auth = new XhsAuthManager(config, componentManager);
  xhsRuntimeServices.translationRuntime = new XhsTranslationRuntime(config, componentManager);
  const xhsRuntime = xhsRuntimeServices.runtime;
  const xhsAuth = xhsRuntimeServices.auth;
  const xhsTranslationRuntime = xhsRuntimeServices.translationRuntime;
  const taskEventStreams = new Set<import("node:http").ServerResponse>();

  // 关闭顺序与初始化顺序相反：先断开 SSE，再关闭数据库，避免客户端收到半截状态或访问已关闭连接。
  app.addHook("onClose", async () => desktopCapabilityRuntime.close());
  app.addHook("onClose", async () => database.close());
  app.addHook("preClose", async () => {
    for (const stream of taskEventStreams) stream.end();
    taskEventStreams.clear();
  });

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
    allowedHeaders: ["Content-Type", "Authorization", "Range", "X-Lan-Transfer-Pin", "X-CSRF-Token", "X-Request-Id"],
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
  await registerAdminSecurity(app, config, database);

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
    request.log.info({ requestId: request.id, method: request.method, url: request.url }, "route not found");
    return reply.code(404).send(fail("ROUTE_NOT_FOUND", "请求的接口不存在"));
  });

  app.setErrorHandler((error, request, reply) => {
    // 错误日志保留结构化字段，具体响应只暴露稳定错误码，避免泄漏堆栈、绝对路径或凭据。
    request.log.error({ err: error, requestId: request.id }, "request failed");
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
    return reply
      .code(statusCode)
      .send(
        fail(
          statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_INVALID",
          statusCode >= 500 ? "Internal server error" : normalized.message
        )
      );
  });

  const requiredStorageDirectories = [
    config.storageRoot,
    config.migrationBackupDir,
    config.quarantineDir,
    config.uploadDir,
    config.outputDir,
    config.tempDir,
    config.lanTransferFilesDir,
    config.videoTextUploadsDir,
    config.videoTextAudioDir,
    config.videoTextResultsDir,
    config.imageAiInputsDir,
    config.imageAiOutputsDir,
    config.imageAiTasksDir,
    config.edgeTtsTasksDir,
    config.chatterboxTasksDir,
    config.xhsArchiveItemsDir,
    config.xhsArchiveStagingDir
  ];
  // 所有领域目录在注册路由前创建，保证首次启动和健康检查不会因缺失目录失败。
  await Promise.all(requiredStorageDirectories.map((directory) => fsp.mkdir(directory, { recursive: true })));

  // 启动阶段只报告缺失工件，绝不删除领域记录。这样存储盘暂时不可用、挂载为空或路径被误改时，
  // 都不会把仍可恢复的本地数据误判为孤儿；破坏性同步仅能由明确选择的维护清理触发。
  const domainConsistency = await reconcileDomainRecords(config, database, { mode: "report" });
  if (domainConsistency.missing > 0 || domainConsistency.failures.length > 0) {
    app.log.warn(
      {
        checked: domainConsistency.checked,
        missing: domainConsistency.missing,
        failures: domainConsistency.failures.length
      },
      "Domain record consistency check found missing artifacts without deleting metadata"
    );
  }

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
      videoText: {
        audioExtractorConfigured: Boolean(config.videoTextAudioExtractCommand),
        transcriberConfigured: Boolean(config.videoTextTranscribeCommand)
      },
      shortVideo: {
        providerConfigured: Boolean(config.shortVideoParseApiUrl)
      },
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

  registerImageCompressRoutes(app, config, taskStore, fileMetadata);
  await registerImageAiRoutes(app, config, database, taskStore, fileMetadata);
  await registerEdgeTtsRoutes({ app, config, database, taskStore, fileMetadata });
  await registerChatterboxRoutes(app, config, database, taskStore, fileMetadata);
  await registerLanTransferRoutes({ app, config, database, fileMetadata });
  await registerVideoTextRoutes({ app, config, taskStore, remoteFetch, fileMetadata });
  await registerShortVideoRoutes({ app, config, remoteFetch, xhsRuntime, xhsAuth });
  await registerXhsArchiveRoutes({
    app,
    config,
    remoteFetch,
    database,
    taskStore,
    fileMetadata,
    runtime: xhsRuntime,
    auth: xhsAuth,
    components: componentManager,
    translationRuntime: xhsTranslationRuntime,
    store: xhsStore
  });
  registerMaintenanceRoutes(app, { config, database, xhsStore });
  registerComponentRoutes(app, componentManager);
  await registerFrontendAssets(app, { root: config.runtime.frontendDistRoot });

  if (config.databasePath !== ":memory:") {
    // 持久化启动时执行可恢复的一致性检查；异常文件进入隔离区而不是直接删除，保护本地数据。
    const consistency = await reconcileLanStorage(config, database);
    if (consistency.quarantinedFiles || consistency.quarantinedRecords || consistency.failures.length) {
      app.log.warn(
        {
          quarantinedFiles: consistency.quarantinedFiles,
          quarantinedRecords: consistency.quarantinedRecords,
          failures: consistency.failures.length
        },
        "LAN storage consistency check found recoverable issues"
      );
    }
    const fileConsistency = await reconcileFileMetadataStorage(config, database);
    if (fileConsistency.quarantined || fileConsistency.removedMetadata || fileConsistency.failures.length) {
      app.log.warn(
        {
          checked: fileConsistency.checked,
          quarantined: fileConsistency.quarantined,
          removedMetadata: fileConsistency.removedMetadata,
          failures: fileConsistency.failures.length
        },
        "File metadata consistency check found recoverable issues"
      );
    }
  }

  return app;
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
