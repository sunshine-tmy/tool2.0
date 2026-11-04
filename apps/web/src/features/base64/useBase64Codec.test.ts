// @vitest-environment happy-dom
import { effectScope } from "vue";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BASE64_AUTO_BYTES, BASE64_LIMITS, processBase64, type Base64Reply, type Base64Request } from "./processor";
import { useBase64Codec } from "./useBase64Codec";
class WorkerStub {
  onmessage: ((event: MessageEvent<Base64Reply>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  request!: Base64Request;
  sent!: Base64Request;
  terminate = vi.fn();
  postMessage(request: Base64Request, transfer: Transferable[]) {
    this.sent = request;
    this.request = structuredClone(request, { transfer });
  }
  finish() {
    const result = processBase64(this.request.input, this.request.settings);
    const reply = structuredClone(
      { id: this.request.id, result },
      { transfer: result.ok && result.direction === "decode" ? [result.buffer] : [] }
    );
    this.onmessage?.({ data: reply } as MessageEvent<Base64Reply>);
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
  return scope.run(() => useBase64Codec(factory))!;
}
beforeEach(() => {
  vi.useFakeTimers();
  workers.length = 0;
});
afterEach(() => {
  scope?.stop();
  vi.useRealTimers();
});
it("debounces small text and makes previous results stale after input or alphabet changes", async () => {
  const state = setup();
  state.source.value = "中文😀";
  await vi.advanceTimersByTimeAsync(299);
  expect(workers).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(1);
  workers[0].finish();
  expect(state.canCopy.value).toBe(true);
  expect(state.source.value).toBe("中文😀");
  expect(state.downloadName()).toBe("encoded.base64.txt");
  state.alphabet.value = "url";
  expect(state.stale.value).toBe(true);
  expect(state.canExport.value).toBe(false);
  await state.run();
  workers[1].finish();
  expect(state.result.value).toMatchObject({ text: Buffer.from("中文😀").toString("base64url") });
  state.direction.value = "decode";
  state.source.value = Buffer.from("中文😀").toString("base64url");
  await state.run();
  workers[2].finish();
  expect(state.result.value).toMatchObject({ text: "中文😀" });
  expect(state.downloadName()).toBe("decoded.txt");
  expect(state.resultChars.value).toBe(3);
});
it("shows binary success with download enabled, and refuses export of obsolete output after an error", async () => {
  const state = setup();
  state.direction.value = "decode";
  state.source.value = "/w==";
  await state.run();
  workers[0].finish();
  expect(state.result.value?.kind).toBe("binary");
  expect(state.canCopy.value).toBe(false);
  expect(state.canExport.value).toBe(true);
  expect(state.downloadName()).toBe("decoded.bin");
  state.source.value = "Zh==";
  await state.run();
  workers[1].finish();
  expect(state.error.value?.code).toBe("base64");
  expect(state.canExport.value).toBe(false);
  state.source.value = "Zg==";
  await state.run();
  workers[2].finish();
  expect(state.canCopy.value).toBe(true);
  expect(state.error.value).toBeUndefined();
});
it("keeps large text manual, respects the automatic toggle and preflights byte limits", async () => {
  const state = setup();
  state.source.value = "a".repeat(BASE64_AUTO_BYTES + 1);
  await vi.advanceTimersByTimeAsync(1000);
  expect(workers).toHaveLength(0);
  await state.run();
  workers[0].finish();
  expect(state.canExport.value).toBe(true);
  state.automatic.value = false;
  state.source.value = "f";
  await vi.advanceTimersByTimeAsync(1000);
  expect(workers).toHaveLength(1);
  state.automatic.value = true;
  await vi.advanceTimersByTimeAsync(300);
  workers[1].finish();
  expect(state.result.value).toMatchObject({ text: "Zg==" });
  state.source.value = "中".repeat(Math.ceil(BASE64_LIMITS.payloadBytes / 3));
  await state.run();
  expect(workers).toHaveLength(2);
  expect(state.error.value?.code).toBe("limit");
});
it("encodes files only on request, transfers buffers and rereads the same File on retry", async () => {
  const state = setup(),
    file = new File([new Uint8Array([255, 0, 1])], "数据?.bin");
  const read = vi.spyOn(file, "arrayBuffer");
  await state.importFile(file);
  expect(state.activeFile.value).toBe(true);
  await vi.advanceTimersByTimeAsync(1000);
  expect(workers).toHaveLength(0);
  await state.run();
  const sent = workers[0].sent.input;
  expect(sent.kind).toBe("file");
  if (sent.kind !== "file") throw Error("expected file request");
  expect(sent.buffer.byteLength).toBe(0);
  workers[0].finish();
  expect(state.result.value).toMatchObject({ text: "/wAB" });
  expect(state.downloadName()).toBe("数据_.bin.base64.txt");
  await state.run();
  workers[1].finish();
  expect(read).toHaveBeenCalledTimes(2);
  expect(state.result.value).toMatchObject({ text: "/wAB" });
  state.removeFile();
  expect(state.hasInput.value).toBe(false);
  expect(state.canExport.value).toBe(false);
  await state.importFile(new File([], "empty.bin"));
  await state.run();
  workers[2].finish();
  expect(state.result.value).toMatchObject({ text: "", outputBytes: 0 });
  expect(state.canExport.value).toBe(true);
});
it("cancels pending reads, timeout or stale worker messages without starting another worker", async () => {
  const state = setup(),
    file = new File(["f"], "slow.bin");
  let finish!: (buffer: ArrayBuffer) => void;
  vi.spyOn(file, "arrayBuffer").mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  await state.importFile(file);
  const running = state.run();
  expect(state.busy.value).toBe(true);
  state.cancel();
  finish(new Uint8Array([102]).buffer);
  await running;
  expect(workers).toHaveLength(0);
  expect(state.busy.value).toBe(false);
  state.inputKind.value = "text";
  state.source.value = "f";
  await state.run();
  const late = workers[0].onmessage!,
    id = workers[0].request.id;
  workers[0].onmessage!({ data: { id: -1 } } as MessageEvent<Base64Reply>);
  expect(state.busy.value).toBe(true);
  await vi.advanceTimersByTimeAsync(5000);
  expect(state.error.value?.message).toContain("5 秒");
  late({
    data: { id, result: processBase64({ kind: "text", text: "f" }, workers[0].request.settings) }
  } as MessageEvent<Base64Reply>);
  expect(state.result.value).toBeUndefined();
  await state.run();
  workers[1].finish();
  expect(state.canCopy.value).toBe(true);
});
it("times out a stalled file read and does not let the late buffer restart work", async () => {
  const state = setup(),
    file = new File(["x"], "slow.bin");
  let finish!: (buffer: ArrayBuffer) => void;
  vi.spyOn(file, "arrayBuffer").mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  await state.importFile(file);
  const run = state.run();
  await vi.advanceTimersByTimeAsync(5000);
  finish(new ArrayBuffer(1));
  await run;
  expect(state.error.value?.message).toContain("5 秒");
  expect(workers).toHaveLength(0);
});
it("preserves input on startup/read/runtime errors and can retry", async () => {
  const state = setup(() => {
    throw Error("worker unavailable");
  });
  state.source.value = "f";
  await state.run();
  expect(state.source.value).toBe("f");
  expect(state.error.value?.code).toBe("internal");
  scope.stop();
  const runtime = setup();
  runtime.source.value = "f";
  await runtime.run();
  workers[0].onerror!(new ErrorEvent("error", { cancelable: true }));
  expect(runtime.busy.value).toBe(false);
  expect(runtime.error.value?.message).toContain("后台");
  const file = new File(["x"], "bad.bin");
  vi.spyOn(file, "arrayBuffer").mockRejectedValueOnce(Error("read failed"));
  await runtime.importFile(file);
  await runtime.run();
  expect(runtime.error.value?.message).toContain("读取文件");
});
it("imports decoded Base64 text without dropping a BOM, and keeps current input on oversize or non-UTF-8 files", async () => {
  const state = setup();
  state.direction.value = "decode";
  await state.importFile(new File(["Zg=="], "text.b64"));
  expect(state.source.value).toBe("Zg==");
  await state.run();
  workers[0].finish();
  expect(state.result.value).toMatchObject({ text: "f" });
  const huge = new File(["x"], "huge.b64");
  Object.defineProperty(huge, "size", { value: BASE64_LIMITS.encodedBytes + 1 });
  await state.importFile(huge);
  expect(state.source.value).toBe("Zg==");
  expect(state.notice.value).toContain("7 MiB");
  await state.importFile(new File([new Uint8Array([255])], "binary.bin"));
  expect(state.notice.value).toContain("UTF-8");
  expect(state.source.value).toBe("Zg==");
  await state.importFile(new File([new Uint8Array([239, 187, 191]), "Zg=="], "bom.txt"));
  expect(state.source.value).toBe("\ufeffZg==");
  await state.run();
  workers[1].finish();
  expect(state.error.value?.code).toBe("base64");
});
it("does not let old imports replace edits, a newer file, a changed direction, cancellation or disposal", async () => {
  const state = setup();
  state.direction.value = "decode";
  const file = new File(["Zg=="], "slow.txt"),
    pending: Array<(buffer: ArrayBuffer) => void> = [];
  vi.spyOn(file, "arrayBuffer").mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
  const bytes = () => new TextEncoder().encode("Zg==").buffer;
  let read = state.importFile(file);
  state.source.value = "Zm8=";
  pending[0](bytes());
  await read;
  expect(state.source.value).toBe("Zm8=");
  read = state.importFile(file);
  await state.importFile(new File(["Zm9v"], "new.txt"));
  pending[1](bytes());
  await read;
  expect(state.source.value).toBe("Zm9v");
  read = state.importFile(file);
  state.direction.value = "encode";
  pending[2](bytes());
  await read;
  expect(state.source.value).toBe("Zm9v");
  state.direction.value = "decode";
  read = state.importFile(file);
  state.cancel();
  pending[3](bytes());
  await read;
  expect(state.source.value).toBe("Zm9v");
  read = state.importFile(file);
  scope.stop();
  pending[4](bytes());
  await read;
  await flushPromises();
  expect(state.source.value).toBe("");
  expect(state.result.value).toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
});
it("releases workers, timers and both input sources on clear/disposal", async () => {
  const state = setup();
  state.source.value = "f";
  await state.importFile(new File(["x"], "x.bin"));
  await state.run();
  const late = workers[0].onmessage!;
  state.clear();
  expect(state.file.value).toBeUndefined();
  expect(state.source.value).toBe("");
  late({
    data: { id: workers[0].request.id, result: processBase64(workers[0].request.input, workers[0].request.settings) }
  } as MessageEvent<Base64Reply>);
  expect(state.result.value).toBeUndefined();
  scope.stop();
  expect(vi.getTimerCount()).toBe(0);
});
