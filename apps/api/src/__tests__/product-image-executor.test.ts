import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defaultProductImageRecipe } from "@toolbox/shared";
import { getConfig, type AppConfig } from "../config";
import { ToolboxDatabase } from "../database/toolbox-database";
import { FileMetadataRepository } from "../database/file-metadata";
import { createTaskStore } from "../tasks/task-store";
import { createImageAiTaskPersistence } from "../domains/image-ai/task-persistence";
import { createProductImageExecutor } from "../domains/image-ai/product-image-executor";
import { renderProductImage } from "../domains/image-ai/product-image-renderer";
import type { StoredImageAiTask } from "../domains/image-ai/types";
import { createIsolatedAppFixture } from "./helpers/isolated-app";

vi.mock("../domains/image-ai/product-image-renderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../domains/image-ai/product-image-renderer")>()),
  renderProductImage: vi.fn()
}));

let fixture: Awaited<ReturnType<typeof createIsolatedAppFixture>>;
let config: AppConfig;
let database: ToolboxDatabase;
let metadata: FileMetadataRepository;
let controller: AbortController;
let execute: ReturnType<typeof createProductImageExecutor>;
const patch = vi.fn((task: StoredImageAiTask, next: Partial<StoredImageAiTask>) => Object.assign(task, next));
const persist = vi.fn<ReturnType<typeof createImageAiTaskPersistence>["persist"]>();
const render = vi.mocked(renderProductImage);

beforeEach(async () => {
  vi.resetAllMocks();
  fixture = await createIsolatedAppFixture();
  config = getConfig({ layout: fixture.layout, dotenvPath: false, environment: { NODE_ENV: "test" } });
  database = new ToolboxDatabase(":memory:");
  metadata = new FileMetadataRepository(database, fixture.layout.storageRoot);
  controller = new AbortController();
  // initialize() owns this directory in production; direct adapter tests reproduce that precondition.
  await fs.mkdir(config.imageAiOutputsDir, { recursive: true });
  const persistence = createImageAiTaskPersistence(config, database, createTaskStore(1000, database), {
    patchTask: patch,
    rememberTask: () => undefined,
    refreshQueuePositions: () => undefined
  });
  persist.mockImplementation(persistence.persist);
  render.mockImplementation(async (assets, _recipe, output, phase) => {
    phase("应用精修");
    phase("计算布局");
    phase("合成图片");
    await sharp(assets.foreground).png().toFile(output);
    return { enlarged: false };
  });
  execute = createProductImageExecutor(config, controller, { patchTask: patch, persist }, metadata);
});

afterEach(async () => {
  vi.restoreAllMocks();
  database.close();
  await fixture.dispose();
});

async function task(): Promise<StoredImageAiTask> {
  const directory = path.join(config.imageAiInputsDir, "product-exec-001");
  await fs.mkdir(directory, { recursive: true });
  const foreground = path.join(directory, "foreground.png");
  await sharp({ create: { width: 8, height: 6, channels: 4, background: "#ff0000" } })
    .png()
    .toFile(foreground);
  const recipe = defaultProductImageRecipe();
  recipe.canvas = { width: 256, height: 256 };
  return {
    id: "product-exec-001",
    operation: "product_image",
    status: "pending",
    progress: 0,
    queuePosition: 1,
    results: [],
    warnings: [],
    inputs: [{ path: foreground, originalName: "商品.png", mimetype: "image/png", size: 1, width: 8, height: 6 }],
    recipe,
    assets: { foreground },
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    expiresAt: "2099-01-01T00:00:00Z"
  };
}
const output = (record: StoredImageAiTask) => path.join(config.imageAiOutputsDir, record.id, "product.png");

it("constructs without I/O, rendering or persistence", () => {
  const mkdir = vi.spyOn(fs, "mkdir");
  createProductImageExecutor(config, controller, { patchTask: patch, persist });
  expect(mkdir).not.toHaveBeenCalled();
  expect(render).not.toHaveBeenCalled();
  expect(persist).not.toHaveBeenCalled();
});

