// @vitest-environment happy-dom
import { effectScope } from "vue";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useVideoHealth } from "./useVideoHealth";

const mocks = vi.hoisted(() => ({ health: vi.fn() }));
vi.mock("./api", () => ({ videoAiApi: mocks }));
const scopes: ReturnType<typeof effectScope>[] = [];
const ready = { available: true, engines: [{ provider: "delogo", available: true }] };
beforeEach(() => {
  vi.useFakeTimers();
  mocks.health.mockReset();
});
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop());
  vi.useRealTimers();
});
function setup() {
  const scope = effectScope();
  scopes.push(scope);
  return { scope, state: scope.run(() => useVideoHealth())! };
}
it("waits for a starting worker, enables it automatically and stops polling once ready", async () => {
  mocks.health
    .mockRejectedValueOnce(Object.assign(new Error("正在启动"), { code: "WORKER_PREPARING" }))
    .mockResolvedValue(ready);
  const { state } = setup();
  await state.refreshHealth();
  expect(state.healthRecovering.value).toBe(true);
  expect(state.capabilityError.value).toContain("无需手动刷新");
  expect(state.capabilityError.value).not.toContain("安装");
  await vi.advanceTimersByTimeAsync(2000);
  expect(state.health.value).toEqual(ready);
  expect(state.healthRecovering.value).toBe(false);
  expect(state.capabilityError.value).toBe("");
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.health).toHaveBeenCalledTimes(2);
});
it("deduplicates checks and never overlaps an automatic retry with a pending request", async () => {
  let finish!: (value: unknown) => void;
  mocks.health.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const { state } = setup();
  const first = state.refreshHealth();
  const second = state.refreshHealth();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mocks.health).toHaveBeenCalledTimes(1);
  finish(ready);
  await Promise.all([first, second]);
  expect(state.healthLoading.value).toBe(false);
});
it("does not automatically retry a confirmed missing package or protocol mismatch", async () => {
  for (const code of ["COMPONENT_NOT_INSTALLED", "WORKER_PROTOCOL_MISMATCH"]) {
    mocks.health.mockRejectedValueOnce(Object.assign(new Error(code), { code }));
    const { scope, state } = setup();
    await state.refreshHealth();
    expect(state.healthRecovering.value).toBe(false);
    expect(state.capabilityError.value).toBe(code);
    expect(vi.getTimerCount()).toBe(0);
    scope.stop();
  }
});
it("bounds unsuccessful retries and can restart checks when the app regains focus", async () => {
  mocks.health.mockResolvedValue({ available: false, engines: [] });
  const { state } = setup();
  await state.refreshHealth();
  await vi.advanceTimersByTimeAsync(5 * 60_000);
  expect(state.healthRecovering.value).toBe(false);
  expect(state.capabilityError.value).toContain("自动检查已暂停");
  expect(vi.getTimerCount()).toBe(0);
  expect(mocks.health.mock.calls.length).toBeLessThan(40);
  mocks.health.mockResolvedValue(ready);
  window.dispatchEvent(new Event("focus"));
  await vi.advanceTimersByTimeAsync(0);
  expect(state.health.value).toEqual(ready);
  expect(state.capabilityError.value).toBe("");
});
it("aborts late requests and clears retries and focus listeners after leaving the page", async () => {
  let finish!: (value: unknown) => void;
  mocks.health.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const { state, scope } = setup();
  const pending = state.refreshHealth();
  await vi.advanceTimersByTimeAsync(0);
  const signal = mocks.health.mock.calls[0][0] as AbortSignal;
  scope.stop();
  expect(signal.aborted).toBe(true);
  finish(ready);
  await pending;
  expect(state.health.value).toBeUndefined();
  window.dispatchEvent(new Event("focus"));
  await vi.advanceTimersByTimeAsync(10_000);
  expect(mocks.health).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
  mocks.health.mockRejectedValue(new Error("offline"));
  const retry = setup();
  await retry.state.refreshHealth();
  expect(vi.getTimerCount()).toBe(1);
  retry.scope.stop();
  expect(vi.getTimerCount()).toBe(0);
});
