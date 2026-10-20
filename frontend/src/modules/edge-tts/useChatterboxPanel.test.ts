/**
 * 中文模块说明：测试 frontend/src/modules/edge-tts/useChatterboxPanel.test.ts 中的稳定行为、边界条件和回归场景
 */
// @vitest-environment happy-dom

import { defineComponent, h, ref, type ComponentPublicInstance } from "vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ChatterboxBatch,
  ChatterboxBatchList,
  ChatterboxHealth,
  ChatterboxSavedVoice,
  ChatterboxTask,
  ChatterboxTaskList
} from "@toolbox/shared";

const mocks = vi.hoisted(() => ({
  api: {
    health: vi.fn(),
    voices: vi.fn(),
    saveVoice: vi.fn(),
    removeVoice: vi.fn(),
    batches: vi.fn(),
    list: vi.fn(),
    createBatch: vi.fn(),
    batch: vi.fn(),
    regenerate: vi.fn(),
    reorder: vi.fn(),
    removeBatchItem: vi.fn(),
    cancelBatch: vi.fn(),
    removeBatchReference: vi.fn(),
    removeBatch: vi.fn(),
    task: vi.fn(),
    remove: vi.fn()
  },
  confirm: vi.fn(),
  message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
}));

vi.mock("naive-ui", () => ({ useMessage: () => mocks.message }));
vi.mock("../../composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
vi.mock("../../composables/useTaskEvents", () => ({
  useTaskEvents: () => ({ task: ref(), error: ref(), connection: ref("idle"), reconnect: vi.fn(), close: vi.fn() })
}));
vi.mock("./chatterbox-api", () => ({ chatterboxApi: mocks.api }));

import { useChatterboxPanel } from "./useChatterboxPanel";

const now = "2026-09-13T00:00:00.000Z";

function health(): ChatterboxHealth {
  return {
    protocolVersion: 1,
    available: true,
    workerAvailable: true,
    model: "multilingual-v3",
    modelLoaded: true,
    device: "cpu",
    message: "ready",
    reference: { maxBytes: 20 * 1024 * 1024, minSeconds: 5, maxSeconds: 30 },
    maxTextLength: 1_200,
    retentionDays: 3,
    queue: { active: 0, queued: 0, concurrency: 1, limit: 30 },
    watermarked: true
  };
}

function unavailableHealth(): ChatterboxHealth {
  return {
    ...health(),
    available: false,
    workerAvailable: false,
    modelLoaded: false,
    message: "Chatterbox Worker 正在启动"
  };
}

function unloadedHealth(): ChatterboxHealth {
  return {
    ...health(),
    modelLoaded: false,
    message: "运行环境已就绪，将从已安装的本地模型加载"
  };
}

function voice(): ChatterboxSavedVoice {
  return {
    id: "voice-1",
    name: "Demo voice",
    language: "ms",
    originalFileName: "voice.wav",
    durationSeconds: 10,
    audioBytes: 100,
    authorization: "self",
    consentConfirmed: true,
    createdAt: now,
    updatedAt: now,
    audioUrl: "/voice.wav"
  };
}

function batch(status: ChatterboxBatch["status"] = "completed"): ChatterboxBatch {
  return {
    id: "batch-1",
    engine: "chatterbox-multilingual-v3",
    status,
    progress: status === "completed" ? 100 : 20,
    name: "Demo batch",
    language: "ms",
    referenceFileName: "voice.wav",
    referenceDurationSeconds: 10,
    referenceRetained: true,
    referenceAvailable: true,
    authorization: "self",
    consentConfirmed: true,
    exaggeration: 0.5,
    cfgWeight: 0.5,
    temperature: 0.8,
    seed: 7,
    includeSubtitles: true,
    subtitleMode: "sentences",
    items: [
      {
        id: "item-1",
        order: 1,
        text: "First line",
        referenceTranslation: "第一行",
        fileName: "one",
        status: "completed",
        progress: 100,
        attempt: 1,
        characterCount: 10,
        audioBytes: 100,
        audioDurationSeconds: 2,
        createdAt: now,
        updatedAt: now,
        audioUrl: "/one.mp3",
        downloadUrl: "/one/download"
      },
      {
        id: "item-2",
        order: 2,
        text: "Second line",
        status: "completed",
        progress: 100,
        attempt: 1,
        characterCount: 11,
        audioBytes: 110,
        audioDurationSeconds: 3,
        createdAt: now,
        updatedAt: now
      }
    ],
    totalCharacters: 21,
    totalAudioBytes: 210,
    totalAudioDurationSeconds: 5,
    completedItems: 2,
    failedItems: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt: now,
    archiveUrl: "/batch.zip"
  };
}

function batchList(page = 1, total = 1): ChatterboxBatchList {
  const current = batch();
  return {
    batches: [{ ...current, itemPreviews: current.items.map((item) => ({ ...item, textPreview: item.text })) }],
    pagination: { page, pageSize: 10, total, totalPages: Math.max(1, Math.ceil(total / 10)) }
  };
}

function legacyTask(): ChatterboxTask {
  return {
    id: "legacy-1",
    engine: "chatterbox-multilingual-v3",
    status: "completed",
    progress: 100,
    text: "Legacy text",
    language: "en",
    referenceFileName: "legacy.wav",
    referenceDurationSeconds: 8,
    authorization: "authorized",
    consentConfirmed: true,
    exaggeration: 0.6,
    cfgWeight: 0.4,
    temperature: 0.7,
    seed: 9,
    includeSubtitles: false,
    fileName: "legacy",
    characterCount: 11,
    createdAt: now,
    updatedAt: now,
    expiresAt: now
  };
}

type Panel = ReturnType<typeof useChatterboxPanel>;

async function mountPanel() {
  let panel: Panel | undefined;
  const Harness = defineComponent({
    setup() {
      panel = useChatterboxPanel();
      return () => h("div");
    }
  });
  const wrapper: VueWrapper<ComponentPublicInstance> = mount(Harness);
  await flushPromises();
  if (!panel) throw new Error("Panel composable did not initialize");
  return { panel, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.confirm.mockResolvedValue(true);
  mocks.api.health.mockResolvedValue(health());
  mocks.api.voices.mockResolvedValue({ voices: [voice()] });
  mocks.api.batches.mockResolvedValue(batchList());
  const tasks: ChatterboxTaskList = {
    tasks: [{ ...legacyTask(), textPreview: "Legacy text" }],
    pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }
  };
  mocks.api.list.mockResolvedValue(tasks);
  mocks.api.createBatch.mockResolvedValue(batch("queued"));
  mocks.api.batch.mockResolvedValue(batch());
  mocks.api.saveVoice.mockResolvedValue(voice());
  mocks.api.removeVoice.mockResolvedValue({ removed: true });
  mocks.api.regenerate.mockResolvedValue(batch("queued"));
  mocks.api.reorder.mockResolvedValue(batch());
  mocks.api.removeBatchItem.mockResolvedValue({ removed: true, batch: batch() });
  mocks.api.cancelBatch.mockResolvedValue(batch("cancelled"));
  mocks.api.removeBatchReference.mockResolvedValue({ removed: true });
  mocks.api.removeBatch.mockResolvedValue({ removed: true });
  mocks.api.task.mockResolvedValue(legacyTask());
  mocks.api.remove.mockResolvedValue({ removed: true });
  vi.stubGlobal("scrollTo", vi.fn());
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:voice");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});

afterEach(() => vi.useRealTimers());

describe("useChatterboxPanel", () => {
  it("bulk deletes selected clone batches and clears matching current/detail state", async () => {
    const { panel, wrapper } = await mountPanel();
    await panel.openBatch("batch-1");
    panel.currentBatch.value = batch();
    panel.toggleAllPageBatches(true);
    mocks.api.batches.mockResolvedValue(batchList(1, 0));
    await panel.removeSelectedBatches();
    expect(mocks.api.removeBatch).toHaveBeenCalledExactlyOnceWith("batch-1");
    expect(panel.currentBatch.value).toBeUndefined();
    expect(panel.detailVisible.value).toBe(false);
    expect(panel.selectedBatchIds.value).toEqual([]);
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.stringContaining("1 个批次"),
      expect.objectContaining({ title: "删除所选批次" })
    );
    wrapper.unmount();
  });
  it("refills complete bilingual batch drafts in order without changing the source batch or running queue", async () => {
    const { panel, wrapper } = await mountPanel();
    const source = batch();
    source.items.reverse();
    source.seed = 42;
    source.device = "cuda";
    mocks.api.batch.mockResolvedValue(source);
    panel.health.value = { ...health(), cudaAvailable: true };
    panel.currentBatch.value = { ...batch("processing"), id: "running-other" };
    const selectedReference = new File(["reference"], "selected.wav");
    panel.referenceFile.value = selectedReference;
    panel.consentConfirmed.value = true;
    const original = JSON.stringify(source);
    await panel.reuseBatch(source.id);
    expect(
      panel.segments.value.map(({ text, fileName, referenceTranslation }) => ({ text, fileName, referenceTranslation }))
    ).toEqual([
      { text: "First line", fileName: "one", referenceTranslation: "第一行" },
      { text: "Second line", fileName: "", referenceTranslation: "" }
    ]);
    expect(panel.segments.value[0].id).not.toBe("item-1");
    expect(panel.batchName.value).toBe(source.name);
    expect(panel.seed.value).toBe(42);
    expect(panel.device.value).toBe("cuda");
    expect(panel.consentConfirmed.value).toBe(false);
    expect(panel.referenceFile.value).toMatchObject({ name: "selected.wav", size: selectedReference.size });
    expect(panel.currentBatch.value.id).toBe("running-other");
    expect(JSON.stringify(source)).toBe(original);
    expect(mocks.api.createBatch).not.toHaveBeenCalled();
    expect(mocks.api.cancelBatch).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("preserves the existing clone draft when replacement is cancelled or loading fails", async () => {
    const { panel, wrapper } = await mountPanel();
    panel.segments.value[0].text = "Keep this draft";
    mocks.confirm.mockResolvedValue(false);
    await panel.reuseBatch("batch-1");
    expect(panel.segments.value[0].text).toBe("Keep this draft");
    expect(mocks.confirm).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ title: "重新填入批次" }));
    mocks.api.batch.mockRejectedValue(new Error("missing batch"));
    await panel.reuseBatch("missing");
    expect(panel.segments.value[0].text).toBe("Keep this draft");
    expect(panel.reusingBatchId.value).toBeUndefined();
    expect(mocks.message.error).toHaveBeenCalled();
    wrapper.unmount();
  });

  it("blocks clone refilling during submission and duplicate in-flight refills", async () => {
    const { panel, wrapper } = await mountPanel();
    panel.creating.value = true;
    await panel.reuseBatch("batch-1");
    expect(mocks.api.batch).not.toHaveBeenCalled();
    panel.creating.value = false;
    let finish!: (value: ChatterboxBatch) => void;
    mocks.api.batch.mockImplementationOnce(
      () =>
        new Promise<ChatterboxBatch>((resolve) => {
          finish = resolve;
        })
    );
    const pending = panel.reuseBatch("batch-1");
    await panel.reuseBatch("batch-2");
    expect(mocks.api.batch).toHaveBeenCalledTimes(1);
    finish(batch());
    await pending;
    expect(panel.reusingBatchId.value).toBeUndefined();
    wrapper.unmount();
  });

  it("paginates batch history and preserves the current page when refreshing", async () => {
    mocks.api.batches.mockImplementation(async (page: number) => batchList(page, 25));
    const { panel, wrapper } = await mountPanel();
    expect(mocks.api.batches).toHaveBeenLastCalledWith(1, 10);
    await panel.changeBatchPage(2);
    expect(mocks.api.batches).toHaveBeenLastCalledWith(2, 10);
    expect(panel.batchHistory.value.pagination).toMatchObject({ page: 2, total: 25, totalPages: 3 });
    await panel.loadBatches();
    expect(mocks.api.batches).toHaveBeenLastCalledWith(2, 10);
    const calls = mocks.api.batches.mock.calls.length;
    await panel.changeBatchPage(0);
    await panel.changeBatchPage(4);
    await panel.changeBatchPage(1.5);
    expect(mocks.api.batches).toHaveBeenCalledTimes(calls);
    wrapper.unmount();
  });

  it("keeps the displayed page and supports retry after a page request fails", async () => {
    mocks.api.batches.mockImplementation(async (page: number) => batchList(page, 25));
    const { panel, wrapper } = await mountPanel();
    mocks.api.batches.mockRejectedValueOnce(new Error("Page unavailable"));
    await panel.changeBatchPage(2);
    expect(panel.batchHistory.value.pagination.page).toBe(1);
    expect(panel.loadingBatches.value).toBe(false);
    expect(panel.errorMessage.value).toContain("批次记录读取失败");
    await panel.loadBatches();
    expect(mocks.api.batches).toHaveBeenLastCalledWith(1, 10);
    await panel.changeBatchPage(2);
    expect(panel.batchHistory.value.pagination.page).toBe(2);
    wrapper.unmount();
  });

  it("ignores older page responses when requests finish out of order", async () => {
    mocks.api.batches.mockResolvedValue(batchList(1, 25));
    const { panel, wrapper } = await mountPanel();
    let resolveSecond!: (value: ChatterboxBatchList) => void;
    mocks.api.batches.mockImplementationOnce(
      () => new Promise<ChatterboxBatchList>((resolve) => (resolveSecond = resolve))
    );
    const older = panel.changeBatchPage(2);
    expect(panel.loadingBatches.value).toBe(true);
    mocks.api.batches.mockResolvedValueOnce(batchList(3, 25));
    await panel.changeBatchPage(3);
    expect(panel.batchHistory.value.pagination.page).toBe(3);
    resolveSecond(batchList(2, 25));
    await older;
    expect(panel.batchHistory.value.pagination.page).toBe(3);
    expect(panel.loadingBatches.value).toBe(false);
    wrapper.unmount();
  });

  it("uses the corrected page after deleting the last batch on the last page", async () => {
    mocks.api.batches.mockImplementation(async (page: number) => batchList(page, 11));
    const { panel, wrapper } = await mountPanel();
    await panel.changeBatchPage(2);
    mocks.api.batches.mockResolvedValue(batchList(1, 10));
    await panel.removeBatch("batch-1");
    expect(panel.batchHistory.value.pagination).toMatchObject({ page: 1, total: 10, totalPages: 1 });
    await panel.loadBatches();
    expect(mocks.api.batches).toHaveBeenLastCalledWith(1, 10);
    wrapper.unmount();
  });

  it("returns to the first history page after submitting a new batch", async () => {
    mocks.api.batches.mockImplementation(async (page: number) => batchList(page, 25));
    const { panel, wrapper } = await mountPanel();
    await panel.changeBatchPage(2);
    panel.selectedVoiceId.value = "voice-1";
    panel.consentConfirmed.value = true;
    panel.segments.value[0].text = "New batch";
    await panel.createBatch();
    expect(mocks.api.createBatch).toHaveBeenCalledTimes(1);
    expect(mocks.api.createBatch).toHaveBeenCalledWith(expect.objectContaining({ referenceRetained: true }));
    expect(mocks.api.batches).toHaveBeenLastCalledWith(1, 10);
    expect(panel.batchHistory.value.pagination.page).toBe(1);
    wrapper.unmount();
  });

  it("defaults to GPU when CUDA is available without overriding later manual selection", async () => {
    const gpuHealth = { ...health(), cudaAvailable: true, gpuName: "Test GPU" };
    mocks.api.health.mockResolvedValue(gpuHealth);
    const { panel, wrapper } = await mountPanel();
    expect(panel.device.value).toBe("cuda");
    panel.device.value = "cpu";
    await panel.loadHealth();
    await flushPromises();
    expect(panel.device.value).toBe("cpu");
    wrapper.unmount();
  });

  it("defaults to CPU when the ready worker has no CUDA support", async () => {
    mocks.api.health.mockResolvedValue({ ...health(), cudaAvailable: false });
    const { panel, wrapper } = await mountPanel();
    expect(panel.device.value).toBe("cpu");
    wrapper.unmount();
  });

  it("waits for worker readiness before resolving the default device", async () => {
    mocks.api.health
      .mockReset()
      .mockResolvedValueOnce(unavailableHealth())
      .mockResolvedValue({
        ...health(),
        cudaAvailable: true
      });
    const { panel, wrapper } = await mountPanel();
    expect(panel.device.value).toBe("cuda");
    await panel.loadHealth();
    await flushPromises();
    expect(panel.cudaAvailable.value).toBe(true);
    expect(panel.device.value).toBe("cuda");
    wrapper.unmount();
  });

  it.each(["queued", "processing"] as const)("allows another batch while the current batch is %s", async (status) => {
    const { panel, wrapper } = await mountPanel();
    panel.currentBatch.value = batch(status);
    panel.referenceSource.value = "saved";
    panel.selectedVoiceId.value = "voice-1";
    panel.consentConfirmed.value = true;
    panel.segments.value[0].text = "Next batch";
    expect(panel.canCreate.value).toBe(true);

    await panel.createBatch();
    panel.segments.value[0].text = "Another batch";
    expect(panel.canCreate.value).toBe(true);
    await panel.createBatch();

    expect(mocks.api.createBatch).toHaveBeenCalledTimes(2);
    expect(mocks.api.createBatch.mock.calls.map(([input]) => input.segments[0].text)).toEqual([
      "Next batch",
      "Another batch"
    ]);
    expect(mocks.api.cancelBatch).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("blocks duplicate submissions only until the request settles and allows retry after failure", async () => {
    const { panel, wrapper } = await mountPanel();
    panel.referenceSource.value = "saved";
    panel.selectedVoiceId.value = "voice-1";
    panel.consentConfirmed.value = true;
    panel.segments.value[0].text = "Queued text";
    let rejectSubmission!: (error: Error) => void;
    mocks.api.createBatch.mockImplementationOnce(
      () => new Promise<ChatterboxBatch>((_resolve, reject) => (rejectSubmission = reject))
    );

    const submission = panel.createBatch();
    expect(panel.creating.value).toBe(true);
    expect(panel.canCreate.value).toBe(false);
    await panel.createBatch();
    await panel.clearBatchDraft();
    expect(panel.segments.value[0].text).toBe("Queued text");
    expect(mocks.api.createBatch).toHaveBeenCalledTimes(1);
    rejectSubmission(new Error("Queue full"));
    await submission;
    expect(panel.creating.value).toBe(false);
    expect(panel.canCreate.value).toBe(true);
    expect(panel.segments.value[0].text).toBe("Queued text");
    await panel.createBatch();
    expect(mocks.api.createBatch).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it("clears the editor draft after confirmation without changing queued work, voice or parameters", async () => {
    const { panel, wrapper } = await mountPanel();
    panel.currentBatch.value = batch("processing");
    panel.referenceSource.value = "saved";
    panel.selectedVoiceId.value = "voice-1";
    panel.consentConfirmed.value = true;
    panel.exaggeration.value = 0.7;
    panel.batchName.value = "Draft";
    panel.segments.value = [panel.newEditorSegment("Text", "file", "中文"), panel.newEditorSegment("Next")];
    panel.autoSegmentText.value = "Pasted text";
    panel.autoSegmentVisible.value = true;
    panel.dragItemId.value = panel.segments.value[0].id;
    const runningBatch = panel.currentBatch.value;

    await panel.clearBatchDraft();

    expect(mocks.confirm).toHaveBeenCalledWith(expect.stringContaining("已加入队列"), {
      title: "清空当前批次内容",
      positiveText: "确认清空",
      danger: true
    });
    expect(panel.batchName.value).toBe("");
    expect(panel.segments.value).toEqual([
      { id: expect.any(String), text: "", fileName: "", referenceTranslation: "" }
    ]);
    expect(panel.autoSegmentText.value).toBe("");
    expect(panel.autoSegmentVisible.value).toBe(false);
    expect(panel.dragItemId.value).toBeUndefined();
    expect(panel.hasBatchDraft.value).toBe(false);
    expect(panel.canCreate.value).toBe(false);
    expect(panel.currentBatch.value).toBe(runningBatch);
    expect(panel.selectedVoiceId.value).toBe("voice-1");
    expect(panel.consentConfirmed.value).toBe(true);
    expect(panel.language.value).toBe("ms");
    expect(panel.exaggeration.value).toBe(0.7);
    expect(mocks.api.cancelBatch).not.toHaveBeenCalled();
    expect(mocks.api.removeBatch).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("keeps the draft when clearing is cancelled and ignores an empty draft", async () => {
    const { panel, wrapper } = await mountPanel();
    await panel.clearBatchDraft();
    expect(mocks.confirm).not.toHaveBeenCalled();
    panel.segments.value[0].referenceTranslation = "仅中文";
    expect(panel.hasBatchDraft.value).toBe(true);
    mocks.confirm.mockResolvedValueOnce(false);
    await panel.clearBatchDraft();
    expect(panel.segments.value[0].referenceTranslation).toBe("仅中文");
    wrapper.unmount();
  });

  it("retries Chatterbox health until the worker becomes available", async () => {
    vi.useFakeTimers();
    mocks.api.health.mockReset().mockResolvedValueOnce(unavailableHealth()).mockResolvedValue(health());

    const { panel, wrapper } = await mountPanel();
    expect(panel.health.value?.available).toBe(false);
    expect(panel.healthLabel.value).toBe("克隆环境未就绪");

    await vi.advanceTimersByTimeAsync(5_000);
    await flushPromises();

    expect(mocks.api.health).toHaveBeenCalledTimes(2);
    expect(panel.health.value?.available).toBe(true);
    expect(panel.healthLabel.value).toContain("V3 已加载");
    wrapper.unmount();
    vi.useRealTimers();
  });

  it("refreshes model status while the panel is open and uses an accurate unloaded label", async () => {
    vi.useFakeTimers();
    mocks.api.health.mockReset().mockResolvedValueOnce(unloadedHealth()).mockResolvedValue(health());

    const { panel, wrapper } = await mountPanel();
    expect(panel.healthLabel.value).toBe("运行就绪 · 生成时载入模型");

    await vi.advanceTimersByTimeAsync(12_000);
    await flushPromises();

    expect(mocks.api.health).toHaveBeenCalledTimes(2);
    expect(panel.healthLabel.value).toContain("V3 已加载");
    wrapper.unmount();
    vi.useRealTimers();
  });

  it("manages editor segments, references and display helpers", async () => {
    // 面板测试使用真实 composable 组合，仅 mock API，验证编辑器、音色和展示辅助状态能协同工作。
    const { panel, wrapper } = await mountPanel();
    expect(panel.health.value?.available).toBe(true);
    expect(panel.savedVoices.value).toHaveLength(1);
    expect(panel.healthLabel.value).toContain("V3 已加载");

    panel.segments.value[0].text = "First\n\nSecond";
    panel.splitByBlankLines();
    expect(panel.segments.value.map((item) => item.text)).toEqual(["First", "Second"]);
    panel.duplicateSegment(0);
    panel.moveSegment(0, 1);
    panel.removeEditorSegment(0);
    panel.addSegment();

    const dataTransfer = { effectAllowed: "", dropEffect: "", setData: vi.fn() };
    panel.startSegmentDrag({ dataTransfer } as unknown as DragEvent, panel.segments.value[0].id);
    panel.allowSegmentDrop({ dataTransfer, preventDefault: vi.fn() } as unknown as DragEvent);
    panel.dropSegment(
      { dataTransfer, preventDefault: vi.fn() } as unknown as DragEvent,
      panel.segments.value.at(-1)!.id
    );

    panel.autoSegmentText.value = "Hello there.\n你好。\n\nThank you.\n谢谢。";
    panel.openAutoSegment();
    await panel.applyAutoSegments();
    expect(panel.segments.value).toHaveLength(2);
    expect(panel.translatedAutoSegmentCount.value).toBe(2);

    const reference = new File([new Uint8Array([1, 2, 3])], "voice.wav", { type: "audio/wav" });
    panel.selectReference({ target: { files: [reference] } } as unknown as Event);
    expect(panel.referencePreview.value).toBe("blob:voice");
    panel.selectRetryReference({ target: { files: [reference], value: "chosen" } } as unknown as Event);
    expect(panel.retryReference.value).toMatchObject({ name: "voice.wav", size: 3 });

    panel.resetParameters();
    expect(panel.languageLabel("pt-BR")).toBe("巴西葡萄牙语");
    expect(panel.batchTitle({ id: "abcdefghi" })).toContain("abcdef");
    expect(panel.batchStatusLabel("partial_failed")).toBe("部分失败");
    expect(panel.batchTagType("completed")).toBe("success");
    expect(panel.taskStatusLabel("failed")).toBe("失败");
    expect(panel.taskTagType("failed")).toBe("error");
    expect(panel.formatDuration(65)).toBe("1 分 5 秒");
    expect(panel.formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(panel.mediaUrl("/audio.mp3")).toBe("/audio.mp3");
    expect(panel.formatDate(now)).toBeTruthy();
    wrapper.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:voice");
  });

  it("coordinates saved voices, batch lifecycle and legacy migration", async () => {
    const { panel, wrapper } = await mountPanel();
    panel.health.value = { ...health(), gpuName: "NVIDIA GeForce RTX 3060 Ti" };
    expect(panel.healthLabel.value).toBe("V3 已加载 · CPU");
    const reference = new File([new Uint8Array([1])], "voice.wav", { type: "audio/wav" });
    panel.referenceFile.value = reference;
    panel.voiceName.value = "Permanent voice";
    panel.consentConfirmed.value = true;
    await panel.saveCurrentVoice();
    expect(mocks.api.saveVoice).toHaveBeenCalled();
    await panel.removeSavedVoice("voice-1");
    expect(mocks.api.removeVoice).toHaveBeenCalledWith("voice-1");

    panel.referenceSource.value = "upload";
    panel.referenceFile.value = reference;
    panel.segments.value[0].text = "Generate this";
    panel.device.value = "cuda";
    panel.health.value = { ...health(), cudaAvailable: false };
    expect(panel.canCreate.value).toBe(false);
    panel.health.value = { ...health(), cudaRuntimeAvailable: true, cudaAvailable: true, gpuName: "Test GPU" };
    expect(panel.canCreate.value).toBe(true);
    await panel.createBatch();
    expect(mocks.api.createBatch).toHaveBeenCalledWith(expect.objectContaining({ device: "cuda" }));

    await panel.openBatch("batch-1");
    expect(panel.detailVisible.value).toBe(true);
    panel.retryReference.value = reference;
    await panel.regenerateItem("item-1");
    expect(mocks.api.regenerate).toHaveBeenCalled();
    await panel.moveDetailItem(0, 1);
    expect(mocks.api.reorder).toHaveBeenCalledWith("batch-1", ["item-2", "item-1"]);
    await panel.removeBatchItem("item-1");
    await panel.cancelBatch("batch-1");
    await panel.removeReference("batch-1");
    await panel.removeBatch("batch-1");
    expect(mocks.api.removeBatch).toHaveBeenCalledWith("batch-1");

    await panel.reuseLegacy("legacy-1");
    expect(panel.language.value).toBe("en");
    expect(panel.segments.value[0].text).toBe("Legacy text");
    await panel.removeLegacy("legacy-1");
    expect(mocks.api.remove).toHaveBeenCalledWith("legacy-1");
    wrapper.unmount();
  });
});
