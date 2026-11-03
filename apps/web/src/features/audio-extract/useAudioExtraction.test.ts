// @vitest-environment happy-dom
import { effectScope } from "vue";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAudioExtraction } from "./useAudioExtraction";
const mock = vi.hoisted(() => ({
  upload: vi.fn(),
  discard: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
  job: vi.fn()
}));
vi.mock("./api", () => ({ audioExtractApi: mock }));
let scope: ReturnType<typeof effectScope> | undefined;
const source = {
  id: "source1",
  name: "video.mp4",
  tracks: [
    { index: 1, default: false, language: "zho" },
    { index: 2, default: true, language: "eng" }
  ]
};
const completed = { id: "job1", status: "completed", progress: 100 };
beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  mock.list.mockResolvedValue({ items: [], total: 0 });
  mock.upload.mockResolvedValue(source);
  mock.create.mockResolvedValue({ items: [completed], total: 1 });
  mock.discard.mockResolvedValue({ ok: true });
});
afterEach(() => {
  scope?.stop();
  vi.useRealTimers();
});
function setup() {
  scope = effectScope();
  return scope.run(() => useAudioExtraction())!;
}
const file = (name = "video.mp4") => new File(["synthetic"], name);
it("validates file count/container/size before upload", () => {
  const state = setup();
  state.choose(Array.from({ length: 1001 }, () => file()));
  expect(state.error.value).toContain("1000");
  state.choose([file("bad.txt")]);
  expect(state.files.value).toEqual([]);
  const huge = file();
  Object.defineProperty(huge, "size", { value: 2 * 1024 ** 3 + 1 });
  state.choose([huge]);
  expect(state.error.value).toContain("2 GiB");
  expect(mock.upload).not.toHaveBeenCalled();
});
it("uses the default-marked stream and freezes output parameters for an active batch", async () => {
  const state = setup();
  state.choose([file(), file("second.mkv")]);
  let release: ((v: typeof source) => void) | undefined;
  mock.upload.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  const work = state.start();
  await flushPromises();
  state.format.value = "original";
  state.bitrate.value = 320;
  release!(source);
  await work;
  expect(mock.create).toHaveBeenCalledTimes(2);
  expect(mock.create.mock.calls[0][0]).toMatchObject({ trackIndices: [2], format: "mp3", bitrate: 192 });
  expect(mock.create.mock.calls[1][0].format).toBe("mp3");
});
it("queues 1000 selections serially without starting parallel uploads", async () => {
  let active = 0,
    max = 0;
  mock.upload.mockImplementation(async () => {
    max = Math.max(max, ++active);
    await Promise.resolve();
    active--;
    return source;
  });
  const state = setup();
  state.choose(Array.from({ length: 1000 }, (_, i) => file(`${i}.mp4`)));
  await state.start();
  expect(mock.upload).toHaveBeenCalledTimes(1000);
  expect(max).toBe(1);
  expect(state.files.value.every((r) => r.state === "已完成")).toBe(true);
});
it("waits for manual multi-track confirmation and cleans an unsubmitted source when stopped", async () => {
  const state = setup();
  state.policy.value = "manual";
  state.choose([file(), file("other.mp4")]);
  const work = state.start();
  await flushPromises();
  expect(state.waiting.value?.source?.tracks).toHaveLength(2);
  expect(mock.create).not.toHaveBeenCalled();
  state.stopQueue();
  await work;
  expect(mock.discard).toHaveBeenCalledWith("source1");
  expect(mock.upload).toHaveBeenCalledTimes(1);
  expect(state.busy.value).toBe(false);
});
it("submits explicitly chosen streams and all-track policy without mixing tracks", async () => {
  const state = setup();
  state.policy.value = "manual";
  state.choose([file()]);
  const work = state.start();
  await flushPromises();
  state.waiting.value!.tracks = [1];
  state.confirmRow();
  await work;
  expect(mock.create.mock.calls[0][0].trackIndices).toEqual([1]);
  state.policy.value = "all";
  state.choose([file()]);
  await state.start();
  expect(mock.create.mock.calls[1][0].trackIndices).toEqual([1, 2]);
});
it("cancels one unsubmitted metadata selection and continues with the next video", async () => {
  const state = setup();
  state.policy.value = "manual";
  state.choose([file(), file("next.mp4")]);
  const work = state.start();
  await flushPromises();
  state.cancelRow(state.files.value[0]);
  await flushPromises();
  expect(state.files.value[0].state).toBe("已取消");
  expect(mock.discard).toHaveBeenCalledWith("source1");
  expect(mock.upload).toHaveBeenCalledTimes(2);
  state.confirmRow();
  await work;
  expect(mock.create).toHaveBeenCalledTimes(1);
});
it("waits for the current accepted job before uploading the next video", async () => {
  mock.create.mockResolvedValueOnce({ items: [{ ...completed, status: "running", progress: 10 }], total: 1 });
  mock.job.mockResolvedValue(completed);
  const state = setup();
  state.choose([file(), file("other.mp4")]);
  const work = state.start();
  await flushPromises();
  expect(mock.upload).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1000);
  await work;
  expect(mock.upload).toHaveBeenCalledTimes(2);
});
it("stops on admission backpressure and does not flood the server with remaining files", async () => {
  mock.upload.mockRejectedValueOnce(Object.assign(Error("busy"), { status: 429 }));
  const state = setup();
  state.choose([file(), file("next.mp4")]);
  await state.start();
  expect(mock.upload).toHaveBeenCalledTimes(1);
  expect(state.files.value[0].state).toBe("失败");
  expect(state.remaining.value).toBe(1);
});
it("aborts requests on disposal and ignores stale page responses", async () => {
  const requests: Array<(v: { items: []; total: number }) => void> = [];
  mock.list.mockImplementation(() => new Promise((resolve) => requests.push(resolve)));
  const state = setup();
  state.page.value = 2;
  await flushPromises();
  requests[1]({ items: [], total: 75 });
  await flushPromises();
  requests[0]({ items: [], total: 999 });
  await flushPromises();
  expect(state.total.value).toBe(75);
  const signal = mock.list.mock.calls[0][1] as AbortSignal;
  scope!.stop();
  expect(signal.aborted).toBe(true);
});
it("retains cross-page selections and bounds incremental selection to 1000 results", async () => {
  mock.list.mockResolvedValue({ items: [completed], total: 1234 });
  const state = setup();
  await flushPromises();
  state.select("job1", true);
  mock.list.mockResolvedValue({ items: [{ ...completed, id: "job2" }], total: 1234 });
  state.page.value = 2;
  await flushPromises();
  state.select("job2", true);
  state.select("job2", true);
  expect(state.selected.value).toEqual(["job1", "job2"]);
  for (let i = 0; i < 998; i++) state.select(String(i), true);
  expect(state.selected.value).toHaveLength(1000);
  state.select("new", true);
  expect(state.selected.value).toHaveLength(1000);
  expect(state.error.value).toContain("1000");
  state.select("job1", false);
  expect(state.selected.value).toHaveLength(999);
  state.select("new", true);
  expect(state.selected.value).toHaveLength(1000);
});
