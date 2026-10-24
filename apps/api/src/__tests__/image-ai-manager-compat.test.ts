import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defaultProductImageRecipe } from "@toolbox/shared";
import { getConfig, type AppConfig } from "../config";
import { ToolboxDatabase } from "../database/toolbox-database";
import { createTaskStore, type TaskStore } from "../tasks/task-store";
import { createImageAiTaskManager, type StoredImageAiTask } from "../domains/image-ai/task-manager";
import { createIsolatedAppFixture } from "./helpers/isolated-app";

let fixture: Awaited<ReturnType<typeof createIsolatedAppFixture>>;
let config: AppConfig;
let database: ToolboxDatabase;
let taskStore: TaskStore;
let manager: ReturnType<typeof createImageAiTaskManager>;

beforeEach(async () => {
  fixture = await createIsolatedAppFixture();
  config = getConfig({ layout: fixture.layout, dotenvPath: false, environment: { NODE_ENV: "test" } });
  database = new ToolboxDatabase(":memory:");
  taskStore = createTaskStore(1000, database);
  manager = createImageAiTaskManager({ ...config, imageAiQueueLimit: 2 }, database, taskStore);
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  try {
    await manager.close();
  } finally {
    database.close();
  }
  await fixture.dispose();
});

function stored(id: string, originalName = "商品.png"): StoredImageAiTask {
  return {
    id,
    operation: "background_remove",
    status: "completed",
    progress: 100,
    queuePosition: null,
    results: [
      {
        id: `${id}-1`,
        originalName,
        outputName: "result.png",
        outputPath: path.join(config.imageAiOutputsDir, id, "result.png"),
        downloadUrl: `/api/v1/tools/image-ai/tasks/${id}/files/${id}-1`,
        width: 32,
        height: 24,
        provider: "birefnet-general",
        model: "synthetic",
        warnings: ["result warning"]
      }
    ],
    inputs: [
      {
        path: path.join(config.imageAiInputsDir, id, "input.png"),
        originalName,
        mimetype: "image/png",
        size: 1,
        width: 32,
        height: 24
      }
    ],
    warnings: ["task warning"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: null
  };
}
function seed(task: StoredImageAiTask) {
  database.upsert({
    id: task.id,
    kind: "image-ai-task",
    status: task.status,
    payload: task,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  });
}

async function composeSyntheticImage(transparent = false) {
  await manager.initialize();
  const task = stored("compose-baseline");
  await fs.mkdir(path.dirname(task.inputs[0].path), { recursive: true });
  await sharp({
    create: { width: 32, height: 24, channels: 4, background: { r: 255, g: 0, b: 0, alpha: transparent ? 0 : 1 } }
  })
    .png()
    .toFile(task.inputs[0].path);
  const recipe = defaultProductImageRecipe();
  recipe.canvas = { width: 256, height: 256 };
  await manager.create({
    id: task.id,
    operation: "product_image",
    files: task.inputs,
    recipe,
    assets: { foreground: task.inputs[0].path }
  });
  await vi.waitFor(() => expect(["completed", "failed"]).toContain(manager.get(task.id)?.status));
  return manager.getStored(task.id)!;
}

it("keeps product PNG identity, permanent archive and synchronized projection without inference", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const record = await composeSyntheticImage();
  expect(record).toMatchObject({ status: "completed", phase: "已留档", progress: 100, expiresAt: null });
  expect(record.results).toHaveLength(1);
  expect(record.results[0]).toMatchObject({
    id: `${record.id}-1`,
    originalName: "商品.png",
    outputName: "product.png",
    width: 256,
    height: 256,
    provider: "sharp",
    model: "商品图渲染器 v1",
    warnings: ["商品经过普通插值放大，不等同于 AI 清晰度增强"]
  });
  expect(await fs.readdir(path.join(config.imageAiOutputsDir, record.id))).toEqual(["product.png"]);
  expect(database.get("image-ai-task", record.id)?.payload).toMatchObject({ status: "completed", expiresAt: null });
  expect(taskStore.get(record.id)).toMatchObject({ status: "completed", outputPath: record.results[0].outputPath });
  expect(fetcher).not.toHaveBeenCalled();
});

