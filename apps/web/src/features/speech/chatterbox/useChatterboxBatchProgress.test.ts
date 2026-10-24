// @vitest-environment happy-dom

import { defineComponent, h, ref } from "vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatterboxBatch, TaskDto } from "@toolbox/shared";
import { useChatterboxEditor } from "./useChatterboxEditor";
import { useChatterboxBatches } from "./useChatterboxBatches";

const api = vi.hoisted(() => ({ batch: vi.fn(), batches: vi.fn(), list: vi.fn(), regenerate: vi.fn() }));
vi.mock("./chatterbox-api", () => ({ chatterboxApi: api }));
const now = "2026-10-19T12:00:00.000Z";
function snapshot(completed = 0, id = "batch-1"): ChatterboxBatch {
  return {
    id,
    engine: "chatterbox-multilingual-v3",
    status: completed === 2 ? "completed" : "processing",
    progress: completed === 2 ? 100 : completed === 1 ? 55 : 5,
    language: "en",
    device: "cpu",
    referenceFileName: "reference.wav",
    referenceDurationSeconds: 6,
    referenceAvailable: true,
    referenceRetained: true,
    authorization: "self",
    consentConfirmed: true,
    exaggeration: 0.5,
    cfgWeight: 0.5,
    temperature: 0.8,
    seed: 0,
    includeSubtitles: true,
    subtitleMode: "sentences",
    totalCharacters: 14,
    completedItems: completed,
    failedItems: 0,
    totalAudioDurationSeconds: completed * 1.25,
    createdAt: now,
    updatedAt: now,
    expiresAt: "2026-10-22T12:00:00.000Z",
    items: [0, 1].map((index) => ({
      id: `item-${index}`,
      order: index + 1,
      text: "English",
      referenceTranslation: "中文",
      status: index < completed ? "completed" : index === completed ? "processing" : "queued",
      progress: index < completed ? 100 : index === completed ? 10 : 0,
      attempt: 1,
      characterCount: 7,
      audioDurationSeconds: index < completed ? 1.25 : undefined,
      createdAt: now,
      updatedAt: now
    }))
  };
}
function event(progress: number, status: TaskDto["status"] = "running", id = "batch-1"): TaskDto {
  return { id, toolId: "chatterbox-batch", progress, status, createdAt: now, updatedAt: now };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const wrappers: VueWrapper[] = [];
async function harness() {
  const task = ref<TaskDto>();
  const message = { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() };
  let state!: { editor: ReturnType<typeof useChatterboxEditor>; batches: ReturnType<typeof useChatterboxBatches> };
  const wrapper = mount(
    defineComponent({
      setup() {
        const confirmAction = async () => true;
        const editor = useChatterboxEditor({ message, confirmAction });
        const batches = useChatterboxBatches({ editor, taskEvents: { task, error: ref() }, message, confirmAction });
        state = { editor, batches };
        return () => h("div");
      }
    })
  );
  wrappers.push(wrapper);
  await flushPromises();
  return { ...state, task, message, wrapper };
}
beforeEach(() => {
  vi.resetAllMocks();
  api.batches.mockResolvedValue({ batches: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } });
  api.list.mockResolvedValue({ tasks: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } });
  api.batch.mockResolvedValue(snapshot());
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.useRealTimers();
});

