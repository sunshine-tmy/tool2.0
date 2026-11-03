// @vitest-environment happy-dom
import { effectScope } from "vue";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { audioConvertApi as api } from "./api";
import { useConversion } from "./useConversion";
vi.mock("./api", () => ({ audioConvertApi: { list: vi.fn(), job: vi.fn(), upload: vi.fn(), cancel: vi.fn() } }));
const scopes: ReturnType<typeof effectScope>[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(api.list).mockReset().mockResolvedValue({ items: [], total: 0 });
  vi.mocked(api.upload).mockReset();
  vi.mocked(api.job).mockReset();
  vi.mocked(api.cancel).mockReset();
});
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop();
  vi.useRealTimers();
});
function setup() {
  const scope = effectScope();
  scopes.push(scope);
  return scope.run(() => useConversion())!;
}
const job = (id: string, status: "pending" | "running" | "failed" | "completed" = "completed") => ({
  id,
  name: `${id}.flac`,
  bitrate: 192 as const,
  status,
  progress: status === "completed" ? 100 : 0,
  createdAt: "2026-11-01",
  updatedAt: "2026-11-01"
});
it("admits up to 1000 files and rejects oversize, invalid or too many files", () => {
  const state = setup(),
    file = new File(["data"], "合法.ogg");
  state.choose(Array.from({ length: 1000 }, () => file));
  expect(state.remaining.value).toBe(1000);
  state.choose(Array.from({ length: 1001 }, () => file));
  expect(state.error.value).toContain("1000");
  expect(state.remaining.value).toBe(1000);
  state.choose([new File(["wrong"], "fake.mp4")]);
  expect(state.error.value).toContain("100 MiB");
});
it("uploads serially, freezes batch bitrate and only retains EKey until admission", async () => {
  const state = setup();
  state.choose([new File(["a"], "a.mgg"), new File(["b"], "b.flac")]);
  state.files.value[0].ekey = "first-key";
  vi.mocked(api.upload).mockResolvedValueOnce(job("one", "running")).mockResolvedValueOnce(job("two"));
  vi.mocked(api.job).mockResolvedValue(job("one"));
  const run = state.start();
  await flushPromises();
  expect(api.upload).toHaveBeenCalledTimes(1);
  expect(state.files.value[0].ekey).toBe("");
  state.bitrate.value = 320;
  await vi.advanceTimersByTimeAsync(1500);
  await run;
  expect(api.upload).toHaveBeenCalledTimes(2);
  expect(vi.mocked(api.upload).mock.calls[1][1]).toBe(192);
  expect(state.files.value.map((f) => f.state)).toEqual(["已完成", "已完成"]);
});
it("stops only subsequent uploads while the admitted job continues", async () => {
  const state = setup();
  state.choose([new File(["a"], "a.flac"), new File(["b"], "b.flac")]);
  vi.mocked(api.upload).mockResolvedValue(job("one", "running"));
  vi.mocked(api.job).mockResolvedValue(job("one"));
  const run = state.start();
  await flushPromises();
  state.stopQueue();
  await vi.advanceTimersByTimeAsync(1500);
  await run;
  expect(api.upload).toHaveBeenCalledTimes(1);
  expect(api.cancel).not.toHaveBeenCalled();
  expect(state.remaining.value).toBe(1);
});
it("releases browser polling and unsubmitted keys on disposal without canceling server jobs", async () => {
  const state = setup();
  state.choose([new File(["a"], "a.mgg")]);
  state.files.value[0].ekey = "private";
  vi.mocked(api.upload).mockResolvedValue(job("one", "pending"));
  const run = state.start();
  await flushPromises();
  scopes.at(-1)!.stop();
  await run;
  expect(state.files.value[0].ekey).toBe("");
  expect(api.cancel).not.toHaveBeenCalled();
  expect(vi.mocked(api.upload).mock.calls[0][3].aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
it("keeps failure visible and continues with the next file", async () => {
  const state = setup();
  state.choose([new File(["a"], "a.flac"), new File(["b"], "b.flac")]);
  vi.mocked(api.upload).mockRejectedValueOnce(new Error("invalid")).mockResolvedValueOnce(job("two"));
  await state.start();
  expect(state.files.value.map((f) => f.state)).toEqual(["失败", "已完成"]);
  expect(state.files.value[0].error).toBeTruthy();
});
it("discards a late response for the previous page and immediately loads the new page", async () => {
  let finish!: (value: Awaited<ReturnType<typeof api.list>>) => void;
  vi.mocked(api.list)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    )
    .mockResolvedValue({ items: [job("new-page")], total: 51 });
  const state = setup();
  state.page.value = 2;
  await flushPromises();
  finish({ items: [job("old-page")], total: 51 });
  await flushPromises();
  expect(api.list).toHaveBeenLastCalledWith(2, expect.any(AbortSignal));
  expect(state.jobs.value.map((j) => j.id)).toEqual(["new-page"]);
});
it("preserves off-page selections while removing loaded records that are no longer completed", async () => {
  vi.mocked(api.list).mockResolvedValue({ items: [job("completed"), job("failed", "failed")], total: 51 });
  const state = setup();
  await flushPromises();
  state.selected.value = ["off-page", "completed", "failed"];
  await state.load();
  expect(state.selected.value).toEqual(["off-page", "completed"]);
  state.page.value = 2;
  vi.mocked(api.list).mockResolvedValue({ items: [job("off-page")], total: 51 });
  await flushPromises();
  expect(state.selected.value).toEqual(["off-page", "completed"]);
});