it("keeps transparent-product rejection temporary without retaining staging or claiming success", async () => {
  const record = await composeSyntheticImage(true);
  expect(record).toMatchObject({ status: "failed", phase: "保存失败", results: [] });
  expect(record.error).toMatch(/^没有可见商品主体/);
  expect(record.expiresAt).not.toBeNull();
  expect(await fs.readdir(path.join(config.imageAiOutputsDir, record.id))).toEqual([]);
  expect(database.get("image-ai-task", record.id)?.status).toBe("failed");
  expect(taskStore.get(record.id)?.status).toBe("failed");
});

it.each(["completed", "failed", "canceled"] as const)(
  "keeps %s domain state distinct from its unified task projection",
  async (status) => {
    const task = stored(`project-${status}`);
    task.status = status;
    task.error = "领域错误原文";
    task.progress = 73;
    task.results.push({ ...task.results[0], id: `${task.id}-2`, outputPath: "second-result.png" });
    seed(task);
    await manager.initialize();
    expect(manager.get(task.id)).toMatchObject({ status, error: task.error, progress: 73 });
    expect(database.get("image-ai-task", task.id)).toMatchObject({
      kind: "image-ai-task",
      status,
      payload: { status, error: task.error }
    });
    const projected = {
      id: task.id,
      toolId: "image-ai",
      status: status === "canceled" ? "failed" : status,
      progress: 73,
      outputPath: task.results[0].outputPath,
      error: status === "canceled" ? "CANCELLED" : task.error,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    };
    expect(taskStore.get(task.id)).toStrictEqual(projected);
    expect(database.get("task", task.id)?.payload).toStrictEqual(projected);
  }
);

it("keeps missing outputs and optional public fields undefined without changing a future empty-task expiry", async () => {
  const task = stored("empty-projection");
  task.status = "failed";
  task.results = [];
  task.expiresAt = "2099-01-01T00:00:00.000Z";
  seed(task);
  await manager.initialize();
  const projected = manager.get(task.id)!;
  expect(projected).toHaveProperty("recipe", undefined);
  expect(projected).toHaveProperty("source", undefined);
  expect(projected).toHaveProperty("phase", undefined);
  expect(projected).toHaveProperty("scale", undefined);
  expect(projected).toHaveProperty("error", undefined);
  expect(projected.expiresAt).toBe(task.expiresAt);
  expect(taskStore.get(task.id)).toHaveProperty("outputPath", undefined);
  expect(taskStore.get(task.id)).toHaveProperty("error", undefined);
  expect(database.get("image-ai-task", task.id)?.payload).toMatchObject({ expiresAt: task.expiresAt, results: [] });
});

it("keeps public projections path-free without changing the existing shallow-reference contract", async () => {
  const task = stored("public-001");
  task.recipe = defaultProductImageRecipe();
  task.source = { taskId: "source-001", resultId: "source-001-1" };
  task.assets = { foreground: task.inputs[0].path };
  task.maskPath = path.join(config.imageAiInputsDir, task.id, "mask.png");
  task.submissionKey = "synthetic-private-submission";
  task.cancelRequested = true;
  seed(task);
  await manager.initialize();
  const internal = manager.getStored(task.id)!;
  const projected = manager.get(task.id)!;
  if (!projected.inputs) throw new Error("Expected the existing manager to project its stored inputs");
  expect(JSON.stringify(projected)).not.toContain(fixture.root);
  expect(projected).not.toHaveProperty("assets");
  expect(projected).not.toHaveProperty("maskPath");
  expect(projected).not.toHaveProperty("submissionKey");
  expect(projected).not.toHaveProperty("cancelRequested");
  expect(projected.inputs[0]).not.toHaveProperty("path");
  expect(projected.results[0]).not.toHaveProperty("outputPath");
  expect(projected.inputs[0]).not.toBe(internal.inputs[0]);
  expect(projected.results[0]).not.toBe(internal.results[0]);
  expect(projected.warnings).not.toBe(internal.warnings);
  // Nested recipe/source/result warnings have always been borrowed references, not deep clones.
  expect(projected.recipe).toBe(internal.recipe);
  expect(projected.source).toBe(internal.source);
  expect(projected.results[0].warnings).toBe(internal.results[0].warnings);
  projected.warnings.push("caller-only");
  expect(internal.warnings).toEqual(["task warning"]);
  expect(manager.findSubmission(task.submissionKey)?.id).toBe(task.id);
});