describe("Chatterbox live batch progress", () => {
  it("refreshes completed counts, fractional duration and detail statuses on SSE without overwriting drafts", async () => {
    const { editor, batches, task } = await harness();
    await batches.openBatch("batch-1");
    editor.itemDrafts["item-1"].referenceTranslation = "用户正在校对的译文";
    api.batch.mockResolvedValue(snapshot(1));
    task.value = event(55);
    await flushPromises();
    expect(editor.currentBatch.value).toMatchObject({
      completedItems: 1,
      totalAudioDurationSeconds: 1.25,
      progress: 55
    });
    expect(batches.detailBatch.value?.items[0].status).toBe("completed");
    expect(editor.itemDrafts["item-1"].referenceTranslation).toBe("用户正在校对的译文");
    expect(api.batches).toHaveBeenCalledTimes(2);
  });

  it("polls while SSE is silent, recovers from a request failure, and stops at terminal status", async () => {
    vi.useFakeTimers();
    const { editor, message } = await harness();
    editor.currentBatch.value = snapshot();
    await flushPromises();
    api.batch.mockRejectedValueOnce(new Error("temporary network failure")).mockResolvedValue(snapshot(1));
    await vi.advanceTimersByTimeAsync(2000);
    expect(editor.currentBatch.value.completedItems).toBe(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(editor.currentBatch.value.completedItems).toBe(1);
    expect(editor.errorMessage.value).toBe("");
    api.batch.mockResolvedValue(snapshot(2));
    await vi.advanceTimersByTimeAsync(2000);
    expect(editor.currentBatch.value).toMatchObject({
      status: "completed",
      completedItems: 2,
      totalAudioDurationSeconds: 2.5
    });
    expect(message.success).toHaveBeenCalledWith("批量声音克隆生成完成");
    const calls = api.batch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(6000);
    expect(api.batch).toHaveBeenCalledTimes(calls);
  });

  it("coalesces burst events, fetches the final snapshot and only notifies once", async () => {
    const { editor, task, message } = await harness();
    editor.currentBatch.value = snapshot();
    const first = deferred<ChatterboxBatch>();
    api.batch.mockReturnValueOnce(first.promise).mockResolvedValue(snapshot(2));
    task.value = event(30);
    await flushPromises();
    for (const progress of [50, 70, 100]) {
      task.value = event(progress, progress === 100 ? "completed" : "running");
      await flushPromises();
    }
    expect(api.batch).toHaveBeenCalledTimes(1);
    first.resolve(snapshot(1));
    await flushPromises();
    expect(api.batch).toHaveBeenCalledTimes(2);
    expect(editor.currentBatch.value?.completedItems).toBe(2);
    task.value = event(100, "completed");
    await flushPromises();
    expect(message.success.mock.calls.filter(([text]) => text === "批量声音克隆生成完成")).toHaveLength(1);
  });

  it("rejects an old batch response when a different batch becomes current", async () => {
    const { editor, task } = await harness();
    const old = deferred<ChatterboxBatch>();
    editor.currentBatch.value = snapshot();
    api.batch.mockReturnValueOnce(old.promise).mockResolvedValue(snapshot(1, "batch-2"));
    task.value = event(55);
    await flushPromises();
    const oldSignal = api.batch.mock.calls[0][1] as AbortSignal;
    editor.currentBatch.value = snapshot(0, "batch-2");
    task.value = event(55, "running", "batch-2");
    await flushPromises();
    expect(oldSignal.aborted).toBe(true);
    old.resolve(snapshot(2));
    await flushPromises();
    expect(editor.currentBatch.value).toMatchObject({ id: "batch-2", status: "processing", completedItems: 1 });
  });

  it("rejects a stale snapshot from before regeneration of the same batch", async () => {
    const { editor, batches, task } = await harness();
    await batches.openBatch("batch-1");
    const old = deferred<ChatterboxBatch>();
    api.batch.mockReturnValueOnce(old.promise);
    task.value = event(55);
    await flushPromises();
    const regenerated = snapshot();
    regenerated.items[0].attempt = 2;
    api.regenerate.mockResolvedValue(regenerated);
    await batches.regenerateItem("item-0");
    old.resolve(snapshot(2));
    await flushPromises();
    expect(editor.currentBatch.value?.items[0].attempt).toBe(2);
    expect(editor.currentBatch.value?.status).toBe("processing");
  });

  it("cancels refresh and stops polling on unmount without applying a late response", async () => {
    vi.useFakeTimers();
    const { editor, task, wrapper } = await harness();
    editor.currentBatch.value = snapshot();
    const pending = deferred<ChatterboxBatch>();
    api.batch.mockReturnValue(pending.promise);
    task.value = event(55);
    await flushPromises();
    const signal = api.batch.mock.calls[0][1] as AbortSignal;
    wrapper.unmount();
    expect(signal.aborted).toBe(true);
    pending.resolve(snapshot(2));
    await flushPromises();
    await vi.advanceTimersByTimeAsync(6000);
    expect(editor.currentBatch.value?.completedItems).toBe(0);
    expect(api.batch).toHaveBeenCalledTimes(1);
  });
});
