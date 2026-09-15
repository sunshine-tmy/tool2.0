// @vitest-environment happy-dom

import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import ChatterboxCurrentBatch from "./ChatterboxCurrentBatch.vue";
import { chatterboxPanelKey } from "./chatterbox-panel-context";

describe("Chatterbox current batch panel", () => {
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
    const TagStub = defineComponent({ template: "<span><slot /></span>" });
    const wrapper = mount(ChatterboxCurrentBatch, {
      global: {
        provide: { [chatterboxPanelKey as symbol]: panel },
        stubs: {
          NButton: ButtonStub,
          NTag: TagStub,
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
    await wrapper.get("button").trigger("click");
    expect(openBatch).toHaveBeenCalledWith("batch-1");
  });
});
