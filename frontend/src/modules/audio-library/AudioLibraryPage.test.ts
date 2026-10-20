// @vitest-environment happy-dom

import { defineComponent } from "vue";
import { flushPromises, shallowMount, type VueWrapper } from "@vue/test-utils";
import { NButton, NCheckbox } from "naive-ui";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "./page.vue";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  trash: vi.fn(),
  purge: vi.fn(),
  confirm: vi.fn(),
  message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() }
}));
vi.mock("naive-ui", async (original) => ({
  ...(await original<typeof import("naive-ui")>()),
  useMessage: () => mocks.message
}));
vi.mock("../../composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
vi.mock("./api", () => ({
  audioLibraryApi: { list: mocks.list, trash: mocks.trash, purge: mocks.purge, exportUrl: () => "/backup" },
  formatBytes: (value: number) => String(value),
  formatDuration: (value: number) => String(value),
  groupOptions: () => [],
  rememberGroup: vi.fn(),
  storedGroup: () => null
}));
const pagination = defineComponent({ inheritAttrs: false, template: "<div />" });

beforeEach(() => {
  vi.clearAllMocks();
  const removed = new Set<string>();
  mocks.list.mockImplementation(async ({ view }: { view: string }) => ({
    items: ["one", "two"]
      .filter((id) => !removed.has(id))
      .map((id) => ({
        id,
        title: "测试音频",
        language: "ms",
        available: true,
        chineseText: "中文",
        foreignText: "Text",
        duration: 5,
        bytes: 100,
        createdAt: "2026-10-19T00:00:00.000Z",
        source: { kind: "upload" },
        deletedAt: view === "trash" ? "2026-10-19T00:00:00.000Z" : undefined
      })),
    groups: [],
    total: 2 - removed.size,
    totalItems: 2 - removed.size,
    page: 1,
    pageSize: 20
  }));
  mocks.trash.mockResolvedValue({ ok: true });
  mocks.purge.mockImplementation(async (id: string) => {
    removed.add(id);
    return { ok: true };
  });
  mocks.confirm.mockResolvedValue(false);
});

async function mountTrash() {
  const wrapper = shallowMount(Page, {
    global: { renderStubDefaultSlot: true, stubs: { NPagination: pagination, Pagination: pagination } }
  });
  await flushPromises();
  await wrapper
    .findAll(".library-view")
    .find((entry) => entry.text() === "回收站")!
    .trigger("click");
  await flushPromises();
  return wrapper;
}

function batchButton(wrapper: VueWrapper, text: string): VueWrapper {
  const buttons: VueWrapper[] = wrapper.get(".library-batch").findAllComponents(NButton);
  return buttons.find((button) => button.text() === text)!;
}

async function selectPage(wrapper: VueWrapper) {
  wrapper.get(".library-batch").getComponent(NCheckbox).vm.$emit("update:checked", true);
  await wrapper.vm.$nextTick();
}

describe("Audio library recycle bin actions", () => {
  it("shows batch purge only in trash, keeps restore styling consistent, and cancels safely", async () => {
    const wrapper = await mountTrash();
    const purge = batchButton(wrapper, "彻底删除所选");
    const restore = batchButton(wrapper, "恢复所选");
    expect(purge.props()).toMatchObject({ disabled: true, size: "small", secondary: true, type: "error" });
    expect(restore.props()).toMatchObject({ secondary: true, type: "primary" });
    await selectPage(wrapper);
    expect(purge.props()).toMatchObject({ disabled: false });
    purge.vm.$emit("click");
    await flushPromises();
    expect(mocks.confirm).toHaveBeenCalledWith(expect.stringContaining("所选 2 条音频"), {
      title: "彻底删除所选",
      positiveText: "确认彻底删除",
      danger: true
    });
    expect(mocks.purge).not.toHaveBeenCalled();
    expect(wrapper.get(".library-batch").text()).toContain("2 条已选");
    restore.vm.$emit("click");
    await flushPromises();
    expect(mocks.trash).toHaveBeenCalledWith(["one", "two"], true);
    await wrapper
      .findAll(".library-view")
      .find((entry) => entry.text() === "全部音频")!
      .trigger("click");
    await flushPromises();
    expect(wrapper.get(".library-batch").text()).not.toContain("彻底删除所选");
    wrapper.unmount();
  });

  it("purges selected items once after confirmation and refreshes the list", async () => {
    const wrapper = await mountTrash();
    await selectPage(wrapper);
    mocks.confirm.mockResolvedValue(true);
    const purge = batchButton(wrapper, "彻底删除所选");
    purge.vm.$emit("click");
    purge.vm.$emit("click");
    await wrapper.vm.$nextTick();
    expect(purge.props()).toMatchObject({ loading: true, disabled: true });
    await flushPromises();
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    expect(mocks.purge.mock.calls).toEqual([["one"], ["two"]]);
    expect(wrapper.findAll(".library-item--trash")).toHaveLength(0);
    expect(wrapper.get(".library-batch").text()).toContain("0 条已选");
    expect(mocks.message.success).toHaveBeenCalledWith("已彻底删除 2 条音频");
    expect(purge.props()).toMatchObject({ loading: false, disabled: true });
    wrapper.unmount();
  });

  it("continues after an individual purge failure and keeps failed items selected for retry", async () => {
    const wrapper = await mountTrash();
    await selectPage(wrapper);
    mocks.confirm.mockResolvedValue(true);
    mocks.purge.mockRejectedValueOnce(new Error("Busy"));
    batchButton(wrapper, "彻底删除所选").vm.$emit("click");
    await flushPromises();
    expect(mocks.purge.mock.calls).toEqual([["one"], ["two"]]);
    expect(mocks.message.warning).toHaveBeenCalledWith(expect.stringContaining("已彻底删除 1 条，1 条删除失败"), {
      duration: 8000
    });
    expect(wrapper.findAll(".library-item--trash")).toHaveLength(1);
    expect(wrapper.get(".library-batch").text()).toContain("1 条已选");
    batchButton(wrapper, "彻底删除所选").vm.$emit("click");
    await flushPromises();
    expect(mocks.purge.mock.calls).toEqual([["one"], ["two"], ["one"]]);
    expect(wrapper.findAll(".library-item--trash")).toHaveLength(0);
    wrapper.unmount();
  });

  it("uses a dedicated compact row with lower emphasis actions and preserves deletion confirmation", async () => {
    const wrapper = shallowMount(Page, {
      global: {
        renderStubDefaultSlot: true,
        stubs: { NPagination: pagination, Pagination: pagination }
      }
    });
    await flushPromises();
    expect(wrapper.get(".library-item").classes()).not.toContain("library-item--trash");
    await wrapper
      .findAll(".library-view")
      .find((entry) => entry.text() === "回收站")!
      .trigger("click");
    await flushPromises();
    const row = wrapper.get(".library-item--trash");
    expect(row.findComponent({ name: "AudioLibraryItemPlayer" }).exists()).toBe(false);
    const buttons: VueWrapper[] = row.findAllComponents(NButton);
    expect(buttons.map((button) => button.text())).toEqual(["恢复", "彻底删除", "详情"]);
    expect(buttons[0].props()).toMatchObject({ size: "small", secondary: true, type: "primary" });
    expect(buttons[1].props()).toMatchObject({ size: "small", secondary: true, type: "error" });
    expect(buttons[2].props()).toMatchObject({ quaternary: true });

    buttons[1].vm.$emit("click");
    await flushPromises();
    expect(mocks.confirm).toHaveBeenCalledWith(expect.stringContaining("无法撤销"), { title: "彻底删除" });
    expect(mocks.purge).not.toHaveBeenCalled();
    buttons[0].vm.$emit("click");
    await flushPromises();
    expect(mocks.trash).toHaveBeenCalledWith(["one"], true);
    wrapper.unmount();
  });
});