it("keeps history filtering, default pagination and the stable descending identity tie-break", async () => {
  const first = stored("history-AAA", "商品-A.JPG");
  const second = stored("history-ZZZ", "商品-B.jpg");
  const third = stored("history-MID", "other.png");
  third.operation = "enhance";
  seed(first);
  seed(second);
  seed(third);
  await manager.initialize();
  expect(manager.listHistory({})).toMatchObject({ total: 3, page: 1, pageSize: 20 });
  const query = {
    keyword: " 商品- ",
    operation: "background_remove" as const,
    status: "completed" as const,
    pageSize: 1
  };
  const page = manager.listHistory({ ...query, page: 1 });
  expect(page).toMatchObject({ total: 2, page: 1, pageSize: 1 });
  expect(page.items.map((item) => item.id)).toEqual([second.id]);
  expect(manager.listHistory({ ...query, page: 2 }).items.map((item) => item.id)).toEqual([first.id]);
  expect(manager.listHistory({ keyword: "HISTORY-MID" }).items.map((item) => item.id)).toEqual([third.id]);
});

it("keeps source lease reference counts and idempotent release before permitting removal", async () => {
  const task = stored("leases-001");
  seed(task);
  await manager.initialize();
  const first = manager.leaseSource(task.id),
    second = manager.leaseSource(task.id);
  expect(first.task).toBe(second.task);
  await expect(manager.remove(task.id)).rejects.toMatchObject({ code: "IMAGE_AI_TASK_BUSY" });
  first.release();
  first.release();
  await expect(manager.remove(task.id)).rejects.toMatchObject({ code: "IMAGE_AI_TASK_BUSY" });
  second.release();
  second.release();
  expect(await manager.remove(task.id)).toBe(true);
  expect(manager.get(task.id)).toBeUndefined();
  expect(taskStore.get(task.id)).toBeUndefined();
  expect(database.get("image-ai-task", task.id)).toBeUndefined();
});

it("queries the live task collection after caller-visible state, filename and identity changes", async () => {
  const task = stored("history-live");
  seed(task);
  await manager.initialize();
  expect(manager.listHistory({ keyword: "renamed" }).total).toBe(0);
  manager.getStored(task.id)!.inputs[0].originalName = "Renamed 商品.png";
  expect(manager.listHistory({ keyword: " RENAMED " }).items.map((item) => item.id)).toEqual([task.id]);
  await manager.remove(task.id);
  expect(manager.listHistory({})).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
});

it("keeps all five history states and combines operation, status and case-insensitive identity filters", async () => {
  const statuses = ["pending", "running", "completed", "failed", "canceled"] as const;
  for (const status of statuses) seed(stored(`history-${status}`));
  await manager.initialize();
  for (const status of statuses) {
    const record = manager.getStored(`history-${status}`)!;
    record.status = status;
    record.operation = "enhance";
    expect(
      manager.listHistory({ keyword: `HISTORY-${status.toUpperCase()}`, operation: "enhance", status }).total
    ).toBe(1);
    expect(manager.listHistory({ keyword: record.id, operation: "background_remove", status }).total).toBe(0);
  }
  expect(manager.listHistory({}).total).toBe(5);
});

it("keeps history date priority, empty pages and default page size without sorting the manager collection", async () => {
  const first = stored("history-ZZZ");
  const newest = stored("history-AAA");
  newest.createdAt = "2026-02-01T00:00:00.000Z";
  seed(first);
  seed(newest);
  await manager.initialize();
  const before = manager.getStored(first.id);
  expect(manager.listHistory({ page: 1, pageSize: 1 }).items.map((item) => item.id)).toEqual([newest.id]);
  expect(manager.listHistory({ page: 3, pageSize: 1 })).toEqual({ items: [], total: 2, page: 3, pageSize: 1 });
  expect(manager.listHistory({ keyword: "   " })).toMatchObject({ total: 2, page: 1, pageSize: 20 });
  expect(manager.getStored(first.id)).toBe(before);
});

