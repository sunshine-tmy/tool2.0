// @vitest-environment happy-dom
import { effectScope, nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ArchiveImportBatch, ArchiveImportPreview, TikTokProfileJob } from "@toolbox/shared";
import { useArchiveBatchImport } from "./useArchiveBatchImport";
import { ApiRequestError } from "../../shared/http/http";
const api = vi.hoisted(() => ({
  preview: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  cancel: vi.fn(),
  retry: vi.fn(),
  remove: vi.fn()
}));
const profiles = vi.hoisted(() => ({ get: vi.fn(), cancel: vi.fn(), remove: vi.fn() }));
vi.mock("./content-api", () => ({ archiveImportApi: api, tiktokProfileApi: profiles }));
const owner: TikTokProfileJob = {
  id: "profile_123",
  username: "shop",
  url: "https://www.tiktok.com/@shop",
  phase: "completed",
  complete: true,
  discoveredCount: 2,
  archivedCount: 1,
  failedCount: 1,
  skippedCount: 0,
  pendingCount: 0,
  batchCount: 2,
  message: "本次所选作品已处理完毕",
  createdAt: "2026-10-26T00:00:00Z",
  updatedAt: "2026-10-26T00:00:00Z"
};
const row = {
  rowNumber: 2,
  inputUrl: "https://vt.tiktok.com/AAAAA/",
  inputPlatform: "",
  platform: "tiktok" as const,
  url: "https://vt.tiktok.com/AAAAA/",
  progress: 0,
  message: "等待"
};
const preview: ArchiveImportPreview = { sourceName: "test.csv", rows: [{ ...row, status: "ready" }] };
function batch(status: ArchiveImportBatch["status"] = "running"): ArchiveImportBatch {
  return {
    ...preview,
    id: "batch_123",
    existing: "skip",
    status,
    createdAt: "2026-10-26T00:00:00Z",
    updatedAt: "2026-10-26T00:00:00Z",
    rows: [{ ...row, status: status === "completed" ? "completed" : "waiting" }]
  };
}
const scopes: ReturnType<typeof effectScope>[] = [];
function setup() {
  const scope = effectScope();
  scopes.push(scope);
  const error = vi.fn(),
    changed = vi.fn();
  const model = scope.run(() => useArchiveBatchImport(error, changed))!;
  return { scope, model, error, changed };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  api.list.mockResolvedValue([]);
  api.preview.mockResolvedValue(preview);
  api.create.mockResolvedValue(batch());
  api.get.mockResolvedValue(batch());
  profiles.get.mockResolvedValue(owner);
  profiles.remove.mockResolvedValue({ removed: true });
});
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop());
  vi.useRealTimers();
});
it("uploads for validation and confirms only the raw rows with explicit existing-work policy", async () => {
  const { model } = setup();
  await model.show();
  const file = new File(["作品链接"], "test.csv");
  await model.upload(file);
  expect(api.preview).toHaveBeenCalledWith(file, expect.any(AbortSignal));
  expect(api.create).not.toHaveBeenCalled();
  model.existing.value = "refresh";
  model.groupId.value = "group_123";
  await model.start();
  expect(api.create).toHaveBeenCalledWith(
    {
      sourceName: "test.csv",
      sheetName: undefined,
      existing: "refresh",
      groupId: "group_123",
      rows: [{ rowNumber: 2, inputUrl: row.inputUrl, inputPlatform: "" }]
    },
    expect.any(AbortSignal)
  );
  expect(model.batch.value?.id).toBe("batch_123");
  expect(model.preview.value).toBeUndefined();
});
it("stops UI polling when hidden and on disposal without cancelling the server batch", async () => {
  api.list.mockResolvedValue([{ ...batch(), rows: undefined }]);
  const { model, scope } = setup();
  await model.show();
  await vi.advanceTimersByTimeAsync(1600);
  expect(api.get).toHaveBeenCalledTimes(2);
  model.open.value = false;
  await nextTick();
  await vi.advanceTimersByTimeAsync(5000);
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(api.cancel).not.toHaveBeenCalled();
  await model.show();
  scope.stop();
  const count = api.get.mock.calls.length;
  await vi.advanceTimersByTimeAsync(5000);
  expect(api.get).toHaveBeenCalledTimes(count);
  expect((api.get.mock.calls.at(-1)?.[1] as AbortSignal).aborted).toBe(true);
});
it("ignores late detail responses after another batch is selected and notifies completion once", async () => {
  let resolve!: (value: ArchiveImportBatch) => void;
  api.get
    .mockImplementationOnce(
      () =>
        new Promise<ArchiveImportBatch>((done) => {
          resolve = done;
        })
    )
    .mockResolvedValue({ ...batch("completed"), id: "batch_456" });
  const { model, changed } = setup();
  model.open.value = true;
  const first = model.select("batch_123");
  await flushPromises();
  await model.select("batch_456");
  resolve(batch());
  await first;
  expect(model.batch.value?.id).toBe("batch_456");
  expect(changed).toHaveBeenCalledOnce();
  await model.select("batch_456");
  expect(changed).toHaveBeenCalledOnce();
});
it("reports validation/network failures and handles cancel, retry and metadata-only deletion", async () => {
  const { model, error } = setup();
  await model.show();
  await model.upload(new File(["bad"], "test.xls"));
  expect(api.preview).not.toHaveBeenCalled();
  expect(error).toHaveBeenCalled();
  api.preview.mockRejectedValueOnce(new Error("bad file"));
  await model.upload(new File(["data"], "test.csv"));
  expect(model.busy.value).toBe(false);
  await model.upload(new File(["data"], "test.csv"));
  await model.start();
  api.cancel.mockResolvedValue(batch("cancelled"));
  await model.cancel();
  expect(model.batch.value?.status).toBe("cancelled");
  api.retry.mockResolvedValue({ ...batch(), id: "retry_123" });
  await model.retry();
  expect(model.batch.value?.id).toBe("retry_123");
  api.remove.mockResolvedValue({ removed: true });
  await model.remove();
  expect(model.batch.value).toBeUndefined();
});
it("cleans a selected owner's records in one request and retains unrelated batches, including on failure", async () => {
  const owned = { ...batch("completed"), ownerProfileId: owner.id };
  const sibling = { ...owned, id: "sibling_123" };
  const unrelated = { ...batch("completed"), id: "manual_123" };
  api.list.mockResolvedValue([owned, sibling, unrelated]);
  api.get.mockResolvedValue(owned);
  const { model, error } = setup();
  await model.show();
  expect(model.owner.value?.id).toBe(owner.id);
  profiles.remove.mockRejectedValueOnce(new Error("cleanup failed"));
  await model.remove();
  expect(error).toHaveBeenCalled();
  expect(model.history.value).toHaveLength(3);
  expect(model.batch.value?.id).toBe(owned.id);
  await model.remove();
  expect(profiles.remove).toHaveBeenLastCalledWith(owner.id, expect.any(AbortSignal));
  expect(api.remove).not.toHaveBeenCalled();
  expect(model.history.value.map((entry) => entry.id)).toEqual([unrelated.id]);
  expect(model.batch.value).toBeUndefined();
  expect(model.owner.value).toBeUndefined();
});
it("can stop the owning profile from a terminal batch and tracks the parent until it is safe to clean", async () => {
  const owned = { ...batch("completed"), ownerProfileId: owner.id };
  api.list.mockResolvedValue([owned]);
  api.get.mockResolvedValue(owned);
  profiles.get.mockResolvedValue({ ...owner, phase: "archiving" });
  const { model } = setup();
  await model.show();
  expect(model.ownerActive.value).toBe(true);
  await vi.advanceTimersByTimeAsync(1600);
  expect(profiles.get).toHaveBeenCalledTimes(2);
  profiles.cancel.mockResolvedValue({ ...owner, phase: "stopping" });
  profiles.get.mockResolvedValue({ ...owner, phase: "cancelled" });
  await model.cancelOwner();
  expect(profiles.cancel).toHaveBeenCalledWith(owner.id, expect.any(AbortSignal));
  expect(api.cancel).not.toHaveBeenCalled();
  expect(model.ownerActive.value).toBe(false);
  expect(model.busy.value).toBe(false);
  const calls = profiles.get.mock.calls.length;
  await vi.advanceTimersByTimeAsync(1600);
  expect(profiles.get).toHaveBeenCalledTimes(calls);
});
it("keeps older orphan batches independently manageable but does not interpret network failure as a missing owner", async () => {
  const owned = { ...batch("completed"), ownerProfileId: owner.id };
  api.list.mockResolvedValue([owned]);
  api.get.mockResolvedValue(owned);
  profiles.get.mockRejectedValueOnce(new Error("owner network unavailable"));
  const { model, error } = setup();
  await model.show();
  expect(error).toHaveBeenCalled();
  expect(model.batch.value).toBeUndefined();
  profiles.get.mockRejectedValueOnce(
    new ApiRequestError("missing owner", { code: "TIKTOK_PROFILE_NOT_FOUND", status: 404 })
  );
  await model.select(owned.id);
  expect(model.batch.value?.id).toBe(owned.id);
  expect(model.owner.value).toBeUndefined();
  api.remove.mockResolvedValue({ removed: true });
  await model.remove();
  expect(api.remove).toHaveBeenCalledWith(owned.id, expect.any(AbortSignal));
  expect(profiles.remove).not.toHaveBeenCalled();
});
it("ignores an owner's late response after the selected batch changes", async () => {
  const owned = { ...batch("completed"), ownerProfileId: owner.id };
  let finish!: (value: TikTokProfileJob) => void;
  profiles.get.mockImplementationOnce(
    () =>
      new Promise<TikTokProfileJob>((resolve) => {
        finish = resolve;
      })
  );
  api.get.mockResolvedValueOnce(owned).mockResolvedValueOnce({ ...batch("completed"), id: "manual_123" });
  const { model } = setup();
  model.open.value = true;
  const pending = model.select(owned.id);
  await flushPromises();
  await model.select("manual_123");
  finish(owner);
  await pending;
  expect(model.batch.value?.id).toBe("manual_123");
  expect(model.owner.value).toBeUndefined();
});
it("refuses an owner identity mismatch before exposing any cleanup action", async () => {
  const owned = { ...batch("completed"), ownerProfileId: owner.id };
  api.list.mockResolvedValue([owned]);
  api.get.mockResolvedValue(owned);
  profiles.get.mockResolvedValue({ ...owner, id: "other_123" });
  const { model, error } = setup();
  await model.show();
  expect(model.batch.value).toBeUndefined();
  expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: "ARCHIVE_IMPORT_OWNER_MISMATCH" }));
  await model.remove();
  expect(profiles.remove).not.toHaveBeenCalled();
  expect(api.remove).not.toHaveBeenCalled();
});
