import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ContentArchiveItem, ContentArchiveTask, TikTokProfileWork } from "@toolbox/shared";
import { ContentArchiveRepository } from "../domains/content-archive/core/repository";
import { ToolboxDatabase } from "../database/toolbox-database";
import { ArchiveImportService } from "../domains/content-archive/batch/service";
import { TikTokProfileService } from "../domains/content-archive/profile/service";
import type { ProfileDiscovery } from "../domains/content-archive/providers/tiktok/profile-reader";
let database: ToolboxDatabase, imports: ArchiveImportService, profiles: TikTokProfileService;
const source = { findBySource: vi.fn(), findByUrl: vi.fn() },
  tasks = new Map<string, ContentArchiveTask>();
const taskApi = {
  createImport: vi.fn(
    (
      _url: string,
      platform: ContentArchiveTask["platform"],
      _skip: boolean,
      before: (task: ContentArchiveTask) => void
    ) => {
      const now = new Date().toISOString(),
        task: ContentArchiveTask = {
          id: `task_${tasks.size + 1}`,
          platform,
          status: "pending",
          stage: "parsing",
          progress: 0,
          message: "排队",
          createdAt: now,
          updatedAt: now
        };
      before(task);
      tasks.set(task.id, task);
      return task;
    }
  ),
  get: (id: string) => tasks.get(id),
  cancel: vi.fn(async (id: string) => {
    const task = {
      ...tasks.get(id)!,
      status: "failed" as const,
      stage: "failed" as const,
      errorCode: "ARCHIVE_CANCELLED"
    };
    tasks.set(id, task);
    return task;
  })
};
const reader = { read: vi.fn() };
function persistTask(task: ContentArchiveTask) {
  database.upsert({
    id: task.id,
    kind: "archive-fetch-task",
    status: task.status,
    payload: task,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  });
}
function saveArchive(platform: ContentArchiveItem["platform"] = "tiktok", contentId = "12345", id = "manual_archive") {
  const now = new Date().toISOString();
  new ContentArchiveRepository(database).save({
    id,
    platform,
    contentId,
    sourceUrl: works(1)[0]!.url,
    canonicalUrl: works(1)[0]!.url,
    type: "video",
    title: "同名作品",
    topics: [],
    media: [],
    fetchedAt: now,
    updatedAt: now,
    status: "ready",
    warnings: [],
    totalBytes: 0
  });
  return id;
}
async function failWorks(count = 2, finish = true) {
  const id = await ready(count);
  await profiles.start(id, { selection: "all", existing: "refresh", allowPartial: false });
  await profiles.tick();
  await imports.tick();
  for (let index = 0; index < count; index++) {
    const task = [...tasks.values()].find((task) => task.status === "pending")!;
    const failed: ContentArchiveTask = {
      ...task,
      status: "failed",
      stage: "failed",
      message: "网络失败",
      errorCode: "ARCHIVE_DOWNLOAD_FAILED",
      updatedAt: new Date().toISOString()
    };
    tasks.set(task.id, failed);
    persistTask(failed);
    await imports.tick();
  }
  if (finish) await profiles.tick();
  return id;
}
function completeManual(
  archiveId = "manual_archive",
  updatedAt = new Date(Date.now() + 1000).toISOString(),
  platform: ContentArchiveItem["platform"] = "tiktok"
) {
  persistTask({
    id: "manual_task",
    platform,
    status: "completed",
    stage: "completed",
    progress: 100,
    message: "完成",
    archiveId,
    createdAt: updatedAt,
    updatedAt
  });
}
const works = (count: number): TikTokProfileWork[] =>
  Array.from({ length: count }, (_, i) => ({
    id: String(12345 + i),
    url: `https://www.tiktok.com/@shop/video/${12345 + i}`
  }));