it("coalesces removal promises and keeps deletion locked until every file operation and close finish", async () => {
  const task = stored("delete-001");
  seed(task);
  await manager.initialize();
  const remove = fs.rm.bind(fs),
    target = path.join(config.imageAiOutputsDir, task.id);
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  vi.spyOn(fs, "rm").mockImplementation(async (file, options) => {
    if (file === target) {
      entered();
      await gate;
    }
    return remove(file, options);
  });
  const first = manager.remove(task.id),
    second = manager.remove(task.id);
  let closing: Promise<void> | undefined;
  try {
    expect(second).toBe(first);
    await started;
    expect(manager.get(task.id)?.status).toBe("completed");
    expect(() => manager.leaseSource(task.id)).toThrow(/正在删除/);
    let closed = false;
    closing = manager.close().then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(closed).toBe(false);
    release();
    expect(await first).toBe(true);
    await closing;
    expect(closed).toBe(true);
    expect(await manager.remove(task.id)).toBe(false);
  } finally {
    release();
    await Promise.allSettled([first, second, ...(closing ? [closing] : [])]);
  }
});

it("keeps reservation limits, idempotent release and refusal after shutdown without starting inference", async () => {
  await manager.initialize();
  const first = manager.tryReserveSlot()!,
    second = manager.tryReserveSlot()!;
  expect(first).toBeTypeOf("function");
  expect(second).toBeTypeOf("function");
  expect(manager.tryReserveSlot()).toBeUndefined();
  first();
  first();
  const replacement = manager.tryReserveSlot()!;
  expect(replacement).toBeTypeOf("function");
  expect(manager.tryReserveSlot()).toBeUndefined();
  second();
  replacement();
  await manager.close();
  expect(manager.activeCount()).toBe(0);
  expect(manager.tryReserveSlot()).toBeUndefined();
});

it("holds the removal lock after one file failure until every in-flight removal settles, then permits retry", async () => {
  const task = stored("remove-failed-files");
  seed(task);
  await manager.initialize();
  const remove = fs.rm.bind(fs);
  const failure = new Error("synthetic input deletion failure");
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const spy = vi.spyOn(fs, "rm").mockImplementation(async (file, options) => {
    if (file === path.join(config.imageAiInputsDir, task.id)) throw failure;
    if (file === path.join(config.imageAiOutputsDir, task.id)) {
      entered();
      await gate;
    }
    return remove(file, options);
  });
  const pending = manager.remove(task.id);
  const outcome = pending.then(
    () => undefined,
    (error: unknown) => error
  );
  try {
    await started;
    expect(manager.remove(task.id)).toBe(pending);
    expect(() => manager.leaseSource(task.id)).toThrow(/正在删除/);
    expect(manager.get(task.id)?.id).toBe(task.id);
    release();
    expect(await outcome).toBe(failure);
    expect(database.get("image-ai-task", task.id)?.status).toBe("completed");
    expect(taskStore.get(task.id)?.status).toBe("completed");
    spy.mockRestore();
    expect(await manager.remove(task.id)).toBe(true);
  } finally {
    release();
    await outcome;
    spy.mockRestore();
  }
});

it("retains the history identity and unified record after database deletion fails, allowing explicit retry", async () => {
  const task = stored("remove-failed-db");
  seed(task);
  await manager.initialize();
  const remove = database.remove.bind(database);
  const failure = new Error("synthetic domain deletion failure");
  let failOnce = true;
  vi.spyOn(database, "remove").mockImplementation((kind, id) => {
    if (failOnce && kind === "image-ai-task" && id === task.id) {
      failOnce = false;
      throw failure;
    }
    return remove(kind, id);
  });
  await expect(manager.remove(task.id)).rejects.toBe(failure);
  expect(manager.get(task.id)?.id).toBe(task.id);
  expect(database.get("image-ai-task", task.id)?.status).toBe("completed");
  expect(taskStore.get(task.id)?.status).toBe("completed");
  expect(await manager.remove(task.id)).toBe(true);
  expect(manager.get(task.id)).toBeUndefined();
  expect(database.get("image-ai-task", task.id)).toBeUndefined();
  expect(taskStore.get(task.id)).toBeUndefined();
});

