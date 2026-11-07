/**
 * 中文模块说明：测试 apps/api/src/__tests__/video-ai.test.ts 中的稳定行为、边界条件和回归场景
 */
import { Readable } from "node:stream";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createIsolatedAppFixture } from "./helpers/isolated-app";
import { isVideoAiModeValue, toPublicTask } from "../domains/video-ai/task-projections";
import { isDetection, isProcessResult } from "../domains/video-ai/worker-client";
import type { StoredVideoAiTask } from "../domains/video-ai/types";
vi.mock("../domains/video-ai/media", () => ({
  probeVideo: vi.fn(async () => ({ width: 1280, height: 720, durationMs: 1000, frameCount: 10, fps: 10 }))
}));

type Fixture = Awaited<ReturnType<typeof createIsolatedAppFixture>>;
type App = Awaited<ReturnType<Fixture["start"]>>;

const disposers: Array<() => Promise<void>> = [];
let worker: FakeWorker | undefined;

afterEach(async () => {
  await worker?.close();
  worker = undefined;
  for (const dispose of disposers.splice(0)) await dispose();
});

async function startApp(environment?: Record<string, string>) {
  const fixture = await createIsolatedAppFixture();
  disposers.push(() => fixture.dispose());
  return fixture.start(environment ? { environment } : undefined);
}

