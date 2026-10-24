import { afterEach, expect, it, vi } from "vitest";
import type { ComponentJob } from "@toolbox/shared";
import { ComponentManagerError } from "../modules/components/component-manager";
import {
  createComponentJob,
  updateComponentJob,
  subscribeComponentJob,
  failComponentJob,
  progress,
  zeroProgress
} from "../modules/components/component-jobs";

function collections(): Parameters<typeof createComponentJob>[0] {
  return { jobs: new Map(), listeners: new Map(), lastFailures: new Map(), activeByComponent: new Map() };
}
function create(state: ReturnType<typeof collections>) {
  return createComponentJob(state, "fixture", "install", "queued", "queued", 100, 2);
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("creates jobs in the supplied owner maps with the same initial progress and timestamp", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  const state = collections(),
    job = create(state);
  expect(state.jobs.get(job.id)?.value).toBe(job);
  expect(job).toMatchObject({
    componentId: "fixture",
    operation: "install",
    state: "queued",
    phase: "queued",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    progress: { downloadedBytes: 0, totalDownloadBytes: 100, processedFiles: 0, totalFiles: 2, percentage: 0 }
  });
});
it("keeps synchronous replay, replacement object identity and unsubscribe semantics", () => {
  const state = collections(),
    job = create(state),
    listener = vi.fn();
  const stop = subscribeComponentJob(state, job.id, listener);
  expect(listener).toHaveBeenLastCalledWith(job);
  expect(listener.mock.calls[0][0]).toBe(job);
  const internal = state.jobs.get(job.id)!;
  updateComponentJob(state, internal, { state: "running", phase: "downloading" });
  expect(internal.value).not.toBe(job);
  expect(listener.mock.calls[1][0]).toBe(internal.value);
  stop();
  expect(state.listeners.has(job.id)).toBe(false);
  updateComponentJob(state, internal, { state: "completed" });
  expect(listener).toHaveBeenCalledTimes(2);
  expect(state.jobs.get(job.id)).toBe(internal);
});
it("publishes failure before clearing owner flags, retaining the domain error code and sanitized fallback", () => {
  const state = collections(),
    job = create(state),
    internal = state.jobs.get(job.id)!;
  internal.controller = new AbortController();
  state.activeByComponent.set("fixture", job.id);
  const observations: boolean[][] = [];
  state.listeners.set(
    job.id,
    new Set([
      () =>
        observations.push([
          state.activeByComponent.has("fixture"),
          state.lastFailures.has("fixture"),
          Boolean(internal.controller)
        ])
    ])
  );
  failComponentJob(state, internal, new ComponentManagerError("COMPONENT_DEPENDENCY_MISSING", "missing dependency"));
  expect(observations).toEqual([[true, false, true]]);
  expect(internal.value).toMatchObject({
    state: "failed",
    phase: "complete",
    errorCode: "COMPONENT_DEPENDENCY_MISSING"
  });
  expect(state.lastFailures.get("fixture")).toEqual({
    code: "COMPONENT_DEPENDENCY_MISSING",
    message: "missing dependency"
  });
  expect(state.activeByComponent.has("fixture")).toBe(false);
  expect(internal.controller).toBeUndefined();
  state.listeners.clear();
  failComponentJob(state, internal, new Error("fixture failure C:\\synthetic\\private-file\nnext line"));
  expect(internal.value.errorCode).toBe("COMPONENT_INSTALL_FAILED");
  expect(internal.value.errorMessage).not.toContain("private-file");
  expect(internal.value.errorMessage).not.toContain("\n");
});
function seed(state: ReturnType<typeof collections>, active: boolean) {
  for (let index = 0; index < 500; index++) {
    const value: ComponentJob = {
      id: "job-" + index,
      componentId: "fixture",
      operation: "install",
      state: active || index === 0 ? "running" : "completed",
      phase: "complete",
      progress: zeroProgress(),
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };
    state.jobs.set(value.id, { value });
  }
}
it("prunes only the oldest terminal job without listeners, preserving active and subscribed jobs", () => {
  const state = collections();
  seed(state, false);
  state.listeners.set("job-1", new Set([() => undefined]));
  create(state);
  expect(state.jobs.size).toBe(500);
  expect(state.jobs.has("job-0")).toBe(true);
  expect(state.jobs.has("job-1")).toBe(true);
  expect(state.jobs.has("job-2")).toBe(false);
  expect(state.jobs.has("job-3")).toBe(true);
});
it("does not turn the pruning target into a new hard cap that evicts active jobs", () => {
  const state = collections();
  seed(state, true);
  create(state);
  expect(state.jobs.size).toBe(501);
  expect(state.jobs.has("job-0")).toBe(true);
});
it.each([
  [0, 0, 0],
  [25, 100, 25],
  [101, 100, 100]
])("preserves byte progress %s/%s -> %s", (downloaded, total, percentage) => {
  expect(progress(downloaded, total, 9, 10)).toEqual({
    downloadedBytes: downloaded,
    totalDownloadBytes: total,
    processedFiles: 9,
    totalFiles: 10,
    percentage
  });
});