it("retains old results, interrupts queued tasks and leaves invalid legacy manifests untouched without inference", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  const retained = stored("retain-001");
  retained.expiresAt = "2020-01-01T00:00:00Z";
  const pending = stored("pending-001");
  pending.status = "pending";
  pending.results = [];
  pending.expiresAt = "2099-01-01T00:00:00Z";
  const empty = stored("expired-001");
  empty.status = "failed";
  empty.results = [];
  empty.expiresAt = "2020-01-01T00:00:00Z";
  seed(retained);
  seed(pending);
  seed(empty);
  await fs.mkdir(config.imageAiTasksDir, { recursive: true });
  const corrupt = path.join(config.imageAiTasksDir, "invalid.json");
  await fs.writeFile(corrupt, "{invalid");
  await manager.initialize();
  expect(manager.get(retained.id)?.expiresAt).toBeNull();
  expect(manager.get(pending.id)).toMatchObject({
    status: "failed",
    progress: 100,
    queuePosition: null,
    error: "任务因服务重启而中断，请手动重试"
  });
  expect(manager.get(empty.id)).toBeUndefined();
  expect(manager.activeCount()).toBe(0);
  expect(await fs.readFile(corrupt, "utf8")).toBe("{invalid");
  await manager.close();
  expect(fetcher).not.toHaveBeenCalled();
});

it("imports readable legacy JSON once, normalizes retained results and preserves every legacy file", async () => {
  const legacy = stored("legacy-001");
  legacy.expiresAt = "2020-01-01T00:00:00Z";
  await fs.mkdir(config.imageAiTasksDir, { recursive: true });
  const files = {
    "readable.json": JSON.stringify(legacy),
    "corrupt.json": "{invalid",
    "invalid.json": JSON.stringify({ ...legacy, id: "!" }),
    "ignored.JSON": JSON.stringify(stored("ignored-001"))
  };
  for (const [name, contents] of Object.entries(files)) {
    await fs.writeFile(path.join(config.imageAiTasksDir, name), contents);
  }
  const events: string[] = [];
  const upsert = database.upsert.bind(database);
  vi.spyOn(database, "upsert").mockImplementation((entity) => {
    if (entity.kind === "image-ai-task") events.push(`domain:${Reflect.get(Object(entity.payload), "expiresAt")}`);
    return upsert(entity);
  });
  const mark = database.markDomainInitialized.bind(database);
  vi.spyOn(database, "markDomainInitialized").mockImplementation((kind) => {
    events.push(`initialized:${kind}`);
    return mark(kind);
  });
  const project = taskStore.upsert.bind(taskStore);
  vi.spyOn(taskStore, "upsert").mockImplementation((task) => {
    expect(manager.getStored(task.id)?.expiresAt).toBeNull();
    events.push(`project:${task.id}`);
    return project(task);
  });
  await manager.initialize();
  expect(events).toEqual([
    "domain:2020-01-01T00:00:00Z",
    "initialized:image-ai-task",
    "domain:null",
    "project:legacy-001"
  ]);
  expect(database.isDomainInitialized("image-ai-task")).toBe(true);
  expect(manager.listHistory({}).items.map((task) => task.id)).toEqual([legacy.id]);
  for (const [name, contents] of Object.entries(files)) {
    expect(await fs.readFile(path.join(config.imageAiTasksDir, name), "utf8")).toBe(contents);
  }
});

it("does not re-import legacy JSON after the domain initialization marker exists", async () => {
  database.markDomainInitialized("image-ai-task");
  await fs.mkdir(config.imageAiTasksDir, { recursive: true });
  const file = path.join(config.imageAiTasksDir, "late.json");
  await fs.writeFile(file, JSON.stringify(stored("late-legacy")));
  const readdir = vi.spyOn(fs, "readdir");
  await manager.initialize();
  expect(readdir.mock.calls.some(([directory]) => directory === config.imageAiTasksDir)).toBe(false);
  expect(manager.get("late-legacy")).toBeUndefined();
  expect(database.get("image-ai-task", "late-legacy")).toBeUndefined();
  expect(await fs.readFile(file, "utf8")).toContain("late-legacy");
});