describe("video-ai task projections", () => {
  const base: StoredVideoAiTask = {
    id: "task_123456",
    mode: "balanced",
    status: "running",
    progress: 42,
    queuePosition: null,
    inputName: "demo.mp4",
    inputBytes: 1024,
    inputPath: "/tmp/input.bin",
    segments: [{ rect: { x: 0.1, y: 0.8, width: 0.8, height: 0.1 }, startFrame: 0, endFrame: 100 }],
    warnings: ["w"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: null
  };

  it("exposes a download url only after the output file exists", () => {
    expect(toPublicTask(base).output).toBeNull();
    const done = toPublicTask({
      ...base,
      status: "completed",
      outputPath: "/tmp/out.mp4",
      outputBytes: 2048,
      outputWidth: 1280,
      outputHeight: 720
    });
    expect(done.output).toEqual({
      downloadUrl: "/api/v1/tools/video-ai/tasks/task_123456/output",
      bytes: 2048,
      width: 1280,
      height: 720,
      durationMs: null
    });
  });

  it("never leaks the input or output filesystem paths", () => {
    const publicTask = toPublicTask({ ...base, outputPath: "/tmp/out.mp4", outputBytes: 1 });
    expect(JSON.stringify(publicTask)).not.toContain("/tmp/");
  });

  it("accepts only the four documented modes", () => {
    for (const mode of ["fast", "balanced", "extreme", "delogo"]) expect(isVideoAiModeValue(mode)).toBe(true);
    for (const mode of ["", "best", "STTN", undefined, 1]) expect(isVideoAiModeValue(mode)).toBe(false);
  });
});

describe("video-ai worker payload validation", () => {
  const detection = {
    width: 1280,
    height: 720,
    fps: 25,
    frameCount: 250,
    hasAudio: true,
    segments: [{ rect: { x: 0, y: 0.9, width: 1, height: 0.1 }, startFrame: 0, endFrame: 249, confidence: 0.9 }],
    warnings: []
  };

  it("accepts a well-formed detection payload", () => {
    expect(isDetection(detection)).toBe(true);
  });

  it("rejects malformed detection payloads instead of trusting the worker", () => {
    expect(isDetection({ ...detection, segments: [{ rect: { x: 0 } }] })).toBe(false);
    expect(isDetection({ ...detection, frameCount: "many" })).toBe(false);
    expect(isDetection(null)).toBe(false);
  });

  it("requires output dimensions in the process result", () => {
    const result = {
      provider: "delogo",
      model: "opencv-inpaint",
      segments: [{ x: 0, y: 0.9, width: 1, height: 0.1 }],
      frameCount: 10,
      width: 1280,
      height: 720,
      warnings: []
    };
    expect(isProcessResult(result)).toBe(true);
    expect(isProcessResult({ ...result, width: undefined })).toBe(false);
  });
});

describe("video-ai api", () => {
  it("refuses unavailable tiers before creating a persisted task", async () => {
    worker = await startFakeWorker();
    const app = await startApp({ VIDEO_AI_WORKER_URL: worker.url });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/video-ai/tasks",
      ...multipart({ fileName: "clip.mp4", fields: { mode: "balanced" } })
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe("VIDEO_AI_MODE_UNAVAILABLE");
    expect((await app.inject({ method: "GET", url: "/api/v1/tools/video-ai/history" })).json().data.total).toBe(0);
  });
  it("serializes the queue, refuses active deletion and honors cancellation even if a Worker returns success", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    worker = await startFakeWorker({ processGate: gate });
    const app = await startApp({ VIDEO_AI_WORKER_URL: worker.url });
    const create = () =>
      app.inject({
        method: "POST",
        url: "/api/v1/tools/video-ai/tasks",
        ...multipart({ fileName: "clip.mp4", fields: { mode: "delogo" } })
      });
    try {
      const first = (await create()).json().data.id;
      await waitForStatus(app, first, "running");
      const second = (await create()).json().data.id;
      expect(
        (await app.inject({ method: "GET", url: `/api/v1/tools/video-ai/tasks/${second}` })).json().data.status
      ).toBe("pending");
      expect((await app.inject({ method: "DELETE", url: `/api/v1/tools/video-ai/tasks/${first}` })).statusCode).toBe(
        409
      );
      expect(
        (await app.inject({ method: "POST", url: `/api/v1/tools/video-ai/tasks/${first}/cancel` })).statusCode
      ).toBe(200);
      release();
      expect((await waitForStatus(app, first, "canceled")).output).toBeNull();
      expect((await waitForStatus(app, second, "completed")).output.durationMs).toBe(1000);
      const range = await app.inject({
        method: "GET",
        url: `/api/v1/tools/video-ai/tasks/${second}/output?preview=1`,
        headers: { range: "bytes=0-3" }
      });
      expect(range.statusCode).toBe(206);
      expect(range.rawPayload.length).toBe(4);
      expect(range.headers["content-disposition"]).toBeUndefined();
    } finally {
      release();
    }
  });
  it("accepts the published no-subtitle response without dimensions and probes the output", async () => {
    worker = await startFakeWorker({ passthrough: true });
    const app = await startApp({ VIDEO_AI_WORKER_URL: worker.url });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/tools/video-ai/tasks",
      ...multipart({ fileName: "clip.mp4", fields: { mode: "delogo" } })
    });
    expect((await waitForStatus(app, created.json().data.id, "completed")).output).toMatchObject({
      width: 1280,
      height: 720
    });
  });
  it.each([
    ["load", "loading"],
    ["flow", "estimating-flow"],
    ["propagate", "propagating"]
  ] as const)("projects %s without publishing a completed result or a download", async (stage, phase) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    worker = await startFakeWorker({ processGate: gate, progressStage: stage });
    const app = await startApp({ VIDEO_AI_WORKER_URL: worker.url });
    try {
      const created = await app.inject({
        method: "POST",
        url: "/api/v1/tools/video-ai/tasks",
        ...multipart({ fileName: "clip.mp4", fields: { mode: "delogo" } })
      });
      const id = created.json().data.id;
      await vi.waitFor(
        async () => {
          const task = (await app.inject({ method: "GET", url: `/api/v1/tools/video-ai/tasks/${id}` })).json().data;
          expect(task).toMatchObject({ status: "running", phase, output: null });
          expect(task.progress).toBeLessThan(100);
        },
        { timeout: 4000 }
      );
    } finally {
      release();
    }
  });
  it("rejects unsupported containers before touching the queue", async () => {
    const app = await startApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/video-ai/tasks",
      ...multipart({ fileName: "notes.txt", fields: { mode: "balanced" } })
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe("UNSUPPORTED_CONTAINER");
  });

  it("rejects an unknown repair tier", async () => {
    const app = await startApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/video-ai/tasks",
      ...multipart({ fileName: "clip.mp4", fields: { mode: "ultra" } })
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe("INVALID_MODE");
  });

  it("rejects a malformed manual area", async () => {
    const app = await startApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/video-ai/tasks",
      ...multipart({ fileName: "clip.mp4", fields: { mode: "balanced", manualArea: '{"x":2}' } })
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe("INVALID_MANUAL_AREA");
  });

  it("returns 404 for unknown tasks, cancellation and outputs", async () => {
    const app = await startApp();
    const id = "missing_123456";
    for (const [method, url] of [
      ["GET", `/api/v1/tools/video-ai/tasks/${id}`],
      ["POST", `/api/v1/tools/video-ai/tasks/${id}/cancel`],
      ["GET", `/api/v1/tools/video-ai/tasks/${id}/output`]
    ] as const) {
      const response = await app.inject({ method, url });
      expect(response.statusCode).toBe(404);
    }
  });

  it("reports the worker as unavailable instead of pretending health is fine", async () => {
    const app = await startApp();
    const response = await app.inject({ method: "GET", url: "/api/v1/tools/video-ai/health" });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("VIDEO_AI_WORKER_UNAVAILABLE");
  });

  it("converts manual time ranges to frame segments at the upload boundary", async () => {
    worker = await startFakeWorker();
    const app = await startApp({ VIDEO_AI_WORKER_URL: worker.url });
    const rect = { x: 0.1, y: 0.7, width: 0.8, height: 0.1 };
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/tools/video-ai/tasks",
      ...multipart({
        fileName: "clip.mp4",
        fields: {
          mode: "delogo",
          manualRanges: JSON.stringify([{ start: 0.2, end: 0.8, rects: [rect, { ...rect, y: 0.1 }] }])
        }
      })
    });
    expect(created.statusCode).toBe(202);
    expect(created.json().data.segments).toEqual([
      { rect, startFrame: 2, endFrame: 7 },
      { rect: { ...rect, y: 0.1 }, startFrame: 2, endFrame: 7 }
    ]);
    await waitForStatus(app, created.json().data.id, "completed");
  });
  it("runs a task to completion against the worker protocol and serves the download", async () => {
    worker = await startFakeWorker();
    const app = await startApp({ VIDEO_AI_WORKER_URL: worker.url });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/tools/video-ai/tasks",
      ...multipart({ fileName: "clip.mp4", fields: { mode: "delogo" } })
    });
    expect(created.statusCode).toBe(202);
    const taskId = created.json().data.id as string;

    const completed = await waitForStatus(app, taskId, "completed");
    expect(completed.output).not.toBeNull();
    expect(completed.output.width).toBe(1280);
    expect(completed.output.height).toBe(720);

    const download = await app.inject({ method: "GET", url: `/api/v1/tools/video-ai/tasks/${taskId}/output` });
    expect(download.statusCode).toBe(200);
    expect(download.headers["content-type"]).toContain("video/mp4");

    const history = await app.inject({ method: "GET", url: "/api/v1/tools/video-ai/history" });
    expect(history.json().data.total).toBe(1);

    const removed = await app.inject({ method: "DELETE", url: `/api/v1/tools/video-ai/tasks/${taskId}` });
    expect(removed.statusCode).toBe(200);
    const gone = await app.inject({ method: "GET", url: `/api/v1/tools/video-ai/tasks/${taskId}` });
    expect(gone.statusCode).toBe(404);
  });

  it("marks the task failed when the worker rejects the job", async () => {
    worker = await startFakeWorker({ fail: true });
    const app = await startApp({ VIDEO_AI_WORKER_URL: worker.url });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/tools/video-ai/tasks",
      ...multipart({ fileName: "clip.mp4", fields: { mode: "delogo" } })
    });
    const failed = await waitForStatus(app, created.json().data.id, "failed");
    expect(failed.error).toContain("显存不足");
    expect(failed.output).toBeNull();
  });

  it("keeps actual frame progress on a late worker failure instead of displaying 100%", async () => {
    worker = await startFakeWorker({ fail: true, progressBeforeFailure: true });
    const app = await startApp({ VIDEO_AI_WORKER_URL: worker.url });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/tools/video-ai/tasks",
      ...multipart({ fileName: "clip.mp4", fields: { mode: "delogo" } })
    });
    const failed = await waitForStatus(app, created.json().data.id, "failed");
    expect(failed).toMatchObject({ progress: 98.91, processedFrames: 455, totalFrames: 460, output: null });
    expect(failed.error).toContain("显存不足");
  });
});

