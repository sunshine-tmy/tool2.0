import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock("./http", () => ({ httpClient: http, withApiError: (operation: () => unknown) => operation() }));

import { componentApi, getToolComponentReadiness, subscribeComponentJob } from "./components";

function componentStatus(id: string, taskToolIds: string[], dependencyIds: string[] = [], ready = false) {
  return {
    id,
    moduleId: id,
    displayName: id.toUpperCase(),
    groupId: "shared" as const,
    purpose: "test",
    taskToolIds,
    dependencyIds,
    dependentIds: [],
    installConditions: [],
    version: "1.0.0",
    platform: "win32-x64" as const,
    downloadBytes: 1,
    installedBytes: 1,
    installed: ready,
    state: ready ? ("ready" as const) : ("not-installed" as const),
    health: ready ? ("healthy" as const) : ("unknown" as const),
    licenseName: "MIT",
    licenseUrl: "https://example.test/license"
  };
}

describe("componentApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists the signed component catalog", async () => {
    http.get.mockResolvedValue([]);
    await expect(componentApi.list()).resolves.toEqual([]);
    expect(http.get).toHaveBeenCalledWith("/components", expect.any(Object));
  });

  it("uses fixed component IDs for lifecycle operations", async () => {
    const job = { id: "job" };
    http.post.mockResolvedValue(job);
    http.delete.mockResolvedValue(job);

    await componentApi.install("python-311 /unsafe");
    await componentApi.reinstall("ffmpeg");
    await componentApi.uninstall("ffmpeg");
    await componentApi.cancel("job-id");
    await componentApi.getJob("job-id");

    expect(http.post).toHaveBeenNthCalledWith(1, "/components/python-311%20%2Funsafe/install", expect.any(Object));
    expect(http.post).toHaveBeenNthCalledWith(2, "/components/ffmpeg/reinstall", expect.any(Object));
    expect(http.delete).toHaveBeenNthCalledWith(1, "/components/ffmpeg", expect.any(Object));
    expect(http.delete).toHaveBeenNthCalledWith(2, "/component-jobs/job-id", expect.any(Object));
    expect(http.get).toHaveBeenCalledWith("/component-jobs/job-id", expect.any(Object));
  });

  it("resolves missing shared dependencies and requires every package to be healthy", () => {
    const worker = componentStatus("video-worker", ["video-text"], ["python-311"]);
    const python = componentStatus("python-311", []);
    const missing = getToolComponentReadiness("video-text", [worker, python]);
    expect(missing.registered).toBe(true);
    expect(missing.missing.map((item) => item.id)).toEqual(["video-worker", "python-311"]);

    const ready = getToolComponentReadiness("video-text", [
      componentStatus("video-worker", ["video-text"], ["python-311"], true),
      componentStatus("python-311", [], [], true)
    ]);
    expect(ready.missing).toEqual([]);
    expect(ready.unresolvedIds).toEqual([]);
    expect(getToolComponentReadiness("edge-tts", [worker, python]).registered).toBe(false);
  });

  it("subscribes to typed progress events and closes the stream", () => {
    const listeners = new Map<string, EventListener>();
    const close = vi.fn();
    const onJob = vi.fn();
    const eventSource = {
      addEventListener: vi.fn((name: string, listener: EventListener) => listeners.set(name, listener)),
      close
    };
    vi.stubGlobal(
      "EventSource",
      vi.fn(() => eventSource)
    );

    const unsubscribe = subscribeComponentJob("123", onJob);
    const job = {
      id: "00000000-0000-4000-8000-000000000001",
      componentId: "ffmpeg",
      operation: "install",
      state: "running",
      phase: "downloading",
      progress: { downloadedBytes: 1, totalDownloadBytes: 3, processedFiles: 0, totalFiles: 1, percentage: 33 },
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:01Z"
    };
    listeners.get("component-job")?.(new MessageEvent("component-job", { data: JSON.stringify(job) }));
    listeners.get("component-job")?.(new MessageEvent("component-job", { data: "not-json" }));

    expect(onJob).toHaveBeenCalledTimes(1);
    expect(onJob).toHaveBeenCalledWith(job);
    unsubscribe();
    expect(close).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
