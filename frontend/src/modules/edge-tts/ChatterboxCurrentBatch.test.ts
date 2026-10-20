/**
 * 中文模块说明：测试 frontend/src/modules/edge-tts/ChatterboxCurrentBatch.test.ts 中的稳定行为、边界条件和回归场景
 */
// @vitest-environment happy-dom

import { defineComponent, reactive } from "vue";
import { mount, shallowMount } from "@vue/test-utils";
import { NButton } from "naive-ui";
import { describe, expect, it, vi } from "vitest";
import ChatterboxCurrentBatch from "./ChatterboxCurrentBatch.vue";
import { chatterboxPanelKey } from "./chatterbox-panel-context";
import SaveToAudioLibrary from "../audio-library/SaveToAudioLibrary.vue";
import SpeechBatchDownloads from "./SpeechBatchDownloads.vue";

describe("Chatterbox current batch panel", () => {
  it("shows real segment progress and fractional audio length with accurate phase labels", async () => {
    const panel = reactive({
      currentBatch: {
        id: "batch-1",
        status: "processing",
        progress: 28,
        completedItems: 1,
        totalAudioDurationSeconds: 2.345,
        items: [
          { id: "one", status: "completed", progress: 100 },
          { id: "two", status: "processing", progress: 10 },
          { id: "three", status: "queued", progress: 0 },
          { id: "four", status: "queued", progress: 0 }
        ]
      },
      isCurrentRunning: true,
      batchTitle: () => "生成中的批次",
      batchStatusLabel: () => "生成中",
      batchTagType: () => "warning"
    });
    const wrapper = shallowMount(ChatterboxCurrentBatch, {
      global: { renderStubDefaultSlot: true, provide: { [chatterboxPanelKey as symbol]: panel } }
    });
    try {
      expect(wrapper.text()).toContain("1/4");
      expect(wrapper.text()).toContain("累计音频 2.35 秒");
      expect(wrapper.get(".chatterbox-live-progress").text()).toBe("28% · 正在生成第 2 段");
      expect(wrapper.get('[role="progressbar"]').attributes("aria-valuenow")).toBe("28");
      expect(wrapper.get(".edge-tts-progress span").attributes("style")).toContain("28%");
      panel.currentBatch.items[1].progress = 82;
      await wrapper.vm.$nextTick();
      expect(wrapper.get(".chatterbox-live-progress").text()).toContain("正在处理第 2 段音频");
      panel.currentBatch.items[1].progress = 99;
      await wrapper.vm.$nextTick();
      expect(wrapper.get(".chatterbox-live-progress").text()).toContain("正在整理总音频与字幕");
      panel.currentBatch.progress = 0;
      panel.currentBatch.totalAudioDurationSeconds = 0.25;
      panel.currentBatch.items.forEach((item) => {
        item.status = "queued";
      });
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain("累计音频 0.25 秒");
      expect(wrapper.get(".chatterbox-live-progress").text()).toBe("0% · 等待处理第 1 段");
      expect(wrapper.get(".edge-tts-progress span").attributes("style")).toContain("0%");
    } finally {
      wrapper.unmount();
    }
  });

  it("renders progress metadata and delegates detail actions", async () => {
    const openBatch = vi.fn();
    const panel = {
      currentBatch: {
        id: "batch-1",
        status: "completed",
        progress: 100,
        completedItems: 2,
        items: [{ id: "item-1" }, { id: "item-2" }],
        totalAudioDurationSeconds: 2,
        archiveUrl: "/batch.zip"
      },
      isCurrentRunning: false,
      batchTitle: () => "测试批次",
      batchStatusLabel: () => "已完成",
      batchTagType: () => "success",
      formatDuration: () => "2 秒",
      mediaUrl: (value?: string) => value,
      openBatch,
      cancelBatch: vi.fn()
    };

    const ButtonStub = defineComponent({ template: '<button v-bind="$attrs"><slot /></button>' });
    const wrapper = mount(ChatterboxCurrentBatch, {
      global: {
        provide: { [chatterboxPanelKey as symbol]: panel },
        stubs: {
          SaveToAudioLibrary: true,
          NButton: ButtonStub,
          Archive: true,
          FileAudio: true,
          Captions: true,
          Languages: true,
          ListTree: true
        }
      }
    });

    expect(wrapper.text()).toContain("测试批次");
    expect(wrapper.text()).toContain("2/2");
    expect(wrapper.get(".chatterbox-batch-status-badge--success").text()).toBe("已完成");
    expect(wrapper.getComponent(SaveToAudioLibrary).props()).toMatchObject({ toolbar: true, size: "small" });
    expect(wrapper.getComponent(SpeechBatchDownloads).props("toolbar")).toBe(true);
    expect(wrapper.getComponent(NButton).props("size")).toBe("small");
    await wrapper.get("button").trigger("click");
    expect(openBatch).toHaveBeenCalledWith("batch-1");
    wrapper.unmount();
  });
});
