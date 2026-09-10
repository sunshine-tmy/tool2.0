import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastify from "fastify";
import { fail, listTools, ok } from "@toolbox/shared";
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

export async function createApp(options: { remoteAddressResolver?: AddressResolver } = {}) {
  const app = fastify({
    logger: false,
    bodyLimit: 220 * 1024 * 1024
  });
  const config = getConfig();
  const taskStore = createTaskStore();
  const remoteFetch = createRemoteFetch({ resolver: options.remoteAddressResolver });

  await app.register(cors, {
    origin(origin, callback) {
      callback(null, !origin || config.corsOrigins.includes(origin));
    },
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Range", "X-Lan-Transfer-Pin"],
    exposedHeaders: ["Content-Disposition", "Content-Length", "Content-Range", "Accept-Ranges"],
    credentials: true
  });
  await app.register(multipart, {
    limits: {
      fileSize: config.lanTransferMaxFileBytes,
      files: 10
    },
    throwFileSizeLimit: false
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

  app.get("/api/health", async () => {
    return ok({
      status: "ok",
      name: "toolbox-api",
      videoText: {
        audioExtractorConfigured: Boolean(config.videoTextAudioExtractCommand),
        transcriberConfigured: Boolean(config.videoTextTranscribeCommand)
      },
      shortVideo: {
        providerConfigured: Boolean(config.shortVideoParseApiUrl)
      },
      xhsArchive: {
        providerConfigured: Boolean(config.xhsProviderUrl),
        archiveDir: config.xhsArchiveDir
      },
      imageAi: {
        workerUrl: config.imageAiWorkerUrl,
        deploymentUsage: config.deploymentUsage
      },
      edgeTts: {
        pythonPath: config.edgeTtsPythonPath,
        retentionDays: config.edgeTtsRetentionDays
      },
      chatterbox: {
        workerUrl: config.chatterboxWorkerUrl,
        retentionDays: config.chatterboxRetentionDays
      }
    });
  });

  app.get("/api/tools", async () => {
    return ok(listTools());
  });

  app.get("/api/tasks", async () => {
    return ok(taskStore.list());
  });

  app.get("/api/tasks/:taskId", async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const task = taskStore.get(taskId);

    if (!task) {
      return reply.code(404).send(fail("TASK_NOT_FOUND", "Task not found"));
    }

    return ok(task);
  });

  app.get("/api/files/:fileName", async (request, reply) => {
    const { fileName } = request.params as { fileName: string };
    const safeName = path.basename(fileName);
    const filePath = path.join(config.outputDir, safeName);

    try {
      const stat = await fsp.stat(filePath);
      if (!stat.isFile()) throw new Error("Not a file");
      reply.header("content-length", String(stat.size));
      reply.header("content-type", outputContentType(path.extname(safeName)));
      reply.header("content-disposition", `attachment; filename="${safeName.replaceAll('"', "")}"`);
      reply.header("x-content-type-options", "nosniff");
      return reply.send(fs.createReadStream(filePath));
    } catch {
      return reply.code(404).send(fail("FILE_NOT_FOUND", "File not found"));
    }
  });

  registerImageCompressRoutes(app, config, taskStore);
  await registerImageAiRoutes(app, config);
  await registerEdgeTtsRoutes({ app, config });
  await registerChatterboxRoutes(app, config);
  await registerLanTransferRoutes({ app, config });
  await registerVideoTextRoutes({ app, config, taskStore, remoteFetch });
  await registerShortVideoRoutes({ app, config, remoteFetch });
  await registerXhsArchiveRoutes({ app, config, remoteFetch });
  registerMaintenanceRoutes(app);

  return app;
}

function outputContentType(extension: string) {
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "application/octet-stream";
}
