// @vitest-environment happy-dom

import { defineComponent, reactive } from "vue";
import { shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import ChatterboxBatchHistory from "./ChatterboxBatchHistory.vue";
import { chatterboxPanelKey } from "./chatterbox-panel-context";
import { SaveToAudioLibrary } from "../../audio-library/integrations/speech";
import SpeechBatchDownloads from "../shared/SpeechBatchDownloads.vue";
import { NButton, NCheckbox } from "naive-ui";
import SpeechBatchSelectionToolbar from "../shared/SpeechBatchSelectionToolbar.vue";

const PaginationStub = defineComponent({
  inheritAttrs: false,
  props: { page: Number, pageCount: Number, disabled: Boolean },
  emits: ["update:page"],
  template: "<div />"
});

describe("Chatterbox batch history pagination", () => {
  it("uses the same small outlined library toolbar as batch details", () => {
    const itemPreviews = [{ id: "item-1", status: "completed", textPreview: "Terima kasih." }];
    const panel = {
      batchHistory: {
        batches: [{ id: "batch-1", status: "completed", itemPreviews, createdAt: "2026-10-19T00:00:00Z" }],
        pagination: { total: 1, page: 1, totalPages: 1, pageSize: 10 }
      },
      legacyHistory: { tasks: [] },
      loadingBatches: false,
      selectedBatchIds: [],
      deletingBatches: false,
      allPageBatchesSelected: false,
      somePageBatchesSelected: false,
      toggleBatchSelection: vi.fn(),
      toggleAllPageBatches: vi.fn(),
      removeSelectedBatches: vi.fn(),
      batchTitle: () => "测试批次",
      languageLabel: () => "马来语",
      formatDate: () => "10/19",
      batchTagType: () => "success",
      batchStatusLabel: () => "已完成",
      reuseBatch: vi.fn()
    };
    const wrapper = shallowMount(ChatterboxBatchHistory, {
      global: {
        renderStubDefaultSlot: true,
        provide: { [chatterboxPanelKey as symbol]: panel },
        stubs: { NPagination: PaginationStub, Pagination: PaginationStub }
      }
    });
    try {
      expect(wrapper.getComponent(SaveToAudioLibrary).props()).toMatchObject({
        toolbar: true,
        size: "small",
        label: "加入音频库",
        batchId: "batch-1",
        items: itemPreviews
      });
      expect(wrapper.getComponent(SpeechBatchDownloads).props("archiveOnly")).toBe(true);
      wrapper
        .findAllComponents(NButton)
        .find((button) => button.text() === "重新填入批次")!
        .vm.$emit("click");
      expect(panel.reuseBatch).toHaveBeenCalledWith("batch-1");
      const toolbar = wrapper.getComponent(SpeechBatchSelectionToolbar);
      expect(toolbar.props("selectedCount")).toBe(0);
      toolbar.vm.$emit("selectAll", true);
      toolbar.vm.$emit("remove");
      wrapper.find(".batch-history-list").getComponent(NCheckbox).vm.$emit("update:checked", true);
      expect(panel.toggleAllPageBatches).toHaveBeenCalledWith(true);
      expect(panel.toggleBatchSelection).toHaveBeenCalledWith("batch-1", true);
      expect(panel.removeSelectedBatches).toHaveBeenCalledOnce();
    } finally {
      wrapper.unmount();
    }
  });

  it("renders page controls and total, delegates page changes, and disables controls during loading", async () => {
    const panel = reactive({
      batchHistory: { batches: [], pagination: { page: 2, pageSize: 10, total: 25, totalPages: 3 } },
      legacyHistory: { tasks: [] },
      loadingBatches: false,
      deletingBatches: false,
      changeBatchPage: vi.fn()
    });
    const wrapper = shallowMount(ChatterboxBatchHistory, {
      global: {
        renderStubDefaultSlot: true,
        provide: { [chatterboxPanelKey as symbol]: panel },
        stubs: { NPagination: PaginationStub, Pagination: PaginationStub }
      }
    });
    const pagination = wrapper.getComponent(PaginationStub);
    expect(wrapper.get(".chatterbox-batch-pagination").text()).toContain("共 25 个批次 · 每页 10 个");
    expect(pagination.props()).toMatchObject({ page: 2, pageCount: 3, disabled: false });
    pagination.vm.$emit("update:page", 3);
    expect(panel.changeBatchPage).toHaveBeenCalledWith(3);

    panel.loadingBatches = true;
    await wrapper.vm.$nextTick();
    expect(pagination.props("disabled")).toBe(true);
    panel.batchHistory.pagination.total = 0;
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent(PaginationStub).exists()).toBe(false);
    wrapper.unmount();
  });
});
