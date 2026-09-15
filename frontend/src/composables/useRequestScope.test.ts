/**
 * 中文模块说明：测试 frontend/src/composables/useRequestScope.test.ts 中的稳定行为、边界条件和回归场景
 */
import { effectScope } from "vue";
import { describe, expect, it } from "vitest";
import { useRequestScope } from "./useRequestScope";

describe("useRequestScope", () => {
  it("aborts requests when the owning Vue scope is disposed", () => {
    const scope = effectScope();
    const request = scope.run(() => useRequestScope())!;

    expect(request.signal.aborted).toBe(false);
    scope.stop();
    expect(request.signal.aborted).toBe(true);
    expect(request.aborted).toBe(true);
  });

  it("supports explicit cancellation without firing twice", () => {
    const scope = effectScope();
    const request = scope.run(() => useRequestScope())!;
    let abortEvents = 0;
    request.signal.addEventListener("abort", () => {
      abortEvents += 1;
    });

    request.abort();
    request.abort();
    expect(abortEvents).toBe(1);
    expect(request.aborted).toBe(true);
    scope.stop();
  });
});
