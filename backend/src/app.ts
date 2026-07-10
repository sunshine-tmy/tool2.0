import fs from "node:fs/promises";
import path from "node:path";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastify from "fastify";
import { fail, listTools, ok } from "@toolbox/shared";
import { getConfig } from "./config";
import { registerImageCompressRoutes } from "./modules/image-compress/routes";
import { registerImageAiRoutes } from "./modules/image-ai/routes";
import { registerLanTransferRoutes } from "./modules/lan-transfer";
import { registerShortVideoRoutes } from "./modules/short-video";
import { registerVideoTextRoutes } from "./modules/video-text";
import { createTaskStore } from "./tasks/task-store";

export async function createApp() {
  const app = fastify({
    logger: false,
    bodyLimit: 220 * 1024 * 1024
  });
  const config = getConfig();
  const taskStore = createTaskStore();

  await app.register(cors, {
    origin: true,
    methods: ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Range"],
    exposedHeaders: ["Content-Disposition", "Content-Length", "Content-Range", "Accept-Ranges"]
  });
  await app.register(multipart, {
    limits: {
      fileSize: config.lanTransferMaxFileBytes,
      files: 10
    },
    throwFileSizeLimit: false
  });

  await fs.mkdir(config.uploadDir, { recursive: true });
  await fs.mkdir(config.outputDir, { recursive: true });
  await fs.mkdir(config.tempDir, { recursive: true });
  await fs.mkdir(config.lanTransferFilesDir, { recursive: true });
  await fs.mkdir(config.videoTextUploadsDir, { recursive: true });
  await fs.mkdir(config.videoTextAudioDir, { recursive: true });
  await fs.mkdir(config.videoTextResultsDir, { recursive: true });
  await fs.mkdir(config.imageAiInputsDir, { recursive: true });
  await fs.mkdir(config.imageAiOutputsDir, { recursive: true });
  await fs.mkdir(config.imageAiTasksDir, { recursive: true });

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
      imageAi: {
        workerUrl: config.imageAiWorkerUrl,
        deploymentUsage: config.deploymentUsage
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
      await fs.access(filePath);
      return reply.send(await fs.readFile(filePath));
    } catch {
      return reply.code(404).send(fail("FILE_NOT_FOUND", "File not found"));
    }
  });

  registerImageCompressRoutes(app, config, taskStore);
  await registerImageAiRoutes(app, config);
  await registerLanTransferRoutes({ app, config });
  await registerVideoTextRoutes({ app, config, taskStore });
  await registerShortVideoRoutes({ app, config });

  return app;
}
