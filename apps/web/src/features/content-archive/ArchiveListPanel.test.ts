/**
 * 中文模块说明：测试 apps/web/src/features/content-archive/ArchiveListPanel.test.ts 中的稳定行为、边界条件和回归场景
 */
// @vitest-environment happy-dom

import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ArchiveListPanel from "./ArchiveListPanel.vue";
import { NCheckbox, NSelect } from "naive-ui";

const archives = {
  items: [
    {
      id: "archive_123",
      platform: "xiaohongshu" as const,
      contentId: "note-123",
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
  const viewModeStorageKey = "toolbox:media-archive:view-mode";
  beforeEach(() => localStorage.removeItem(viewModeStorageKey));
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem(viewModeStorageKey);
  });
  function mountPanel() {
    return mount(ArchiveListPanel, {
      props: {
        archives,
        listLoading: false,
        selectedIds: ["archive_123"],
        keyword: "测试",
        typeFilter: "all",
        sort: "published-asc",
        page: 2
      }
    });
  }
  it("切换为逐行列表保留筛选、排序、页码及选择，详情和发布标记仍指向同一归档", async () => {
    const wrapper = mountPanel();
    try {
      expect(wrapper.get(".archive-grid").classes()).not.toContain("is-list");
      const buttons = wrapper.findAll(".archive-view-switch button");
      await buttons[1]!.trigger("click");
      expect(wrapper.get(".archive-grid").classes()).toContain("is-list");
      expect(buttons[1]!.attributes("aria-pressed")).toBe("true");
      expect(wrapper.findAll("article")).toHaveLength(1);
      expect(wrapper.get("article").text()).toContain("测试存档");
      expect(wrapper.props()).toMatchObject({ keyword: "测试", sort: "published-asc", page: 2 });
      expect(wrapper.getComponent(NCheckbox).props("checked")).toBe(true);
      for (const event of ["pageChange", "update:sort", "toggleSelection", "openDetail"])
        expect(wrapper.emitted(event)).toBeUndefined();
      const selector = wrapper.get(".card-selector");
      await selector.trigger("click");
      expect(wrapper.emitted("toggleSelection")).toEqual([["archive_123", false]]);
      await wrapper.setProps({ selectedIds: [] });
      await selector.trigger("keyup", { key: "Enter" });
      expect(wrapper.emitted("toggleSelection")).toEqual([
        ["archive_123", false],
        ["archive_123", true]
      ]);
      expect(wrapper.emitted("openDetail")).toBeUndefined();
      const mark = wrapper.findAll("button").find((button) => button.text() === "标记为已发布")!;
      await mark.trigger("click");
      expect(wrapper.emitted("setPublication")).toEqual([["archive_123", true]]);
      expect(wrapper.emitted("openDetail")).toBeUndefined();
      await wrapper.setProps({
        archives: { ...archives, items: [{ ...archives.items[0], publishedElsewhere: true }] }
      });
      expect(wrapper.get(".card-publication-badge").text()).toBe("已发布");
      expect(wrapper.get(".card-publication-badge").attributes("title")).toBe("已在其他平台发布");
      await wrapper
        .findAll("button")
        .find((button) => button.text() === "取消已发布标记")!
        .trigger("click");
      expect(wrapper.emitted("setPublication")?.at(-1)).toEqual(["archive_123", false]);
      expect(wrapper.emitted("openDetail")).toBeUndefined();
      await wrapper.get("article").trigger("click");
      await wrapper.get("article").trigger("keyup", { key: "Enter" });
      expect(wrapper.emitted("openDetail")).toEqual([["archive_123"], ["archive_123"]]);
      await buttons[0]!.trigger("click");
      expect(wrapper.get(".archive-grid").classes()).not.toContain("is-list");
      expect(wrapper.get(".card-publication-badge").text()).toContain("已在其他平台发布");
      expect(wrapper.get(".n-pagination-prefix").text()).toBe("共 1 条");
    } finally {
      wrapper.unmount();
    }
  });
  it("重新进入页面恢复展示方式，非法存储值回退卡片", async () => {
    let wrapper = mountPanel();
    try {
      await wrapper.get(".archive-view-switch button:last-child").trigger("click");
      wrapper.unmount();
      wrapper = mountPanel();
      expect(wrapper.get(".archive-grid").classes()).toContain("is-list");
      await wrapper.get(".archive-view-switch button:first-child").trigger("click");
      expect(localStorage.getItem(viewModeStorageKey)).toBe("card");
      wrapper.unmount();
      localStorage.setItem(viewModeStorageKey, "invalid");
      wrapper = mountPanel();
      expect(wrapper.get(".archive-grid").classes()).not.toContain("is-list");
    } finally {
      wrapper.unmount();
    }
  });
  it("浏览器禁止读写偏好时仍可以切换展示方式", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    const wrapper = mountPanel();
    try {
      expect(wrapper.get(".archive-grid").classes()).not.toContain("is-list");
      await wrapper.get(".archive-view-switch button:last-child").trigger("click");
      expect(wrapper.get(".archive-grid").classes()).toContain("is-list");
    } finally {
      wrapper.unmount();
    }
  });
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
    expect(wrapper.text()).toContain("发布：未知");
    expect(wrapper.text()).toContain("归档：2026");
    const sorting = wrapper
      .findAllComponents(NSelect)
      .find((select) => select.attributes("aria-label") === "归档列表排序")!;
    expect(sorting.props("value")).toBe("archived-desc");
    expect(sorting.props("options")?.map((option) => option.value)).toEqual([
      "archived-desc",
      "archived-asc",
      "published-desc",
      "published-asc"
    ]);
    for (const sort of ["published-asc", "published-desc", "archived-asc", "archived-desc"])
      sorting.vm.$emit("update:value", sort);
    expect(wrapper.emitted("update:sort")).toEqual([
      ["published-asc"],
      ["published-desc"],
      ["archived-asc"],
      ["archived-desc"]
    ]);

    await wrapper.get("article").trigger("click");
    expect(wrapper.emitted("openDetail")).toEqual([["archive_123"]]);
    expect(wrapper.find(".card-publication-badge").exists()).toBe(false);
    const mark = wrapper.findAll("button").find((button) => button.text() === "标记为已发布")!;
    await mark.trigger("click");
    await mark.trigger("keyup", { key: "Enter" });
    expect(wrapper.emitted("setPublication")).toEqual([["archive_123", true]]);
    expect(wrapper.emitted("openDetail")).toHaveLength(1);
    await wrapper.setProps({ archives: { ...archives, items: [{ ...archives.items[0], publishedElsewhere: true }] } });
    expect(wrapper.get(".card-cover .card-publication-badge").text()).toContain("已在其他平台发布");
    const cancel = wrapper.findAll("button").find((button) => button.text() === "取消已发布标记")!;
    await cancel.trigger("click");
    expect(wrapper.emitted("setPublication")?.at(-1)).toEqual(["archive_123", false]);
    expect(wrapper.emitted("openDetail")).toHaveLength(1);
    await wrapper.setProps({ publicationBusyIds: ["archive_123"] });
    expect(cancel.attributes("disabled")).toBeDefined();
    await wrapper.setProps({ publicationBusyIds: [] });

    await wrapper.get(".card-selector").trigger("click");
    expect(wrapper.emitted("toggleSelection")).toEqual([["archive_123", true]]);

    const secondPage = wrapper.findAll(".n-pagination-item--clickable").find((item) => item.text() === "2");
    expect(secondPage).toBeDefined();
    await secondPage?.trigger("click");
    expect(wrapper.emitted("update:page")).toEqual([[2]]);
    expect(wrapper.emitted("pageChange")).toHaveLength(1);
    const platformSelect = wrapper
      .findAllComponents(NSelect)
      .find((select) => select.props("options")?.some((option) => option.value === "tiktok"));
    expect(platformSelect).toBeDefined();
    platformSelect!.vm.$emit("update:value", "tiktok");
    expect(wrapper.emitted("update:platformFilter")).toEqual([["tiktok"]]);
    await wrapper.setProps({ archives: { ...archives, items: [{ ...archives.items[0], platform: "tiktok" }] } });
    expect(wrapper.text()).toContain("TikTok");
    await wrapper.setProps({ archives: { ...archives, total: 117, pageCount: 10 } });
    expect(wrapper.get(".n-pagination-prefix").text()).toBe("共 117 条");
    await wrapper.setProps({ archives: { ...archives, total: 13, pageCount: 2 } });
    expect(wrapper.get(".n-pagination-prefix").text()).toBe("共 13 条");
    wrapper.unmount();
  });
});
