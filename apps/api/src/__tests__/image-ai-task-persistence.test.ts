import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ToolboxDatabase } from "../database/toolbox-database";
import { createTaskStore, type TaskStore } from "../tasks/task-store";
import { createImageAiTaskPersistence } from "../domains/image-ai/task-persistence";
import type { StoredImageAiTask } from "../domains/image-ai/types";
import { toEntity } from "../domains/image-ai/task-projections";
import { createIsolatedAppFixture } from "./helpers/isolated-app";

let fixture: Awaited<ReturnType<typeof createIsolatedAppFixture>>;
let database: ToolboxDatabase;
let taskStore: TaskStore;
let persistence: ReturnType<typeof createImageAiTaskPersistence>;
let tasksDir: string;
let restored: StoredImageAiTask[];
let events: string[];

function stored(): StoredImageAiTask {
  return {
    id: "persist-001",
    operation: "background_remove",
    status: "completed",
    progress: 73,
    queuePosition: null,
    inputs: [
      { path: "synthetic/input.png", originalName: "商品.png", mimetype: "image/png", size: 1, width: 32, height: 24 }
    ],
    results: [
      {
        id: "persist-001-1",
        originalName: "商品.png",
        outputName: "result.png",
        outputPath: "synthetic/result.png",
        downloadUrl: "/synthetic/result.png",
        width: 32,
        height: 24,
        provider: "birefnet-general",
        model: "synthetic",
        warnings: []
      }
    ],
    warnings: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z"
  };
}

