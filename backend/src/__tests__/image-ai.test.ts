import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../app";

let storageRoot: string;
let workerServer: http.Server;
let workerUrl: string;
let app: FastifyInstance | undefined;

beforeEach(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-image-ai-"));
  workerServer = createFakeWorker();
  await new Promise<void>((resolve) => workerServer.listen(0, "127.0.0.1", resolve));
  const address = workerServer.address();
  if (!address || typeof address === "string") throw new Error("Fake worker did not bind");
  workerUrl = `http://127.0.0.1:${address.port}`;
  process.env.STORAGE_ROOT = storageRoot;
  process.env.IMAGE_AI_WORKER_URL = workerUrl;
  process.env.DEPLOYMENT_USAGE = "internal-noncommercial";
});

afterEach(async () => {
  await app?.close();
  app = undefined;
  await new Promise<void>((resolve) => workerServer.close(() => resolve()));
  delete process.env.STORAGE_ROOT;
  delete process.env.IMAGE_AI_WORKER_URL;
  delete process.env.DEPLOYMENT_USAGE;
  await fs.rm(storageRoot, { recursive: true, force: true });
});

describe("image ai api", () => {
  it("reports local worker model and license health", async () => {
    app = await createApp();
    const response = await app.inject({ method: "GET", url: "/api/tools/image-ai/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.available).toBe(true);
    expect(response.json().data.deploymentUsage).toBe("internal-noncommercial");
    expect(response.json().data.models[0].license).toBe("Apache-2.0");
  });

  it("allows a cold worker more than three seconds to report model health", async () => {
    await new Promise<void>((resolve) => workerServer.close(() => resolve()));
    workerServer = createFakeWorker({ healthDelayMs: 3200 });
    await new Promise<void>((resolve) => workerServer.listen(Number(new URL(workerUrl).port), "127.0.0.1", resolve));
    app = await createApp();

    const response = await app.inject({ method: "GET", url: "/api/tools/image-ai/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.available).toBe(true);
  }, 10000);

  it("returns normalized watermark suggestions without OCR text", async () => {
    app = await createApp();
    const image = await testImage(80, 60);
    const response = await app.inject({
      method: "POST",
      url: "/api/tools/image-ai/watermark/suggestions",
      ...multipartPayload([{ field: "file", fileName: "owned.png", mimeType: "image/png", content: image }])
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.suggestions[0].polygon[0]).toEqual({ x: 0.1, y: 0.1 });
    expect(JSON.stringify(response.json())).not.toContain("recognized text");
  });

  it("queues, persists and serves enhanced PNG results", async () => {
    app = await createApp();
    const image = await testImage(80, 60);
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/tools/image-ai/tasks",
      ...multipartPayload(
        [{ field: "files", fileName: "product.png", mimeType: "image/png", content: image }],
        { operation: "enhance", scale: "2" }
      )
    });

    expect(createResponse.statusCode).toBe(202);
    const taskId = createResponse.json().data.id as string;
    const task = await waitForTask(app, taskId);
    expect(task.status).toBe("completed");
    expect(task.results[0]).toMatchObject({
      originalName: "product.png",
      width: 160,
      height: 120,
      provider: "real-esrgan",
      model: "RealESRGAN_x2plus"
    });

    const fileResponse = await app.inject({ method: "GET", url: task.results[0].downloadUrl });
    expect(fileResponse.statusCode).toBe(200);
    expect(fileResponse.headers["content-type"]).toContain("image/png");
    expect((await sharp(fileResponse.rawPayload).metadata()).width).toBe(160);

    const downloadResponse = await app.inject({
      method: "GET",
      url: `${task.results[0].downloadUrl}?download=1`
    });
    expect(downloadResponse.statusCode).toBe(200);
    expect(downloadResponse.headers["content-disposition"]).toContain("attachment");
    expect(downloadResponse.headers["content-disposition"]).toContain("product-enhanced.png");

    const zipResponse = await app.inject({
      method: "GET",
      url: `/api/tools/image-ai/tasks/${taskId}/download.zip`
    });
    expect(zipResponse.statusCode).toBe(200);
    expect(zipResponse.headers["content-type"]).toContain("application/zip");
    expect(zipResponse.rawPayload.subarray(0, 2).toString()).toBe("PK");
  });

  it("requires a same-size PNG mask for watermark removal", async () => {
    app = await createApp();
    const image = await testImage(80, 60);
    const wrongMask = await sharp({
      create: { width: 40, height: 30, channels: 4, background: "white" }
    }).png().toBuffer();

    const response = await app.inject({
      method: "POST",
      url: "/api/tools/image-ai/tasks",
      ...multipartPayload(
        [
          { field: "files", fileName: "owned.png", mimeType: "image/png", content: image },
          { field: "mask", fileName: "mask.png", mimeType: "image/png", content: wrongMask }
        ],
        { operation: "watermark_remove" }
      )
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("MASK_DIMENSIONS_MISMATCH");
  });

  it("rejects spoofed filenames even when the bytes are a valid image", async () => {
    app = await createApp();
    const image = await testImage(20, 20);
    const response = await app.inject({
      method: "POST",
      url: "/api/tools/image-ai/tasks",
      ...multipartPayload(
        [{ field: "files", fileName: "payload.txt", mimeType: "image/png", content: image }],
        { operation: "background_remove" }
      )
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("UNSUPPORTED_IMAGE_EXTENSION");
  });
});

function createFakeWorker(options: { healthDelayMs?: number } = {}) {
  return http.createServer(async (request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.url === "/health") {
      if (options.healthDelayMs) await new Promise((resolve) => setTimeout(resolve, options.healthDelayMs));
      response.end(JSON.stringify({
        success: true,
        data: {
          available: true,
          deploymentUsage: "internal-noncommercial",
          workerUrl,
          models: [{ provider: "lama", model: "big-lama", version: "test", license: "Apache-2.0", device: "cpu", available: true }]
        }
      }));
      return;
    }

    const body = JSON.parse(await readBody(request)) as Record<string, any>;
    if (request.url === "/watermark/suggestions") {
      response.end(JSON.stringify({
        success: true,
        data: {
          width: 80,
          height: 60,
          suggestions: [{ polygon: [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.4, y: 0.2 }, { x: 0.1, y: 0.2 }], confidence: 0.9 }],
          provider: "paddleocr",
          model: "PP-OCRv5",
          warnings: []
        }
      }));
      return;
    }

    if (request.url === "/process") {
      const metadata = await sharp(body.input_path).metadata();
      const scale = body.operation === "enhance" ? Number(body.scale || 2) : 1;
      await sharp(body.input_path)
        .resize({ width: (metadata.width || 1) * scale, height: (metadata.height || 1) * scale })
        .png()
        .toFile(body.output_path);
      response.end(JSON.stringify({
        success: true,
        data: {
          provider: body.operation === "enhance" ? "real-esrgan" : body.operation === "watermark_remove" ? "lama" : "birefnet-general",
          model: body.operation === "enhance" ? `RealESRGAN_x${scale}plus` : "test-model",
          warnings: []
        }
      }));
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ success: false, error: { code: "NOT_FOUND", message: "Not found" } }));
  });
}

async function readBody(request: http.IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function waitForTask(instance: FastifyInstance, taskId: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await instance.inject({ method: "GET", url: `/api/tools/image-ai/tasks/${taskId}` });
    const task = response.json().data;
    if (!["pending", "running"].includes(task.status)) return task;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for image AI task");
}

function testImage(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: "#2563eb" } }).png().toBuffer();
}

function multipartPayload(
  files: Array<{ field: string; fileName: string; mimeType: string; content: Buffer }>,
  fields: Record<string, string> = {}
) {
  const boundary = `----toolbox-${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  for (const file of files) {
    chunks.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.fileName}"\r\nContent-Type: ${file.mimeType}\r\n\r\n`),
      file.content,
      Buffer.from("\r\n")
    );
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat(chunks)
  };
}