it.each([false, true])("preserves phases, commit-before-registration and enlarged=%s result", async (enlarged) => {
  const record = await task();
  const renderer = render.getMockImplementation()!;
  render.mockImplementation(async (...args) => ({ ...(await renderer(...args)), enlarged }));
  const register = metadata.registerIfExists.bind(metadata);
  vi.spyOn(metadata, "registerIfExists").mockImplementation(async (input) => {
    expect(record.status).toBe("running");
    expect(record.results).toEqual([]);
    expect(await fs.stat(input.filePath)).toMatchObject({ size: expect.any(Number) });
    expect(await fs.readdir(path.dirname(input.filePath))).toEqual(["product.png"]);
    return register(input);
  });
  const save = persist.getMockImplementation()!;
  persist.mockImplementation(async (value) => {
    if (value.status === "completed") {
      expect(await fs.readdir(path.dirname(output(record)))).toEqual(["product.png"]);
      expect(metadata.list("image-ai-result", record.id)).toHaveLength(1);
    }
    await save(value);
  });
  await execute(record);
  expect(patch.mock.calls.map(([, value]) => value.phase)).toEqual([
    "准备素材",
    "应用精修",
    "计算布局",
    "合成图片",
    "保存记录",
    "已留档"
  ]);
  expect(record).toMatchObject({ status: "completed", progress: 100, expiresAt: null, queuePosition: null });
  expect(record.results[0]).toMatchObject({
    id: `${record.id}-1`,
    originalName: "商品.png",
    outputName: "product.png",
    outputPath: output(record),
    downloadUrl: `/api/v1/tools/image-ai/tasks/${record.id}/files/${record.id}-1`,
    width: 256,
    height: 256,
    provider: "sharp",
    model: "商品图渲染器 v1",
    warnings: enlarged ? ["商品经过普通插值放大，不等同于 AI 清晰度增强"] : []
  });
  expect(database.get("image-ai-task", record.id)?.payload).toMatchObject({ status: "completed", expiresAt: null });
});

it.each(["recipe", "assets"] as const)("keeps missing %s failure private and temporary", async (key) => {
  const record = await task();
  delete record[key];
  await execute(record);
  expect(record).toMatchObject({ status: "failed", results: [], phase: "保存失败" });
  expect(record.error).toBe("商品图保存失败，请检查素材是否完整、磁盘空间及目录访问权限");
  expect(record.expiresAt).not.toBeNull();
  expect(render).not.toHaveBeenCalled();
});

it("retains controlled-path validation before rendering", async () => {
  const record = await task();
  record.assets!.foreground = path.join(fixture.root, "outside.png");
  await fs.writeFile(record.assets!.foreground, "not an image");
  await execute(record);
  expect(record.status).toBe("failed");
  expect(render).not.toHaveBeenCalled();
  expect(await fs.readFile(record.assets!.foreground, "utf8")).toBe("not an image");
});

it.each([
  [Object.assign(new Error("private path"), { code: "ENOSPC" }), "磁盘空间不足，请先释放空间"],
  [new Error("没有可见商品主体，请调整精修"), "没有可见商品主体，请调整精修"],
  [new Error("原图缺失，请重新上传"), "原图缺失，请重新上传"],
  [new Error("请选择背景图片"), "请选择背景图片"],
  [new Error("可用磁盘空间不足"), "可用磁盘空间不足"],
  ["opaque failure", "商品图保存失败，请检查素材是否完整、磁盘空间及目录访问权限"]
])("preserves rendering failure mapping for %j", async (failure, message) => {
  const record = await task();
  render.mockRejectedValueOnce(failure);
  await execute(record);
  expect(record).toMatchObject({ status: "failed", results: [], error: message });
  expect(record.expiresAt).not.toBeNull();
  expect(await fs.readdir(path.dirname(output(record)))).toEqual([]);
});

it.each(["cancel", "shutdown"])("discards staging after %s during rendering without deleting inputs", async (kind) => {
  const record = await task();
  const renderer = render.getMockImplementation()!;
  render.mockImplementationOnce(async (...args) => {
    const result = await renderer(...args);
    if (kind === "cancel") record.cancelRequested = true;
    else controller.abort();
    return result;
  });
  await execute(record);
  expect(record).toMatchObject({ status: "canceled", phase: "已取消", results: [] });
  expect(record.expiresAt).not.toBeNull();
  expect(await fs.readdir(path.dirname(output(record)))).toEqual([]);
  expect(await fs.stat(record.inputs[0].path)).toMatchObject({ size: expect.any(Number) });
});

