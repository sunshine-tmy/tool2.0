// @vitest-environment happy-dom
import { defineComponent, h } from "vue";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EdgeTtsBatch, EdgeTtsBatchList, EdgeTtsHealth } from "@toolbox/shared";
const mocks = vi.hoisted(() => ({
  health: vi.fn(),
  voices: vi.fn(),
  batches: vi.fn(),
  batch: vi.fn(),
  createBatch: vi.fn(),
  cancelBatch: vi.fn(),
  removeBatch: vi.fn(),
  regenerate: vi.fn(),
  reorder: vi.fn(),
  removeBatchItem: vi.fn(),
  list: vi.fn(),
  task: vi.fn(),
  remove: vi.fn(),
  confirm: vi.fn(),
  message: { success: vi.fn(), warning: vi.fn(), error: vi.fn() }
}));
vi.mock("./api", () => ({ edgeTtsApi: mocks }));
vi.mock("naive-ui", () => ({ useMessage: () => mocks.message }));
vi.mock("../../../shared/composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
import { useEdgeTtsPanel } from "./useEdgeTtsPanel";
const now = "2026-10-19T00:00:00.000Z";
function batch(status: "queued" | "processing" | "completed" = "completed", id = "batch-1"): EdgeTtsBatch {
  const settings = {
    name: "Online batch",
    language: "ms-MY" as const,
    voice: "ms-MY-YasminNeural",
    rate: 0,
    volume: 0,
    pitch: 0,
    includeSubtitles: true,
    subtitleMode: "sentences" as const
  };
  return {
    ...settings,
    id,
    status,
    progress: status === "completed" ? 100 : 10,
    completedItems: status === "completed" ? 2 : 0,
    failedItems: 0,
    totalCharacters: 20,
    totalAudioBytes: 100,
    totalAudioDurationSeconds: 1,
    createdAt: now,
    updatedAt: now,
    expiresAt: now,
    items: ["one", "two"].map((name, index) => ({
      ...settings,
      id: `item-${name}`,
      order: index + 1,
      attempt: 1,
      text: name,
      referenceTranslation: `中文${index}`,
      status,
      progress: 100,
      characterCount: 3,
      createdAt: now,
      updatedAt: now,
      expiresAt: now
    }))
  };
}
function history(page = 1, total = 1): EdgeTtsBatchList {
  return {
    batches: [batch()],
    pagination: { page, pageSize: 10, total, totalPages: Math.max(1, Math.ceil(total / 10)) }
  };
}
let wrapper: VueWrapper | undefined;
async function panel() {
  let result: ReturnType<typeof useEdgeTtsPanel> | undefined;
  wrapper = mount(
    defineComponent({
      setup() {
        result = useEdgeTtsPanel();
        return () => h("div");
      }
    })
  );
  await flushPromises();
  return result!;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.health.mockResolvedValue({
    available: true,
    version: "7.3.1",
    queue: { active: 0, queued: 0, concurrency: 2, limit: 20 }
  } as EdgeTtsHealth);
  mocks.voices.mockResolvedValue({ voices: [{ shortName: "ms-MY-YasminNeural", suggested: true }] });
  mocks.batches.mockImplementation(async (page: number) => history(page, 25));
  mocks.batch.mockResolvedValue(batch());
  mocks.createBatch.mockResolvedValue(batch("queued"));
  mocks.confirm.mockResolvedValue(true);
  mocks.list.mockResolvedValue({ tasks: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } });
  mocks.reorder.mockResolvedValue(batch());
  mocks.regenerate.mockResolvedValue(batch("queued"));
  mocks.cancelBatch.mockResolvedValue(batch());
  mocks.removeBatch.mockResolvedValue({ removed: true });
  mocks.removeBatchItem.mockResolvedValue(batch());
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.useRealTimers();
});
describe("online ordered speech panel", () => {
  it("bulk deletes selected online batches and clears matching current/detail state", async () => {
    const p = await panel();
    await p.openBatch("batch-1");
    p.current.value = batch();
    p.toggleAllPageBatches(true);
    mocks.batches.mockResolvedValue({ batches: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 1 } });
    await p.removeSelectedBatches();
    expect(mocks.removeBatch).toHaveBeenCalledExactlyOnceWith("batch-1");
    expect(p.current.value).toBeUndefined();
    expect(p.detailVisible.value).toBe(false);
    expect(p.selectedBatchIds.value).toEqual([]);
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.stringContaining("1 个批次"),
      expect.objectContaining({ title: "删除所选批次" })
    );
  });
  it("refills a complete bilingual online batch and settings without generating or replacing the running batch", async () => {
    const p = await panel();
    const source = batch();
    source.language = "en-US";
    source.voice = "en-US-AriaNeural";
    source.rate = 20;
    source.volume = 5;
    source.pitch = -10;
    source.subtitleMode = "segments";
    source.items.reverse();
    mocks.batch.mockResolvedValue(source);
    mocks.voices.mockResolvedValue({ voices: [{ shortName: source.voice, suggested: true }] });
    p.current.value = batch("processing", "running-other");
    const original = JSON.stringify(source);
    await p.reuseBatch(source.id);
    await flushPromises();
    expect(p.editor.segments.value.map((item) => item.text)).toEqual(["one", "two"]);
    expect(p.editor.segments.value.map((item) => item.referenceTranslation)).toEqual(["中文0", "中文1"]);
    expect(p.editor.segments.value[0].id).not.toBe("item-one");
    expect(p.editor.batchName.value).toBe(source.name);
    expect(p.language.value).toBe("en-US");
    expect(p.voice.value).toBe(source.voice);
    expect([p.rate.value, p.volume.value, p.pitch.value]).toEqual([20, 5, -10]);
    expect(p.subtitleMode.value).toBe("segments");
    expect(p.current.value?.id).toBe("running-other");
    expect(JSON.stringify(source)).toBe(original);
    expect(mocks.createBatch).not.toHaveBeenCalled();
    expect(mocks.cancelBatch).not.toHaveBeenCalled();
  });

  it("keeps the online draft on cancelled replacement or failed loading", async () => {
    const p = await panel();
    p.editor.segments.value[0].text = "Keep this draft";
    mocks.confirm.mockResolvedValue(false);
    await p.reuseBatch("batch-1");
    expect(p.editor.segments.value[0].text).toBe("Keep this draft");
    mocks.batch.mockRejectedValue(new Error("missing batch"));
    await p.reuseBatch("missing");
    expect(p.editor.segments.value[0].text).toBe("Keep this draft");
    expect(p.reusingBatchId.value).toBeUndefined();
    expect(mocks.message.error).toHaveBeenCalled();
  });

  it("blocks online refilling during submission and coalesces duplicate clicks", async () => {
    const p = await panel();
    p.creating.value = true;
    await p.reuseBatch("batch-1");
    expect(mocks.batch).not.toHaveBeenCalled();
    p.creating.value = false;
    let finish!: (value: EdgeTtsBatch) => void;
    mocks.batch.mockImplementationOnce(
      () =>
        new Promise<EdgeTtsBatch>((resolve) => {
          finish = resolve;
        })
    );
    const pending = p.reuseBatch("batch-1");
    await p.reuseBatch("batch-2");
    expect(mocks.batch).toHaveBeenCalledTimes(1);
    finish(batch());
    await pending;
    expect(p.reusingBatchId.value).toBeUndefined();
  });

  it("parses bilingual ordered drafts, reorders, duplicates and clears without modifying submitted batches or controls", async () => {
    const p = await panel();
    p.editor.autoText.value = "1. Hello there.\n你好。\n\n2. Thank you.\n谢谢。";
    await p.editor.apply();
    expect(p.editor.segments.value.map((item) => item.referenceTranslation)).toEqual(["你好。", "谢谢。"]);
    p.editor.duplicate(0);
    p.editor.move(2, -2);
    p.editor.remove(1);
    expect(p.editor.segments.value.map((item) => item.text)).toEqual(["Thank you.", "Hello there."]);
    p.current.value = batch("processing");
    p.rate.value = 15;
    await p.editor.clear();
    expect(p.editor.segments.value).toHaveLength(1);
    expect(p.editor.segments.value[0].text).toBe("");
    expect(p.rate.value).toBe(15);
    expect(p.current.value.status).toBe("processing");
    expect(mocks.cancelBatch).not.toHaveBeenCalled();
  });
  it("allows more batches during generation but prevents duplicate in-flight submissions", async () => {
    const p = await panel();
    p.editor.segments.value[0].text = "First";
    p.editor.segments.value[0].referenceTranslation = "第一";
    p.current.value = batch("processing");
    expect(p.canCreate.value).toBe(true);
    let finish!: (value: EdgeTtsBatch) => void;
    mocks.createBatch.mockImplementationOnce(() => new Promise<EdgeTtsBatch>((resolve) => (finish = resolve)));
    const creating = p.createBatch();
    await p.createBatch();
    expect(mocks.createBatch).toHaveBeenCalledTimes(1);
    expect(p.canCreate.value).toBe(false);
    finish(batch("queued"));
    await creating;
    expect(p.canCreate.value).toBe(true);
    p.editor.segments.value[0].text = "Second";
    await p.createBatch();
    expect(mocks.createBatch).toHaveBeenCalledTimes(2);
    expect(mocks.createBatch.mock.calls[0][0].segments[0]).toEqual({
      text: "First",
      referenceTranslation: "第一",
      fileName: undefined
    });
  });
  it("validates draft limits and retains the draft after a rejected submission", async () => {
    const p = await panel();
    p.editor.segments.value[0].text = "a".repeat(20001);
    expect(p.canCreate.value).toBe(false);
    p.editor.segments.value[0].text = "Text";
    p.editor.segments.value[0].referenceTranslation = "中".repeat(2001);
    expect(p.canCreate.value).toBe(false);
    p.editor.segments.value[0].referenceTranslation = "中文";
    mocks.createBatch.mockRejectedValueOnce(new Error("Queue full"));
    await p.createBatch();
    expect(p.editor.segments.value[0].text).toBe("Text");
    expect(p.creating.value).toBe(false);
    expect(p.canCreate.value).toBe(true);
    expect(p.error.value).toBeTruthy();
  });
  it("preserves the history page on refresh and ignores stale responses", async () => {
    const p = await panel();
    await p.changePage(2);
    await p.loadBatches();
    expect(mocks.batches).toHaveBeenLastCalledWith(2, 10);
    let finish!: (value: EdgeTtsBatchList) => void;
    mocks.batches.mockImplementationOnce(() => new Promise<EdgeTtsBatchList>((resolve) => (finish = resolve)));
    const older = p.changePage(1);
    await p.changePage(3);
    finish(history(1, 25));
    await older;
    expect(p.history.value.pagination.page).toBe(3);
  });
  it("polls active results and stops requesting once the panel is unmounted", async () => {
    vi.useFakeTimers();
    const p = await panel();
    p.current.value = batch("processing");
    await vi.advanceTimersByTimeAsync(2500);
    await flushPromises();
    expect(mocks.batch).toHaveBeenCalledWith("batch-1");
    expect(p.current.value.status).toBe("completed");
    wrapper!.unmount();
    wrapper = undefined;
    const calls = mocks.batch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10000);
    expect(mocks.batch).toHaveBeenCalledTimes(calls);
  });
  it("manages per-segment drafts and regeneration without sending edits before explicit submission", async () => {
    const p = await panel();
    await p.openBatch("batch-1");
    p.drafts["item-one"].text = "Updated";
    p.drafts["item-one"].referenceTranslation = "更新";
    expect(mocks.regenerate).not.toHaveBeenCalled();
    await p.regenerate(p.detail.value!.items[0]);
    expect(mocks.regenerate).toHaveBeenCalledWith(
      "batch-1",
      "item-one",
      expect.objectContaining({ text: "Updated", referenceTranslation: "更新" })
    );
    expect(p.current.value?.status).toBe("queued");
    mocks.batch.mockResolvedValue(batch());
    await p.openBatch("batch-1");
    await p.moveItem(0, 1);
    expect(mocks.reorder).toHaveBeenCalledWith("batch-1", ["item-two", "item-one"]);
    await p.removeItem("item-two");
    expect(mocks.removeBatchItem).toHaveBeenCalledWith("batch-1", "item-two");
  });
});
