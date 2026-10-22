/**
 * 中文模块说明：测试 backend/src/__tests__/image-ai.test.ts 中的稳定行为、边界条件和回归场景
 */
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../app";
import { ToolboxDatabase } from "../database/toolbox-database";
import { defaultProductImageRecipe } from "@toolbox/shared";

let storageRoot: string;
let workerServer: http.Server;
let workerUrl: string;
let app: FastifyInstance | undefined;
let beforeProcess: (() => Promise<void>) | undefined;
let failProcessAt: number | undefined;
let processCount = 0;

beforeEach(async () => {
  beforeProcess = undefined;
  failProcessAt = undefined;
  processCount = 0;
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-image-ai-"));
  workerServer = createFakeWorker();
  await new Promise<void>((resolve) => workerServer.listen(0, "127.0.0.1", resolve));
  const address = workerServer.address();
  if (!address || typeof address === "string") throw new Error("Fake worker did not bind");
  workerUrl = `http://127.0.0.1:${address.port}`;
  process.env.STORAGE_ROOT = storageRoot;
  process.env.DATABASE_PATH = path.join(storageRoot, "toolbox.db");
  process.env.IMAGE_AI_WORKER_URL = workerUrl;
  process.env.DEPLOYMENT_USAGE = "internal-noncommercial";
});

afterEach(async () => {
  await app?.close();
  app = undefined;
  await new Promise<void>((resolve) => workerServer.close(() => resolve()));
  delete process.env.STORAGE_ROOT;
  delete process.env.DATABASE_PATH;
  delete process.env.IMAGE_AI_WORKER_URL;
  delete process.env.DEPLOYMENT_USAGE;
  await fs.rm(storageRoot, { recursive: true, force: true });
});

