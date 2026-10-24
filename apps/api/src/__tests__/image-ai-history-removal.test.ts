import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getConfig, type AppConfig } from "../config";
import { ToolboxDatabase } from "../database/toolbox-database";
import { FileMetadataRepository } from "../database/file-metadata";
import { createTaskStore, type TaskStore } from "../tasks/task-store";
import { createImageAiHistoryRemoval } from "../domains/image-ai/history/removal";
import { toEntity, toUnifiedTask } from "../domains/image-ai/task-projections";
import type { StoredImageAiTask } from "../domains/image-ai/types";
import { createIsolatedAppFixture } from "./helpers/isolated-app";

let fixture: Awaited<ReturnType<typeof createIsolatedAppFixture>>;
let config: AppConfig;
let database: ToolboxDatabase;
let metadata: FileMetadataRepository;
let taskStore: TaskStore;
let remove: ReturnType<typeof createImageAiHistoryRemoval>;
const forget = vi.fn<(id: string) => void>();

beforeEach(async () => {
  vi.resetAllMocks();
  fixture = await createIsolatedAppFixture();
  config = getConfig({ layout: fixture.layout, dotenvPath: false, environment: { NODE_ENV: "test" } });
  database = new ToolboxDatabase(":memory:");
  metadata = new FileMetadataRepository(database, fixture.layout.storageRoot);
  taskStore = createTaskStore(1000, database);
  remove = createImageAiHistoryRemoval(config, database, taskStore, forget, metadata);
});
afterEach(async () => {
  vi.restoreAllMocks();
  database.close();
  await fixture.dispose();
});

function targets(id: string) {
  return [
    path.join(config.imageAiInputsDir, id),
    path.join(config.imageAiOutputsDir, id),
    path.join(config.imageAiTasksDir, `${id}.json`)
  ];
}

async function seed(): Promise<StoredImageAiTask> {
  const id = "remove-adapter-001";
  const [inputDirectory, outputDirectory, manifest] = targets(id);
  await Promise.all(
    [inputDirectory, outputDirectory, config.imageAiTasksDir].map((directory) =>
      fs.mkdir(directory, { recursive: true })
    )
  );
  const input = path.join(inputDirectory, "input.png"),
    result = path.join(outputDirectory, "result.png"),
    mask = path.join(inputDirectory, "mask.png");
  for (const file of [input, result, mask]) await fs.writeFile(file, "synthetic");
  const record: StoredImageAiTask = {
    id,
    operation: "background_remove",
    status: "completed",
    progress: 100,
    queuePosition: null,
    results: [
      {
        id: `${id}-1`,
        originalName: "商品.png",
        outputName: "result.png",
        outputPath: result,
        downloadUrl: `/api/v1/tools/image-ai/tasks/${id}/files/${id}-1`,
        width: 1,
        height: 1,
        provider: "birefnet-general",
        model: "synthetic",
        warnings: []
      }
    ],
    inputs: [1, 2].map(() => ({
      path: input,
      originalName: "商品.png",
      mimetype: "image/png",
      size: 9,
      width: 1,
      height: 1
    })),
    warnings: [],
    maskPath: mask,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    expiresAt: null
  };
  await fs.writeFile(manifest, JSON.stringify(record));
  database.upsert(toEntity(record));
  taskStore.upsert(toUnifiedTask(record));
  for (const [kind, file] of [
    ["image-ai-input", input],
    ["image-ai-mask", mask],
    ["image-ai-result", result]
  ]) {
    await metadata.register({ entityKind: kind, entityId: id, filePath: file });
  }
  for (const index of [1, 2]) {
    // relative_path is unique: old per-image registrations need distinct fixture files, not the same row overwritten.
    const legacy = path.join(inputDirectory, `legacy-${index}.png`);
    await fs.writeFile(legacy, "synthetic");
    await metadata.register({ entityKind: "image-ai-input", entityId: `${id}-${index}`, filePath: legacy });
  }
  return record;
}

it("constructs without deleting files, opening a transaction or forgetting a record", () => {
  const rm = vi.spyOn(fs, "rm"),
    transaction = vi.spyOn(database, "transaction");
  createImageAiHistoryRemoval(config, database, taskStore, forget);
  expect(rm).not.toHaveBeenCalled();
  expect(transaction).not.toHaveBeenCalled();
  expect(forget).not.toHaveBeenCalled();
});