async function waitForStatus(
  app: App,
  taskId: string,
  status: "completed" | "failed" | "canceled" | "running",
  timeoutMs = 5000
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await app.inject({ method: "GET", url: `/api/v1/tools/video-ai/tasks/${taskId}` });
    const task = response.json().data;
    if (task.status === status) return task;
    await delay(50);
  }
  throw new Error(`task ${taskId} did not reach ${status}`);
}

function multipart(input: { fileName: string; fields: Record<string, string> }) {
  const boundary = `----toolbox-${Math.random().toString(16).slice(2)}`;
  const fieldChunks = Object.entries(input.fields).map(([name, value]) =>
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)
  );
  const content = Buffer.from("fake-video-bytes");
  const chunks = [
    ...fieldChunks,
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="video"; filename="${input.fileName}"\r\nContent-Type: video/mp4\r\n\r\n`
    ),
    content,
    Buffer.from("\r\n"),
    Buffer.from(`--${boundary}--\r\n`)
  ];
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Readable.from(chunks)
  };
}

type FakeWorker = { url: string; close: () => Promise<void> };

async function startFakeWorker(
  options: {
    fail?: boolean;
    processGate?: Promise<void>;
    passthrough?: boolean;
    progressBeforeFailure?: boolean;
    progressStage?: "load" | "flow" | "propagate";
  } = {}
): Promise<FakeWorker> {
  const server: Server = createServer((request, response) => void handle(request, response));
  const sockets = new Set<Socket>();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  async function handle(request: IncomingMessage, response: ServerResponse) {
    if (request.url === "/health" && request.method === "GET") {
      return json(response, {
        success: true,
        data: {
          protocolVersion: 1,
          available: true,
          device: "cuda",
          vramTotalMb: 8192,
          engines: [{ provider: "delogo", license: "Apache-2.0 (OpenCV)", available: true, reason: null }]
        }
      });
    }
    if (request.url === "/process" && request.method === "POST") {
      const body = await readJson(request);
      if (options.progressStage)
        await fs.writeFile(
          String(body.progress_path),
          JSON.stringify({ stage: options.progressStage, percent: 0, processedFrames: 0, totalFrames: 10 })
        );
      if (options.processGate) await options.processGate;
      if (options.fail) {
        if (options.progressBeforeFailure) {
          await fs.writeFile(
            String(body.progress_path),
            JSON.stringify({
              stage: "repair",
              percent: 98.91,
              processedFrames: 455,
              totalFrames: 460
            })
          );
          await delay(1200);
        }
        return json(response, { success: false, error: { code: "CUDA_OUT_OF_MEMORY", message: "显存不足" } }, 503);
      }
      await fs.mkdir(path.dirname(String(body.output_path)), { recursive: true });
      await fs.writeFile(String(body.output_path), "processed-video");
      await fs.writeFile(String(body.progress_path), JSON.stringify({ stage: "mux", percent: 100 }), "utf8");
      if (options.passthrough)
        return json(response, {
          success: true,
          data: { provider: "passthrough", model: null, segments: [], frameCount: 10, warnings: [] }
        });
      return json(response, {
        success: true,
        data: {
          provider: "delogo",
          model: "opencv-inpaint",
          segments: [{ x: 0, y: 0.9, width: 1, height: 0.1 }],
          frameCount: 10,
          width: 1280,
          height: 720,
          warnings: []
        }
      });
    }
    return json(response, { success: false, error: { code: "NOT_FOUND", message: "not found" } }, 404);
  }

  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      })
  };
}

function json(response: ServerResponse, payload: unknown, status = 200) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}
