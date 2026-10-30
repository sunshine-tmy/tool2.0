// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineComponent, reactive } from "vue";
import { mount, shallowMount } from "@vue/test-utils";
import { NButton, NCheckbox, NPagination } from "naive-ui";
import SpeechBatchSelectionToolbar from "../shared/SpeechBatchSelectionToolbar.vue";
import { describe, expect, it, vi } from "vitest";
import EdgeTtsPanel from "./EdgeTtsPanel.vue";
import SpeechBatchDownloads from "../shared/SpeechBatchDownloads.vue";
import { SaveToAudioLibrary } from "../../audio-library/integrations/speech";

const mocks = vi.hoisted(() => ({ usePanel: vi.fn() }));
vi.mock("./useEdgeTtsPanel", async (original) => ({
  ...(await original<typeof import("./useEdgeTtsPanel")>()),
  useEdgeTtsPanel: mocks.usePanel
}));

const paginationStub = defineComponent({ inheritAttrs: false, template: "<div />" });
const mountOptions = {
  global: {
    renderStubDefaultSlot: true,
    stubs: { NPagination: paginationStub, Pagination: paginationStub }
  }
};

function createPanel(status = "completed") {
  const batch = {
    id: "batch-1",
    name: "双语测试",
    language: "ms-MY",
    status,
    progress: 25,
    completedItems: 1,
    totalAudioDurationSeconds: 65,
    createdAt: "2026-10-19T00:00:00.000Z",
    items: [{ id: "item-1", status: "completed", text: "Terima kasih.", referenceTranslation: "谢谢。" }],
    archiveUrl: "/batch.zip"
  };
  return reactive({
    current: batch,
    history: { batches: [batch], pagination: { page: 1, totalPages: 1, pageSize: 10, total: 1 } },
    legacy: { tasks: [], pagination: { total: 0 } },
    editor: { segments: [] },
    health: { available: true, retentionDays: 3, queue: { limit: 20 } },
    language: "ms-MY",
    voices: [],
    creating: false,
    busy: false,
    selectedBatchIds: [],
    deletingBatches: false,
    allPageBatchesSelected: false,
    somePageBatchesSelected: false,
    toggleBatchSelection: vi.fn(),
    toggleAllPageBatches: vi.fn(),
    removeSelectedBatches: vi.fn(),
    loadingBatches: false,
    title: (item: { name: string }) => item.name,
    statusLabel: (value: string) => (value === "completed" ? "已完成" : "生成中"),
    languageLabel: () => "马来西亚马来语",
    loadBatches: vi.fn(),
    openBatch: vi.fn(),
    removeBatch: vi.fn(),
    cancelBatch: vi.fn(),
    reuseBatch: vi.fn()
  });
}

