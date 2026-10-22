// @vitest-environment happy-dom
/** Retained history never starts inference; covers viewing, downloading, deletion and request races. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { ImageAiHistory, ImageAiTask } from "@toolbox/shared";
import HistoryPanel from "./ImageAiHistoryPanel.vue";
import ImageAiResultGallery from "./ImageAiResultGallery.vue";
import { NCheckbox, NInput, NPagination, NSelect } from "naive-ui";

const mocks = vi.hoisted(() => ({
  history: vi.fn(),
  getTask: vi.fn(),
  removeHistory: vi.fn(),
  confirm: vi.fn(),
  download: vi.fn(),
  message: { error: vi.fn(), success: vi.fn() }
}));
vi.mock("./api", () => ({
  imageAiApi: mocks,
  absoluteImageAiUrl: (url: string) => url,
  resultDownloadUrl: (url: string) => `${url}?download=1`,
  triggerImageAiDownload: mocks.download
}));
vi.mock("../../composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
vi.mock("naive-ui", async (original) => {
  const { defineComponent } = await import("vue");
  const slot = () => defineComponent({ template: "<div><slot /></div>" });
  return {
    ...(await original<object>()),
    useMessage: () => mocks.message,
    NAlert: slot(),
    NDrawer: slot(),
    NDrawerContent: slot(),
    NEmpty: defineComponent({ props: { description: String }, template: "<p>{{ description }}</p>" }),
    NSpin: slot(),
    NTag: slot(),
    NCheckbox: defineComponent({
      props: { checked: Boolean, indeterminate: Boolean, disabled: Boolean },
      emits: ["update:checked"],
      template: '<label><input type="checkbox" :checked="checked" :disabled="disabled" /><slot /></label>'
    }),
    NInput: defineComponent({ props: { value: String }, emits: ["update:value"], template: "<input />" }),
    NSelect: defineComponent({
      props: { value: String, options: Array },
      emits: ["update:value"],
      template: "<select />"
    }),
    NPagination: defineComponent({
      props: { page: Number, itemCount: Number },
      emits: ["update:page"],
      template: "<nav />"
    }),
    NButton: defineComponent({
      props: { disabled: Boolean, loading: Boolean },
      template: '<button :disabled="disabled || loading"><slot /></button>'
    })
  };
});
const wrappers: ReturnType<typeof mount>[] = [];
function task(overrides: Partial<ImageAiTask> = {}): ImageAiTask {
  return {
    id: "history-task-123",
    operation: "background_remove",
    status: "completed",
    progress: 100,
    queuePosition: null,
    createdAt: "2026-10-22T00:00:00Z",
    updatedAt: "2026-10-22T00:00:01Z",
    expiresAt: null,
    warnings: [],
    results: [
      {
        id: "history-task-123-1",
        originalName: "商品.png",
        outputName: "商品-cutout.png",
        downloadUrl: "/result.png",
        width: 20,
        height: 20,
        provider: "birefnet-general",
        model: "BiRefNet",
        warnings: []
      }
    ],
    ...overrides
  };
}
function history(items = [task()], total = items.length, page = 1): ImageAiHistory {
  return { items, total, page, pageSize: 20 };
}
function render() {
  const wrapper = mount(HistoryPanel, {
    props: { refreshVersion: 0 },
    global: { stubs: { ImageAiResultGallery: true, ImageAiTaskStatusCard: true } }
  });
  wrappers.push(wrapper);
  return wrapper;
}
function button(wrapper: ReturnType<typeof mount>, text: string) {
  return (
    wrapper.findAll("button").find((entry) => entry.text() === text) ??
    wrapper.findAll("button").find((entry) => entry.text().includes(text))!
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.history.mockResolvedValue(history());
  mocks.getTask.mockResolvedValue(task());
  mocks.removeHistory.mockResolvedValue({ id: "history-task-123", deleted: true });
  mocks.confirm.mockResolvedValue(true);
});
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));

describe("image AI retained history", () => {
  it("selects only deletable current-page tasks and displays partial selection", async () => {
    mocks.history.mockResolvedValue(
      history([
        task(),
        task({ id: "history-task-456", status: "failed" }),
        task({ id: "history-task-789", status: "running" }),
        task({ id: "history-task-999", status: "pending" })
      ])
    );
    const wrapper = render();
    await flushPromises();
    const boxes = wrapper.findAllComponents(NCheckbox);
    expect(boxes).toHaveLength(5);
    expect(boxes[3].props("disabled")).toBe(true);
    expect(boxes[4].props("disabled")).toBe(true);
    boxes[0].vm.$emit("update:checked", true);
    await flushPromises();
    expect(wrapper.text()).toContain("已选 2 条");
    expect(boxes[0].props("checked")).toBe(true);
    boxes[1].vm.$emit("update:checked", false);
    await flushPromises();
    expect(boxes[0].props("indeterminate")).toBe(true);
    expect(wrapper.text()).toContain("已选 1 条");
    boxes[3].vm.$emit("update:checked", true);
    await flushPromises();
    expect(wrapper.text()).toContain("已选 1 条");
  });

  it("confirms the selected count once and deletes exactly the selected records", async () => {
    mocks.history.mockResolvedValue(
      history([task(), task({ id: "history-task-456" }), task({ id: "history-task-789" })])
    );
    const wrapper = render();
    await flushPromises();
    const boxes = wrapper.findAllComponents(NCheckbox);
    boxes[1].vm.$emit("update:checked", true);
    boxes[2].vm.$emit("update:checked", true);
    await flushPromises();
    mocks.history.mockResolvedValue(history([task({ id: "history-task-789" })]));
    await button(wrapper, "删除所选").trigger("click");
    await flushPromises();
    expect(mocks.confirm).toHaveBeenCalledOnce();
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.stringContaining("所选 2 条"),
      expect.objectContaining({ positiveText: "确认删除 2 条", danger: true })
    );
    expect(mocks.removeHistory.mock.calls.map((call) => call[0])).toEqual(["history-task-123", "history-task-456"]);
    expect(wrapper.emitted("deleted")).toEqual([["history-task-123"], ["history-task-456"]]);
    expect(mocks.message.success).toHaveBeenCalledWith(expect.stringContaining("已删除 2 条"));
    expect(wrapper.text()).toContain("已选 0 条");
  });

  it("does not delete when bulk confirmation is canceled", async () => {
    const wrapper = render();
    await flushPromises();
    wrapper.findAllComponents(NCheckbox)[0].vm.$emit("update:checked", true);
    await flushPromises();
    mocks.confirm.mockResolvedValueOnce(false);
    await button(wrapper, "删除所选").trigger("click");
    await flushPromises();
    expect(mocks.removeHistory).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("已选 1 条");
    expect(button(wrapper, "删除所选").attributes("disabled")).toBeUndefined();
  });

  it("reports actual partial outcomes and keeps the failed deletable record selected for retry", async () => {
    mocks.history.mockResolvedValue(history([task(), task({ id: "history-task-456" })]));
    const wrapper = render();
    await flushPromises();
    wrapper.findAllComponents(NCheckbox)[0].vm.$emit("update:checked", true);
    await flushPromises();
    mocks.removeHistory.mockResolvedValueOnce({ deleted: true }).mockRejectedValueOnce(new Error("file locked"));
    mocks.history.mockResolvedValue(history([task({ id: "history-task-456" })]));
    await button(wrapper, "删除所选").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("1 条未能完成删除");
    expect(wrapper.text()).toContain("已选 1 条");
    expect(mocks.message.success).toHaveBeenCalledWith(expect.stringContaining("已删除 1 条"));
    expect(wrapper.emitted("deleted")).toEqual([["history-task-123"]]);
    expect(wrapper.findAllComponents(NCheckbox)[1].props("checked")).toBe(true);
  });

  it("clears selection on page and filter changes instead of deleting hidden records", async () => {
    const wrapper = render();
    await flushPromises();
    wrapper.findAllComponents(NCheckbox)[0].vm.$emit("update:checked", true);
    await flushPromises();
    wrapper.findComponent(NPagination).vm.$emit("update:page", 2);
    await flushPromises();
    expect(wrapper.text()).toContain("已选 0 条");
    wrapper.findAllComponents(NCheckbox)[0].vm.$emit("update:checked", true);
    await flushPromises();
    wrapper.findAllComponents(NSelect)[0].vm.$emit("update:value", "enhance");
    await flushPromises();
    expect(wrapper.text()).toContain("已选 0 条");
    expect(mocks.removeHistory).not.toHaveBeenCalled();
  });

  it("serializes bulk requests, shows real progress and prevents duplicate or single deletes mid-batch", async () => {
    mocks.history.mockResolvedValue(history([task(), task({ id: "history-task-456" })]));
    let release!: () => void;
    mocks.removeHistory.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ deleted: true });
        })
    );
    const wrapper = render();
    await flushPromises();
    wrapper.findAllComponents(NCheckbox)[0].vm.$emit("update:checked", true);
    await flushPromises();
    await button(wrapper, "删除所选").trigger("click");
    await flushPromises();
    expect(mocks.removeHistory).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain("删除中 0/2");
    expect(button(wrapper, "删除中").attributes("disabled")).toBeDefined();
    expect(button(wrapper, "删除").attributes("disabled")).toBeDefined();
    await button(wrapper, "删除中").trigger("click");
    await button(wrapper, "删除").trigger("click");
    mocks.history.mockResolvedValue(history([]));
    release();
    await flushPromises();
    expect(mocks.removeHistory.mock.calls.map((call) => call[0])).toEqual(["history-task-123", "history-task-456"]);
    expect(mocks.confirm).toHaveBeenCalledOnce();
  });

  it("drops stale selections when a refresh reveals a task has become active", async () => {
    const wrapper = render();
    await flushPromises();
    wrapper.findAllComponents(NCheckbox)[0].vm.$emit("update:checked", true);
    await flushPromises();
    mocks.history.mockResolvedValue(history([task({ status: "running" })]));
    await wrapper.setProps({ refreshVersion: 1 });
    await flushPromises();
    expect(wrapper.text()).toContain("已选 0 条");
    expect(wrapper.findAllComponents(NCheckbox)[1].props("disabled")).toBe(true);
  });
  it("loads retained tasks, searches file names, and resets pagination for type/status filters", async () => {
    const wrapper = render();
    await flushPromises();
    expect(wrapper.text()).toContain("长期留档");
    expect(wrapper.text()).toContain("商品.png");
    wrapper.findComponent(NInput).vm.$emit("update:value", " 商品 ");
    await button(wrapper, "搜索").trigger("click");
    await flushPromises();
    expect(mocks.history.mock.calls.at(-1)?.[0]).toMatchObject({ keyword: "商品", page: 1 });
    wrapper.findAllComponents(NSelect)[0].vm.$emit("update:value", "enhance");
    await flushPromises();
    expect(mocks.history.mock.calls.at(-1)?.[0]).toMatchObject({ operation: "enhance", page: 1 });
  });

  it("reads saved details with original comparison sources and downloads without reprocessing", async () => {
    const wrapper = render();
    await flushPromises();
    await button(wrapper, "查看详情").trigger("click");
    await flushPromises();
    expect(mocks.getTask).toHaveBeenCalledWith("history-task-123");
    expect(wrapper.findComponent(ImageAiResultGallery).props()).toMatchObject({
      persistedSources: true,
      checkerboard: true,
      sourceFiles: []
    });
    await button(wrapper, "下载结果").trigger("click");
    expect(mocks.download).toHaveBeenCalledWith("/result.png?download=1");
    mocks.history.mockResolvedValue(
      history([task({ results: [...task().results, { ...task().results[0], id: "history-task-123-2" }] })])
    );
    await wrapper.setProps({ refreshVersion: 1 });
    await flushPromises();
    await button(wrapper, "下载 ZIP").trigger("click");
    expect(mocks.download).toHaveBeenLastCalledWith("/api/v1/tools/image-ai/tasks/history-task-123/download.zip");
  });

  it("requires confirmation before deleting saved images, refreshes and notifies the editor", async () => {
    const wrapper = render();
    await flushPromises();
    mocks.confirm.mockResolvedValueOnce(false);
    await button(wrapper, "删除").trigger("click");
    await flushPromises();
    expect(mocks.removeHistory).not.toHaveBeenCalled();
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.stringContaining("无法撤销"),
      expect.objectContaining({ danger: true })
    );
    mocks.history.mockResolvedValue(history([]));
    await button(wrapper, "删除").trigger("click");
    await flushPromises();
    expect(mocks.removeHistory).toHaveBeenCalledWith("history-task-123");
    expect(wrapper.emitted("deleted")).toEqual([["history-task-123"]]);
    expect(wrapper.text()).toContain("暂无处理记录");
  });

  it.each(["pending", "running"] as const)("does not delete a %s task", async (status) => {
    mocks.history.mockResolvedValue(history([task({ status, results: [] })]));
    const wrapper = render();
    await flushPromises();
    expect(button(wrapper, "删除").attributes("disabled")).toBeDefined();
    await button(wrapper, "删除").trigger("click");
    await flushPromises();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.removeHistory).not.toHaveBeenCalled();
  });

  it("keeps the record visible after a deletion failure", async () => {
    const wrapper = render();
    await flushPromises();
    mocks.removeHistory.mockRejectedValueOnce(new Error("file locked"));
    await button(wrapper, "删除").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("商品.png");
    expect(mocks.message.error).toHaveBeenCalledOnce();
    expect(wrapper.emitted("deleted")).toBeUndefined();
  });

  it("ignores superseded responses and aborts the active request on unmount", async () => {
    let release!: (value: ImageAiHistory) => void;
    mocks.history.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const wrapper = render();
    await wrapper.setProps({ refreshVersion: 1 });
    await flushPromises();
    release(history([task({ id: "obsolete-task", results: [] })]));
    await flushPromises();
    expect(wrapper.text()).not.toContain("obsolete-task");
    const signal = mocks.history.mock.calls.at(-1)?.[1] as AbortSignal;
    wrapper.unmount();
    wrappers.splice(wrappers.indexOf(wrapper), 1);
    expect(signal.aborted).toBe(true);
  });

  it("returns to page one when the last record disappears on a later page", async () => {
    const wrapper = render();
    await flushPromises();
    mocks.history.mockResolvedValue(history([], 0, 2));
    wrapper.findComponent(NPagination).vm.$emit("update:page", 2);
    await flushPromises();
    expect(mocks.history.mock.calls.at(-1)?.[0].page).toBe(1);
    expect(wrapper.findComponent(NPagination).props("page")).toBe(1);
  });
});
