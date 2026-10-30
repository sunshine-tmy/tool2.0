// @vitest-environment happy-dom

import { reactive } from "vue";
import { shallowMount } from "@vue/test-utils";
import { NButton, NInput, NInputNumber, NSlider, NSelect, NCheckbox, NModal, NCard } from "naive-ui";
import { describe, expect, it, vi } from "vitest";
import ChatterboxEditorForm from "./ChatterboxEditorForm.vue";
import { chatterboxPanelKey } from "./chatterbox-panel-context";

describe("Chatterbox editor actions", () => {
  it("edits local clone options, saved-voice selection and segment controls without enqueueing", async () => {
    const voice = {
      id: "voice-1",
      name: "Owned voice",
      durationSeconds: 12,
      createdAt: "2026-10-22",
      audioUrl: "/voice"
    };
    const panel = reactive({
      referenceSource: "upload",
      savedVoices: [voice],
      languageSavedVoices: [voice],
      selectedVoiceId: "",
      referenceFile: new File(["wav"], "reference.wav"),
      voiceName: "",
      batchName: "",
      segments: [{ id: "segment-1", text: "Original", referenceTranslation: "原文", fileName: "first" }],
      autoSegmentText: "",
      parsedAutoSegments: [],
      autoSegmentVisible: false,
      dragItemId: "",
      maxBatchSegments: 30,
      totalCharacters: 8,
      maxBatchTextLength: 10000,
      language: "ms",
      device: "cpu",
      cudaAvailable: true,
      exaggeration: 0.5,
      cfgWeight: 0.5,
      temperature: 0.8,
      seed: 0,
      authorization: "own",
      authorizationOptions: [],
      consentConfirmed: false,
      includeSubtitles: false,
      subtitleMode: "sentences",
      subtitleModeOptions: [],
      health: { available: true },
      validSegmentCount: 1,
      creating: false,
      canCreate: true,
      hasBatchDraft: true,
      formatBytes: () => "3 B",
      formatDate: () => "today",
      languageLabel: () => "Malay",
      mediaUrl: (url: string) => url,
      selectReference: vi.fn(),
      saveCurrentVoice: vi.fn(),
      removeSavedVoice: vi.fn(),
      openAutoSegment: vi.fn(),
      splitByBlankLines: vi.fn(),
      addSegment: vi.fn(),
      clearBatchDraft: vi.fn(),
      allowSegmentDrop: vi.fn(),
      dropSegment: vi.fn(),
      startSegmentDrag: vi.fn(),
      moveSegment: vi.fn(),
      duplicateSegment: vi.fn(),
      removeEditorSegment: vi.fn(),
      resetParameters: vi.fn(),
      applyAutoSegments: vi.fn(),
      createBatch: vi.fn()
    });
    const wrapper = shallowMount(ChatterboxEditorForm, {
      global: {
        renderStubDefaultSlot: true,
        provide: { [chatterboxPanelKey as symbol]: panel },
        stubs: {
          NCard: { template: "<section><slot/><slot name='footer'/></section>" },
          Card: { template: "<section><slot/><slot name='footer'/></section>" }
        }
      }
    });
    try {
      const inputs = wrapper.findAllComponents(NInput);
      ["Saved voice", "Clone batch", "Changed text", "修改译文", "renamed", "1. Auto"].forEach((value, index) =>
        inputs[index].vm.$emit("update:value", value)
      );
      expect(panel).toMatchObject({ voiceName: "Saved voice", batchName: "Clone batch", autoSegmentText: "1. Auto" });
      const textarea = document.createElement("textarea");
      const paste = new Event("paste", { cancelable: true });
      Object.defineProperty(paste, "target", { value: textarea });
      Object.defineProperty(paste, "clipboardData", {
        value: { getData: (type: string) => (type === "text/plain" ? "**1. Hello.**\r\n你好。" : "") }
      });
      inputs.at(-1)!.vm.$emit("paste", paste);
      expect(paste.defaultPrevented).toBe(true);
      expect(panel.autoSegmentText).toBe("1. Hello.\n你好。");
      expect(panel.segments[0]).toMatchObject({
        text: "Changed text",
        referenceTranslation: "修改译文",
        fileName: "renamed"
      });
      wrapper.findAllComponents(NSlider).forEach((slider, index) => slider.vm.$emit("update:value", 0.3 + index * 0.1));
      expect([panel.exaggeration, panel.cfgWeight, panel.temperature]).toEqual([0.3, 0.4, 0.5]);
      wrapper.getComponent(NInputNumber).vm.$emit("update:value", 42);
      expect(panel.seed).toBe(42);
      wrapper.findAllComponents(NSelect)[0].vm.$emit("update:value", "authorized");
      wrapper.findAllComponents(NSelect)[1].vm.$emit("update:value", "segments");
      wrapper.findAllComponents(NCheckbox).forEach((box) => box.vm.$emit("update:checked", true));
      expect(panel).toMatchObject({
        authorization: "authorized",
        subtitleMode: "segments",
        consentConfirmed: true,
        includeSubtitles: true
      });
      for (const language of ["en", "pt-BR", "ms"]) {
        const index = ["ms", "en", "pt-BR"].indexOf(language);
        await wrapper.findAll(".chatterbox-language-grid button")[index].trigger("click");
        expect(panel.language).toBe(language);
      }
      await wrapper.get('input[value="cuda"]').setValue();
      expect(panel.device).toBe("cuda");
      await wrapper.get('input[value="cpu"]').setValue();
      expect(panel.device).toBe("cpu");
      await wrapper.get(".chatterbox-dropzone input").trigger("change");
      expect(panel.selectReference).toHaveBeenCalledOnce();
      await wrapper.get(".segment-order").trigger("dragstart");
      await wrapper.get(".segment-editor-card").trigger("dragover");
      await wrapper.get(".segment-editor-card").trigger("drop");
      await wrapper.get(".segment-order").trigger("dragend");
      expect(panel.startSegmentDrag).toHaveBeenCalledWith(expect.any(Event), "segment-1");
      expect(panel.dropSegment).toHaveBeenCalledWith(expect.any(Event), "segment-1");
      expect(panel.dragItemId).toBeUndefined();
      for (const title of ["上移", "下移", "复制", "删除"])
        wrapper
          .findAllComponents(NButton)
          .find((button) => button.attributes("title") === title)!
          .vm.$emit("click");
      expect(panel.moveSegment.mock.calls).toEqual([
        [0, -1],
        [0, 1]
      ]);
      expect(panel.duplicateSegment).toHaveBeenCalledWith(0);
      expect(panel.removeEditorSegment).toHaveBeenCalledWith(0);
      await wrapper.findAll(".voice-source-tabs button")[1].trigger("click");
      await wrapper.get(".saved-voice-list article").trigger("click");
      expect(panel.selectedVoiceId).toBe("voice-1");
      panel.selectedVoiceId = "";
      wrapper
        .findAllComponents(NButton)
        .find((button) => button.classes().includes("saved-voice-select"))!
        .vm.$emit("click", new MouseEvent("click"));
      expect(panel.selectedVoiceId).toBe("voice-1");
      wrapper
        .findAllComponents(NButton)
        .find((button) => button.attributes("title") === "永久删除该音色")!
        .vm.$emit("click", new MouseEvent("click"));
      expect(panel.removeSavedVoice).toHaveBeenCalledWith("voice-1");
      await wrapper.findAll(".voice-source-tabs button")[0].trigger("click");
      expect(panel.referenceSource).toBe("upload");
      wrapper.getComponent(NModal).vm.$emit("update:show", true);
      expect(panel.autoSegmentVisible).toBe(true);
      wrapper.getComponent(NCard).vm.$emit("close");
      expect(panel.autoSegmentVisible).toBe(false);
      wrapper
        .findAllComponents(NButton)
        .find((button) => button.text() === "取消")!
        .vm.$emit("click");
      expect(panel.createBatch).not.toHaveBeenCalled();
    } finally {
      wrapper.unmount();
    }
  });
  it("keeps enqueue and clear actions usable during generation, locking only during submission", async () => {
    const panel = reactive({
      referenceSource: "upload",
      savedVoices: [],
      segments: [],
      autoSegmentText: "",
      parsedAutoSegments: [],
      maxBatchSegments: 30,
      totalCharacters: 0,
      maxBatchTextLength: 10000,
      language: "ms",
      device: "cpu",
      exaggeration: 0.5,
      cfgWeight: 0.5,
      temperature: 0.8,
      health: { available: true },
      validSegmentCount: 2,
      isCurrentRunning: true,
      creating: false,
      canCreate: true,
      hasBatchDraft: true,
      createBatch: vi.fn(),
      clearBatchDraft: vi.fn()
    });
    const wrapper = shallowMount(ChatterboxEditorForm, {
      global: { renderStubDefaultSlot: true, provide: { [chatterboxPanelKey as symbol]: panel } }
    });
    expect(wrapper.findAll('input[name="chatterbox-device"]').map((input) => input.attributes("value"))).toEqual([
      "cuda",
      "cpu"
    ]);
    const enqueue = wrapper.findAllComponents(NButton).find((button) => button.text().includes("到生成队列"))!;
    const clear = wrapper.findAllComponents(NButton).find((button) => button.text().includes("清空当前批次内容"))!;
    expect(wrapper.text()).toContain("参考音色随批次保留 3 天");
    expect(wrapper.text()).not.toContain("批次结束后会删除参考音色");

    expect(enqueue.props("loading")).toBe(false);
    expect(enqueue.props("disabled")).toBe(false);
    expect(clear.props("disabled")).toBe(false);
    enqueue.vm.$emit("click");
    clear.vm.$emit("click");
    expect(panel.createBatch).toHaveBeenCalledTimes(1);
    expect(panel.clearBatchDraft).toHaveBeenCalledTimes(1);

    panel.creating = true;
    panel.canCreate = false;
    await wrapper.vm.$nextTick();
    expect(enqueue.props("loading")).toBe(true);
    expect(enqueue.props("disabled")).toBe(true);
    expect(clear.props("disabled")).toBe(true);
    expect(enqueue.text()).toContain("正在加入队列");
    wrapper.unmount();
  });
});