beforeEach(async () => {
  fixture = await createIsolatedAppFixture();
  tasksDir = path.join(fixture.layout.storageRoot, "synthetic-ai-manifests");
  database = new ToolboxDatabase(":memory:");
  taskStore = createTaskStore(1000, database);
  restored = [];
  events = [];
  persistence = createImageAiTaskPersistence({ imageAiTasksDir: tasksDir }, database, taskStore, {
    patchTask(task, patch) {
      events.push("patch");
      Object.assign(task, patch);
      task.updatedAt = "2026-01-02T00:00:00.000Z";
    },
    rememberTask(task) {
      events.push("remember");
      restored.push(task);
    },
    refreshQueuePositions() {
      events.push("refresh");
    }
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  database.close();
  await fixture.dispose();
});

it("constructs without filesystem, database or restore side effects", () => {
  const read = vi.spyOn(fs, "readdir");
  const write = vi.spyOn(database, "upsert");
  const list = vi.spyOn(database, "list");
  const hook = vi.fn();
  const adapter = createImageAiTaskPersistence({ imageAiTasksDir: tasksDir }, database, taskStore, {
    patchTask: hook,
    rememberTask: hook,
    refreshQueuePositions: hook
  });
  expect(Object.keys(adapter)).toEqual(["loadTasks", "persist", "commitTerminal"]);
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(list).not.toHaveBeenCalled();
  expect(hook).not.toHaveBeenCalled();
});

it.each(["pending", "running", "completed", "failed", "canceled"] as const)(
  "persists %s synchronously in domain-before-projection order with the original retention rule",
  async (status) => {
    const task = stored();
    task.status = status;
    const expiry = task.expiresAt;
    const upsert = database.upsert.bind(database);
    vi.spyOn(database, "upsert").mockImplementation((entity) => {
      events.push(entity.kind);
      if (entity.kind === "image-ai-task") expect(entity.payload).toBe(task);
      return upsert(entity);
    });
    const unsubscribe = taskStore.subscribe(task.id, () => {
      expect(database.get("image-ai-task", task.id)?.payload).toMatchObject({ status, expiresAt: task.expiresAt });
      events.push("subscriber");
    });
    try {
      const saving = persistence.persist(task);
      expect(events).toEqual(["image-ai-task", "task", "subscriber"]);
      await saving;
      expect(task.expiresAt).toBe(status === "pending" || status === "running" ? expiry : null);
      expect(task.updatedAt).toBe("2026-01-01T00:00:00.000Z");
      expect(taskStore.get(task.id)?.status).toBe(status === "canceled" ? "failed" : status);
      expect(restored).toEqual([]);
    } finally {
      unsubscribe();
    }
  }
);

it.each(["completed", "failed", "canceled"] as const)("does not make an empty %s task permanent", async (status) => {
  const task = stored();
  task.status = status;
  task.results = [];
  await persistence.persist(task);
  expect(task.expiresAt).toBe("2099-01-01T00:00:00.000Z");
  expect(database.get("image-ai-task", task.id)?.payload).toMatchObject({ expiresAt: task.expiresAt, results: [] });
});

it("propagates a domain write failure without projecting, reverting expiry or starting a transaction", async () => {
  const task = stored();
  const failure = new Error("synthetic domain failure");
  vi.spyOn(database, "upsert").mockImplementation(() => {
    throw failure;
  });
  const project = vi.spyOn(taskStore, "upsert");
  const transaction = vi.spyOn(database, "transaction");
  await expect(persistence.persist(task)).rejects.toBe(failure);
  expect(project).not.toHaveBeenCalled();
  expect(transaction).not.toHaveBeenCalled();
  expect(task.expiresAt).toBeNull();
  expect(database.get("image-ai-task", task.id)).toBeUndefined();
  expect(events).toEqual([]);
});

it("leaves the domain write in place when projection fails so the original caller owns rollback", async () => {
  const task = stored();
  const failure = new Error("synthetic projection failure");
  vi.spyOn(taskStore, "upsert").mockImplementation(() => {
    throw failure;
  });
  const transaction = vi.spyOn(database, "transaction");
  await expect(persistence.persist(task)).rejects.toBe(failure);
  expect(database.get("image-ai-task", task.id)?.payload).toMatchObject({ status: "completed", expiresAt: null });
  expect(transaction).not.toHaveBeenCalled();
  expect(taskStore.get(task.id)).toBeUndefined();
  expect(events).toEqual([]);
});

it("keeps missing legacy directories nonfatal and marks the domain before restoring an empty list", async () => {
  await persistence.loadTasks();
  expect(database.isDomainInitialized("image-ai-task")).toBe(true);
  expect(restored).toEqual([]);
  expect(events).toEqual(["refresh"]);
});

it("leaves a failed legacy import untouched and continues importing other files before setting the marker", async () => {
  await fs.mkdir(tasksDir, { recursive: true });
  const first = stored(),
    second = { ...stored(), id: "persist-002" };
  const file = path.join(tasksDir, "first.json"),
    contents = JSON.stringify(first);
  await fs.writeFile(file, contents);
  await fs.writeFile(path.join(tasksDir, "second.json"), JSON.stringify(second));
  const upsert = database.upsert.bind(database);
  vi.spyOn(database, "upsert").mockImplementation((entity) => {
    if (entity.id === first.id) throw new Error("synthetic import failure");
    return upsert(entity);
  });
  await persistence.loadTasks();
  expect(database.get("image-ai-task", first.id)).toBeUndefined();
  expect(restored.map((task) => task.id)).toEqual([second.id]);
  expect(database.isDomainInitialized("image-ai-task")).toBe(true);
  expect(await fs.readFile(file, "utf8")).toBe(contents);
});

it("propagates initialization-marker failure without reading or publishing database tasks", async () => {
  const failure = new Error("synthetic marker failure");
  vi.spyOn(database, "markDomainInitialized").mockImplementation(() => {
    throw failure;
  });
  const list = vi.spyOn(database, "list");
  await expect(persistence.loadTasks()).rejects.toBe(failure);
  expect(list).not.toHaveBeenCalled();
  expect(restored).toEqual([]);
  expect(events).toEqual([]);
});

it("preserves already retained records without a domain rewrite or timestamp patch", async () => {
  const task = stored();
  task.expiresAt = null;
  database.upsert(toEntity(task));
  database.markDomainInitialized("image-ai-task");
  const upsert = vi.spyOn(database, "upsert");
  const loading = persistence.loadTasks();
  // A marked domain still restores and refreshes synchronously before the returned Promise settles.
  expect(events).toEqual(["remember", "refresh"]);
  await loading;
  expect(upsert.mock.calls.map(([entity]) => entity.kind)).toEqual(["task"]);
  expect(restored[0].updatedAt).toBe(task.updatedAt);
});

it("retains the restored identity and normalized domain record if its projection throws", async () => {
  const task = stored();
  task.status = "running";
  database.upsert(toEntity(task));
  database.markDomainInitialized("image-ai-task");
  const failure = new Error("synthetic restore projection failure");
  vi.spyOn(taskStore, "upsert").mockImplementation(() => {
    throw failure;
  });
  await expect(persistence.loadTasks()).rejects.toBe(failure);
  expect(events).toEqual(["patch", "remember"]);
  expect(restored[0]).toMatchObject({ status: "failed", expiresAt: null });
  expect(database.get("image-ai-task", task.id)?.payload).toStrictEqual(restored[0]);
});

it("retains the legacy structural acceptance boundary instead of silently applying the public API schema", async () => {
  const legacy = {
    id: "legacy-minimal",
    operation: "enhance",
    status: "completed",
    progress: 25,
    queuePosition: null,
    inputs: [{ originalName: "商品.png", path: "synthetic/input.png" }],
    results: [{ id: "minimal-result", outputPath: "synthetic/output.png" }],
    warnings: [],
    createdAt: "legacy-date",
    updatedAt: "legacy-updated"
  };
  database.upsert({
    id: legacy.id,
    kind: "image-ai-task",
    status: legacy.status,
    payload: legacy,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt
  });
  database.markDomainInitialized("image-ai-task");
  await persistence.loadTasks();
  expect(restored).toHaveLength(1);
  expect(restored[0]).toMatchObject({ ...legacy, expiresAt: null });
  expect(taskStore.get(legacy.id)).toMatchObject({
    progress: 25,
    outputPath: "synthetic/output.png",
    createdAt: "legacy-date"
  });
});

it.each(["completed", "failed", "canceled"] as const)(
  "commits a %s snapshot before publishing the original task",
  async (status) => {
    const task = stored();
    task.status = "running";
    await persistence.persist(task);
    const originalExpiry = task.expiresAt;
    const write = database.upsert.bind(database);
    vi.spyOn(database, "upsert").mockImplementation((entity) => {
      expect(database.connection.inTransaction).toBe(true);
      expect(task.status).toBe("running");
      expect(task.expiresAt).toBe(originalExpiry);
      return write(entity);
    });
    const listener = vi.fn(() => {
      expect(database.connection.inTransaction).toBe(false);
      expect(task.status).toBe(status);
      expect(task.expiresAt).toBeNull();
      expect(database.get("image-ai-task", task.id)?.status).toBe(status);
    });
    taskStore.subscribe(task.id, listener);
    persistence.commitTerminal(task, { status, progress: 100 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(task).toMatchObject({ status, progress: 100, expiresAt: null });
  }
);

it.each(["image-ai-task", "task"] as const)(
  "does not publish a terminal snapshot when %s persistence fails",
  async (kind) => {
    const task = stored();
    task.status = "running";
    await persistence.persist(task);
    const previous = structuredClone(task),
      failure = new Error("synthetic terminal failure");
    const write = database.upsert.bind(database);
    vi.spyOn(database, "upsert").mockImplementation((entity) => {
      if (entity.kind === kind) throw failure;
      return write(entity);
    });
    const listener = vi.fn();
    taskStore.subscribe(task.id, listener);
    expect(() => persistence.commitTerminal(task, { status: "completed", progress: 100 })).toThrow(failure);
    expect(task).toStrictEqual(previous);
    expect(database.get("image-ai-task", task.id)?.payload).toStrictEqual(previous);
    expect(taskStore.get(task.id)?.status).toBe("running");
    expect(listener).not.toHaveBeenCalled();
  }
);

const unreadableCases: Array<[string, (task: StoredImageAiTask) => unknown]> = [
  ["null payload", () => null],
  ["undefined payload", () => undefined],
  ["invalid identity", (task) => ({ ...task, id: "!" })],
  ["unknown operation", (task) => ({ ...task, operation: "unknown" })],
  ["unknown status", (task) => ({ ...task, status: "unknown" })],
  ["non-array inputs", (task) => ({ ...task, inputs: {} })],
  ["null input", (task) => ({ ...task, inputs: [null] })],
  ["missing original name", (task) => ({ ...task, inputs: [{ path: "synthetic" }] })],
  ["missing input path", (task) => ({ ...task, inputs: [{ originalName: "商品.png" }] })],
  ["non-array results", (task) => ({ ...task, results: {} })],
  ["null result", (task) => ({ ...task, results: [null] })],
  ["missing result identity", (task) => ({ ...task, results: [{ outputPath: "synthetic" }] })],
  ["missing result path", (task) => ({ ...task, results: [{ id: "result-001" }] })],
  ["non-array warnings", (task) => ({ ...task, warnings: {} })],
  ["missing creation time", (task) => ({ ...task, createdAt: undefined })]
];

it.each(unreadableCases)("ignores %s without rewriting or deleting its database record", async (_label, candidate) => {
  const task = stored();
  database.markDomainInitialized("image-ai-task");
  const payload = candidate(task);
  vi.spyOn(database, "list").mockReturnValue([{ ...toEntity(task), payload }]);
  const write = vi.spyOn(database, "upsert"),
    remove = vi.spyOn(database, "remove");
  const project = vi.spyOn(taskStore, "upsert");
  await persistence.loadTasks();
  expect(restored).toEqual([]);
  expect(events).toEqual(["refresh"]);
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(project).not.toHaveBeenCalled();
});
