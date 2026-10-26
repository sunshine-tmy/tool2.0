import { ToolboxDatabase } from "../database/toolbox-database";
import { ArchiveImportService } from "../domains/content-archive/batch/service";
import { ArchiveTaskError } from "../domains/content-archive/core/provider";
import { previewArchiveRows } from "../domains/content-archive/batch/input";
import { ArchiveGroupStore } from "../domains/content-archive/core/groups";
import type { ContentArchiveItem, ContentArchiveTask, ArchiveImportCreate } from "@toolbox/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let database: ToolboxDatabase, service: ArchiveImportService, now: number;
const records = new Map<string, ContentArchiveTask>();
const existingItem = { id: "existing_archive" } as ContentArchiveItem;
const store = { findBySource: vi.fn(), findByUrl: vi.fn() };
const children: string[] = [];
const tasks = {
  createImport: vi.fn(
    (
      url: string,
      platform: ContentArchiveTask["platform"],
      _skip: boolean,
      before: (task: ContentArchiveTask) => void
    ) => {
      const id = `child_${records.size + 1}`;
      const task: ContentArchiveTask = {
        id,
        platform,
        status: "pending",
        stage: "parsing",
        progress: 0,
        message: url,
        createdAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString()
      };
      records.set(id, task);
      before(task);
      children.push(id);
      return task;
    }
  ),
  get: (id: string) => records.get(id),
  cancel: vi.fn(async (id: string) => {
    const task = records.get(id)!;
    const cancelled: ContentArchiveTask = {
      ...task,
      status: "failed",
      stage: "failed",
      errorCode: "ARCHIVE_CANCELLED"
    };
    records.set(id, cancelled);
    return cancelled;
  })
};
const input = (count = 2): ArchiveImportCreate => ({
  sourceName: "batch.csv",
  existing: "skip",
  rows: Array.from({ length: count }, (_, i) => ({
    rowNumber: i + 2,
    inputUrl: `https://www.tiktok.com/@shop/video/${12345 + i}`,
    inputPlatform: ""
  }))
});
beforeEach(() => {
  vi.clearAllMocks();
  store.findBySource.mockResolvedValue(undefined);
  store.findByUrl.mockResolvedValue(undefined);
  now = 1_000;
  records.clear();
  children.length = 0;
  database = new ToolboxDatabase(":memory:");
  service = new ArchiveImportService(database, store, tasks, { now: () => now, pollMs: 3600000 });
  service.initialize();
});
afterEach(async () => {
  await service.stop();
  database.close();
});
function finish(id: string, failure = false, skipped = false) {
  const task = records.get(id)!;
  records.set(id, {
    ...task,
    status: failure ? "failed" : "completed",
    stage: failure ? "failed" : "completed",
    progress: 100,
    archiveId: failure ? undefined : "saved_archive",
    errorCode: failure ? "TIKTOK_NETWORK_ERROR" : undefined,
    skipped
  });
}
describe("durable archive import coordinator", () => {
  it("commits group membership with batch progress, rolls both back on failure, and never overwrites a later manual move", async () => {
    const groups = new ArchiveGroupStore(database),
      target = groups.save("导入目标"),
      other = groups.save("手工整理");
    database.upsert({
      id: "saved_archive",
      kind: "xhs-archive",
      payload: { id: "saved_archive", platform: "tiktok", contentId: "12345" },
      createdAt: "now",
      updatedAt: "now"
    });
    const batch = await service.create({ ...input(1), groupId: target.id });
    await service.tick();
    finish(children[0]!);
    const original = database.upsert.bind(database);
    const save = vi.spyOn(database, "upsert").mockImplementation((entity) => {
      if (entity.kind === "archive-import-batch") throw new Error("batch-save-failed");
      return original(entity);
    });
    await expect(service.tick()).rejects.toThrow("batch-save-failed");
    expect(groups.memberships().size).toBe(0);
    expect(service.get(batch.id)?.status).toBe("running");
    save.mockRestore();
    await service.tick();
    expect(groups.memberships().get("saved_archive")).toBe(target.id);
    expect(service.get(batch.id)?.status).toBe("completed");
    groups.assign({ groupId: other.id, itemIds: ["saved_archive"] });
    await service.tick();
    expect(groups.memberships().get("saved_archive")).toBe(other.id);
    const late = await service.create({ ...input(1), groupId: target.id });
    now += 7000;
    await service.tick();
    groups.remove(target.id);
    finish(children[1]!);
    await service.tick();
    expect(service.get(late.id)?.status).toBe("completed");
    expect(groups.memberships().get("saved_archive")).toBe(other.id);
    expect(groups.list()).toHaveLength(1);
    store.findBySource.mockResolvedValue({ ...existingItem, id: "saved_archive" });
    const skipped = await service.create({ ...input(1), groupId: other.id });
    expect(skipped.rows[0]?.status).toBe("skipped");
    expect(groups.memberships().get("saved_archive")).toBe(other.id);
  });
  it("restores grouping for an already committed child and retries failed rows without recreating a deleted target group", async () => {
    const groups = new ArchiveGroupStore(database),
      target = groups.save("待整理");
    database.upsert({
      id: "saved_archive",
      kind: "xhs-archive",
      payload: { id: "saved_archive", platform: "tiktok", contentId: "12345" },
      createdAt: "now",
      updatedAt: "now"
    });
    const batch = await service.create({ ...input(2), groupId: target.id });
    await service.tick();
    finish(children[0]!);
    await service.stop();
    service = new ArchiveImportService(database, store, tasks, { now: () => now, pollMs: 3600000 });
    service.initialize();
    expect(groups.memberships().get("saved_archive")).toBe(target.id);
    const retry = await service.retry(batch.id);
    expect(retry?.groupId).toBe(target.id);
    await service.tick();
    finish(children[1]!, true);
    await service.tick();
    groups.remove(target.id);
    const withoutGroup = await service.retry(retry!.id);
    expect(withoutGroup?.groupId).toBeUndefined();
  });
  it("previews mixed platforms, invalid inputs, duplicates and existing works without network fetches", async () => {
    store.findBySource.mockResolvedValue(existingItem);
    const result = await previewArchiveRows(store, "test.csv", undefined, [
      { rowNumber: 2, inputUrl: "https://www.tiktok.com/@shop/video/12345?a=1", inputPlatform: "TikTok" },
      { rowNumber: 3, inputUrl: "https://www.tiktok.com/@other/video/12345?a=2", inputPlatform: "" },
      { rowNumber: 4, inputUrl: "https://v.douyin.com/AAAAA/", inputPlatform: "小红书" },
      { rowNumber: 5, inputUrl: "https://v.douyin.com/BBBBB/", inputPlatform: "douyin" },
      { rowNumber: 6, inputUrl: "not a link", inputPlatform: "other" }
    ]);
    expect(result.rows.map((row) => row.status)).toEqual(["existing", "duplicate", "invalid", "ready", "invalid"]);
    expect(tasks.createImport).not.toHaveBeenCalled();
    await expect(previewArchiveRows(store, "bad.csv", undefined, [input().rows[0]!, input().rows[0]!])).rejects.toThrow(
      "行号不能重复"
    );
  });
  it("admits one owned child at a time with durable ownership and a minimum seven-second interval", async () => {
    const batch = await service.create(input(100));
    expect(database.hasStatus("archive-import-batch", ["running", "stopping"])).toBe(true);
    expect(database.hasStatus("archive-import-batch", [])).toBe(false);
    expect(database.hasStatus("archive-import-batch", ["completed"])).toBe(false);
    expect(database.hasStatus("task", ["running"])).toBe(false);
    await service.tick();
    expect(children).toHaveLength(1);
    expect(
      (database.get("archive-import-batch", batch.id)?.payload as { rows: Array<{ taskId?: string }> }).rows[0]?.taskId
    ).toBe(children[0]);
    for (let i = 0; i < 20; i++) await service.tick();
    expect(children).toHaveLength(1);
    finish(children[0]!);
    await service.tick();
    expect(children).toHaveLength(1);
    now += 7000;
    await service.tick();
    expect(children).toHaveLength(2);
    expect(tasks.createImport.mock.calls[0]?.[2]).toBe(true);
    await expect(service.create(input())).rejects.toMatchObject({ code: "ARCHIVE_IMPORT_BUSY" });
  });
  it("skips known and late-resolved existing works while refresh is an explicit opt-in", async () => {
    store.findBySource.mockResolvedValue(existingItem);
    const skipped = await service.create(input(1));
    expect(skipped.rows[0]!.status).toBe("skipped");
    expect(skipped.status).toBe("completed");
    expect(tasks.createImport).not.toHaveBeenCalled();
    const refresh = await service.create({ ...input(1), existing: "refresh" });
    await service.tick();
    expect(tasks.createImport.mock.calls.at(-1)?.[2]).toBe(false);
    finish(children.at(-1)!, false, true);
    await service.tick();
    expect(service.get(refresh.id)?.rows[0]!.status).toBe("skipped");
  });
  it("does not re-create a known archive deleted or replaced before its batch row reaches the queue", async () => {
    for (const replacement of [undefined, { ...existingItem, id: "replacement_archive" }]) {
      store.findBySource.mockResolvedValue(existingItem);
      const batch = await service.create({ ...input(1), existing: "refresh" });
      store.findBySource.mockResolvedValue(replacement);
      await service.tick();
      expect(service.get(batch.id)?.rows[0]).toMatchObject({ status: "cancelled", errorCode: "ARCHIVE_CANCELLED" });
      expect(tasks.createImport).not.toHaveBeenCalled();
      await expect(service.retry(batch.id)).rejects.toMatchObject({ code: "ARCHIVE_IMPORT_NO_FAILURES" });
    }
  });
  it("waits for full or busy shared queues and continues after an individual failure", async () => {
    const batch = await service.create(input());
    tasks.createImport.mockImplementationOnce(() => {
      throw new ArchiveTaskError("ARCHIVE_QUEUE_FULL", "full", 429);
    });
    await service.tick();
    expect(service.get(batch.id)?.rows[0]!.taskId).toBeUndefined();
    tasks.createImport.mockImplementationOnce(() => {
      throw new ArchiveTaskError("ARCHIVE_TASK_BUSY", "busy", 409);
    });
    await service.tick();
    expect(tasks.cancel).not.toHaveBeenCalled();
    await service.tick();
    finish(children[0]!, true);
    now += 7000;
    await service.tick();
    expect(children).toHaveLength(2);
    finish(children[1]!);
    await service.tick();
    expect(service.get(batch.id)?.rows.map((row) => row.status)).toEqual(["failed", "completed"]);
    const retry = await service.retry(batch.id);
    expect(retry?.rows.map((row) => row.rowNumber)).toEqual([2]);
  });
  it("stops remaining rows while letting a running child finish, and can cancel its own pending child", async () => {
    const batch = await service.create(input(3));
    await service.tick();
    records.get(children[0]!)!.status = "running";
    expect((await service.cancel(batch.id))?.status).toBe("stopping");
    expect(database.hasStatus("archive-import-batch", ["stopping"])).toBe(true);
    expect(tasks.cancel).not.toHaveBeenCalled();
    finish(children[0]!);
    await service.tick();
    expect(database.hasStatus("archive-import-batch", ["running", "stopping"])).toBe(false);
    expect(service.get(batch.id)).toMatchObject({
      status: "cancelled",
      rows: [{ status: "completed" }, { status: "cancelled" }, { status: "cancelled" }]
    });
    const second = await service.create(input(1));
    now += 7000;
    await service.tick();
    expect((await service.cancel(second.id))?.status).toBe("cancelled");
    expect(tasks.cancel).toHaveBeenCalledTimes(1);
    await expect(service.retry(second.id)).rejects.toMatchObject({ code: "ARCHIVE_IMPORT_NO_FAILURES" });
  });
  it("recovers persisted batches without submitting new work and preserves a child already committed", async () => {
    const batch = await service.create(input(3));
    await service.tick();
    finish(children[0]!);
    await service.stop();
    service = new ArchiveImportService(database, store, tasks, { pollMs: 3600000 });
    service.initialize();
    expect(service.get(batch.id)).toMatchObject({
      status: "interrupted",
      rows: [{ status: "completed" }, { status: "failed", errorCode: "ARCHIVE_INTERRUPTED" }, { status: "failed" }]
    });
    await service.tick();
    expect(children).toHaveLength(1);
    const retried = await service.retry(batch.id);
    expect(retried?.rows).toHaveLength(2);
  });
  it("deletes only terminal batch metadata and does not enqueue if ownership persistence fails", async () => {
    const batch = await service.create(input(1));
    await expect(service.remove(batch.id)).rejects.toMatchObject({ code: "ARCHIVE_IMPORT_BUSY" });
    vi.spyOn(database, "upsert").mockImplementationOnce(() => {
      throw new Error("disk write failed");
    });
    await expect(service.tick()).rejects.toThrow("disk write failed");
    expect(children).toHaveLength(0);
    await service.cancel(batch.id);
    database.upsert({
      id: "kept_archive",
      kind: "xhs-archive",
      payload: { id: "kept_archive", noteId: "original123" },
      createdAt: "now",
      updatedAt: "now"
    });
    await service.remove(batch.id);
    expect(database.get("xhs-archive", "kept_archive")).toBeDefined();
    expect(service.get(batch.id)).toBeUndefined();
  });
});