it("rechecks cancellation after metadata registration and removes the committed output", async () => {
  const record = await task();
  const register = metadata.registerIfExists.bind(metadata);
  vi.spyOn(metadata, "registerIfExists").mockImplementation(async (input) => {
    const result = await register(input);
    record.cancelRequested = true;
    return result;
  });
  await execute(record);
  expect(record).toMatchObject({ status: "canceled", phase: "已取消", results: [] });
  expect(metadata.list("image-ai-result", record.id)).toEqual([]);
  expect(await fs.readdir(path.dirname(output(record)))).toEqual([]);
});

it("keeps registration failure fatal for composition and removes its committed file", async () => {
  const record = await task();
  vi.spyOn(metadata, "registerIfExists").mockRejectedValueOnce(new Error("synthetic registration failure"));
  await execute(record);
  expect(record.status).toBe("failed");
  expect(record.results).toEqual([]);
  expect(await fs.readdir(path.dirname(output(record)))).toEqual([]);
});

it("rolls back output and expiry on terminal persistence failure, preserving the existing retry", async () => {
  const record = await task();
  const expiry = record.expiresAt;
  const save = persist.getMockImplementation()!;
  persist.mockImplementation(async (value) => {
    if (value.status === "completed") throw new Error("synthetic final write failure");
    await save(value);
  });
  await execute(record);
  expect(record).toMatchObject({
    status: "failed",
    phase: "保存失败",
    results: [],
    expiresAt: expiry,
    error: "写入留档记录失败，请检查数据库及磁盘空间后重试"
  });
  expect(metadata.list("image-ai-result", record.id)).toEqual([]);
  expect(await fs.readdir(path.dirname(output(record)))).toEqual([]);
  expect(database.get("image-ai-task", record.id)?.status).toBe("failed");
});

it("propagates the initial running write failure before file operations", async () => {
  const record = await task();
  const failure = new Error("synthetic initial write failure");
  persist.mockRejectedValueOnce(failure);
  await expect(execute(record)).rejects.toBe(failure);
  expect(render).not.toHaveBeenCalled();
  expect(record.status).toBe("running");
});

it.each(["output", "staging", "cancel", "rollback"])(
  "keeps %s cleanup warning and existing terminal semantics",
  async (kind) => {
    const record = await task();
    const remove = fs.rm.bind(fs);
    vi.spyOn(fs, "rm").mockImplementation(async (file, options) => {
      if (
        file === (kind === "staging" ? path.join(path.dirname(output(record)), ".product.staging.png") : output(record))
      )
        throw new Error("synthetic cleanup failure");
      return remove(file, options);
    });
    if (kind === "output") render.mockRejectedValueOnce(new Error("synthetic render failure"));
    if (kind === "cancel") {
      vi.spyOn(metadata, "registerIfExists").mockImplementation(async () => {
        record.cancelRequested = true;
        return undefined;
      });
    }
    if (kind === "rollback") {
      const save = persist.getMockImplementation()!;
      persist.mockImplementation(async (value) => {
        if (value.status === "completed") throw new Error("synthetic final write failure");
        await save(value);
      });
    }
    await execute(record);
    const expected = {
      output: ["failed", "临时输出清理失败，稍后可删除此失败记录"],
      staging: ["completed", "临时渲染文件清理失败，稍后可删除此记录"],
      cancel: ["canceled", "取消后的输出清理失败，稍后可删除此记录"],
      rollback: ["failed", "未留档输出清理失败，稍后可删除此失败记录"]
    }[kind]!;
    expect(record.status).toBe(expected[0]);
    expect(record.warnings).toContain(expected[1]);
  }
);

it("reads current directory values and works without a metadata repository", async () => {
  execute = createProductImageExecutor(config, controller, { patchTask: patch, persist });
  config.imageAiInputsDir = path.join(fixture.layout.storageRoot, "late-inputs");
  config.imageAiOutputsDir = path.join(fixture.layout.storageRoot, "late-outputs");
  await fs.mkdir(config.imageAiOutputsDir, { recursive: true });
  const record = await task();
  await execute(record);
  expect(record.status).toBe("completed");
  expect(record.results[0].outputPath).toBe(output(record));
});
