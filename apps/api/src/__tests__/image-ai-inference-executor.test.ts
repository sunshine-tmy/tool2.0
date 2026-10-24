import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getConfig, type AppConfig } from "../config";
import { ToolboxDatabase } from "../database/toolbox-database";
import { FileMetadataRepository } from "../database/file-metadata";
import { createTaskStore } from "../tasks/task-store";
import { createImageAiInferenceExecutor } from "../domains/image-ai/inference-executor";
import { createImageAiTaskPersistence } from "../domains/image-ai/task-persistence";
import type { createImageAiWorkerClient } from "../domains/image-ai/worker-client";
import type { StoredImageAiTask } from "../domains/image-ai/types";
import { createIsolatedAppFixture } from "./helpers/isolated-app";

type ProcessInput = Parameters<ReturnType<typeof createImageAiWorkerClient>["process"]>[0];
type Terminal = Parameters<ReturnType<typeof createImageAiTaskPersistence>["commitTerminal"]>[1];
let fixture: Awaited<ReturnType<typeof createIsolatedAppFixture>>;
let config: AppConfig;
let database: ToolboxDatabase;
let metadata: FileMetadataRepository;
let controller: AbortController;
let execute: ReturnType<typeof createImageAiInferenceExecutor>;
const process = vi.fn(async (input: ProcessInput) => {
  await sharp(input.inputPath).png().withMetadata().toFile(input.outputPath);
  return { provider: "birefnet-general" as const, model: "synthetic", warnings: ["same", "same", ""] };
});
const compose = vi.fn(async (_task: StoredImageAiTask) => undefined);
const patch = vi.fn((task: StoredImageAiTask, next: Partial<StoredImageAiTask>) => {
  Object.assign(task, next);
});
const persist = vi.fn<ReturnType<typeof createImageAiTaskPersistence>["persist"]>();
const finish = vi.fn<(task: StoredImageAiTask, terminal: Terminal) => void>();
const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

beforeEach(async () => {
  vi.resetAllMocks();
  fixture = await createIsolatedAppFixture();
  config = getConfig({ layout: fixture.layout, dotenvPath: false, environment: { NODE_ENV: "test" } });
  database = new ToolboxDatabase(":memory:");
  metadata = new FileMetadataRepository(database, fixture.layout.storageRoot);
  controller = new AbortController();
  const persistence = createImageAiTaskPersistence(config, database, createTaskStore(1000, database), {
    patchTask: patch,
    rememberTask: () => {
      throw new Error("Unexpected restore");
    },
    refreshQueuePositions: () => undefined
  });
  persist.mockImplementation(persistence.persist);
  finish.mockImplementation(persistence.commitTerminal);
  execute = createImageAiInferenceExecutor(
    config,
    { process },
    controller,
    {
      patchTask: patch,
      persist,
      unique,
      processComposition: compose,
      finishInference: finish
    },
    metadata
  );
});
afterEach(async () => {
  vi.restoreAllMocks();
  database.close();
  await fixture.dispose();
});

async function task(names = ["商品.png"]): Promise<StoredImageAiTask> {
  const directory = path.join(config.imageAiInputsDir, "infer-001");
  await fs.mkdir(directory, { recursive: true });
  const inputs = [];
  for (const [index, originalName] of names.entries()) {
    const file = path.join(directory, `${index}.png`);
    await sharp({ create: { width: 6, height: 4, channels: 3, background: "#2563eb" } })
      .png()
      .toFile(file);
    inputs.push({ path: file, originalName, mimetype: "image/png", size: 1, width: 6, height: 4 });
  }
  return {
    id: "infer-001",
    operation: "background_remove",
    status: "pending",
    progress: 0,
    queuePosition: 1,
    inputs,
    results: [],
    warnings: ["same"],
    scale: 2,
    maskPath: path.join(directory, "mask.png"),
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    expiresAt: "2099-01-01T00:00:00Z"
  };
}

it("constructs without I/O or eagerly calling the worker, persistence or composition", () => {
  const mkdir = vi.spyOn(fs, "mkdir");
  createImageAiInferenceExecutor(config, { process }, controller, {
    patchTask: patch,
    persist,
    unique,
    processComposition: compose,
    finishInference: finish
  });
  expect(mkdir).not.toHaveBeenCalled();
  expect(process).not.toHaveBeenCalled();
  expect(persist).not.toHaveBeenCalled();
  expect(compose).not.toHaveBeenCalled();
});

it("delegates product images to the original composition callback without entering inference", async () => {
  const record = await task();
  record.operation = "product_image";
  await execute(record);
  expect(compose).toHaveBeenCalledExactlyOnceWith(record);
  expect(process).not.toHaveBeenCalled();
  expect(patch).not.toHaveBeenCalled();
  expect(persist).not.toHaveBeenCalled();
  expect(finish).not.toHaveBeenCalled();
});

