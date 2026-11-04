// @vitest-environment happy-dom
import { effectScope } from "vue";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { processUrl, URL_CODEC_AUTO_BYTES, URL_CODEC_LIMITS, type UrlReply, type UrlRequest } from "./processor";
import { useUrlCodec } from "./useUrlCodec";
class WorkerStub {
  onmessage: ((event: MessageEvent<UrlReply>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  request!: UrlRequest;
  terminate = vi.fn();
  postMessage(request: UrlRequest) {
    this.request = structuredClone(request);
  }
  finish() {
    this.onmessage?.({
      data: { id: this.request.id, result: processUrl(this.request.source, this.request.settings) }
    } as MessageEvent<UrlReply>);
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
  return scope.run(() => useUrlCodec(factory))!;
}
beforeEach(() => {
  vi.useFakeTimers();
  workers.length = 0;
});
afterEach(() => {
  scope?.stop();
  vi.useRealTimers();
});
it("debounces small text, cancels superseded work and invalidates output on every source/setting change", async () => {
  const state = setup();
  expect(state.direction.value).toBe("encode");
  expect(state.mode.value).toBe("component");
  state.source.value = "中文😀";
  await vi.advanceTimersByTimeAsync(299);
  expect(workers).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(1);
  workers[0].finish();
  expect(state.result.value?.text).toBe("%E4%B8%AD%E6%96%87%F0%9F%98%80");
  expect(state.canExport.value).toBe(true);
  state.source.value = "a b";
  expect(state.stale.value).toBe(true);
  expect(state.canExport.value).toBe(false);
  state.mode.value = "form";
  state.run();
  workers[1].finish();
  expect(state.result.value?.text).toBe("a+b");
  state.direction.value = "decode";
  expect(state.canExport.value).toBe(false);
  state.source.value = "a+b";
  state.run();
  workers[2].finish();
  expect(state.result.value?.text).toBe("a b");
  expect(state.metrics.value).toEqual({ bytes: 3, characters: 3 });
});
it("keeps large text manual, supports disabling/re-enabling automatic work and rejects oversized UTF-8 before worker startup", async () => {
  const state = setup();
  state.source.value = "a".repeat(URL_CODEC_AUTO_BYTES + 1);
  await vi.advanceTimersByTimeAsync(1000);
  expect(workers).toHaveLength(0);
  state.run();
  workers[0].finish();
  expect(state.canExport.value).toBe(true);
  state.automatic.value = false;
  state.source.value = "f";
  await vi.advanceTimersByTimeAsync(1000);
  expect(workers).toHaveLength(1);
  state.automatic.value = true;
  await vi.advanceTimersByTimeAsync(300);
  workers[1].finish();
  expect(state.result.value?.text).toBe("f");
  state.source.value = "中".repeat(Math.ceil(URL_CODEC_LIMITS.inputBytes / 3));
  state.run();
  expect(workers).toHaveLength(2);
  expect(state.error.value?.code).toBe("limit");
  expect(state.canExport.value).toBe(false);
});
it("does not publish a reply with another id or a late reply after cancel, clear or a new request", () => {
  const state = setup();
  state.source.value = "a b";
  state.run();
  const old = workers[0].onmessage!,
    request = workers[0].request;
  old({ data: { id: -1 } } as MessageEvent<UrlReply>);
  expect(state.busy.value).toBe(true);
  state.mode.value = "form";
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  state.run();
  old({ data: { id: request.id, result: processUrl(request.source, request.settings) } } as MessageEvent<UrlReply>);
  expect(state.result.value).toBeUndefined();
  workers[1].finish();
  expect(state.result.value?.text).toBe("a+b");
  state.source.value = "new";
  state.run();
  const late = workers[2].onmessage!,
    next = workers[2].request;
  state.cancel();
  state.clear();
  late({ data: { id: next.id, result: processUrl(next.source, next.settings) } } as MessageEvent<UrlReply>);
  expect(state.source.value).toBe("");
  expect(state.result.value).toBeUndefined();
  expect(state.canExport.value).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
it("makes failed results non-exportable and allows correction without losing input", () => {
  const state = setup();
  state.source.value = "ok";
  state.run();
  workers[0].finish();
  state.direction.value = "decode";
  state.source.value = "%FF";
  state.run();
  workers[1].finish();
  expect(state.error.value?.code).toBe("utf8");
  expect(state.source.value).toBe("%FF");
  expect(state.canExport.value).toBe(false);
  state.source.value = "%20";
  state.run();
  workers[2].finish();
  expect(state.error.value).toBeUndefined();
  expect(state.result.value?.text).toBe(" ");
  expect(state.canExport.value).toBe(true);
});
it("times out and terminates the worker, ignores its late message and supports a fresh retry", async () => {
  const state = setup();
  state.source.value = "x";
  state.run();
  const late = workers[0].onmessage!,
    request = workers[0].request;
  await vi.advanceTimersByTimeAsync(5000);
  expect(state.error.value?.message).toContain("5 秒");
  expect(state.busy.value).toBe(false);
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  late({ data: { id: request.id, result: processUrl(request.source, request.settings) } } as MessageEvent<UrlReply>);
  expect(state.result.value).toBeUndefined();
  state.run();
  workers[1].finish();
  expect(state.canExport.value).toBe(true);
});
it("handles worker construction and runtime failures without exposing input in error text", () => {
  const failed = setup(() => {
    throw Error("secret source");
  });
  failed.source.value = "private-url";
  failed.run();
  expect(failed.error.value?.code).toBe("internal");
  expect(failed.error.value?.message).not.toContain("secret");
  expect(failed.source.value).toBe("private-url");
  scope.stop();
  const state = setup();
  state.source.value = "private-url";
  state.run();
  workers[0].onerror!(new ErrorEvent("error", { cancelable: true }));
  expect(state.error.value?.message).toContain("后台");
  expect(state.busy.value).toBe(false);
  expect(state.canExport.value).toBe(false);
});
it("releases worker handlers, timers and all text on disposal and cannot restart afterwards", async () => {
  const state = setup();
  state.source.value = "x";
  state.run();
  const worker = workers[0];
  scope.stop();
  expect(worker.onmessage).toBeNull();
  expect(worker.onerror).toBeNull();
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(state.source.value).toBe("");
  expect(state.result.value).toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
  state.run();
  await vi.advanceTimersByTimeAsync(6000);
  expect(workers).toHaveLength(1);
});
