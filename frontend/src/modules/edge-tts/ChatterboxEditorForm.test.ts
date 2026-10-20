// @vitest-environment happy-dom

import { reactive } from "vue";
import { shallowMount } from "@vue/test-utils";
import { NButton } from "naive-ui";
import { describe, expect, it, vi } from "vitest";
import ChatterboxEditorForm from "./ChatterboxEditorForm.vue";
import { chatterboxPanelKey } from "./chatterbox-panel-context";

describe("Chatterbox editor actions", () => {
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