it.each([false, true])(
  "keeps fixed deletion targets and post-transaction forgetting with metadata=%s",
  async (withMetadata) => {
    const record = await seed();
    const sentinel = path.join(fixture.root, "payload-must-not-be-deleted.png");
    await fs.writeFile(sentinel, "keep");
    record.inputs[0].path = sentinel;
    record.results[0].outputPath = sentinel;
    record.maskPath = sentinel;
    const sibling = path.join(config.imageAiOutputsDir, "sibling-001");
    await fs.mkdir(sibling, { recursive: true });
    await fs.writeFile(path.join(sibling, "keep.png"), "keep sibling");
    const events: string[] = [];
    const transaction = database.transaction.bind(database);
    vi.spyOn(database, "transaction").mockImplementation((operation) => {
      events.push("begin");
      const result = transaction(operation);
      events.push("committed");
      return result;
    });
    forget.mockImplementation((id) => {
      expect(events).toEqual(["begin", "committed"]);
      expect(database.get("image-ai-task", id)).toBeUndefined();
      expect(taskStore.get(id)).toBeUndefined();
      if (withMetadata) expect(metadata.list()).toEqual([]);
      events.push("forgotten");
    });
    remove = createImageAiHistoryRemoval(config, database, taskStore, forget, withMetadata ? metadata : undefined);
    expect(await remove(record.id, record)).toBe(true);
    expect(forget).toHaveBeenCalledExactlyOnceWith(record.id);
    expect(events).toEqual(["begin", "committed", "forgotten"]);
    for (const file of targets(record.id)) await expect(fs.access(file)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await fs.readFile(sentinel, "utf8")).toBe("keep");
    expect(await fs.readFile(path.join(sibling, "keep.png"), "utf8")).toBe("keep sibling");
    expect(metadata.list()).toHaveLength(withMetadata ? 0 : 5);
  }
);

it.each([0, 1, 2])("keeps records on file target %s failure and permits explicit retry", async (index) => {
  const record = await seed();
  const failure = new Error("synthetic file failure");
  const rm = fs.rm.bind(fs);
  const spy = vi.spyOn(fs, "rm").mockImplementation(async (file, options) => {
    if (file === targets(record.id)[index]) throw failure;
    return rm(file, options);
  });
  await expect(remove(record.id, record)).rejects.toBe(failure);
  expect(forget).not.toHaveBeenCalled();
  expect(database.get("image-ai-task", record.id)?.status).toBe("completed");
  expect(taskStore.get(record.id)?.status).toBe("completed");
  expect(metadata.list()).toHaveLength(5);
  spy.mockRestore();
  expect(await remove(record.id, record)).toBe(true);
  expect(forget).toHaveBeenCalledExactlyOnceWith(record.id);
});

it("rolls back domain and file metadata when unified-record deletion fails before commit, retaining retry identity", async () => {
  const record = await seed();
  const failure = new Error("synthetic unified deletion failure");
  const drop = database.remove.bind(database);
  const spy = vi.spyOn(database, "remove").mockImplementation((kind, id) => {
    if (kind === "task") throw failure;
    return drop(kind, id);
  });
  await expect(remove(record.id, record)).rejects.toBe(failure);
  expect(forget).not.toHaveBeenCalled();
  expect(database.get("image-ai-task", record.id)?.status).toBe("completed");
  expect(taskStore.get(record.id)?.status).toBe("completed");
  expect(metadata.list()).toHaveLength(5);
  spy.mockRestore();
  expect(await remove(record.id, record)).toBe(true);
  expect(metadata.list()).toEqual([]);
});

it("reads all three managed roots from the original config object at execution time", async () => {
  config.imageAiInputsDir = path.join(fixture.layout.storageRoot, "late-inputs");
  config.imageAiOutputsDir = path.join(fixture.layout.storageRoot, "late-outputs");
  config.imageAiTasksDir = path.join(fixture.layout.storageRoot, "late-manifests");
  const record = await seed();
  expect(await remove(record.id, record)).toBe(true);
  for (const file of targets(record.id)) await expect(fs.access(file)).rejects.toMatchObject({ code: "ENOENT" });
});
