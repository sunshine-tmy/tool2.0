// @vitest-environment happy-dom

import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ArchiveListPanel from "./ArchiveListPanel.vue";

const archives = {
  items: [
    {
      id: "archive_123",
      noteId: "note-123",
      sourceUrl: "https://www.xiaohongshu.com/explore/note-123",
      canonicalUrl: "https://www.xiaohongshu.com/explore/note-123",
      type: "image" as const,
      title: "测试存档",
      topics: [],
      fetchedAt: "2026-09-14T08:00:00.000Z",
      updatedAt: "2026-09-14T08:00:00.000Z",
      status: "ready" as const,
      warnings: [],
      totalBytes: 2048,
      mediaCount: 2,
      author: { name: "测试作者" }
    }
  ],
  total: 1,
  page: 1,
  pageSize: 12,
  pageCount: 2
};

const ButtonStub = defineComponent({
  inheritAttrs: false,
  template: '<button v-bind="$attrs"><slot name="icon" /><slot /></button>'
});
const CheckboxStub = defineComponent({
  inheritAttrs: false,
  props: { checked: Boolean },
  emits: ["update:checked"],
  template: '<button v-bind="$attrs" @click="$emit(\'update:checked\', !checked)"><slot /></button>'
});
const PaginationStub = defineComponent({
  props: { page: Number },
  emits: ["update:page"],
  template: '<button class="next-page" @click="$emit(\'update:page\', (page || 1) + 1)">下一页</button>'
});

describe("XHS archive list panel", () => {
  it("renders archive metadata and emits selection, detail and pagination actions", async () => {
    const wrapper = mount(ArchiveListPanel, {
      props: {
        archives,
        listLoading: false,
        selectedIds: [],
        keyword: "",
        typeFilter: "all",
        page: 1
      },
      global: {
        stubs: {
          NButton: ButtonStub,
          NCheckbox: CheckboxStub,
          NInput: true,
          NSelect: true,
          NSpin: { template: "<div><slot /></div>" },
          NEmpty: true,
          NPagination: PaginationStub,
          FileImage: true,
          Languages: true,
          Play: true,
          RefreshCw: true,
          Search: true,
          Sparkles: true
        }
      }
    });

    expect(wrapper.text()).toContain("测试存档");
    expect(wrapper.text()).toContain("2 个媒体");
    expect(wrapper.text()).toContain("2.0 KB");

    await wrapper.get("article").trigger("click");
    expect(wrapper.emitted("openDetail")).toEqual([["archive_123"]]);

    await wrapper.get(".card-selector").trigger("click");
    expect(wrapper.emitted("toggleSelection")).toEqual([["archive_123", true]]);

    const secondPage = wrapper.findAll(".n-pagination-item--clickable").find((item) => item.text() === "2");
    expect(secondPage).toBeDefined();
    await secondPage?.trigger("click");
    expect(wrapper.emitted("update:page")).toEqual([[2]]);
    expect(wrapper.emitted("pageChange")).toHaveLength(1);
  });
});
