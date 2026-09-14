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
  TaskIdParamsSchema,
  TaskListSchema,
  TaskSchema,
  apiSuccessSchema,
  fail,
  listTools,
  ok
} from "@toolbox/shared";
import { getConfig } from "./config";
import { registerImageCompressRoutes } from "./modules/image-compress/routes";
import { registerImageAiRoutes } from "./modules/image-ai/routes";
import { registerEdgeTtsRoutes } from "./modules/edge-tts";
import { registerChatterboxRoutes } from "./modules/chatterbox/routes";
import { registerLanTransferRoutes } from "./modules/lan-transfer";
import { registerShortVideoRoutes } from "./modules/short-video";
import { registerVideoTextRoutes } from "./modules/video-text";
import { registerXhsArchiveRoutes } from "./modules/xhs-archive/routes";
import { registerMaintenanceRoutes } from "./modules/maintenance";
import { createTaskStore } from "./tasks/task-store";
import { createRemoteFetch, type AddressResolver } from "./security/remote-fetch";
import { registerAdminSecurity } from "./security/admin-session";
import { openToolboxDatabase } from "./database/legacy-migration";

export async function createApp(options: { remoteAddressResolver?: AddressResolver } = {}) {
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
  const config = getConfig();
  const { database } = await openToolboxDatabase(config);
  const taskStore = createTaskStore(1000, database);
  const remoteFetch = createRemoteFetch({ resolver: options.remoteAddressResolver });

  app.addHook("onClose", async () => database.close());

  await app.register(cookie);
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute"
  });
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

  app.addHook("preSerialization", async (request, _reply, payload) => {
    if (typeof payload !== "object" || payload === null) return payload;
    const value = payload as Record<string, unknown>;
    return typeof value.success === "boolean" && typeof value.requestId !== "string"
      ? { ...value, requestId: request.id }
      : payload;
  });

  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("x-request-id", request.id);
    return payload;
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error, requestId: request.id }, "request failed");
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

  await fsp.mkdir(config.uploadDir, { recursive: true });
  await fsp.mkdir(config.outputDir, { recursive: true });
  await fsp.mkdir(config.tempDir, { recursive: true });
  await fsp.mkdir(config.lanTransferFilesDir, { recursive: true });
  await fsp.mkdir(config.videoTextUploadsDir, { recursive: true });
  await fsp.mkdir(config.videoTextAudioDir, { recursive: true });
  await fsp.mkdir(config.videoTextResultsDir, { recursive: true });
  await fsp.mkdir(config.imageAiInputsDir, { recursive: true });
  await fsp.mkdir(config.imageAiOutputsDir, { recursive: true });
  await fsp.mkdir(config.imageAiTasksDir, { recursive: true });
  await fsp.mkdir(config.edgeTtsTasksDir, { recursive: true });
  await fsp.mkdir(config.chatterboxTasksDir, { recursive: true });
  await fsp.mkdir(config.xhsArchiveItemsDir, { recursive: true });
  await fsp.mkdir(config.xhsArchiveStagingDir, { recursive: true });

  app.get("/health/live", async () => {
    return ok({ status: "ok" });
  });

  app.get("/health/ready", async (_request, reply) => {
    try {
      database.ready();
      await Promise.all(
        [config.storageRoot, config.tempDir].map((directory) =>
          fsp.access(directory, fs.constants.R_OK | fs.constants.W_OK)
        )
      );
      return ok({ status: "ready", database: "ok", storage: "ok" });
    } catch {
      return reply.code(503).send(fail("NOT_READY", "Required storage is unavailable"));
    }
  });

  app.get("/api/v1/health", async () => {
    return ok({
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
    });
  });

  app.get("/api/v1/tools", async () => {
    return ok(listTools());
  });

  app.get("/api/v1/tasks", { schema: { response: { 200: apiSuccessSchema(TaskListSchema) } } }, async () =>
    ok(taskStore.list())
  );

  app.get(
    "/api/v1/tasks/:taskId",
    {
      schema: {
        params: TaskIdParamsSchema,
        response: { 200: apiSuccessSchema(TaskSchema), 404: ApiFailureSchema }
      }
    },
    async (request, reply) => {
      const { taskId } = request.params as { taskId: string };
      const task = taskStore.get(taskId);

      if (!task) {
        return reply.code(404).send(fail("TASK_NOT_FOUND", "Task not found"));
      }

      return ok(task);
    }
  );

  app.get("/api/v1/tasks/:taskId/events", { schema: { params: TaskIdParamsSchema } }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const task = taskStore.get(taskId);
    if (!task) return reply.code(404).send(fail("TASK_NOT_FOUND", "Task not found"));
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no"
    });
    const send = (value: typeof task) => reply.raw.write(`event: task\ndata: ${JSON.stringify(value)}\n\n`);
    send(task);
    const unsubscribe = taskStore.subscribe(taskId, (value) => {
      send(value);
      if (value.status === "completed" || value.status === "failed") reply.raw.end();
    });
    const heartbeat = setInterval(() => reply.raw.write(": keep-alive\n\n"), 15_000);
    reply.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  app.get("/api/v1/files/:fileName", async (request, reply) => {
    const { fileName } = request.params as { fileName: string };
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
  });

  registerImageCompressRoutes(app, config, taskStore);
  await registerImageAiRoutes(app, config, database, taskStore);
  await registerEdgeTtsRoutes({ app, config, database, taskStore });
  await registerChatterboxRoutes(app, config, database, taskStore);
  await registerLanTransferRoutes({ app, config, database });
  await registerVideoTextRoutes({ app, config, taskStore, remoteFetch });
  await registerShortVideoRoutes({ app, config, remoteFetch });
  await registerXhsArchiveRoutes({ app, config, remoteFetch, database, taskStore });
  registerMaintenanceRoutes(app);

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