it.each(["enhance", "watermark_remove", "background_remove"] as const)(
  "keeps %s request, PNG commit, metadata and terminal order",
  async (operation) => {
    const record = await task();
    record.operation = operation;
    const saved: Array<{ status: string; progress: number; count: number }> = [];
    const save = persist.getMockImplementation()!;
    persist.mockImplementation(async (value) => {
      saved.push({ status: value.status, progress: value.progress, count: value.results.length });
      await save(value);
    });
    await execute(record);
    expect(record).toMatchObject({ status: "completed", progress: 100, expiresAt: null, warnings: ["same"] });
    expect(saved).toEqual([
      { status: "running", progress: 5, count: 0 },
      { status: "running", progress: 95, count: 1 }
    ]);
    expect(process).toHaveBeenCalledExactlyOnceWith({
      operation,
      inputPath: record.inputs[0].path,
      outputPath: record.results[0].outputPath,
      maskPath: record.maskPath,
      scale: 2,
      signal: controller.signal
    });
    expect(finish).toHaveBeenCalledExactlyOnceWith(record, { status: "completed", progress: 100 });
    const result = record.results[0],
      png = await sharp(result.outputPath).metadata();
    expect(result).toMatchObject({
      id: "infer-001-1",
      width: 6,
      height: 4,
      warnings: ["same", "same", ""],
      downloadUrl: "/api/v1/tools/image-ai/tasks/infer-001/files/infer-001-1"
    });
    expect(png.format).toBe("png");
    expect(png.exif).toBeUndefined();
    expect(png.icc).toBeUndefined();
    expect(await fs.readdir(path.dirname(result.outputPath))).toEqual([result.outputName]);
    expect(metadata.list("image-ai-result", record.id)).toHaveLength(1);
  }
);

it.each([
  ["中文 名称.png", "中文-名称-1-cutout.png"],
  ['商品"\n名.png', "商品-名-1-cutout.png"],
  ["x".repeat(100) + ".png", "x".repeat(80) + "-1-cutout.png"],
  ["", "image-1-1-cutout.png"],
  ["name...png", "name..-1-cutout.png"]
])("retains the original filename mapping for %j", async (originalName, outputName) => {
  const record = await task([originalName]);
  await execute(record);
  expect(record.results[0].outputName).toBe(outputName);
  expect(record.results[0].originalName).toBe(originalName);
});

it("keeps partial failures, original input indexes and permanent successful outputs", async () => {
  const record = await task(["bad.png", "good.png"]);
  process.mockRejectedValueOnce(new Error("synthetic failure"));
  await execute(record);
  expect(record).toMatchObject({ status: "completed", expiresAt: null });
  expect(record.results).toHaveLength(1);
  expect(record.results[0]).toMatchObject({
    id: "infer-001-2",
    originalName: "good.png",
    outputName: "good-2-cutout.png"
  });
  expect(record.warnings).toEqual(["same", "bad.png：synthetic failure", "1 张图片处理失败"]);
});

it("keeps non-Error failures temporary and preserves the existing public failure message", async () => {
  const record = await task();
  process.mockRejectedValueOnce("opaque failure");
  await execute(record);
  expect(record).toMatchObject({
    status: "failed",
    results: [],
    error: "所有图片均处理失败，请检查本地模型与推理服务状态"
  });
  expect(record.expiresAt).not.toBeNull();
  expect(record.warnings).toContain("商品.png：处理失败");
});

it("stops before the first image when cancellation is already requested", async () => {
  const record = await task();
  record.cancelRequested = true;
  await execute(record);
  expect(record).toMatchObject({ status: "canceled", progress: 100, results: [] });
  expect(record.expiresAt).not.toBeNull();
  expect(process).not.toHaveBeenCalled();
});

it("routes shutdown interruption through the original protected terminal callback", async () => {
  const record = await task();
  process.mockImplementationOnce(async () => {
    controller.abort();
    throw new Error("interrupted");
  });
  await execute(record);
  expect(record).toMatchObject({ status: "failed", progress: 100, error: "任务因服务关闭而中断，请手动重试" });
  expect(finish).toHaveBeenCalledTimes(1);
  expect(record.results).toEqual([]);
});

it("keeps metadata registration failure nonfatal without deleting its generated result", async () => {
  const record = await task();
  vi.spyOn(metadata, "registerIfExists").mockRejectedValue(new Error("synthetic metadata failure"));
  await execute(record);
  expect(record.status).toBe("completed");
  expect(await fs.stat(record.results[0].outputPath)).toMatchObject({ size: expect.any(Number) });
});

it("reads the output directory from the original config object at execution time", async () => {
  const record = await task();
  config.imageAiOutputsDir = path.join(fixture.layout.storageRoot, "late-output-directory");
  await execute(record);
  expect(path.dirname(record.results[0].outputPath)).toBe(path.join(config.imageAiOutputsDir, record.id));
});
