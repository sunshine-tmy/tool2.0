// @vitest-environment happy-dom
import { defineComponent, onMounted, onUnmounted, reactive } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { archiveFixture } from "./__tests__/fixtures";
import Page from "./ArchiveVideoEditorPage.vue";
const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  push: vi.fn(),
  canLeave: vi.fn(),
  editorMounted: vi.fn(),
  editorUnmounted: vi.fn(),
  leaveGuard: vi.fn(),
  updateGuard: vi.fn(),
  route: {
    params: { itemId: "archive-123", mediaId: "video-123" },
    query: { returnTo: "/tools/media-archive?editorReturn=1&page=3", panel: undefined as string | string[] | undefined }
  }
}));
vi.mock("./content-api", () => ({ contentArchiveApi: { detail: mocks.detail } }));
vi.mock("vue-router", () => ({
  useRoute: () => reactive(mocks.route),
  useRouter: () => ({ push: mocks.push }),
  onBeforeRouteLeave: (guard: unknown) => mocks.leaveGuard(guard),
  onBeforeRouteUpdate: (guard: unknown) => mocks.updateGuard(guard)
}));
const Editor = defineComponent({
  name: "ArchiveAudioEditor",
  props: { item: Object, mediaId: String, initialPanel: String, embedded: Boolean },
  emits: ["update:show", "saved"],
  setup(_props, { expose }) {
    expose({ canLeave: mocks.canLeave });
    onMounted(mocks.editorMounted);
    onUnmounted(mocks.editorUnmounted);
    return () => null;
  }
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.canLeave.mockResolvedValue(true);
  const item = archiveFixture();
  item.media[0].kind = "video";
  item.media[0].id = "video-123";
  mocks.detail.mockResolvedValue(item);
  mocks.route.params = { itemId: "archive-123", mediaId: "video-123" };
  mocks.route.query.returnTo = "/tools/media-archive?editorReturn=1&page=3";
  mocks.route.query.panel = undefined;
});
function setup() {
  return mount(Page, {
    global: {
      stubs: { ToolLayout: { template: "<main><slot /></main>" }, ToolPageHeader: true, ArchiveAudioEditor: Editor }
    }
  });
}
describe("归档视频编辑页面", () => {
  it.each([
    [undefined, "watermark"],
    ["watermark", "watermark"],
    ["audio", "audio"],
    ["invalid", "watermark"],
    [["audio", "watermark"], "watermark"]
  ])("面板参数 %s 打开 %s，始终使用完整编辑页面", async (panel, expected) => {
    mocks.route.query.panel = panel;
    const wrapper = setup();
    await flushPromises();
    expect(wrapper.getComponent(Editor).props()).toMatchObject({ initialPanel: expected, embedded: true });
    wrapper.unmount();
  });
  it("同一视频切换面板先检查未保存修改，通过后重建编辑器而不重复加载作品", async () => {
    const wrapper = setup();
    await flushPromises();
    expect(mocks.editorMounted).toHaveBeenCalledOnce();
    mocks.canLeave.mockResolvedValueOnce(false);
    expect(await mocks.updateGuard.mock.calls[0][0]()).toBe(false);
    expect(mocks.editorUnmounted).not.toHaveBeenCalled();
    expect(await mocks.updateGuard.mock.calls[0][0]()).toBe(true);
    reactive(mocks.route).query.panel = "audio";
    await flushPromises();
    expect(mocks.editorUnmounted).toHaveBeenCalledOnce();
    expect(mocks.editorMounted).toHaveBeenCalledTimes(2);
    expect(wrapper.getComponent(Editor).props("initialPanel")).toBe("audio");
    expect(mocks.detail).toHaveBeenCalledOnce();
    wrapper.unmount();
  });
  it("只加载指定归档媒体，返回原筛选页；路由离开复用未保存确认且仅调用一次", async () => {
    const wrapper = setup();
    await flushPromises();
    const editor = wrapper.findComponent(Editor);
    expect(editor.props("mediaId")).toBe("video-123");
    mocks.canLeave.mockResolvedValueOnce(false);
    expect(await mocks.leaveGuard.mock.calls[0][0]()).toBe(false);
    expect(mocks.canLeave).toHaveBeenCalledOnce();
    editor.vm.$emit("update:show", false);
    await flushPromises();
    expect(mocks.push).toHaveBeenCalledWith("/tools/media-archive?editorReturn=1&page=3");
    wrapper.unmount();
    expect((mocks.detail.mock.calls[0][1] as AbortSignal).aborted).toBe(true);
  });
  it("媒体已删除显示错误；返回地址只接受归档列表，不能跳往任意网站", async () => {
    mocks.route.query.returnTo = "https://evil.test";
    mocks.detail.mockResolvedValue(archiveFixture());
    const wrapper = setup();
    await flushPromises();
    expect(wrapper.text()).toContain("该视频不存在");
    const buttons = wrapper.findAll("button");
    await buttons.find((button) => button.text() === "返回内容归档")!.trigger("click");
    expect(mocks.push).toHaveBeenCalledWith("/tools/media-archive");
    wrapper.unmount();
  });
});