describe("image ai api", () => {
  it("does not publish archive success when the final database write fails", async () => {
    app = await createApp();
    const source = await createHistoryTask(app, "background_remove", "database.png");
    const update = ToolboxDatabase.prototype.upsert;
    let failOnce = true;
    const spy = vi.spyOn(ToolboxDatabase.prototype, "upsert").mockImplementation(function (
      this: ToolboxDatabase,
      entity
    ) {
      if (
        failOnce &&
        entity.kind === "image-ai-task" &&
        entity.status === "completed" &&
        (entity.payload as { operation?: string }).operation === "product_image"
      ) {
        failOnce = false;
        throw new Error("simulated database write failure");
      }
      return update.call(this, entity);
    });
    try {
      const recipe = defaultProductImageRecipe();
      recipe.canvas = { width: 256, height: 256 };
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tools/image-ai/compositions",
        ...multipartPayload([], {
          taskId: source.id,
          resultId: source.results[0].id,
          recipe: JSON.stringify(recipe),
          submissionKey: "database-failure-1"
        })
      });
      const task = await waitForTask(app, response.json().data.id);
      expect(task.status).toBe("failed");
      expect(task.error).toContain("写入留档记录失败");
      expect(task.results).toEqual([]);
      expect(task.expiresAt).not.toBeNull();
      expect(await fs.readdir(path.join(storageRoot, "image-ai/outputs", task.id))).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
  it("normalizes EXIF before cutout so originals and masks share coordinates", async () => {
    app = await createApp();
    const bytes = await sharp({ create: { width: 20, height: 10, channels: 3, background: "#ff0000" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/image-ai/tasks",
      ...multipartPayload([{ field: "files", fileName: "rotated.jpg", mimeType: "image/jpeg", content: bytes }], {
        operation: "background_remove"
      })
    });
    const task = await waitForTask(app, response.json().data.id);
    expect(task.results[0]).toMatchObject({ width: 10, height: 20 });
    const source = await app.inject({ method: "GET", url: `${task.results[0].downloadUrl}/edit-source` });
    expect(source.json().data).toMatchObject({ width: 10, height: 20, canRestore: true });
  });

  it("protects source reads from concurrent deletion with a lease", async () => {
    app = await createApp();
    const source = await createHistoryTask(app, "background_remove", "lease.png");
    const target = path.join(storageRoot, "image-ai/outputs", source.id, source.results[0].outputName);
    const realpath = fs.realpath.bind(fs);
    let release!: () => void,
      entered!: () => void,
      armed = true;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
      }),
      started = new Promise<void>((resolve) => {
        entered = resolve;
      });
    const spy = vi.spyOn(fs, "realpath").mockImplementation(async (...args) => {
      if (armed && args[0] === target) {
        armed = false;
        entered();
        await gate;
      }
      return realpath(...args);
    });
    const request = app
      .inject({ method: "GET", url: `${source.results[0].downloadUrl}/edit-source` })
      .then((value) => value);
    try {
      await started;
      const removal = await app.inject({ method: "DELETE", url: `/api/v1/tools/image-ai/history/${source.id}` });
      expect(removal.statusCode).toBe(409);
    } finally {
      release();
      await request;
      spy.mockRestore();
    }
    expect(
      (await app.inject({ method: "DELETE", url: `/api/v1/tools/image-ai/history/${source.id}` })).statusCode
    ).toBe(200);
  });

  it("uses uploaded backgrounds, validates proxy masks and cancels without deleting source images", async () => {
    app = await createApp();
    const source = await createHistoryTask(app, "background_remove", "bg.png");
    const recipe = defaultProductImageRecipe();
    recipe.canvas = { width: 256, height: 256 };
    recipe.background.kind = "image";
    const fields = {
      taskId: source.id,
      resultId: source.results[0].id,
      recipe: JSON.stringify(recipe),
      submissionKey: "background-test-1"
    };
    const background = await sharp({ create: { width: 10, height: 30, channels: 3, background: "#00ff00" } })
      .png()
      .toBuffer();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/image-ai/compositions",
      ...multipartPayload(
        [{ field: "background", fileName: "bg.png", mimeType: "image/png", content: background }],
        fields
      )
    });
    expect(response.statusCode, response.body).toBe(202);
    const task = await waitForTask(app, response.json().data.id);
    expect(task.status).toBe("completed");
    const png = await app.inject({ method: "GET", url: task.results[0].downloadUrl });
    const raw = await sharp(png.rawPayload).ensureAlpha().raw().toBuffer();
    expect([...raw.subarray(0, 4)]).toEqual([0, 255, 0, 255]);
    const wrong = await app.inject({
      method: "POST",
      url: "/api/v1/tools/image-ai/compositions",
      ...multipartPayload(
        [{ field: "erase", fileName: "mask.png", mimeType: "image/png", content: await testImage(10, 10) }],
        {
          ...fields,
          recipe: JSON.stringify({ ...recipe, background: { kind: "transparent", color: "#FFFFFF" } }),
          submissionKey: "wrong-size-mask-1"
        }
      )
    });
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json().error.code).toBe("MASK_DIMENSIONS_MISMATCH");
    const pending = await app.inject({
      method: "POST",
      url: "/api/v1/tools/image-ai/compositions",
      ...multipartPayload([], {
        ...fields,
        recipe: JSON.stringify(defaultProductImageRecipe()),
        submissionKey: "cancel-product-1"
      })
    });
    const id = pending.json().data.id;
    await app.inject({ method: "DELETE", url: `/api/v1/tools/image-ai/tasks/${id}` });
    const canceled = await waitForTask(app, id);
    expect(canceled.status).toBe("canceled");
    expect(canceled.results).toEqual([]);
    expect((await app.inject({ method: "GET", url: source.results[0].downloadUrl })).statusCode).toBe(200);
    const outputs = await fs.readdir(path.join(storageRoot, "image-ai/outputs", id)).catch(() => []);
    expect(outputs).toEqual([]);
  });

  it("keeps background editing available when an old original is missing and refuses disk-starved saves", async () => {
    app = await createApp();
    const source = await createHistoryTask(app, "background_remove", "missing-original.png");
    await fs.rm(path.join(storageRoot, "image-ai/inputs", source.id), { recursive: true });
    const descriptor = await app.inject({ method: "GET", url: `${source.results[0].downloadUrl}/edit-source` });
    expect(descriptor.statusCode).toBe(200);
    expect(descriptor.json().data.canRestore).toBe(false);
    const actualStatfs = await fs.statfs(storageRoot);
    const spy = vi.spyOn(fs, "statfs").mockResolvedValue({ ...actualStatfs, bavail: 0 });
    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tools/image-ai/compositions",
        ...multipartPayload([], {
          taskId: source.id,
          resultId: source.results[0].id,
          recipe: JSON.stringify(defaultProductImageRecipe()),
          submissionKey: "disk-shortage-1"
        })
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("INSUFFICIENT_DISK_SPACE");
    } finally {
      spy.mockRestore();
    }
  });
  it("snapshots independent product edits, works without Python, deduplicates and survives source deletion and restart", async () => {
    app = await createApp();
    const source = await createHistoryTask(app, "background_remove", "product.png");
    const editSource = await app.inject({ method: "GET", url: `${source.results[0].downloadUrl}/edit-source` });
    expect(editSource.statusCode).toBe(200);
    expect(editSource.json().data.canRestore).toBe(true);
    const recipe = defaultProductImageRecipe();
    recipe.canvas = { width: 256, height: 256 };
    recipe.background = { kind: "transparent", color: "#FFFFFF" };
    const fields = {
      taskId: source.id,
      resultId: source.results[0].id,
      recipe: JSON.stringify(recipe),
      submissionKey: "independent-product-1"
    };
    const post = () =>
      app!.inject({ method: "POST", url: "/api/v1/tools/image-ai/compositions", ...multipartPayload([], fields) });
    const [response, concurrentDuplicate] = await Promise.all([post(), post()]);
    expect(response.statusCode, response.body).toBe(202);
    expect(concurrentDuplicate.statusCode, concurrentDuplicate.body).toBe(202);
    expect(concurrentDuplicate.json().data.id).toBe(response.json().data.id);
    const edited = await waitForTask(app, response.json().data.id);
    expect(edited.status, JSON.stringify(edited)).toBe("completed");
    expect(edited.results[0].provider).toBe("sharp");
    expect(processCount).toBe(1);
    expect(edited.expiresAt).toBeNull();
    expect(JSON.stringify(edited)).not.toContain(storageRoot);
    expect((await post()).json().data.id).toBe(edited.id);
    expect(
      (await app.inject({ method: "DELETE", url: `/api/v1/tools/image-ai/history/${source.id}` })).statusCode
    ).toBe(200);
    await app.close();
    app = await createApp();
    const continued = await app.inject({ method: "GET", url: `${edited.results[0].downloadUrl}/edit-source` });
    expect(continued.statusCode, continued.body).toBe(200);
    expect(continued.json().data.canRestore).toBe(true);
    const png = await app.inject({ method: "GET", url: edited.results[0].downloadUrl });
    expect((await sharp(png.rawPayload).metadata()).width).toBe(256);
    expect((await app.inject({ method: "GET", url: `${edited.results[0].downloadUrl}?format=jpeg` })).statusCode).toBe(
      400
    );
    const jpg = await app.inject({ method: "GET", url: `${edited.results[0].downloadUrl}?format=jpeg&flatten=white` });
    expect(jpg.headers["content-type"]).toContain("image/jpeg");
    expect((await sharp(jpg.rawPayload).metadata()).format).toBe("jpeg");
  });

  it("rejects invalid recipes, arbitrary attachments and direct product requests through the Python endpoint", async () => {
    app = await createApp();
    const source = await createHistoryTask(app, "background_remove", "source.png");
    const fields = {
      taskId: source.id,
      resultId: source.results[0].id,
      recipe: JSON.stringify({ ...defaultProductImageRecipe(), path: "C:/secret" }),
      submissionKey: "invalid-product-1"
    };
    const invalid = await app.inject({
      method: "POST",
      url: "/api/v1/tools/image-ai/compositions",
      ...multipartPayload([], fields)
    });
    expect(invalid.statusCode).toBe(400);
    const unknown = await app.inject({
      method: "POST",
      url: "/api/v1/tools/image-ai/compositions",
      ...multipartPayload(
        [{ field: "command", fileName: "x.png", mimeType: "image/png", content: await testImage(20, 20) }],
        fields
      )
    });
    expect(unknown.statusCode).toBe(400);
    const direct = await app.inject({
      method: "POST",
      url: "/api/v1/tools/image-ai/tasks",
      ...multipartPayload([], { operation: "product_image" })
    });
    expect(direct.statusCode).toBe(400);
    expect(processCount).toBe(1);
    expect(await fs.readdir(path.join(storageRoot, "image-ai/inputs"))).toEqual([source.id]);
  });
  it("persists queued and running images as interrupted and never auto-runs them on restart", async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const processCall = vi.fn(() => blocked);
    beforeProcess = processCall;
    app = await createApp();
    const ids: string[] = [];
    try {
      for (let n = 0; n < 2; n++) {
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/tools/image-ai/tasks",
          ...multipartPayload(
            [
              { field: "files", fileName: `retained-${n}.png`, mimeType: "image/png", content: await testImage(20, 20) }
            ],
            { operation: "background_remove" }
          )
        });
        expect(response.statusCode).toBe(202);
        ids.push(response.json().data.id);
      }
      await vi.waitFor(() => expect(processCall).toHaveBeenCalledTimes(1));
      for (const id of ids) {
        const removal = await app.inject({ method: "DELETE", url: `/api/v1/tools/image-ai/history/${id}` });
        expect(removal.statusCode).toBe(409);
        expect(removal.json().error.code).toBe("IMAGE_AI_TASK_BUSY");
      }
      await app.close();
      release();
      beforeProcess = undefined;
      app = await createApp();
      for (const id of ids) {
        const response = await app.inject({ method: "GET", url: `/api/v1/tools/image-ai/tasks/${id}` });
        expect(response.json().data).toMatchObject({
          status: "failed",
          error: expect.stringMatching(/应用退出|服务关闭/)
        });
      }
      expect(processCall).toHaveBeenCalledTimes(1);
    } finally {
      release();
    }
  });
  it("reports local worker model and license health", async () => {
    app = await createApp();
    const response = await app.inject({ method: "GET", url: "/api/v1/tools/image-ai/health" });

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

    const response = await app.inject({ method: "GET", url: "/api/v1/tools/image-ai/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.available).toBe(true);
  }, 10000);

  it("returns normalized watermark suggestions without OCR text", async () => {
    app = await createApp();
    const image = await testImage(80, 60);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/image-ai/watermark/suggestions",
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
      url: "/api/v1/tools/image-ai/tasks",
      ...multipartPayload([{ field: "files", fileName: "product.png", mimeType: "image/png", content: image }], {
        operation: "enhance",
        scale: "2"
      })
    });

    expect(createResponse.statusCode).toBe(202);
    const taskId = createResponse.json().data.id as string;
    const unifiedTaskResponse = await app.inject({ method: "GET", url: `/api/v1/tasks/${taskId}` });
    expect(unifiedTaskResponse.statusCode).toBe(200);
    expect(unifiedTaskResponse.json().data).toMatchObject({ id: taskId, toolId: "image-ai" });
    const task = await waitForTask(app, taskId);
    expect(task.status).toBe("completed");
    expect(task.results[0]).toMatchObject({
      originalName: "product.png",
      width: 160,
      height: 120,
      provider: "real-esrgan",
      model: "RealESRGAN_x2plus"
    });
    const database = new ToolboxDatabase(path.join(storageRoot, "toolbox.db"));
    const storedTask = database.get("image-ai-task", taskId)?.payload;
    database.close();
    expect(storedTask).toMatchObject({ id: taskId, status: "completed" });

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
    expect(downloadResponse.headers["content-disposition"]).toContain("product-1-enhanced.png");

    const zipResponse = await app.inject({
      method: "GET",
      url: `/api/v1/tools/image-ai/tasks/${taskId}/download.zip`
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
    })
      .png()
      .toBuffer();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/image-ai/tasks",
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

  it("lists retained results with safe pagination, filters and original-image previews", async () => {
    app = await createApp();
    const enhance = await createHistoryTask(app, "enhance", "product-large.png");
    const cutout = await createHistoryTask(app, "background_remove", "product-cutout.png");
    expect(enhance.expiresAt).toBeNull();
    const first = await app.inject({ method: "GET", url: "/api/v1/tools/image-ai/history?page=1&pageSize=1" });
    expect(first.statusCode).toBe(200);
    expect(first.json().data).toMatchObject({ total: 2, page: 1, pageSize: 1 });
    const second = await app.inject({ method: "GET", url: "/api/v1/tools/image-ai/history?page=2&pageSize=1" });
    expect(second.json().data.items[0].id).not.toBe(first.json().data.items[0].id);
    const filtered = await app.inject({
      method: "GET",
      url: "/api/v1/tools/image-ai/history?operation=background_remove&status=completed&keyword=PRODUCT-CUTOUT"
    });
    expect(filtered.json().data.items.map((item: { id: string }) => item.id)).toEqual([cutout.id]);
    expect(filtered.body).not.toContain(storageRoot);
    expect(filtered.body).not.toContain("outputPath");
    expect(filtered.body).not.toContain("input-0.bin");
    const original = await app.inject({ method: "GET", url: `/api/v1/tools/image-ai/tasks/${cutout.id}/inputs/1` });
    expect(original.statusCode).toBe(200);
    expect(original.headers["content-type"]).toContain("image/png");
    expect((await sharp(original.rawPayload).metadata()).width).toBe(20);
    const thumbnail = await app.inject({ method: "GET", url: `${cutout.results[0].downloadUrl}/thumbnail` });
    expect(thumbnail.statusCode).toBe(200);
    expect((await sharp(thumbnail.rawPayload).metadata()).format).toBe("webp");
    expect((await sharp(thumbnail.rawPayload).metadata()).width).toBeLessThanOrEqual(160);
    expect(filtered.json().data.items[0].inputs[0]).toMatchObject({
      originalName: "product-cutout.png",
      width: 20,
      height: 20
    });
    for (const query of [
      "page=0",
      "pageSize=51",
      "operation=unknown",
      "status=unknown",
      `keyword=${"x".repeat(101)}`
    ]) {
      expect((await app.inject({ method: "GET", url: `/api/v1/tools/image-ai/history?${query}` })).statusCode).toBe(
        400
      );
    }
    for (const index of ["0", "11", "bad"])
      expect(
        (await app.inject({ method: "GET", url: `/api/v1/tools/image-ai/tasks/${cutout.id}/inputs/${index}` }))
          .statusCode
      ).toBe(400);
  });

  it("preserves old and partially successful results across restart and cleans only result-less expired tasks", async () => {
    app = await createApp();
    failProcessAt = 2;
    const partial = await createHistoryTask(app, "background_remove", "partial.png", 2);
    expect(partial.status).toBe("completed");
    expect(partial.results).toHaveLength(1);
    expect(partial.expiresAt).toBeNull();
    await app.close();
    app = undefined;
    const database = new ToolboxDatabase(path.join(storageRoot, "toolbox.db"));
    const entity = database.get("image-ai-task", partial.id)!;
    const payload = entity.payload as Record<string, unknown>;
    database.upsert({ ...entity, payload: { ...payload, expiresAt: "2020-01-01T00:00:00Z" } });
    database.upsert({
      ...entity,
      id: "expired-empty",
      status: "failed",
      payload: {
        ...payload,
        id: "expired-empty",
        status: "failed",
        results: [],
        inputs: [],
        expiresAt: "2020-01-01T00:00:00Z"
      }
    });
    database.close();
    app = await createApp();
    const retained = await app.inject({ method: "GET", url: `/api/v1/tools/image-ai/tasks/${partial.id}` });
    expect(retained.json().data.expiresAt).toBeNull();
    expect((await app.inject({ method: "GET", url: partial.results[0].downloadUrl })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/v1/tools/image-ai/tasks/expired-empty" })).statusCode).toBe(
      404
    );
    expect((await app.inject({ method: "GET", url: "/api/v1/tools/image-ai/history" })).json().data.total).toBe(1);
  });

  it("deletes only the selected task's inputs, mask, results and metadata and does not resurrect it", async () => {
    app = await createApp();
    const owned = await createHistoryTask(app, "watermark_remove", "owned.png");
    const sibling = await createHistoryTask(app, "background_remove", "sibling.png");
    const legacyFile = path.join(storageRoot, "image-ai/tasks", `${owned.id}.json`);
    await fs.writeFile(legacyFile, JSON.stringify(owned));
    const response = await app.inject({ method: "DELETE", url: `/api/v1/tools/image-ai/history/${owned.id}` });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({ id: owned.id, deleted: true });
    for (const target of [
      path.join(storageRoot, "image-ai/inputs", owned.id),
      path.join(storageRoot, "image-ai/outputs", owned.id),
      legacyFile
    ])
      await expect(fs.stat(target)).rejects.toMatchObject({ code: "ENOENT" });
    expect((await app.inject({ method: "GET", url: sibling.results[0].downloadUrl })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: owned.results[0].downloadUrl })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: `/api/v1/tasks/${owned.id}` })).statusCode).toBe(404);
    const database = new ToolboxDatabase(path.join(storageRoot, "toolbox.db"));
    expect(database.get("image-ai-task", owned.id)).toBeUndefined();
    expect(database.listFiles({ entityId: owned.id })).toHaveLength(0);
    database.close();
    await app.close();
    app = await createApp();
    expect((await app.inject({ method: "GET", url: `/api/v1/tools/image-ai/tasks/${owned.id}` })).statusCode).toBe(404);
    expect(
      (await app.inject({ method: "GET", url: "/api/v1/tools/image-ai/history" }))
        .json()
        .data.items.map((item: { id: string }) => item.id)
    ).toEqual([sibling.id]);
    expect((await app.inject({ method: "DELETE", url: `/api/v1/tools/image-ai/history/${owned.id}` })).statusCode).toBe(
      404
    );
  });

  it("keeps the history identity on file deletion failure and allows an explicit retry", async () => {
    app = await createApp();
    const task = await createHistoryTask(app, "background_remove", "retry-delete.png");
    const target = path.join(storageRoot, "image-ai/outputs", task.id);
    const originalRemove = fs.rm.bind(fs);
    const blocked = vi.spyOn(fs, "rm").mockImplementation(async (...args) => {
      if (args[0] === target) throw Object.assign(new Error("file locked"), { code: "EPERM" });
      return originalRemove(...args);
    });
    try {
      const response = await app.inject({ method: "DELETE", url: `/api/v1/tools/image-ai/history/${task.id}` });
      expect(response.statusCode).toBe(500);
      expect(response.json().error.code).toBe("IMAGE_AI_DELETE_FAILED");
      expect((await app.inject({ method: "GET", url: `/api/v1/tools/image-ai/tasks/${task.id}` })).statusCode).toBe(
        200
      );
    } finally {
      blocked.mockRestore();
    }
    expect((await app.inject({ method: "DELETE", url: `/api/v1/tools/image-ai/history/${task.id}` })).statusCode).toBe(
      200
    );
  });

  it("rejects spoofed filenames even when the bytes are a valid image", async () => {
    app = await createApp();
    const image = await testImage(20, 20);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tools/image-ai/tasks",
      ...multipartPayload([{ field: "files", fileName: "payload.txt", mimeType: "image/png", content: image }], {
        operation: "background_remove"
      })
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("UNSUPPORTED_IMAGE_EXTENSION");
  });

  it("validates task and result route parameters before storage access", async () => {
    app = await createApp();
    const invalidTask = await app.inject({ method: "GET", url: "/api/v1/tools/image-ai/tasks/bad!" });
    const invalidDownload = await app.inject({
      method: "GET",
      url: "/api/v1/tools/image-ai/tasks/abcdef/files/abcdef-1?download=2"
    });

    expect(invalidTask.statusCode).toBe(400);
    expect(invalidTask.json()).toMatchObject({
      success: false,
      error: { code: "REQUEST_INVALID" },
      requestId: expect.any(String)
    });
    expect(invalidDownload.statusCode).toBe(400);
    expect(invalidDownload.json().error.code).toBe("REQUEST_INVALID");
  });

  it("applies independent rate limits to expensive task creation", async () => {
    app = await createApp();
    let response;
    for (let requestNumber = 0; requestNumber < 21; requestNumber += 1) {
      response = await app.inject({ method: "POST", url: "/api/v1/tools/image-ai/tasks" });
    }

    expect(response?.statusCode).toBe(429);
    expect(response?.json()).toMatchObject({
      success: false,
      error: { code: "RATE_LIMIT_EXCEEDED" },
      requestId: expect.any(String)
    });
  });
});

