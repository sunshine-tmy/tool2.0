// @vitest-environment happy-dom

import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { VideoTextHistoryItem } from "./types";
import VideoHistoryPanel from "./VideoHistoryPanel.vue";

const item = {
  id: "history-1",
  fileName: "demo.mp4",
  source: "transcriber",
  fileSize: 2048,
  mimeType: "video/mp4",
  textPreview: "历史文案",
  characterCount: 4,
  summary: ["摘要"],
  createdAt: "2026-09-15T00:00:00.000Z"
} as unknown as VideoTextHistoryItem;

describe("video history panel", () => {
  it("renders history metadata and delegates open/delete actions", async () => {
    const openHistory = vi.fn();
    const deleteHistory = vi.fn();
    const ButtonStub = defineComponent({ template: '<button v-bind="$attrs"><slot /></button>' });
    const CheckboxStub = defineComponent({ template: '<input type="checkbox" />' });
    const wrapper = mount(VideoHistoryPanel, {
      props: {
        keyword: "",
        historyLoading: false,
        searchHistory: vi.fn(),
        historyPageSelection: { checked: false, indeterminate: false },
        historyItems: [item],
        selectedHistoryIds: [],
        batchDeletingHistory: false,
        toggleAllHistoryItems: vi.fn(),
        deleteSelectedHistory: vi.fn(),
        openingHistoryId: "",
        sourceName: () => "本地识别",
        formatBytes: () => "2.0 KB",
        formatDateTime: () => "刚刚",
        toggleHistoryItem: vi.fn(),
        deletingHistoryId: "",
        openHistory,
        deleteHistory,
        total: 1,
        page: 1,
        pageSize: 5,
        loadHistory: vi.fn(),
        onHistoryPageSizeChange: vi.fn()
      },
      global: {
        stubs: {
          NButton: ButtonStub,
          NCheckbox: CheckboxStub,
          NInput: true,
          NPagination: true,
          NEmpty: true,
          FileVideo: true
        }
      }
    });

    expect(wrapper.text()).toContain("demo.mp4");
    expect(wrapper.text()).toContain("历史文案");
    const buttons = wrapper.findAll("button");
    await buttons.find((button) => button.text() === "查看")?.trigger("click");
    await buttons.find((button) => button.text() === "删除")?.trigger("click");
    expect(openHistory).toHaveBeenCalledWith("history-1");
    expect(deleteHistory).toHaveBeenCalledWith(item);
  });
});
