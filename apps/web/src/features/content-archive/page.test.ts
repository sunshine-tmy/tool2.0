// @vitest-environment happy-dom
/** 页面容器验证真实组件事件与中性 API 编排，SSE 仅模拟传输，不替代浏览器验收。 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import { createMemoryHistory, createRouter, isNavigationFailure, NavigationFailureType, type Router } from "vue-router";
import { flushPromises, mount } from "@vue/test-utils";
import Page from "./page.vue";
import ArchiveListPanel from "./ArchiveListPanel.vue";
import ArchiveTaskPanel from "./ArchiveTaskPanel.vue";
import XhsDetailDrawer from "./XhsDetailDrawer.vue";
import XhsResultPanel from "./XhsResultPanel.vue";
import TranslationEditModal from "./TranslationEditModal.vue";
import ArchiveBatchImport from "./ArchiveBatchImport.vue";
import ArchiveLocalVideoUpload from "./ArchiveLocalVideoUpload.vue";
import ArchiveGroups from "./ArchiveGroups.vue";
import TikTokProfileImport from "./TikTokProfileImport.vue";
import { archiveFixture, listFixture, taskFixture, translationFixture } from "./__tests__/fixtures";
import { ApiRequestError } from "../../shared/http/http";

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
      "setPublication",
      "publication",
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
  replace: vi.fn(),
  router: undefined as Router | undefined,
  profileShow: vi.fn(),
  copy: vi.fn(),
  streams: [] as Array<{ task: ReturnType<typeof ref>; error: ReturnType<typeof ref> }>
}));
vi.mock("./content-api", () => ({
  contentArchiveApi: mocks.api,
  contentArchiveZipUrl: (id: string) => `/api/v1/tools/media-archive/items/${id}/download.zip`
}));
vi.mock("naive-ui", async (original) => ({ ...(await original<object>()), useMessage: () => mocks.message }));
vi.mock("vue-router", async (original) => ({
  ...(await original<object>()),
  useRouter: () => mocks.router ?? { push: mocks.push, replace: mocks.replace }
}));
vi.mock("../../shared/composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
vi.mock("../../shared/utils/clipboard", () => ({ copyTextToClipboard: mocks.copy }));
vi.mock("../../shared/composables/useTaskEvents", () => ({
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
        ArchiveBatchImport: true,
        ArchiveLocalVideoUpload: true,
        TikTokProfileImport: defineComponent({
          name: "TikTokProfileImport",
          setup(_props, { expose }) {
            expose({ show: mocks.profileShow });
            return () => null;
          }
        }),
        ArchiveGroups: true,
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
  mocks.router = undefined;
  mocks.push.mockReset().mockResolvedValue(undefined);
  mocks.replace.mockReset().mockResolvedValue(undefined);
  mocks.streams.length = 0;
  Object.values(mocks.api).forEach((fn) => fn.mockResolvedValue({}));
  mocks.api.list!.mockResolvedValue(listFixture());
  mocks.api.detail!.mockResolvedValue(archiveFixture());
  mocks.api.publication!.mockImplementation(async (archiveId) => ({ archiveId, publishedElsewhere: false }));
  mocks.api.create!.mockResolvedValue(taskFixture());
  mocks.api.refresh!.mockResolvedValue(taskFixture());
  mocks.api.translate!.mockResolvedValue({ id: "translation-123" });
  mocks.api.translateBatch!.mockResolvedValue({ id: "translation-123" });
  mocks.api.xhsRuntime!.mockResolvedValue({ message: "小红书环境就绪" });
  mocks.api.douyinRuntime!.mockResolvedValue({ available: false, message: "抖音组件未安装" });
  mocks.confirm.mockReset().mockResolvedValue(true);
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
  it("本地视频整轮队列结束后只刷新一次列表并显示最后结果，结果行可直接打开详情", async () => {
    const wrapper = mountPage();
    await flushPromises();
    const item = archiveFixture({ platform: "local", id: "local-123" });
    const uploader = wrapper.getComponent(ArchiveLocalVideoUpload);
    const groups = [
      {
        id: "group-123",
        name: "上传素材",
        createdAt: "2026-10-29T00:00:00.000Z",
        updatedAt: "2026-10-29T00:00:00.000Z"
      }
    ];
    wrapper.getComponent(ArchiveGroups).vm.$emit("loaded", groups);
    await flushPromises();
    expect(uploader.props("groups")).toEqual(groups);
    mocks.api.list!.mockClear();
    uploader.vm.$emit("archived", item);
    await flushPromises();
    expect(mocks.api.list).not.toHaveBeenCalled();
    uploader.vm.$emit("finished", item);
    await flushPromises();
    expect(mocks.api.list).toHaveBeenCalledOnce();
    expect(wrapper.getComponent(XhsResultPanel).props("current")).toMatchObject({ id: item.id, platform: "local" });
    uploader.vm.$emit("finished", undefined);
    await flushPromises();
    expect(mocks.api.list).toHaveBeenCalledTimes(2);
    expect(wrapper.getComponent(XhsResultPanel).props("current")).toMatchObject({ id: item.id });
    mocks.api.detail!.mockResolvedValue(item);
    uploader.vm.$emit("openArchive", item.id);
    await flushPromises();
    expect(wrapper.getComponent(XhsDetailDrawer).props("detail")).toMatchObject({ id: item.id });
  });
  it.each([
    ["editWatermark", "watermark"],
    ["editAudio", "audio"]
  ] as const)("%s 从当前结果或详情进入对应视频面板，并携带原筛选和分页", async (event, panel) => {
    const wrapper = mountPage();
    await flushPromises();
    const result = await showResult(wrapper, archiveFixture({ id: "fresh_archive123" }));
    result.vm.$emit(event, "fresh_video123");
    await flushPromises();
    expect(mocks.replace).toHaveBeenLastCalledWith(expect.stringContaining("/tools/media-archive?editorReturn=1"));
    expect(mocks.push).toHaveBeenLastCalledWith(
      expect.objectContaining({
        name: "archive-video-editor",
        params: { itemId: "fresh_archive123", mediaId: "fresh_video123" },
        query: { panel, returnTo: expect.stringContaining("editorReturn=1") }
      })
    );
    const list = wrapper.findComponent(ArchiveListPanel);
    mocks.api.detail!.mockResolvedValue(archiveFixture());
    list.vm.$emit("openDetail", "archive-123");
    await flushPromises();
    wrapper.findComponent(XhsDetailDrawer).vm.$emit(event, "detail_video123");
    await flushPromises();
    expect(mocks.push).toHaveBeenLastCalledWith(
      expect.objectContaining({
        params: { itemId: "archive-123", mediaId: "detail_video123" },
        query: { panel, returnTo: expect.stringContaining("editorReturn=1") }
      })
    );
  });
  it("导航异常时提示错误并释放进入锁，下一次仍能打开编辑页", async () => {
    const wrapper = mountPage();
    await flushPromises();
    const result = await showResult(wrapper);
    mocks.replace.mockRejectedValueOnce(new Error("navigation failed"));
    result.vm.$emit("editWatermark", "video-123");
    await flushPromises();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.message.error).toHaveBeenCalledOnce();
    result.vm.$emit("editWatermark", "video-123");
    await flushPromises();
    expect(mocks.push).toHaveBeenCalledOnce();
  });
  it("返回相同列表地址后仍能第二次进入水印页，保留筛选、排序和页码", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/tools/media-archive", component: { render: () => null } },
        {
          path: "/tools/media-archive/video-editor/:itemId/:mediaId",
          name: "archive-video-editor",
          component: { render: () => null }
        }
      ]
    });
    mocks.router = router;
    await router.push("/tools/media-archive");
    const replace = vi.spyOn(router, "replace");
    const wrapper = mountPage();
    await flushPromises();
    const list = wrapper.getComponent(ArchiveListPanel);
    list.vm.$emit("update:keyword", "待发布");
    list.vm.$emit("update:sort", "published-asc");
    list.vm.$emit("update:page", 3);
    list.vm.$emit("openDetail", "archive-123");
    await flushPromises();
    const allowNavigation = router.beforeEach(() => false);
    wrapper.getComponent(XhsDetailDrawer).vm.$emit("editWatermark", "video-123");
    await flushPromises();
    expect(isNavigationFailure(await replace.mock.results[0]!.value, NavigationFailureType.aborted)).toBe(true);
    expect(router.currentRoute.value.path).toBe("/tools/media-archive");
    allowNavigation();
    wrapper.getComponent(XhsDetailDrawer).vm.$emit("editWatermark", "video-123");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("archive-video-editor");
    const returnTo = String(router.currentRoute.value.query.returnTo);
    const query = new URL(returnTo, "http://localhost").searchParams;
    expect(Object.fromEntries(query)).toMatchObject({ keyword: "待发布", sort: "published-asc", page: "3" });
    await router.push(returnTo);
    wrapper.getComponent(XhsDetailDrawer).vm.$emit("editWatermark", "video-123");
    await flushPromises();
    // 真实 Vue Router 会把同地址 replace 返回为 duplicated，不能当作进入编辑页失败。
    expect(isNavigationFailure(await replace.mock.results.at(-1)!.value, NavigationFailureType.duplicated)).toBe(true);
    expect(router.currentRoute.value).toMatchObject({
      name: "archive-video-editor",
      params: { itemId: "archive-123", mediaId: "video-123" },
      query: { returnTo }
    });
  });
  it("persists the card publication action and only reports success after confirmation from the API", async () => {
    mocks.api.setPublication!.mockImplementation(async (archiveId, publishedElsewhere) => ({
      archiveId,
      publishedElsewhere
    }));
    const wrapper = mountPage();
    await flushPromises();
    const panel = wrapper.getComponent(ArchiveListPanel);
    panel.vm.$emit("setPublication", "archive-123", true);
    await flushPromises();
    expect(mocks.api.setPublication).toHaveBeenCalledWith("archive-123", true, expect.any(AbortSignal));
    expect(mocks.message.success).toHaveBeenCalledWith("已标记为在其他平台发布");
    expect(mocks.confirm).not.toHaveBeenCalled();
    mocks.message.success.mockClear();
    mocks.api.setPublication!.mockRejectedValueOnce(new Error("write failed"));
    panel.vm.$emit("setPublication", "archive-123", false);
    await flushPromises();
    expect(mocks.message.success).not.toHaveBeenCalled();
    expect(mocks.message.error).toHaveBeenCalled();
  });
  it.each(["列表", "详情"] as const)("%s取消发布标记需二次确认，拒绝或重复点击不会写入", async (source) => {
    let published = true;
    mocks.api.list!.mockImplementation(async () => {
      const result = listFixture();
      result.items[0]!.publishedElsewhere = published;
      return result;
    });
    mocks.api.publication!.mockImplementation(async (archiveId) => ({ archiveId, publishedElsewhere: published }));
    mocks.api.setPublication!.mockImplementation(async (archiveId, value) => {
      published = value;
      return { archiveId, publishedElsewhere: value };
    });
    const wrapper = mountPage();
    await flushPromises();
    const panel = wrapper.getComponent(ArchiveListPanel);
    panel.vm.$emit("openDetail", "archive-123");
    await flushPromises();
    const modal = wrapper.getComponent(XhsDetailDrawer);
    const action = source === "列表" ? panel : modal;
    let decide!: (accepted: boolean) => void;
    mocks.confirm.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          decide = resolve;
        })
    );
    action.vm.$emit("setPublication", "archive-123", false);
    await flushPromises();
    expect(mocks.confirm).toHaveBeenCalledWith(
      expect.stringContaining("日落"),
      expect.objectContaining({ title: "取消已发布标记", positiveText: "确认取消标记", negativeText: "保留标记" })
    );
    expect(mocks.api.setPublication).not.toHaveBeenCalled();
    panel.vm.$emit("setPublication", "archive-123", false);
    modal.vm.$emit("setPublication", "archive-123", false);
    await flushPromises();
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    decide(false);
    await flushPromises();
    expect(mocks.api.setPublication).not.toHaveBeenCalled();
    expect(mocks.message.success).not.toHaveBeenCalled();
    expect(panel.props("archives").items[0]?.publishedElsewhere).toBe(true);
    expect(modal.props("publishedElsewhere")).toBe(true);
    mocks.confirm.mockResolvedValueOnce(true);
    action.vm.$emit("setPublication", "archive-123", false);
    await flushPromises();
    expect(mocks.api.setPublication).toHaveBeenCalledTimes(1);
    expect(mocks.api.setPublication).toHaveBeenCalledWith("archive-123", false, expect.any(AbortSignal));
    expect(panel.props("archives").items[0]?.publishedElsewhere).toBe(false);
    expect(modal.props("publishedElsewhere")).toBe(false);
    expect(mocks.message.success).toHaveBeenCalledWith("已取消发布标记");
  });
  it("离开归档页面后，迟到的取消标记确认不会发起写入", async () => {
    const list = listFixture();
    list.items[0]!.publishedElsewhere = true;
    mocks.api.list!.mockResolvedValue(list);
    const wrapper = mountPage();
    await flushPromises();
    let decide!: (accepted: boolean) => void;
    mocks.confirm.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          decide = resolve;
        })
    );
    wrapper.getComponent(ArchiveListPanel).vm.$emit("setPublication", "archive-123", false);
    await flushPromises();
    expect(mocks.confirm).toHaveBeenCalledTimes(1);
    wrappers.splice(wrappers.indexOf(wrapper), 1);
    wrapper.unmount();
    decide(true);
    await flushPromises();
    expect(mocks.api.setPublication).not.toHaveBeenCalled();
    expect(mocks.message.success).not.toHaveBeenCalled();
  });
  it("详情与列表的发布按钮双向同步，失败不改变状态或显示成功", async () => {
    let published = false;
    mocks.api.list!.mockImplementation(async () => {
      const result = listFixture();
      result.items[0]!.publishedElsewhere = published;
      return result;
    });
    mocks.api.setPublication!.mockImplementation(async (archiveId, value) => {
      published = value;
      return { archiveId, publishedElsewhere: value };
    });
    const wrapper = mountPage();
    await flushPromises();
    const panel = wrapper.getComponent(ArchiveListPanel);
    panel.vm.$emit("openDetail", "archive-123");
    await flushPromises();
    const modal = wrapper.getComponent(XhsDetailDrawer);
    expect(modal.props("publishedElsewhere")).toBe(false);
    modal.vm.$emit("setPublication", "archive-123", true);
    await flushPromises();
    expect(modal.props("publishedElsewhere")).toBe(true);
    expect(panel.props("archives").items[0]?.publishedElsewhere).toBe(true);
    mocks.message.success.mockClear();
    mocks.api.setPublication!.mockRejectedValueOnce(new Error("write failed"));
    modal.vm.$emit("setPublication", "archive-123", false);
    await flushPromises();
    expect(modal.props("publishedElsewhere")).toBe(true);
    expect(mocks.message.success).not.toHaveBeenCalled();
    panel.vm.$emit("setPublication", "archive-123", false);
    await flushPromises();
    expect(modal.props("publishedElsewhere")).toBe(false);
    expect(panel.props("archives").items[0]?.publishedElsewhere).toBe(false);
    expect(mocks.message.success).toHaveBeenCalledWith("已取消发布标记");
  });
  it("wires date sorting into the server request and keeps it on explicit refresh", async () => {
    const wrapper = mountPage();
    await flushPromises();
    const panel = wrapper.getComponent(ArchiveListPanel);
    expect(panel.props("sort")).toBe("archived-desc");
    panel.vm.$emit("update:page", 2);
    panel.vm.$emit("update:sort", "published-asc");
    await flushPromises();
    expect(panel.props()).toMatchObject({ page: 1, sort: "published-asc" });
    expect(mocks.api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, sort: "published-asc" }),
      expect.any(AbortSignal)
    );
    panel.vm.$emit("refresh");
    await flushPromises();
    expect(mocks.api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, sort: "published-asc" }),
      expect.any(AbortSignal)
    );
  });
  it("prefills a profile work for explicit single archiving without replacing or cancelling an active task", async () => {
    const wrapper = mountPage();
    await flushPromises();
    const form = wrapper.getComponent(ArchiveTaskPanel);
    wrapper.getComponent(TikTokProfileImport).vm.$emit("retrySingle", "https://www.tiktok.com/@shop/video/12345");
    await flushPromises();
    expect(form.props()).toMatchObject({ inputUrl: "https://www.tiktok.com/@shop/video/12345", platform: "tiktok" });
    expect(mocks.api.create).not.toHaveBeenCalled();
    form.vm.$emit("submit");
    await flushPromises();
    expect(mocks.api.create).toHaveBeenCalledExactlyOnceWith(
      { url: "https://www.tiktok.com/@shop/video/12345", platform: "tiktok" },
      expect.any(AbortSignal)
    );
    const previous = form.props("task");
    wrapper.getComponent(TikTokProfileImport).vm.$emit("retrySingle", "https://www.tiktok.com/@shop/photo/12346");
    await flushPromises();
    expect(form.props("inputUrl")).toContain("/photo/12346");
    expect(form.props("task")).toEqual(previous);
    form.vm.$emit("submit");
    await flushPromises();
    expect(mocks.api.create).toHaveBeenCalledTimes(1);
    expect(mocks.api.cancel).not.toHaveBeenCalled();
  });
  it("opens the exact owning profile directly from its batch record", async () => {
    const wrapper = mountPage();
    await flushPromises();
    wrapper.getComponent(ArchiveBatchImport).vm.$emit("openProfile", "profile_123");
    expect(mocks.profileShow).toHaveBeenCalledExactlyOnceWith("profile_123");
  });
  it("抽屉分项复制使用事件中的内容，结果区共用剪贴板处理并提示失败", async () => {
    const wrapper = mountPage();
    await flushPromises();
    const result = await showResult(wrapper);
    wrapper.findComponent(XhsDetailDrawer).vm.$emit("copy", "抽屉中另一条作品的正文", "正文");
    await flushPromises();
    expect(mocks.copy).toHaveBeenLastCalledWith("抽屉中另一条作品的正文");
    expect(mocks.message.success).toHaveBeenLastCalledWith("正文已复制");
    result.vm.$emit("copy", "#Tea #Herb", "话题");
    await flushPromises();
    expect(mocks.copy).toHaveBeenLastCalledWith("#Tea #Herb");
    expect(mocks.message.success).toHaveBeenLastCalledWith("话题已复制");
    mocks.message.success.mockClear();
    mocks.copy.mockRejectedValueOnce(new Error("Permission denied"));
    result.vm.$emit("copy", "标题", "标题");
    await flushPromises();
    expect(mocks.message.error).toHaveBeenLastCalledWith("复制标题失败，请检查浏览器剪贴板权限后重试");
    expect(mocks.message.success).not.toHaveBeenCalled();
  });
  it("居中详情弹窗同时限制桌面宽度和移动视口，不依赖一次性窗口尺寸", () => {
    const wrapper = mountPage();
    expect(wrapper.findComponent(XhsDetailDrawer).props("width")).toBe("min(1040px, calc(100vw - 32px))");
  });
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
    expect(result.props("formatDate")("unavailable")).toBe("未知");
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
  it("小红书登录轮询保留并重试原任务", async () => {
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
  it("小红书使用中性 API；抖音未就绪或平台不符时不会创建任务", async () => {
    const wrapper = mountPage();
    await flushPromises();
    const input = wrapper.findComponent(ArchiveTaskPanel);
    input.vm.$emit("update:inputUrl", "https://v.douyin.com/PrWnsoVIg78/");
    input.vm.$emit("submit");
    await flushPromises();
    expect(mocks.api.create).not.toHaveBeenCalled();
    expect(mocks.message.warning).toHaveBeenCalledWith("抖音归档环境未就绪：抖音组件未安装");
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
  it("仅在实时抖音匿名能力可用时通过中性 API 创建抖音任务", async () => {
    mocks.api.douyinRuntime!.mockResolvedValue({
      platform: "douyin",
      mode: "anonymous",
      available: true,
      state: "ready",
      message: "匿名解析环境已就绪，仅支持公开可访问作品"
    });
    const wrapper = mountPage();
    await flushPromises();
    const panel = wrapper.findComponent(ArchiveTaskPanel);
    panel.vm.$emit("update:inputUrl", "https://v.douyin.com/PrWnsoVIg78/");
    panel.vm.$emit("submit");
    await flushPromises();

    expect(mocks.api.create).toHaveBeenCalledWith(
      { url: "https://v.douyin.com/PrWnsoVIg78/", platform: "douyin" },
      expect.any(AbortSignal)
    );
    expect(mocks.api.douyinRuntime).toHaveBeenCalledTimes(2);
  });
  it("网页端无需安装入口，存在受信任能力目录时允许首次归档触发自动安装", async () => {
    mocks.api.douyinRuntime!.mockResolvedValue({
      platform: "douyin",
      mode: "anonymous",
      available: false,
      state: "not-installed",
      installMode: "automatic",
      message: "首次归档时会自动安装抖音匿名能力"
    });
    const wrapper = mountPage();
    await flushPromises();
    const panel = wrapper.findComponent(ArchiveTaskPanel);
    expect(panel.props("douyinCanAutoInstall")).toBe(true);
    panel.vm.$emit("update:inputUrl", "https://v.douyin.com/PrWnsoVIg78/");
    panel.vm.$emit("submit");
    await flushPromises();

    expect(mocks.api.create).toHaveBeenCalledWith(
      { url: "https://v.douyin.com/PrWnsoVIg78/", platform: "douyin" },
      expect.any(AbortSignal)
    );
  });
  it("取消活动获取任务后采用服务端终态并提示用户", async () => {
    mocks.api.create!.mockResolvedValue(taskFixture({ status: "running", stage: "downloading", progress: 45 }));
    mocks.api.cancel!.mockResolvedValue(
      taskFixture({ status: "failed", stage: "failed", errorCode: "ARCHIVE_CANCELLED", error: "任务已取消" })
    );
    const wrapper = mountPage();
    await flushPromises();
    const panel = wrapper.findComponent(ArchiveTaskPanel);
    panel.vm.$emit("update:inputUrl", "https://www.xiaohongshu.com/explore/123");
    panel.vm.$emit("submit");
    await flushPromises();

    panel.vm.$emit("cancel");
    await flushPromises();

    expect(mocks.api.cancel).toHaveBeenCalledWith("task-123", expect.any(AbortSignal));
    expect(panel.props("task")).toMatchObject({ status: "failed", errorCode: "ARCHIVE_CANCELLED" });
    expect(mocks.message.info).toHaveBeenCalledWith("获取任务已取消");
    expect(panel.props("cancelling")).toBe(false);
  });
  it("取消请求与任务完成竞争时以服务端完成态为准并加载归档", async () => {
    const completed = taskFixture({ status: "completed", stage: "completed", archiveId: "archive-123", progress: 100 });
    mocks.api.create!.mockResolvedValue(taskFixture({ status: "running", stage: "downloading", progress: 45 }));
    mocks.api.cancel!.mockResolvedValue(completed);
    mocks.api.task!.mockResolvedValue(completed);
    const wrapper = mountPage();
    await flushPromises();
    const panel = wrapper.findComponent(ArchiveTaskPanel);
    panel.vm.$emit("update:inputUrl", "https://www.xiaohongshu.com/explore/123");
    panel.vm.$emit("submit");
    await flushPromises();

    panel.vm.$emit("cancel");
    await flushPromises();

    expect(mocks.api.detail).toHaveBeenCalledWith("archive-123", expect.any(AbortSignal));
    expect(wrapper.findComponent(XhsResultPanel).props("current")?.id).toBe("archive-123");
    expect(mocks.message.info).not.toHaveBeenCalledWith("获取任务已取消");
  });
  it("提交阶段取消被拒绝时重新读取任务状态", async () => {
    const committing = taskFixture({ status: "running", stage: "archiving", progress: 92 });
    mocks.api.create!.mockResolvedValue(taskFixture({ status: "running", stage: "downloading", progress: 90 }));
    mocks.api.cancel!.mockRejectedValue(
      new ApiRequestError("文件正在原子提交，请等待完成后再操作", {
        code: "ARCHIVE_COMMIT_IN_PROGRESS",
        status: 409
      })
    );
    mocks.api.task!.mockResolvedValue(committing);
    const wrapper = mountPage();
    await flushPromises();
    const panel = wrapper.findComponent(ArchiveTaskPanel);
    panel.vm.$emit("update:inputUrl", "https://www.xiaohongshu.com/explore/123");
    panel.vm.$emit("submit");
    await flushPromises();

    panel.vm.$emit("cancel");
    await flushPromises();

    expect(mocks.message.error).toHaveBeenCalledWith(expect.stringContaining("文件正在原子提交"));
    expect(panel.props("task")).toMatchObject({ status: "running", stage: "archiving" });
    expect(mocks.api.task).toHaveBeenCalledWith("task-123", expect.any(AbortSignal));
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