function discovery(count: number, complete = true): ProfileDiscovery {
  return {
    works: works(count),
    complete,
    declaredCount: count,
    waitingUser: false,
    message: complete ? "列表完整" : "列表未确认完整"
  };
}
async function ready(count: number, complete = true) {
  reader.read.mockResolvedValueOnce(discovery(count, complete));
  const job = await profiles.create("https://www.tiktok.com/@shop?_t=share");
  await vi.waitFor(() => expect(profiles.get(job.id)?.phase).toBe("ready"));
  return job.id;
}
beforeEach(() => {
  vi.clearAllMocks();
  tasks.clear();
  source.findBySource.mockResolvedValue(undefined);
  source.findByUrl.mockResolvedValue(undefined);
  database = new ToolboxDatabase(":memory:");
  imports = new ArchiveImportService(database, source, taskApi, { intervalMs: 0, pollMs: 3600000 });
  imports.initialize();
  profiles = new TikTokProfileService(database, imports, reader, { pollMs: 3600000 });
  profiles.initialize();
});
afterEach(async () => {
  await profiles.close();
  await imports.stop();
  database.close();
  vi.restoreAllMocks();
});
it("discovers without downloading and splits 201 works into owner-bound batches of 100/100/1", async () => {
  const id = await ready(201);
  expect(imports.list()).toHaveLength(0);
  expect(taskApi.createImport).not.toHaveBeenCalled();
  expect(profiles.page(id, 2)?.items[0]?.id).toBe("12395");
  source.findBySource.mockResolvedValue({ id: "existing_archive" });
  await profiles.start(id, { selection: "all", existing: "skip", allowPartial: false });
  for (let i = 0; i < 4; i++) await profiles.tick();
  expect(profiles.get(id)).toMatchObject({ phase: "completed", skippedCount: 201, batchCount: 3 });
  expect(
    imports
      .list()
      .map((batch) => imports.get(batch.id)!.rows.length)
      .sort((a, b) => a - b)
  ).toEqual([1, 100, 100]);
  expect(imports.list().every((batch) => batch.ownerProfileId === id)).toBe(true);
  expect(taskApi.createImport).not.toHaveBeenCalled();
  const child = imports.list()[0]!;
  await expect(imports.remove(child.id)).rejects.toMatchObject({ code: "ARCHIVE_IMPORT_OWNED" });
  await expect(imports.retry(child.id)).rejects.toMatchObject({ code: "ARCHIVE_IMPORT_OWNED" });
  await profiles.remove(id);
  expect(imports.list()).toHaveLength(0);
  expect(profiles.get(id)).toBeUndefined();
  expect(database.list("archive-import-batch")).toHaveLength(0);
});
it("atomically cleans only the selected profile and its terminal batches, with rollback on either removal failure", async () => {
  const id = await ready(201);
  source.findBySource.mockResolvedValue({ id: "existing_archive" });
  await profiles.start(id, { selection: "all", existing: "skip", allowPartial: false });
  for (let i = 0; i < 4; i++) await profiles.tick();
  const other = await ready(1);
  const manual = await imports.create({
    sourceName: "manual.csv",
    existing: "skip",
    rows: [{ rowNumber: 1, inputUrl: works(1)[0]!.url, inputPlatform: "tiktok" }]
  });
  const remove = database.remove.bind(database);
  for (const failingKind of ["archive-import-batch", "tiktok-profile-job"]) {
    const failure = vi.spyOn(database, "remove").mockImplementation((kind, recordId) => {
      if (kind === failingKind) throw new Error("simulated remove failure");
      return remove(kind, recordId);
    });
    await expect(profiles.remove(id)).rejects.toThrow("simulated remove failure");
    failure.mockRestore();
    expect(profiles.get(id)?.batchCount).toBe(3);
    expect(imports.list().filter((batch) => batch.ownerProfileId === id)).toHaveLength(3);
    expect(database.list("archive-import-batch")).toHaveLength(4);
    expect(database.get("tiktok-profile-job", id)).toBeDefined();
  }
  await profiles.remove(id);
  expect(imports.get(manual.id)).toBeDefined();
  expect(profiles.get(other)).toBeDefined();
  expect(imports.list()).toHaveLength(1);
  // Reopening uses exactly the committed records; no removed child or owner is resurrected.
  expect(new ArchiveImportService(database, source, taskApi).list()).toHaveLength(1);
  expect(new TikTokProfileService(database, imports, reader).list().map((job) => job.id)).toEqual([other]);
});
it("refuses cleanup while an owned batch is active even if the parent record was interrupted", async () => {
  const id = await ready(1);
  await profiles.start(id, { selection: "all", existing: "skip", allowPartial: false });
  await profiles.tick();
  const child = imports.list()[0]!;
  await profiles.close();
  expect(profiles.get(id)?.phase).toBe("interrupted");
  await expect(profiles.remove(id)).rejects.toMatchObject({ code: "ARCHIVE_IMPORT_BUSY" });
  expect(imports.get(child.id)).toBeDefined();
  expect(profiles.get(id)).toBeDefined();
});
it("requires an explicit partial-list decision and rejects forged or unselected work identities", async () => {
  const id = await ready(2, false);
  await expect(profiles.start(id, { selection: "all", existing: "skip", allowPartial: false })).rejects.toMatchObject({
    code: "TIKTOK_PROFILE_LIST_PARTIAL"
  });
  await expect(
    profiles.start(id, { selection: "selected", itemIds: ["99999"], existing: "skip", allowPartial: true })
  ).rejects.toMatchObject({ code: "TIKTOK_PROFILE_SELECTION_INVALID" });
  await expect(profiles.start(id, { selection: "selected", existing: "skip", allowPartial: true })).rejects.toThrow(
    "请选择"
  );
  await profiles.start(id, { selection: "selected", itemIds: ["12346"], existing: "skip", allowPartial: true });
  await profiles.tick();
  expect(imports.get(imports.list()[0]!.id)?.rows[0]?.inputUrl).toContain("12346");
  await expect(profiles.create("https://www.tiktok.com/@other")).rejects.toMatchObject({ code: "TIKTOK_PROFILE_BUSY" });
  await expect(profiles.remove(id)).rejects.toMatchObject({ code: "TIKTOK_PROFILE_BUSY" });
});
it("keeps ownership atomic on database failure, defers to manual batches, and stops only owned work", async () => {
  const id = await ready(201);
  await profiles.start(id, { selection: "all", existing: "skip", allowPartial: false });
  const upsert = database.upsert.bind(database),
    failure = vi.spyOn(database, "upsert").mockImplementation((entity) => {
      if (entity.kind === "archive-import-batch") throw new Error("write failed");
      return upsert(entity);
    });
  await expect(profiles.tick()).rejects.toThrow("write failed");
  expect(imports.list()).toHaveLength(0);
  expect(database.get("tiktok-profile-job", id)?.payload).toMatchObject({ nextIndex: 0, batchIds: [] });
  failure.mockRestore();
  const manual = await imports.create({
    sourceName: "manual.csv",
    existing: "skip",
    rows: [{ rowNumber: 1, inputUrl: "https://www.tiktok.com/@other/video/99999", inputPlatform: "" }]
  });
  await profiles.tick();
  expect(profiles.get(id)?.message).toContain("等待其他");
  await profiles.cancel(id);
  expect(imports.get(manual.id)?.status).toBe("running");
  expect(taskApi.cancel).not.toHaveBeenCalled();
  expect(profiles.get(id)?.phase).toBe("cancelled");
});
it("retains restart progress, never auto-fetches, and retries only unfinished work", async () => {
  const id = await ready(2);
  await profiles.start(id, { selection: "all", existing: "skip", allowPartial: false });
  await profiles.tick();
  await imports.tick();
  const child = [...tasks.values()][0]!;
  tasks.set(child.id, { ...child, status: "completed", stage: "completed", progress: 100, archiveId: "saved_archive" });
  await profiles.close();
  await imports.stop();
  imports = new ArchiveImportService(database, source, taskApi, { intervalMs: 0, pollMs: 3600000 });
  imports.initialize();
  profiles = new TikTokProfileService(database, imports, reader, { pollMs: 3600000 });
  profiles.initialize();
  expect(profiles.get(id)).toMatchObject({ phase: "interrupted", archivedCount: 1, failedCount: 1 });
  const before = imports.list().length;
  await profiles.tick();
  expect(imports.list()).toHaveLength(before);
  await profiles.retry(id);
  await profiles.tick();
  expect(imports.list()).toHaveLength(2);
  const retried = imports.list().find((batch) => batch.ownerPart === 1)!;
  expect(imports.get(retried.id)?.rows.map((row) => row.inputUrl)).toEqual([works(2)[1]!.url]);
});
it("keeps discoveries after a manual stop and on shutdown without persisting browser sessions", async () => {
  reader.read.mockImplementationOnce(async (_url, signal: AbortSignal, update: (value: ProfileDiscovery) => void) => {
    update(discovery(2, false));
    return new Promise<ProfileDiscovery>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  });
  const job = await profiles.create("https://www.tiktok.com/@shop");
  await vi.waitFor(() => expect(profiles.get(job.id)?.discoveredCount).toBe(2));
  await profiles.cancel(job.id);
  await vi.waitFor(() => expect(profiles.get(job.id)?.phase).toBe("ready"));
  expect(profiles.get(job.id)?.complete).toBe(false);
  expect(profiles.results(job.id)).toHaveLength(2);
  expect(JSON.stringify(database.get("tiktok-profile-job", job.id)?.payload)).not.toContain("cookie");
  await expect(profiles.retry(job.id)).rejects.toMatchObject({ code: "TIKTOK_PROFILE_NO_RETRY" });
  expect(profiles.get("missing_id")).toBeUndefined();
  expect(profiles.page("missing_id")).toBeUndefined();
  await expect(profiles.remove("missing_id")).rejects.toMatchObject({ code: "TIKTOK_PROFILE_NOT_FOUND" });
});
it("does not create a late child batch when shutdown starts during preview", async () => {
  const id = await ready(1);
  await profiles.start(id, { selection: "all", existing: "skip", allowPartial: false });
  let resolve!: (value: undefined) => void;
  source.findBySource.mockReturnValueOnce(
    new Promise<undefined>((done) => {
      resolve = done;
    })
  );
  const tick = profiles.tick();
  await vi.waitFor(() => expect(resolve).toBeTypeOf("function"));
  const closing = profiles.close();
  resolve(undefined);
  await tick;
  await closing;
  expect(imports.list()).toHaveLength(0);
  expect(taskApi.createImport).not.toHaveBeenCalled();
  expect(profiles.get(id)?.phase).toBe("interrupted");
});
it("caps retained histories without deleting older records and rejects corrupt stored ownership", async () => {
  for (let index = 0; index < 20; index++) await ready(0, false);
  expect(profiles.list()).toHaveLength(20);
  await expect(profiles.create("https://www.tiktok.com/@shop")).rejects.toMatchObject({
    code: "TIKTOK_PROFILE_HISTORY_FULL"
  });
  await profiles.remove(profiles.list()[0]!.id);
  const id = await ready(1);
  await profiles.close();
  const stored = database.get("tiktok-profile-job", id)!;
  const payload = JSON.parse(JSON.stringify(stored.payload)) as { works: TikTokProfileWork[] };
  payload.works[0]!.url = "https://evil.test/video/12345";
  database.upsert({ ...stored, payload });
  expect(() => new TikTokProfileService(database, imports, reader)).toThrow("RECORD_INVALID");
  expect(database.get("tiktok-profile-job", id)?.payload).toEqual(payload);
});
it("retries one failed work, preserving refresh policy and leaving other failures untouched", async () => {
  const id = await failWorks();
  await expect(profiles.retry(id, "99999")).rejects.toMatchObject({ code: "TIKTOK_PROFILE_NO_RETRY" });
  await profiles.retry(id, "12345");
  expect(profiles.get(id)).toMatchObject({ failedCount: 1, pendingCount: 1 });
  await profiles.tick();
  const batch = imports.list().find((batch) => batch.ownerPart === 1)!;
  expect(imports.get(batch.id)).toMatchObject({ existing: "refresh", rows: [{ inputUrl: works(1)[0]!.url }] });
  await expect(profiles.retry(id, "12345")).rejects.toMatchObject({ code: "TIKTOK_PROFILE_NO_RETRY" });
});
it("queues a row retry behind the current batch without restarting it or duplicating other works", async () => {
  const id = await failWorks(2, false);
  const original = imports.list()[0]!;
  const before = database.get("tiktok-profile-job", id)!.payload as { currentBatchId: string };
  await profiles.retry(id, "12345");
  expect(database.get("tiktok-profile-job", id)!.payload).toMatchObject({
    currentBatchId: before.currentBatchId,
    nextIndex: 1,
    selectedIds: ["12346", "12345"]
  });
  expect(profiles.page(id)?.items[0]?.outcome?.status).toBe("waiting");
  await expect(profiles.retry(id, "12345")).rejects.toMatchObject({ code: "TIKTOK_PROFILE_NO_RETRY" });
  expect(imports.get(original.id)?.rows).toHaveLength(2);
  await profiles.tick();
  const retry = imports.list().find((batch) => batch.ownerPart === 1)!;
  expect(imports.get(retry.id)?.rows.map((row) => row.inputUrl)).toEqual([works(1)[0]!.url]);
  await profiles.cancel(id);
  expect(profiles.get(id)?.phase).toBe("cancelled");
});
it("accepts a failed row retry while another work is still running, without replacing that work", async () => {
  const id = await ready(3);
  await profiles.start(id, { selection: "all", existing: "skip", allowPartial: false });
  await profiles.tick();
  await imports.tick();
  const first = [...tasks.values()][0]!;
  tasks.set(first.id, { ...first, status: "failed", stage: "failed" });
  await imports.tick();
  const running = [...tasks.values()].find((task) => task.status === "pending")!;
  const batchId = imports.list()[0]!.id;
  expect(imports.get(batchId)?.status).toBe("running");
  await profiles.retry(id, "12345");
  expect(taskApi.createImport).toHaveBeenCalledTimes(2);
  expect(taskApi.cancel).not.toHaveBeenCalled();
  expect(tasks.get(running.id)?.status).toBe("pending");
  await profiles.tick();
  expect(imports.list()).toHaveLength(1);
  expect(profiles.page(id)?.items[0]?.outcome?.status).toBe("waiting");
});
it("matches committed single-work successes by platform and ID, preserving batch rows and surviving task eviction/restart", async () => {
  const id = await failWorks();
  const batch = imports.get(imports.list()[0]!.id)!;
  saveArchive();
  completeManual();
  const upsert = vi.spyOn(database, "upsert");
  expect(profiles.page(id)?.items[0]?.outcome).toMatchObject({
    status: "completed",
    progress: 100,
    archiveId: "manual_archive"
  });
  expect(profiles.get(id)).toMatchObject({ archivedCount: 1, failedCount: 1 });
  expect(profiles.results(id)[0]?.outcome?.errorCode).toBeUndefined();
  expect(profiles.list()[0]?.archivedCount).toBe(1);
  expect(upsert).not.toHaveBeenCalled();
  await profiles.tick();
  expect(imports.get(batch.id)?.rows).toEqual(batch.rows);
  upsert.mockClear();
  await profiles.tick();
  expect(upsert).not.toHaveBeenCalled();
  expect(database.get("tiktok-profile-job", id)?.payload).toMatchObject({
    successMatches: [{ workId: "12345", archiveId: "manual_archive" }]
  });
  database.remove("archive-fetch-task", "manual_task");
  await profiles.close();
  profiles = new TikTokProfileService(database, imports, reader, { pollMs: 3600000 });
  profiles.initialize();
  expect(profiles.get(id)).toMatchObject({ archivedCount: 1, failedCount: 1 });
  database.remove("xhs-archive", "manual_archive");
  expect(profiles.get(id)).toMatchObject({ archivedCount: 0, failedCount: 2 });
});
it("does not confuse old successes, other platforms/IDs, running retries or an explicit later refresh", async () => {
  const id = await failWorks();
  saveArchive("douyin");
  completeManual("manual_archive", undefined, "douyin");
  expect(profiles.get(id)?.archivedCount).toBe(0);
  saveArchive("tiktok", "99999", "unrelated_archive");
  completeManual("unrelated_archive");
  expect(profiles.get(id)?.archivedCount).toBe(0);
  saveArchive("tiktok", "12345", "tiktok_archive");
  completeManual("tiktok_archive", "2020-01-01T00:00:00.000Z");
  expect(profiles.get(id)?.archivedCount).toBe(0);
  completeManual("tiktok_archive");
  await profiles.tick();
  expect(profiles.get(id)?.archivedCount).toBe(1);
  await profiles.start(id, { selection: "selected", itemIds: ["12345"], existing: "refresh", allowPartial: true });
  expect(profiles.page(id)?.items[0]?.outcome?.status).toBe("waiting");
  await profiles.tick();
  await imports.tick();
  expect(profiles.get(id)?.archivedCount).toBe(0);
  const running = [...tasks.values()].find((task) => task.status === "pending")!;
  const failed: ContentArchiveTask = {
    ...running,
    status: "failed",
    stage: "failed",
    updatedAt: new Date(Date.now() + 2000).toISOString()
  };
  tasks.set(failed.id, failed);
  persistTask(failed);
  await imports.tick();
  expect(profiles.get(id)?.archivedCount).toBe(0);
});
it("persists matching after the import row catches up with an already failed task and a later single success", async () => {
  const id = await ready(1);
  await profiles.start(id, { selection: "all", existing: "skip", allowPartial: false });
  await profiles.tick();
  await imports.tick();
  const first = [...tasks.values()][0]!;
  const failed: ContentArchiveTask = {
    ...first,
    status: "failed",
    stage: "failed",
    updatedAt: new Date().toISOString()
  };
  tasks.set(first.id, failed);
  persistTask(failed);
  saveArchive();
  completeManual();
  await profiles.tick();
  // The child batch still reports waiting/running until its own coordinator polls the task.
  expect(profiles.get(id)?.archivedCount).toBe(0);
  await imports.tick();
  await profiles.tick();
  expect(database.get("tiktok-profile-job", id)?.payload).toMatchObject({
    successMatches: [{ workId: "12345", archiveId: "manual_archive" }]
  });
  database.remove("archive-fetch-task", "manual_task");
  expect(profiles.get(id)?.archivedCount).toBe(1);
});