it("reads the current manifest directory from the original config object at initialization", async () => {
  await manager.close();
  const mutableConfig = { ...config };
  manager = createImageAiTaskManager(mutableConfig, database, taskStore);
  mutableConfig.imageAiTasksDir = path.join(fixture.layout.storageRoot, "late-manifest-directory");
  await fs.mkdir(mutableConfig.imageAiTasksDir, { recursive: true });
  const task = stored("late-config-001");
  await fs.writeFile(path.join(mutableConfig.imageAiTasksDir, "legacy.json"), JSON.stringify(task));
  await manager.initialize();
  expect(manager.get(task.id)?.id).toBe(task.id);
  expect(database.get("image-ai-task", task.id)?.id).toBe(task.id);
});

it.each(["pending", "running"] as const)(
  "restores interrupted %s records before publishing their projection",
  async (status) => {
    const task = stored(`restore-${status}`);
    task.status = status;
    task.progress = 22;
    task.queuePosition = 2;
    task.expiresAt = "2020-01-01T00:00:00Z";
    seed(task);
    database.markDomainInitialized("image-ai-task");
    const events: string[] = [];
    const upsert = database.upsert.bind(database);
    vi.spyOn(database, "upsert").mockImplementation((entity) => {
      if (entity.kind === "image-ai-task") {
        expect(entity.payload).toMatchObject({ status: "failed", progress: 100, queuePosition: null, expiresAt: null });
        expect(manager.getStored(task.id)).toBeUndefined();
        expect(taskStore.get(task.id)).toBeUndefined();
        events.push("domain");
      }
      return upsert(entity);
    });
    const project = taskStore.upsert.bind(taskStore);
    vi.spyOn(taskStore, "upsert").mockImplementation((projection) => {
      expect(database.get("image-ai-task", task.id)?.payload).toMatchObject({ status: "failed", expiresAt: null });
      expect(manager.getStored(task.id)).toMatchObject({ status: "failed", expiresAt: null });
      events.push("project");
      return project(projection);
    });
    await manager.initialize();
    expect(events).toEqual(["domain", "project"]);
    expect(manager.get(task.id)).toMatchObject({ status: "failed", error: "任务因服务重启而中断，请手动重试" });
    expect(manager.getStored(task.id)?.updatedAt).not.toBe(task.updatedAt);
    expect(manager.activeCount()).toBe(0);
  }
);

it("rolls back a new task if its unified projection fails after the domain write", async () => {
  await manager.initialize();
  const task = stored("create-rollback");
  const failure = new Error("synthetic projection failure");
  vi.spyOn(taskStore, "upsert").mockImplementation((projection) => {
    expect(database.get("image-ai-task", task.id)?.payload).toMatchObject({ status: "pending", results: [] });
    expect(manager.getStored(projection.id)?.status).toBe("pending");
    throw failure;
  });
  await expect(manager.create({ id: task.id, operation: "enhance", files: task.inputs })).rejects.toBe(failure);
  expect(manager.get(task.id)).toBeUndefined();
  expect(database.get("image-ai-task", task.id)).toBeUndefined();
  expect(taskStore.get(task.id)).toBeUndefined();
  expect(manager.activeCount()).toBe(0);
});

it("never publishes a unified projection when a new domain write fails", async () => {
  await manager.initialize();
  const task = stored("domain-rollback");
  const failure = new Error("synthetic domain failure");
  vi.spyOn(database, "upsert").mockImplementation(() => {
    throw failure;
  });
  const project = vi.spyOn(taskStore, "upsert");
  await expect(manager.create({ id: task.id, operation: "enhance", files: task.inputs })).rejects.toBe(failure);
  expect(project).not.toHaveBeenCalled();
  expect(manager.get(task.id)).toBeUndefined();
  expect(database.get("image-ai-task", task.id)).toBeUndefined();
  expect(manager.activeCount()).toBe(0);
});