function createFakeWorker(options: { healthDelayMs?: number } = {}) {
  return http.createServer(async (request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.url === "/health") {
      if (options.healthDelayMs) await new Promise((resolve) => setTimeout(resolve, options.healthDelayMs));
      response.end(
        JSON.stringify({
          success: true,
          data: {
            protocolVersion: 1,
            available: true,
            deploymentUsage: "internal-noncommercial",
            workerUrl,
            models: [
              {
                provider: "lama",
                model: "big-lama",
                version: "test",
                license: "Apache-2.0",
                device: "cpu",
                available: true
              }
            ]
          }
        })
      );
      return;
    }

    const body = JSON.parse(await readBody(request)) as {
      input_path: string;
      output_path: string;
      operation?: string;
      scale?: number | string;
      deployment_usage?: string;
    };
    if (request.url === "/watermark/suggestions") {
      response.end(
        JSON.stringify({
          success: true,
          data: {
            width: 80,
            height: 60,
            suggestions: [
              {
                polygon: [
                  { x: 0.1, y: 0.1 },
                  { x: 0.4, y: 0.1 },
                  { x: 0.4, y: 0.2 },
                  { x: 0.1, y: 0.2 }
                ],
                confidence: 0.9
              }
            ],
            provider: "paddleocr",
            model: "PP-OCRv5",
            warnings: []
          }
        })
      );
      return;
    }

    if (request.url === "/process") {
      await beforeProcess?.();
      if (response.destroyed) return;
      processCount += 1;
      if (processCount === failProcessAt) {
        response.statusCode = 500;
        response.end(
          JSON.stringify({ success: false, error: { code: "TEST_FAILURE", message: "simulated partial failure" } })
        );
        return;
      }
      const metadata = await sharp(body.input_path).metadata();
      const scale = body.operation === "enhance" ? Number(body.scale || 2) : 1;
      await sharp(body.input_path)
        .resize({ width: (metadata.width || 1) * scale, height: (metadata.height || 1) * scale })
        .png()
        .toFile(body.output_path);
      response.end(
        JSON.stringify({
          success: true,
          data: {
            provider:
              body.operation === "enhance"
                ? "real-esrgan"
                : body.operation === "watermark_remove"
                  ? "lama"
                  : "birefnet-general",
            model: body.operation === "enhance" ? `RealESRGAN_x${scale}plus` : "test-model",
            warnings: []
          }
        })
      );
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

async function createHistoryTask(
  instance: FastifyInstance,
  operation: "enhance" | "background_remove" | "watermark_remove",
  filename: string,
  count = 1
) {
  const image = await testImage(20, 20);
  const files = Array.from({ length: count }, () => ({
    field: "files",
    fileName: filename,
    mimeType: "image/png",
    content: image
  }));
  if (operation === "watermark_remove")
    files.push({ field: "mask", fileName: "mask.png", mimeType: "image/png", content: image });
  const response = await instance.inject({
    method: "POST",
    url: "/api/v1/tools/image-ai/tasks",
    ...multipartPayload(files, { operation, scale: "2" })
  });
  expect(response.statusCode).toBe(202);
  return waitForTask(instance, response.json().data.id);
}

async function waitForTask(instance: FastifyInstance, taskId: string) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const response = await instance.inject({ method: "GET", url: `/api/v1/tools/image-ai/tasks/${taskId}` });
    const task = response.json().data;
    if (!["pending", "running"].includes(task.status)) return task;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for image AI task");
}

function testImage(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: "#2563eb" } })
    .png()
    .toBuffer();
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
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.fileName}"\r\nContent-Type: ${file.mimeType}\r\n\r\n`
      ),
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
