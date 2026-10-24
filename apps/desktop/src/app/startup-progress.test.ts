import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { StartupSnapshot, StartupStepId } from "@toolbox/shared/desktop";
import { StartupProgress, startupSteps } from "./startup-progress";
afterEach(() => vi.useRealTimers());
describe("honest startup progress", () => {
  it("keeps the shared stage IDs and snapshot contract aligned with the existing progress machine", () => {
    expectTypeOf<(typeof startupSteps)[number]["id"]>().toEqualTypeOf<StartupStepId>();
    expectTypeOf<ReturnType<StartupProgress["snapshot"]>>().toEqualTypeOf<StartupSnapshot>();
    expect(startupSteps.map((step) => step.id)).toEqual([
      "storage",
      "migration",
      "proxy",
      "process",
      "config",
      "database",
      "directories",
      "service",
      "window"
    ]);
  });
  it("uses elapsed time without inventing completed steps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const progress = new StartupProgress();
    vi.setSystemTime(21_000);
    expect(progress.snapshot()).toMatchObject({ completedCount: 0, elapsedMs: 20_000, stageElapsedMs: 20_000 });
    expect(progress.stage("storage")).toBe(false);
    expect(progress.stage("unknown")).toBe(false);
    expect(progress.snapshot().stageElapsedMs).toBe(20_000);
  });
  it("advances only on real events, rejects backwards stages, and freezes timing on failure", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const progress = new StartupProgress();
    vi.setSystemTime(2000);
    progress.stage("migration");
    progress.stage("storage");
    vi.setSystemTime(4000);
    progress.fail("FAILED", "失败", true);
    vi.setSystemTime(10_000);
    expect(progress.snapshot()).toMatchObject({
      completedCount: 1,
      elapsedMs: 3000,
      stageElapsedMs: 2000,
      failed: true
    });
    expect(progress.snapshot().steps[0].status).toBe("completed");
    expect(progress.snapshot().steps[1].status).toBe("failed");
    expect(progress.stage("database")).toBe(false);
  });
  it("does not mark unobserved steps complete and fully resets retry state", () => {
    const progress = new StartupProgress();
    progress.stage("database");
    expect(progress.snapshot().completedCount).toBe(1);
    expect(progress.snapshot().steps.find((step) => step.id === "config")?.status).toBe("pending");
    progress.fail("FAILED", "失败", true);
    const revision = progress.snapshot().revision;
    progress.reset();
    expect(progress.snapshot()).toMatchObject({
      completedCount: 0,
      failed: false,
      canRetry: false,
      code: "STARTING",
      stageId: "storage"
    });
    expect(progress.snapshot().revision).toBeGreaterThan(revision);
  });
  it("finishes after all reported steps and forbids startup recovery after runtime failure", () => {
    const progress = new StartupProgress();
    for (const step of startupSteps) progress.stage(step.id);
    expect(progress.snapshot()).toMatchObject({ completedCount: 8, entered: false, stageId: "window" });
    progress.ready();
    expect(progress.snapshot()).toMatchObject({ completedCount: 9, entered: true, code: "READY" });
    progress.fail("EXITED", "退出", true);
    expect(progress.snapshot()).toMatchObject({ phase: "运行中服务异常", canRetry: false, entered: true });
  });
});
