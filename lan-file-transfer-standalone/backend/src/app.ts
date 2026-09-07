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
import { registerLanTransferRoutes } from "./modules/lan-transfer";
import { createTaskStore } from "./tasks/task-store";

export async function createApp() {
  const config = getConfig();
  const app = fastify({ logger: false, bodyLimit: config.lanTransferMaxFileBytes });
  const taskStore = createTaskStore();

  await app.register(cors, {
    origin: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Range", "X-Lan-Transfer-Pin"],
    exposedHeaders: ["Content-Disposition", "Content-Length", "Content-Range", "Accept-Ranges"],
    credentials: true
  });
  await app.register(multipart, {
    limits: { fileSize: config.lanTransferMaxFileBytes, files: 10 },
    throwFileSizeLimit: false
  });

  await Promise.all([
    fsp.mkdir(config.uploadDir, { recursive: true }),
    fsp.mkdir(config.outputDir, { recursive: true }),
    fsp.mkdir(config.tempDir, { recursive: true }),
    fsp.mkdir(config.lanTransferFilesDir, { recursive: true }),
    fsp.mkdir(config.imageAiInputsDir, { recursive: true }),
    fsp.mkdir(config.imageAiOutputsDir, { recursive: true }),
    fsp.mkdir(config.imageAiTasksDir, { recursive: true })
  ]);

  app.get("/api/health", async () =>
    ok({
      status: "ok",
      name: "standalone-toolbox-api",
      imageAi: {
        workerUrl: config.imageAiWorkerUrl,
        deploymentUsage: config.deploymentUsage
      }
    })
  );

  app.get("/api/tools", async () => ok(listTools()));
  app.get("/api/tasks", async () => ok(taskStore.list()));
  app.get("/api/tasks/:taskId", async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const task = taskStore.get(taskId);
    return task ? ok(task) : reply.code(404).send(fail("TASK_NOT_FOUND", "Task not found"));
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
  await registerLanTransferRoutes({ app, config });
  return app;
}

function outputContentType(extension: string) {
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "application/octet-stream";
}
