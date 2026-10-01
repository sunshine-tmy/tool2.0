// @vitest-environment happy-dom
/** 页面容器验证真实组件事件与中性 API 编排，SSE 仅模拟传输，不替代浏览器验收。 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import Page from "./page.vue";
import ArchiveListPanel from "./ArchiveListPanel.vue";
import ArchiveTaskPanel from "./ArchiveTaskPanel.vue";
import XhsDetailDrawer from "./XhsDetailDrawer.vue";
import XhsResultPanel from "./XhsResultPanel.vue";
import TranslationEditModal from "./TranslationEditModal.vue";
import { archiveFixture, listFixture, taskFixture, translationFixture } from "./__tests__/fixtures";

const mocks = vi.hoisted(() => ({
  api: Object.fromEntries(
    [
      "create",
      "task",
      "cancel",
      "list",
      "detail",
      "addFrame",
      "refresh",
      "remove",
      "xhsRuntime",
      "douyinRuntime",
      "startXhsAuth",
      "xhsAuth",
      "translationRuntime",
      "translate",
      "translationTask",
      "translateBatch",
      "editTranslation",
      "resetTranslation"
    ].map((key) => [key, vi.fn()])
  ),
  message: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() },
  confirm: vi.fn(),
  push: vi.fn(),
  copy: vi.fn(),
  streams: [] as Array<{ task: ReturnType<typeof ref>; error: ReturnType<typeof ref> }>
}));
vi.mock("./content-api", () => ({
  contentArchiveApi: mocks.api,
  contentArchiveZipUrl: (id: string) => `/api/v1/tools/media-archive/items/${id}/download.zip`
}));
vi.mock("naive-ui", async (original) => ({ ...(await original<object>()), useMessage: () => mocks.message }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("../../composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
vi.mock("../../utils/clipboard", () => ({ copyTextToClipboard: mocks.copy }));
vi.mock("../../composables/useTaskEvents", () => ({
  useTaskEvents: () => {
    const stream = { task: ref(), error: ref() };
    mocks.streams.push(stream);
    return stream;
  }
}));
const wrappers: ReturnType<typeof mount>[] = [];
function mountPage() {
  const wrapper = mount(Page, {
    global: {
      stubs: {
        ToolLayout: defineComponent({ template: "<main><slot /></main>" }),
        ToolPageHeader: true,
        NAlert: defineComponent({ template: "<div><slot /><slot name='header'/></div>" }),
        NButton: true,
        ArchiveListPanel: true,
        ArchiveTaskPanel: true,
        XhsDetailDrawer: true,
        XhsResultPanel: true,
        TranslationEditModal: true
      }
    }
  });
  wrappers.push(wrapper);
  return wrapper;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.streams.length = 0;
  Object.values(mocks.api).forEach((fn) => fn.mockResolvedValue({}));
  mocks.api.list!.mockResolvedValue(listFixture());
  mocks.api.detail!.mockResolvedValue(archiveFixture());
  mocks.api.create!.mockResolvedValue(taskFixture());
  mocks.api.refresh!.mockResolvedValue(taskFixture());
  mocks.api.translate!.mockResolvedValue({ id: "translation-123" });
  mocks.api.translateBatch!.mockResolvedValue({ id: "translation-123" });
  mocks.api.xhsRuntime!.mockResolvedValue({ message: "小红书环境就绪" });
  mocks.api.douyinRuntime!.mockResolvedValue({ available: false, message: "抖音组件未安装" });
  mocks.confirm.mockResolvedValue(true);
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.useRealTimers();
  delete window.toolboxDesktop;
});

async function showResult(
  wrapper: ReturnType<typeof mountPage>,
  item = archiveFixture({ translation: translationFixture() })
) {
  const input = wrapper.findComponent(ArchiveTaskPanel);
  input.vm.$emit("update:inputUrl", "https://www.xiaohongshu.com/explore/123");
  input.vm.$emit("submit");
  await flushPromises();
  mocks.api.detail!.mockResolvedValue(item);
  mocks.api.task!.mockResolvedValue(
    taskFixture({ status: "completed", stage: "completed", archiveId: item.id, progress: 100 })
  );
  mocks.streams[0]!.task.value = { id: "task-123", status: "completed" };
  await flushPromises();
  return wrapper.findComponent(XhsResultPanel);
}

describe("中性多媒体归档页面", () => {
  it("结果区保留复制、翻译、刷新和格式化操作", async () => {
    const wrapper = mountPage();
    await flushPromises();
    const result = await showResult(wrapper);
    await result.props("copyDescription")();
    expect(mocks.copy).toHaveBeenLastCalledWith("晚霞");
    await result.props("copyCurrent")("both");
    expect(mocks.copy).toHaveBeenLastCalledWith(expect.stringContaining("My sunset"));
    await result.props("translateCurrent")();
    expect(mocks.api.translate).toHaveBeenLastCalledWith("archive-123", true, expect.any(AbortSignal));
    expect(result.props("hasEdited")(result.props("current"))).toBe(true);
    expect(result.props("formatDate")("2026-10-01T00:00:00.000Z")).toContain("2026");
    await result.props("refreshItem")("archive-123");
    expect(mocks.api.refresh).toHaveBeenCalledWith("archive-123", expect.any(AbortSignal));
    mocks.api.refresh!.mockRejectedValueOnce(new Error("offline"));
    await result.props("refreshItem")("archive-123");
    expect(mocks.message.error).toHaveBeenCalled();
  });
  it("创建、任务读取、翻译和修订错误保留当前内容", async () => {
    const wrapper = mountPage();
    await flushPromises();
    const input = wrapper.findComponent(ArchiveTaskPanel);
    input.vm.$emit("update:inputUrl", "https://www.xiaohongshu.com/explore/123");
    mocks.api.create!.mockRejectedValueOnce(new Error("create failed"));
    input.vm.$emit("submit");
    await flushPromises();
    expect(mocks.message.error).toHaveBeenCalled();
    const result = await showResult(wrapper);
    const item = result.props("current");
    mocks.api.translate!.mockRejectedValueOnce(new Error("worker failed"));
    await result.props("translateCurrent")();
    result.props("editTranslation")(item);
    await flushPromises();
    mocks.api.editTranslation!.mockRejectedValueOnce(new Error("conflict"));
    wrapper
      .findComponent(TranslationEditModal)
      .vm.$emit("save", { sourceHash: item.translation!.sourceHash, title: { edited: "edit" }, topics: [] });
    await flushPromises();
    expect(wrapper.findComponent(TranslationEditModal).props("show")).toBe(true);
    mocks.api.resetTranslation!.mockRejectedValueOnce(new Error("reset failed"));
    await result.props("resetTranslation")(item);
    mocks.api.task!.mockRejectedValueOnce(new Error("task failed"));
    mocks.streams[0]!.task.value = { id: "task-123", status: "failed" };
    await flushPromises();
    expect(result.props("current")?.id).toBe(item.id);
    mocks.streams[0]!.error.value = new Error("stream failed");
    mocks.streams[1]!.error.value = new Error("translation stream failed");
    await flushPromises();
    expect(mocks.message.warning).toHaveBeenCalledTimes(2);
  });
  it("小红书登录轮询保留并重试原任务，不启动抖音登录", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    mocks.api.create!.mockResolvedValue(
      taskFixture({ status: "failed", stage: "failed", errorCode: "ARCHIVE_AUTH_REQUIRED" })
    );
    mocks.api.startXhsAuth!.mockResolvedValue({ id: "auth-123", status: "running" });
    mocks.api.xhsAuth!.mockResolvedValue({ status: "completed" });
    const wrapper = mountPage();
    await flushPromises();
    const input = wrapper.findComponent(ArchiveTaskPanel);
    input.vm.$emit("login");
    await flushPromises();
    expect(mocks.api.startXhsAuth).not.toHaveBeenCalled();
    input.vm.$emit("update:inputUrl", "https://www.xiaohongshu.com/explore/123");
    input.vm.$emit("submit");
    await flushPromises();
    input.vm.$emit("login");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(1200);
    await flushPromises();
    expect(mocks.api.xhsAuth).toHaveBeenCalledWith("auth-123", expect.any(AbortSignal));
    expect(mocks.api.create).toHaveBeenCalledTimes(2);
  });
  it("登录等待时卸载释放计时器，不再轮询或重新获取", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    mocks.api.create!.mockResolvedValue(taskFixture({ status: "failed", stage: "failed" }));
    mocks.api.startXhsAuth!.mockResolvedValue({ id: "auth-123", status: "running" });
    const wrapper = mountPage();
    await flushPromises();
    const input = wrapper.findComponent(ArchiveTaskPanel);
    input.vm.$emit("update:inputUrl", "https://www.xiaohongshu.com/explore/123");
    input.vm.$emit("submit");
    await flushPromises();
    input.vm.$emit("login");
    await flushPromises();
    wrapper.unmount();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(2400);
    expect(mocks.api.xhsAuth).not.toHaveBeenCalled();
    expect(mocks.api.create).toHaveBeenCalledOnce();
    expect(mocks.message.error).not.toHaveBeenCalled();
  });
  it.each(["ready", "not-installed"])("桌面翻译能力 %s 不触发静默安装", async (status) => {
    Object.defineProperty(window, "toolboxDesktop", { configurable: true, value: {} });
    mocks.api.translationRuntime!.mockResolvedValue({ status, message: "翻译状态夹具" });
    const wrapper = mountPage();
    await flushPromises();
    const result = await showResult(wrapper);
    await result.props("translateCurrent")();
    if (status === "ready") expect(mocks.api.translate).toHaveBeenCalledOnce();
    else {
      expect(mocks.api.translate).not.toHaveBeenCalled();
      expect(mocks.push).toHaveBeenCalledWith("/settings");
    }
  });
  it("详情删除确认与失败反馈，不误关后来打开的其他归档", async () => {
    const wrapper = mountPage();
    await flushPromises();
    wrapper.findComponent(ArchiveListPanel).vm.$emit("openDetail", "archive-123");
    await flushPromises();
    const drawer = wrapper.findComponent(XhsDetailDrawer);
    mocks.confirm.mockResolvedValueOnce(false);
    await drawer.props("removeItem")();
    expect(mocks.api.remove).not.toHaveBeenCalled();
    mocks.api.remove!.mockRejectedValueOnce(new Error("delete failed"));
    await drawer.props("removeItem")();
    expect(drawer.props("open")).toBe(true);
    await drawer.props("removeItem")();
    await flushPromises();
    expect(drawer.props("open")).toBe(false);
    drawer.vm.$emit("update:open", false);
    wrapper.findComponent(TranslationEditModal).vm.$emit("update:show", false);
    await flushPromises();
    expect(mocks.api.remove).toHaveBeenCalledTimes(2);
  });
  it("页面粘贴快捷输入，不覆盖正在编辑的输入框", async () => {
    const wrapper = mountPage();
    await flushPromises();
    const paste = new Event("paste", { cancelable: true, bubbles: true });
    Object.defineProperty(paste, "clipboardData", { value: { getData: () => "https://xhslink.com/a/123" } });
    window.dispatchEvent(paste);
    await flushPromises();
    expect(wrapper.findComponent(ArchiveTaskPanel).props("inputUrl")).toBe("https://xhslink.com/a/123");
    const input = document.createElement("input");
    document.body.appendChild(input);
    const editing = new Event("paste", { cancelable: true, bubbles: true });
    Object.defineProperty(editing, "clipboardData", { value: { getData: () => "不覆盖" } });
    input.dispatchEvent(editing);
    await flushPromises();
    expect(wrapper.findComponent(ArchiveTaskPanel).props("inputUrl")).toBe("https://xhslink.com/a/123");
    input.remove();
  });
  it("离线能力不阻断列表，筛选范围传递到批量补译", async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("抖音组件未安装");
    expect(mocks.api.list).toHaveBeenCalledOnce();
    const list = wrapper.findComponent(ArchiveListPanel);
    list.vm.$emit("update:platformFilter", "douyin");
    list.vm.$emit("update:typeFilter", "video");
    list.vm.$emit("update:keyword", "日落");
    await flushPromises();
    list.vm.$emit("translateSelected");
    await flushPromises();
    expect(mocks.api.translateBatch).toHaveBeenLastCalledWith(
      { mode: "missing-or-stale", filter: { platform: "douyin", type: "video", keyword: "日落" } },
      expect.any(AbortSignal)
    );
    expect(mocks.api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ platform: "douyin", page: 1 }),
      expect.any(AbortSignal)
    );
  });
  it("显式选择按 ID 翻译，分页后清空选择", async () => {
    const wrapper = mountPage();
    await flushPromises();
    const list = wrapper.findComponent(ArchiveListPanel);
    list.vm.$emit("toggleSelection", "archive-123", true);
    await flushPromises();
    list.vm.$emit("translateSelected");
    await flushPromises();
    expect(mocks.api.translateBatch).toHaveBeenCalledWith(
      { mode: "selected", itemIds: ["archive-123"] },
      expect.any(AbortSignal)
    );
    list.vm.$emit("update:page", 2);
    list.vm.$emit("pageChange");
    await flushPromises();
    expect(list.props("selectedIds")).toEqual([]);
  });
  it("小红书创建改用中性 API，抖音/平台不符仍不可绕过获取门禁", async () => {
    const wrapper = mountPage();
    await flushPromises();
    const input = wrapper.findComponent(ArchiveTaskPanel);
    input.vm.$emit("update:inputUrl", "https://v.douyin.com/PrWnsoVIg78/");
    input.vm.$emit("submit");
    await flushPromises();
    expect(mocks.api.create).not.toHaveBeenCalled();
    input.vm.$emit("update:platform", "douyin");
    input.vm.$emit("update:inputUrl", "https://www.xiaohongshu.com/explore/123");
    input.vm.$emit("submit");
    await flushPromises();
    expect(mocks.api.create).not.toHaveBeenCalled();
    input.vm.$emit("update:platform", "auto");
    input.vm.$emit("submit");
    await flushPromises();
    expect(mocks.api.create).toHaveBeenCalledWith(
      { url: "https://www.xiaohongshu.com/explore/123", platform: "xiaohongshu" },
      expect.any(AbortSignal)
    );
    input.vm.$emit("submit");
    await flushPromises();
    expect(mocks.api.create).toHaveBeenCalledOnce();
    mocks.api.task!.mockResolvedValue(
      taskFixture({ status: "completed", stage: "completed", archiveId: "archive-123", progress: 100 })
    );
    mocks.streams[0]!.task.value = { id: "task-123", status: "completed" };
    await flushPromises();
    expect(wrapper.findComponent(XhsResultPanel).props("current").platform).toBe("xiaohongshu");
  });
  it("抖音详情、翻译、编辑和重置使用同一页面与中性 API", async () => {
    const item = archiveFixture({ platform: "douyin", rawText: "抖音原文[微笑R]", translation: translationFixture() });
    mocks.api.detail!.mockResolvedValue(item);
    const wrapper = mountPage();
    await flushPromises();
    wrapper.findComponent(ArchiveListPanel).vm.$emit("openDetail", item.id);
    await flushPromises();
    const drawer = wrapper.findComponent(XhsDetailDrawer);
    expect(drawer.props("detail")?.platform).toBe("douyin");
    await drawer.props("translateDetail")();
    expect(mocks.api.translate).toHaveBeenCalledWith(item.id, true, expect.any(AbortSignal));
    drawer.props("editTranslation")(item);
    await flushPromises();
    const edit = { sourceHash: item.translation!.sourceHash, title: { edited: "Hand edited" }, topics: [] };
    wrapper.findComponent(TranslationEditModal).vm.$emit("save", edit);
    await flushPromises();
    expect(mocks.api.editTranslation).toHaveBeenCalledWith(item.id, edit, expect.any(AbortSignal));
    expect(wrapper.findComponent(TranslationEditModal).props("show")).toBe(false);
    await drawer.props("resetTranslation")(item);
    expect(mocks.api.resetTranslation).toHaveBeenCalledWith(item.id, expect.any(AbortSignal));
  });
  it("翻译终态刷新列表和当前详情，失败保留原文且显示反馈", async () => {
    const item = archiveFixture({ platform: "douyin" });
    mocks.api.detail!.mockResolvedValue(item);
    const wrapper = mountPage();
    await flushPromises();
    wrapper.findComponent(ArchiveListPanel).vm.$emit("openDetail", item.id);
    await flushPromises();
    await wrapper.findComponent(XhsDetailDrawer).props("translateDetail")();
    mocks.api.translationTask!.mockResolvedValue({ status: "completed" });
    mocks.streams[1]!.task.value = { id: "translation-123", status: "completed" };
    await flushPromises();
    expect(mocks.message.success).toHaveBeenCalledWith("英文翻译已完成");
    expect(mocks.api.list!.mock.calls.length).toBeGreaterThan(1);
    await wrapper.findComponent(XhsDetailDrawer).props("translateDetail")();
    mocks.api.translationTask!.mockResolvedValue({ status: "failed", error: "模型读取失败" });
    mocks.streams[1]!.task.value = { id: "translation-123", status: "failed" };
    await flushPromises();
    expect(mocks.message.error).toHaveBeenCalledWith("模型读取失败");
    expect(wrapper.findComponent(XhsDetailDrawer).props("detail")?.id).toBe(item.id);
  });
  it("截帧更新当前归档并刷新媒体数量，ZIP 指向中性接口", async () => {
    const wrapper = mountPage();
    await flushPromises();
    wrapper.findComponent(ArchiveListPanel).vm.$emit("openDetail", "archive-123");
    await flushPromises();
    const drawer = wrapper.findComponent(XhsDetailDrawer);
    const updated = archiveFixture({ totalBytes: 128 });
    drawer.vm.$emit("frameSaved", updated);
    await flushPromises();
    expect(drawer.props("detail")?.totalBytes).toBe(128);
    expect(drawer.props("zipUrl")("archive-123")).toContain("/tools/media-archive/");
  });
  it("批量删除部分失败不谎报成功，失败记录保留可重试", async () => {
    const second = archiveFixture({ id: "archive-456", platform: "douyin" });
    mocks.api.list!.mockResolvedValue(listFixture([archiveFixture(), second]));
    mocks.api.remove!.mockImplementation((id) =>
      id === second.id ? Promise.reject(new Error("locked")) : Promise.resolve({ removed: true })
    );
    const wrapper = mountPage();
    await flushPromises();
    const list = wrapper.findComponent(ArchiveListPanel);
    list.vm.$emit("toggleSelectAll", true);
    await flushPromises();
    list.vm.$emit("removeSelected");
    await flushPromises();
    expect(mocks.api.remove).toHaveBeenCalledTimes(2);
    expect(mocks.message.success).toHaveBeenCalledWith("已删除 1 条存档");
    expect(mocks.message.error).toHaveBeenCalled();
    expect(list.props("selectedIds")).toEqual([second.id]);
  });
  it.each(["late-ready", "abort"])("桌面能力请求卸载后 %s，不显示错误或恢复页面状态", async (mode) => {
    window.toolboxDesktop = {} as NonNullable<typeof window.toolboxDesktop>;
    let resolve!: (value: unknown) => void;
    let reject!: (error: unknown) => void;
    mocks.api.translationRuntime!.mockReturnValue(
      new Promise((accept, fail) => {
        resolve = accept;
        reject = fail;
      })
    );
    const wrapper = mountPage();
    await flushPromises();
    const signal = mocks.api.translationRuntime!.mock.calls[0]![0] as AbortSignal;
    wrapper.unmount();
    expect(signal.aborted).toBe(true);
    if (mode === "abort") reject(new DOMException("已取消", "AbortError"));
    else resolve({ status: "ready", message: "迟到的能力状态" });
    await flushPromises();
    expect(mocks.message.warning).not.toHaveBeenCalled();
  });
  it("卸载中止全部请求，能力错误不隐藏本地归档", async () => {
    mocks.api.douyinRuntime!.mockRejectedValue(new Error("offline"));
    const wrapper = mountPage();
    await flushPromises();
    expect(mocks.message.warning).toHaveBeenCalled();
    const signal = mocks.api.list!.mock.calls[0]![1] as AbortSignal;
    expect(signal.aborted).toBe(false);
    wrapper.unmount();
    expect(signal.aborted).toBe(true);
  });
});