describe("Online speech batch presentation", () => {
  it("旧版生成记录分页展示服务端总条数，更新总数及切页不影响批次分页", async () => {
    const panel = reactive({
      ...createPanel(),
      legacy: {
        tasks: [{ id: "legacy-1", textPreview: "Hello", status: "completed" }],
        pagination: { total: 31, page: 2, totalPages: 4 }
      },
      loadLegacy: vi.fn()
    });
    mocks.usePanel.mockReturnValue(panel);
    const wrapper = mount(EdgeTtsPanel, {
      global: {
        stubs: {
          OrderedSpeechEditor: true,
          EdgeTtsBatchDetail: true,
          SpeechBatchSelectionToolbar: true,
          SpeechBatchDownloads: true,
          SaveToAudioLibrary: true,
          DiagnosticErrorLink: true
        }
      }
    });
    try {
      expect(wrapper.get(".legacy-clone-history .n-pagination-prefix").text()).toBe("共 31 条");
      expect(wrapper.get(".chatterbox-batch-pagination").text()).toContain("共 1 个批次");
      panel.legacy.pagination.total = 44;
      panel.legacy.pagination.totalPages = 5;
      await wrapper.vm.$nextTick();
      expect(wrapper.get(".legacy-clone-history .n-pagination-prefix").text()).toBe("共 44 条");
      wrapper.findAllComponents(NPagination).at(-1)!.vm.$emit("update:page", 3);
      expect(panel.loadLegacy).toHaveBeenCalledWith(3);
    } finally {
      wrapper.unmount();
    }
  });
  it("shares panel gaps, history alignment and responsive rules with voice cloning", () => {
    const globalCss = readFileSync(resolve("src/features/speech/shared/styles/foundation.css"), "utf8");
    const batchCss = readFileSync(resolve("src/features/speech/chatterbox/ChatterboxPanel.css"), "utf8");
    expect(globalCss).toMatch(/\.chatterbox-panel,\s*\.online-tts-panel\s*\{[^}]*gap: 20px;/);
    expect(globalCss).toMatch(/\.edge-tts-result-actions\s*\{[^}]*align-items: center;/);
    expect(batchCss.match(/:is\(\.chatterbox-panel, \.online-tts-panel\) \.batch-history-list article/g)).toHaveLength(
      1
    );
    expect(
      batchCss.match(/:is\(\.chatterbox-panel, \.online-tts-panel\) \.batch-history-list \.history-actions/g)
    ).toHaveLength(1);
  });

  it("matches clone status badges, prioritizes labeled detail/download buttons and delegates clicks", () => {
    const panel = createPanel();
    mocks.usePanel.mockReturnValue(panel);
    const wrapper = shallowMount(EdgeTtsPanel, mountOptions);
    try {
      expect(wrapper.get(".edge-tts-result").classes()).toContain("status-completed");
      expect(wrapper.get(".edge-tts-result .chatterbox-batch-status-badge--success").text()).toBe("已完成");
      expect(wrapper.get(".edge-tts-result").text()).toContain("1 分 5 秒");
      expect(wrapper.find(".history-main .voice-avatar").exists()).toBe(true);
      expect(wrapper.get(".batch-history-meta .chatterbox-batch-status-badge--success").text()).toBe("已完成");
      const saves = wrapper.findAllComponents(SaveToAudioLibrary);
      expect(saves.map((save) => save.props("engine"))).toEqual(["edge-tts", "edge-tts"]);
      expect(saves[0].props("size")).toBe("small");
      expect(saves[0].props("toolbar")).toBe(true);
      expect(saves[1].props("size")).toBe("small");
      expect(saves[1].props("toolbar")).toBe(true);
      expect(wrapper.findAllComponents(SpeechBatchDownloads).map((downloads) => downloads.props("compact"))).toEqual([
        false,
        false
      ]);
      expect(wrapper.findAllComponents(SpeechBatchDownloads)[0].props("toolbar")).toBe(true);
      expect(wrapper.findAllComponents(SpeechBatchDownloads)[1].props("toolbar")).toBe(true);
      expect(wrapper.findAllComponents(SpeechBatchDownloads)[1].props("archiveOnly")).toBe(true);
      const buttons = wrapper.findAllComponents(NButton);
      buttons.find((button) => button.text() === "重新填入批次")!.vm.$emit("click");
      expect(panel.reuseBatch).toHaveBeenCalledWith("batch-1");
      const toolbar = wrapper.getComponent(SpeechBatchSelectionToolbar);
      expect(toolbar.props("selectedCount")).toBe(0);
      toolbar.vm.$emit("selectAll", true);
      toolbar.vm.$emit("remove");
      wrapper.find(".batch-history-list").getComponent(NCheckbox).vm.$emit("update:checked", true);
      expect(panel.toggleAllPageBatches).toHaveBeenCalledWith(true);
      expect(panel.toggleBatchSelection).toHaveBeenCalledWith("batch-1", true);
      expect(panel.removeSelectedBatches).toHaveBeenCalledOnce();
      const currentDetail = buttons.find((button) => button.text() === "查看详情")!;
      expect(currentDetail.props()).toMatchObject({ size: "small", secondary: false });
      currentDetail.vm.$emit("click");
      expect(panel.openBatch).toHaveBeenCalledWith("batch-1");
      const details = buttons.filter((button) => button.attributes("title") === "查看详情");
      expect(details).toHaveLength(1);
      expect(details[0].text()).toBe("查看详情");
      expect(details[0].props()).toMatchObject({ circle: false, quaternary: false, size: "small" });
      for (const selector of [".edge-tts-result-actions", ".history-actions"]) {
        const actions = wrapper.get(selector);
        expect(Array.from(actions.element.children).slice(0, 3)).toEqual([
          actions.getComponent(NButton).element,
          actions.getComponent(SpeechBatchDownloads).element,
          actions.getComponent(SaveToAudioLibrary).element
        ]);
      }
      details[0].vm.$emit("click");
      expect(panel.openBatch).toHaveBeenCalledWith("batch-1");
      const remove = buttons.find((button) => button.attributes("title") === "删除批次")!;
      expect(remove.props()).toMatchObject({ circle: true, quaternary: true, type: "error", size: "small" });
      remove.vm.$emit("click");
      expect(panel.removeBatch).toHaveBeenCalledWith("batch-1");
      buttons.find((button) => button.text().includes("刷新"))!.vm.$emit("click");
      expect(panel.loadBatches).toHaveBeenCalledOnce();
    } finally {
      wrapper.unmount();
    }
  });

  it("preserves running progress, cancellation and disabled actions while busy", async () => {
    const panel = createPanel("processing");
    mocks.usePanel.mockReturnValue(panel);
    const wrapper = shallowMount(EdgeTtsPanel, mountOptions);
    try {
      expect(wrapper.get(".edge-tts-progress span").attributes("style")).toContain("25%");
      expect(wrapper.find(".edge-tts-result .chatterbox-batch-status-badge--warning").exists()).toBe(true);
      const cancel = wrapper.findAllComponents(NButton).find((button) => button.attributes("title") === "取消剩余")!;
      cancel.vm.$emit("click");
      expect(panel.cancelBatch).toHaveBeenCalledWith("batch-1");
      panel.busy = true;
      await wrapper.vm.$nextTick();
      expect(cancel.props("disabled")).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });
});
