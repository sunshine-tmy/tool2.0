// @vitest-environment happy-dom
/** 一键入库只提交版本引用，不提交编辑草稿或客户端文件路径。 */
import { defineComponent } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { NButton } from "naive-ui";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SaveToAudioLibrary from "./SaveToAudioLibrary.vue";
import { audioLibraryApi } from "./api";
import { rememberGroup, storedGroup } from "./preferences";
const messages = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() }));
vi.mock("naive-ui", async (original) => ({
  ...(await original<typeof import("naive-ui")>()),
  useMessage: () => messages
}));
vi.mock("./api", () => ({
  audioLibraryApi: { importChatterbox: vi.fn(), importEdgeTts: vi.fn(), list: vi.fn() },
  groupOptions: () => [{ label: "指定分组", value: "chosen" }],
  storedGroup: vi.fn(),
  rememberGroup: vi.fn()
}));
const button = defineComponent({ template: '<button v-bind="$attrs"><slot/></button>' });
vi.mock("./preferences", () => ({ storedGroup: vi.fn(), rememberGroup: vi.fn() }));
const modal = defineComponent({ props: { show: Boolean }, template: '<div v-if="show"><slot/></div>' });
const card = defineComponent({ template: '<div><slot/><slot name="footer"/></div>' });
const select = defineComponent({
  props: { value: { type: String, default: null } },
  emits: ["update:value"],
  template: "<div />"
});
const options = {
  global: {
    stubs: {
      NButton: button,
      Button: button,
      NModal: modal,
      Modal: modal,
      NCard: card,
      Card: card,
      NSelect: select,
      Select: select
    }
  }
};
function libraryList() {
  return {
    libraryId: "library",
    revision: 1,
    groups: [
      { id: "remembered", name: "上次分组", parentId: null },
      { id: "chosen", name: "指定分组", parentId: null }
    ],
    items: [],
    total: 0,
    page: 1,
    pageSize: 1,
    usedBytes: 0,
    reservedBytes: 0,
    maxBytes: 10000,
    totalItems: 0
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(storedGroup).mockReturnValue("remembered");
  vi.mocked(audioLibraryApi.list).mockResolvedValue(libraryList());
  vi.mocked(audioLibraryApi.importChatterbox).mockResolvedValue({ results: [{ sourceId: "done", status: "added" }] });
});
describe("配音入库入口", () => {
  it("详情工具栏使用统一的小号描边按钮且保留指定分组入口", async () => {
    const wrapper = mount(SaveToAudioLibrary, {
      ...options,
      props: { toolbar: true, batchId: "batch", items: [{ id: "done", status: "completed" }] }
    });
    try {
      const buttons = wrapper.findAllComponents(NButton);
      expect(wrapper.find(".library-save-actions--toolbar").exists()).toBe(true);
      expect(buttons[0].attributes()).toMatchObject({ size: "small", secondary: "false" });
      expect(buttons[1].attributes()).toMatchObject({ size: "small", quaternary: "false" });
      expect(buttons[1].text()).toBe("添加至分组");
      await buttons[1].trigger("click");
      await flushPromises();
      expect(wrapper.getComponent(select).props("value")).toBeNull();
    } finally {
      wrapper.unmount();
    }
  });
  it("在线自然音色入库发送独立的批次版本引用并默认为未分组", async () => {
    vi.mocked(audioLibraryApi.importEdgeTts).mockResolvedValue({ results: [{ sourceId: "done", status: "added" }] });
    const wrapper = mount(SaveToAudioLibrary, {
      ...options,
      props: {
        engine: "edge-tts",
        batchId: "batch",
        items: [{ id: "done", status: "completed", attempt: 2 }]
      }
    });
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(audioLibraryApi.importEdgeTts).toHaveBeenCalledWith({
      batchId: "batch",
      itemIds: ["done"],
      attempts: { done: 2 },
      groupId: null
    });
    expect(audioLibraryApi.importChatterbox).not.toHaveBeenCalled();
    wrapper.unmount();
  });
  it("只发送成功段落和明确版本，重复入库反馈已有，新版本重置按钮状态", async () => {
    vi.mocked(audioLibraryApi.importChatterbox).mockResolvedValue({
      results: [{ sourceId: "done", status: "existing" }]
    });
    const wrapper = mount(SaveToAudioLibrary, {
      ...options,
      props: {
        batchId: "batch",
        items: [
          { id: "done", status: "completed", attempt: 2 },
          { id: "pending", status: "queued", attempt: 1 }
        ]
      }
    });
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(audioLibraryApi.importChatterbox).toHaveBeenCalledWith({
      batchId: "batch",
      itemIds: ["done"],
      attempts: { done: 2 },
      groupId: null
    });
    expect(storedGroup).not.toHaveBeenCalled();
    expect(rememberGroup).not.toHaveBeenCalled();
    expect(audioLibraryApi.list).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("已加入音频库");
    await wrapper.setProps({ items: [{ id: "done", status: "completed", attempt: 3 }] });
    expect(wrapper.text()).not.toContain("已加入音频库");
    expect(messages.success).toHaveBeenCalledWith(expect.stringContaining("已有 1 段"));
    wrapper.unmount();
  });
  it("仅手动添加至指定分组，之后快捷入库和重新打开选择框仍默认未分组", async () => {
    const wrapper = mount(SaveToAudioLibrary, {
      ...options,
      props: { batchId: "batch", items: [{ id: "done", status: "completed", attempt: 1 }] }
    });
    await wrapper.findAll("button")[1].trigger("click");
    await flushPromises();
    expect(wrapper.getComponent(select).props("value")).toBeNull();
    wrapper.getComponent(select).vm.$emit("update:value", "chosen");
    await wrapper.vm.$nextTick();
    await wrapper
      .findAll("button")
      .find((x) => x.text() === "确认添加")!
      .trigger("click");
    await flushPromises();
    expect(audioLibraryApi.importChatterbox).toHaveBeenLastCalledWith(expect.objectContaining({ groupId: "chosen" }));

    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(audioLibraryApi.importChatterbox).toHaveBeenLastCalledWith(expect.objectContaining({ groupId: null }));
    await wrapper.findAll("button")[1].trigger("click");
    await flushPromises();
    expect(wrapper.getComponent(select).props("value")).toBeNull();
    expect(rememberGroup).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("手动选择的分组被删除时回退到未分组", async () => {
    const wrapper = mount(SaveToAudioLibrary, {
      ...options,
      props: { batchId: "batch", items: [{ id: "done", status: "completed", attempt: 1 }] }
    });
    await wrapper.findAll("button")[1].trigger("click");
    await flushPromises();
    wrapper.getComponent(select).vm.$emit("update:value", "chosen");
    await wrapper.vm.$nextTick();
    vi.mocked(audioLibraryApi.list).mockResolvedValueOnce({ ...libraryList(), groups: [] });
    await wrapper
      .findAll("button")
      .find((x) => x.text() === "确认添加")!
      .trigger("click");
    await flushPromises();
    expect(audioLibraryApi.importChatterbox).toHaveBeenLastCalledWith(expect.objectContaining({ groupId: null }));
    wrapper.unmount();
  });
  it("无成功产物禁用，失败明确提示且不显示虚假成功", async () => {
    const wrapper = mount(SaveToAudioLibrary, {
      ...options,
      props: { batchId: "batch", items: [{ id: "one", status: "processing" }] }
    });
    expect(wrapper.get("button").attributes()).toHaveProperty("disabled");
    await wrapper.setProps({ items: [{ id: "one", status: "completed", attempt: 1 }] });
    vi.mocked(audioLibraryApi.importChatterbox).mockResolvedValue({
      results: [{ sourceId: "one", status: "failed", message: "原文件已删除" }]
    });
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(messages.warning).toHaveBeenCalledWith(expect.stringContaining("原文件已删除"), { duration: 8000 });
    expect(wrapper.text()).not.toContain("已加入音频库");
    wrapper.unmount();
  });
});
