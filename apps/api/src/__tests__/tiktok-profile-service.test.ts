import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ContentArchiveTask, TikTokProfileWork } from "@toolbox/shared";
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
