// @vitest-environment happy-dom
import { effectScope } from "vue";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { UUID_LIMITS, type RandomFill } from "./generator";
import { useUuidGenerator } from "./useUuidGenerator";
let scope: ReturnType<typeof effectScope>;
function sequence() {
  let serial = 0;
  return vi.fn((bytes: Uint8Array) => {
    bytes.fill(171);
    for (let i = 0; i < bytes.length; i += 16) new DataView(bytes.buffer).setUint32(i, serial++);
  });
}
function setup(fill: RandomFill = sequence()) {
  scope = effectScope();
  return scope.run(() => useUuidGenerator(fill))!;
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  scope?.stop();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it("starts empty, generates five canonical IDs only on request and reformats without new randomness", async () => {
  const fill = sequence(),
    state = setup(fill);
  expect(state.count.value).toBe(5);
  expect(state.output.value).toBe("");
  expect(state.canExport.value).toBe(false);
  await vi.runAllTimersAsync();
  expect(fill).not.toHaveBeenCalled();
  state.generate();
  expect(state.busy.value).toBe(true);
  expect(state.canExport.value).toBe(false);
  await vi.runAllTimersAsync();
  const ids = [...state.values.value];
  expect(ids).toHaveLength(5);
  expect(state.canExport.value).toBe(true);
  state.letterCase.value = "upper";
  state.hyphens.value = false;
  state.layout.value = "json";
  expect(JSON.parse(state.output.value)).toEqual(ids.map((id) => id.replaceAll("-", "").toUpperCase()));
  expect(fill).toHaveBeenCalledOnce();
  expect(state.values.value).toEqual(ids);
  state.count.value = 10;
  expect(state.values.value).toHaveLength(5);
  expect(fill).toHaveBeenCalledOnce();
});
it("captures requested count, yields after each chunk and commits all 10000 at once", async () => {
  const fill = sequence(),
    state = setup(fill);
  state.generate();
  await vi.runAllTimersAsync();
  const old = state.values.value;
  state.count.value = 10_000;
  state.generate();
  state.generate();
  await vi.advanceTimersByTimeAsync(0);
  expect(state.completed.value).toBe(UUID_LIMITS.chunkSize);
  expect(state.target.value).toBe(10_000);
  expect(state.values.value).toBe(old);
  expect(state.canGenerate.value).toBe(false);
  state.count.value = 1;
  await vi.runAllTimersAsync();
  expect(state.values.value).toHaveLength(10_000);
  expect(new Set(state.values.value).size).toBe(10_000);
  expect(fill).toHaveBeenCalledTimes(41);
  expect(state.busy.value).toBe(false);
});
it("validates quantities without coercion and preserves previously committed data", async () => {
  const fill = sequence(),
    state = setup(fill);
  state.generate();
  await vi.runAllTimersAsync();
  const old = state.output.value;
  for (const count of [null, 0, -1, 1.5, 10_001, NaN]) {
    state.count.value = count;
    expect(state.canGenerate.value).toBe(false);
    state.generate();
    expect(state.error.value).toContain("整数");
    expect(state.output.value).toBe(old);
  }
  expect(fill).toHaveBeenCalledOnce();
  expect(state.canExport.value).toBe(true);
});
it("cancels an unfinished batch, retains the old result and ignores an obsolete scheduled callback", async () => {
  const state = setup();
  state.generate();
  await vi.runAllTimersAsync();
  const old = state.values.value;
  const schedule = vi.spyOn(globalThis, "setTimeout");
  state.count.value = 513;
  state.generate();
  const callback = schedule.mock.calls[0][0];
  if (typeof callback !== "function") throw Error("missing scheduled chunk");
  await vi.advanceTimersByTimeAsync(0);
  state.stop();
  expect(state.values.value).toBe(old);
  expect(state.notice.value).toContain("仍保留");
  expect(vi.getTimerCount()).toBe(0);
  state.count.value = 1;
  state.generate();
  Reflect.apply(callback, undefined, []);
  await vi.runAllTimersAsync();
  expect(state.values.value).toHaveLength(1);
  expect(state.notice.value).toBe("");
});
it("keeps incomplete chunks private after a random-source failure, then starts a fresh retry", async () => {
  const sequenceFill = sequence();
  let failing = false,
    calls = 0;
  const state = setup((bytes) => {
    if (failing && ++calls === 2) throw Error("sensitive native failure");
    sequenceFill(bytes);
  });
  state.generate();
  await vi.runAllTimersAsync();
  const old = state.values.value;
  failing = true;
  state.count.value = 300;
  state.generate();
  await vi.runAllTimersAsync();
  expect(state.values.value).toBe(old);
  expect(state.error.value).toBe("UUID 生成失败，请重试");
  expect(state.notice.value).toContain("5 条");
  expect(state.canExport.value).toBe(true);
  failing = false;
  state.generate();
  await vi.runAllTimersAsync();
  expect(state.values.value).toHaveLength(300);
  expect(state.error.value).toBe("");
});
it("clears results and timers and prevents delayed publication after disposal", async () => {
  const state = setup();
  state.generate();
  await vi.runAllTimersAsync();
  state.count.value = 513;
  state.generate();
  await vi.advanceTimersByTimeAsync(0);
  state.clear();
  expect(state.output.value).toBe("");
  expect(state.values.value).toHaveLength(0);
  expect(state.completed.value).toBe(0);
  expect(state.target.value).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
  state.generate();
  scope.stop();
  state.generate();
  await vi.runAllTimersAsync();
  expect(state.output.value).toBe("");
  expect(state.busy.value).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
