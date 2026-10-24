/** Progress is based on output/stage completion, never inferred installation percentages. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPythonBuildProgress } from "../modules/components/python-build-progress";
afterEach(() => vi.useRealTimers());

describe("Python build progress", () => {
  it("handles split output, normalizes only locked names and distinguishes parsed from installed", () => {
    vi.useFakeTimers();
    const report = vi.fn();
    const tracker = createPythonBuildProgress("sample_pkg==1.0 --hash=sha256:abc\nother==2.0\n", report);
    tracker.step("install-dependencies");
    tracker.output("Processing C:\\Users\\secret\\sample_");
    tracker.output("pkg-1.0-py3-none-any.whl\r\nProcessing C:\\private\\sample_pkg-1.0-py3-none-any.whl\n");
    tracker.output(
      "Processing https://user:token@evil/unknown-1.0-any.whl\nInstalling collected packages: private 文案\n"
    );
    vi.advanceTimersByTime(1000);
    expect(report.mock.calls.at(-1)?.[0]).toMatchObject({
      step: "install-dependencies",
      completedSteps: 0,
      preparedDependencies: 1,
      totalDependencies: 2,
      currentDependency: "sample-pkg",
      activity: "installing"
    });
    expect(JSON.stringify(report.mock.calls)).not.toMatch(/secret|private|token|evil|文案/);
    tracker.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps consuming after long unknown output and flushes the last real activity without waiting for another chunk", () => {
    vi.useFakeTimers();
    const report = vi.fn();
    const tracker = createPythonBuildProgress("sample==1.0", report);
    tracker.step("install-dependencies");
    tracker.output("x".repeat(40000) + "\nProcessing /controlled/sample-1.0-py3-none-any.whl\n");
    expect(report).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(report).toHaveBeenCalledTimes(2);
    expect(report.mock.calls.at(-1)?.[0]).toMatchObject({
      preparedDependencies: 1,
      currentDependency: "sample",
      lastOutputAt: expect.any(String)
    });
    tracker.completeStep();
    expect(report.mock.calls.at(-1)?.[0].completedSteps).toBe(1);
    tracker.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});
