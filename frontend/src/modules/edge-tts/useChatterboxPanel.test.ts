/**
 * 中文模块说明：测试 frontend/src/modules/edge-tts/useChatterboxPanel.test.ts 中的稳定行为、边界条件和回归场景
 */
// @vitest-environment happy-dom

import { defineComponent, h, ref, type ComponentPublicInstance } from "vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

function batchList(): ChatterboxBatchList {
  const current = batch();
  return {
    batches: [{ ...current, itemPreviews: current.items.map((item) => ({ ...item, textPreview: item.text })) }],
    pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 }
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

describe("useChatterboxPanel", () => {
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
    await panel.createBatch();
    expect(mocks.api.createBatch).toHaveBeenCalled();

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
