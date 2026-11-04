// @vitest-environment happy-dom
import { effectScope } from "vue";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { JSON_AUTO_BYTES, JSON_LIMITS, processJson, type JsonWorkerReply, type JsonWorkerRequest } from "./processor";
import { useJsonFormatter } from "./useJsonFormatter";
class WorkerStub {
  onmessage: ((event: MessageEvent<JsonWorkerReply>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  request!: JsonWorkerRequest;
  terminate = vi.fn();
  postMessage(request: JsonWorkerRequest) {
    this.request = request;
  }
  finish() {
    this.onmessage?.({
      data: { id: this.request.id, result: processJson(this.request.text, this.request) }
    } as MessageEvent<JsonWorkerReply>);
  }
}
let scope: ReturnType<typeof effectScope>;
const workers: WorkerStub[] = [];
function setup(
  factory = () => {
    const worker = new WorkerStub();
    workers.push(worker);
    return worker;
  }
) {
  scope = effectScope();
  return scope.run(() => useJsonFormatter(factory))!;
}
beforeEach(() => {
  vi.useFakeTimers();
  workers.length = 0;
});
afterEach(() => {
  scope?.stop();
  vi.useRealTimers();
});
it("debounces small input, cancels stale work and exports only results for the latest source and options", async () => {
  const state = setup();
  state.source.value = '{"id":9007199254740993}';
  await vi.advanceTimersByTimeAsync(299);
  expect(workers).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(1);
  expect(state.busy.value).toBe(true);
  const late = workers[0].onmessage!;
  state.source.value = '{"x":2}';
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  late({
    data: { id: workers[0].request.id, result: processJson("1", workers[0].request) }
  } as MessageEvent<JsonWorkerReply>);
  expect(state.result.value).toBeUndefined();
  await vi.advanceTimersByTimeAsync(300);
  workers[1].finish();
  expect(state.canExport.value).toBe(true);
  expect(state.result.value?.text).toContain('"x": 2');
  state.indent.value = "tab";
  expect(state.stale.value).toBe(true);
  expect(state.canExport.value).toBe(false);
  state.run("minify");
  workers.at(-1)!.finish();
  expect(state.result.value?.text).toBe('{"x":2}');
  expect(state.canExport.value).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
it("keeps previous output visible but blocks export after invalid input, until it is fixed", () => {
  const state = setup();
  state.source.value = "[]";
  state.run();
  workers[0].finish();
  state.source.value = "[1,]";
  state.run();
  workers[1].finish();
  expect(state.error.value?.code).toBe("syntax");
  expect(state.result.value?.text).toBe("[]");
  expect(state.canExport.value).toBe(false);
  state.source.value = "[1]";
  state.run();
  workers[2].finish();
  expect(state.error.value).toBeUndefined();
  expect(state.canExport.value).toBe(true);
});
it("processes large text manually, refuses oversized UTF-8 text before worker creation, and leaves whitespace idle", async () => {
  const state = setup();
  state.source.value = '"' + "a".repeat(JSON_AUTO_BYTES) + '"';
  await vi.advanceTimersByTimeAsync(1000);
  expect(workers).toHaveLength(0);
  state.run();
  workers[0].finish();
  expect(state.canExport.value).toBe(true);
  state.source.value = '"' + "中".repeat(Math.ceil(JSON_LIMITS.inputBytes / 3)) + '"';
  state.run();
  expect(state.error.value?.code).toBe("limit");
  expect(workers).toHaveLength(1);
  state.source.value = " \r\n\t";
  await vi.advanceTimersByTimeAsync(300);
  expect(state.result.value).toBeUndefined();
  expect(state.error.value).toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
});
it("supports manual processing and toggling automatic mode without replacing the input", async () => {
  const state = setup();
  state.automatic.value = false;
  state.source.value = "true";
  await vi.advanceTimersByTimeAsync(1000);
  expect(workers).toHaveLength(0);
  state.automatic.value = true;
  await vi.advanceTimersByTimeAsync(300);
  workers[0].finish();
  expect(state.result.value?.text).toBe("true");
  expect(state.source.value).toBe("true");
});
it("terminates timed-out workers, accepts retry and ignores wrong request IDs", async () => {
  const state = setup();
  state.source.value = "[]";
  state.run();
  workers[0].onmessage!({ data: { id: -1, result: { ok: false } } } as MessageEvent<JsonWorkerReply>);
  expect(state.busy.value).toBe(true);
  await vi.advanceTimersByTimeAsync(5000);
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  expect(state.error.value?.message).toContain("5 秒");
  state.run();
  workers[1].finish();
  expect(state.canExport.value).toBe(true);
});
it("handles worker startup errors and runtime failures without discarding input", () => {
  const state = setup(() => {
    throw Error("blocked");
  });
  state.source.value = "{}";
  state.run();
  expect(state.error.value?.message).toContain("无法启动");
  expect(state.source.value).toBe("{}");
  scope.stop();
  const runtime = setup();
  runtime.source.value = "{}";
  runtime.run();
  workers[0].onerror!(new ErrorEvent("error", { cancelable: true }));
  expect(runtime.error.value?.message).toContain("后台处理");
  expect(runtime.busy.value).toBe(false);
});
it("clears state and releases timers and worker even when its response arrives after disposal", () => {
  const state = setup();
  state.source.value = "{}";
  state.run();
  const late = workers[0].onmessage!,
    request = workers[0].request;
  state.cancel();
  expect(state.busy.value).toBe(false);
  state.run();
  state.clear();
  expect(state.empty.value).toBe(true);
  expect(state.result.value).toBeUndefined();
  state.source.value = "[]";
  state.run();
  scope.stop();
  late({ data: { id: request.id, result: processJson(request.text, request) } } as MessageEvent<JsonWorkerReply>);
  expect(state.result.value).toBeUndefined();
  expect(state.source.value).toBe("");
  expect(vi.getTimerCount()).toBe(0);
});
it("imports UTF-8 files with BOM and sanitizes the download name without accepting unsupported or oversized files", async () => {
  const state = setup();
  await state.importFile(new File([new Uint8Array([0xef, 0xbb, 0xbf]), '{"x":1}'], "数据.TXT"));
  expect(state.source.value).toBe('\ufeff{"x":1}');
  expect(state.fileName.value).toBe("数据.json");
  state.run();
  workers[0].finish();
  expect(state.result.value?.warningCount).toBe(1);
  await state.importFile(new File(["bad"], "x.exe"));
  expect(state.notice.value).toContain(".json");
  expect(state.source.value).toContain('"x"');
  const huge = new File(["x"], "huge.json");
  Object.defineProperty(huge, "size", { value: JSON_LIMITS.inputBytes + 1 });
  await state.importFile(huge);
  expect(state.notice.value).toContain("5 MiB");
  await state.importFile(new File([new Uint8Array([0xff, 0xff])], "invalid.json"));
  expect(state.notice.value).toContain("UTF-8");
});
it("does not let a late file read replace user edits, a newer import, clear or disposed state", async () => {
  const state = setup(),
    file = new File(["null"], "slow.json");
  const pending: Array<(data: ArrayBuffer) => void> = [];
  vi.spyOn(file, "arrayBuffer").mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
  const bytes = new TextEncoder().encode("null").buffer;
  let read = state.importFile(file);
  state.source.value = "1";
  pending[0](bytes);
  await read;
  expect(state.source.value).toBe("1");
  read = state.importFile(file);
  await state.importFile(new File(["true"], "new.json"));
  pending[1](bytes);
  await read;
  expect(state.source.value).toBe("true");
  read = state.importFile(file);
  state.clear();
  pending[2](bytes);
  await read;
  expect(state.source.value).toBe("");
  read = state.importFile(file);
  scope.stop();
  pending[3](bytes);
  await read;
  await flushPromises();
  expect(state.source.value).toBe("");
});
