// @vitest-environment happy-dom
import { defineComponent } from "vue";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";
import { NCheckbox, NProgress, NSelect } from "naive-ui";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultArchiveWatermarkSettings } from "@toolbox/shared/archive";
import Editor from "./ArchiveImageBatchEditor.vue";
import Controls from "./ArchiveWatermarkControls.vue";
import Sandbox from "./ArchiveWatermarkSandbox.vue";
import Preview from "./ArchiveWatermarkPreview.vue";
import { archiveFixture, listFixture } from "./__tests__/fixtures";
const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  cancel: vi.fn(),
  selectLibraryWatermark: vi.fn(),
  watermarkLibrary: vi.fn(),
  uploadWatermark: vi.fn(),
  musicList: vi.fn(),
  confirm: vi.fn(),
  guard: vi.fn()
}));
vi.mock("./content-api", () => ({ contentArchiveApi: { detail: mocks.detail } }));
vi.mock("./video-edit-api", () => ({ videoEditApi: mocks }));
vi.mock("../audio-library/integrations/music", () => ({ archiveMusicLibraryApi: { list: mocks.musicList } }));
vi.mock("../../shared/composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
vi.mock("vue-router", () => ({ onBeforeRouteLeave: (guard: unknown) => mocks.guard(guard) }));
const wrappers: VueWrapper[] = [];
const photo = () => {
  const item = archiveFixture({ id: "image-one", type: "image" });
  item.media = [0, 1].map((index) => ({ ...item.media[0], kind: "image", id: `image-${index}`, index }));
  return item;
};
const library = { id: "library12345", name: "品牌logo", width: 40, height: 20, previewUrl: "/logo.png", revision: 1 };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.detail.mockResolvedValue(photo());
  mocks.list.mockResolvedValue([]);
  mocks.watermarkLibrary.mockResolvedValue([library]);
  mocks.selectLibraryWatermark.mockResolvedValue({ id: "draft1234567" });
  mocks.create.mockResolvedValue({ id: "job-123" });
  mocks.get.mockResolvedValue({ status: "completed", progress: 100, message: "已保存" });
  mocks.musicList.mockResolvedValue({
    items: [{ id: "music-one", title: "歌曲一", available: true, revision: 2, duration: 60, audioUrl: "/music.mp3" }],
    total: 1
  });
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function setup() {
  const modal = defineComponent({ props: { show: Boolean }, template: '<section v-if="show"><slot /></section>' });
  const wrapper = mount(Editor, {
    global: {
      stubs: {
        teleport: true,
        Modal: modal,
        NModal: modal,
        ArchiveWatermarkControls: true,
        ArchiveMusicRange: true
      }
    }
  });
  wrappers.push(wrapper);
  return wrapper;
}
async function click(wrapper: VueWrapper, label: string) {
  await wrapper
    .findAll("button")
    .find((button) => button.text() === label)!
    .trigger("click");
  await flushPromises();
}
describe("图文批量编辑窗口", () => {
  it("可选择每条作品自己的原配乐，不要求从音乐库选择相同歌曲", async () => {
    const item = photo();
    item.media.push({ ...item.media[0], id: "source_music123", kind: "audio", checksum: "b".repeat(64) });
    mocks.detail.mockResolvedValue(item);
    const wrapper = setup();
    await wrapper.vm.show("audio", listFixture([item]).items);
    const select = wrapper
      .findAllComponents(NSelect)
      .find((entry) => entry.attributes("aria-label") === "批量图文背景音乐")!;
    select.vm.$emit("update:value", "__original__");
    await flushPromises();
    expect(wrapper.text()).toContain("逐条使用各作品已归档的原配乐");
    await click(wrapper, "开始批量保存 1 条");
    expect(mocks.create).toHaveBeenCalledWith(
      item.id,
      item.media[0].id,
      expect.objectContaining({ sourceMusicId: "source_music123", sourceMusicChecksum: "b".repeat(64) }),
      expect.any(AbortSignal)
    );
  });
  it.each(["preview", "save"] as const)(
    "%s 的进度显示整数百分比，不展示长小数，也不提前四舍五入到 100%%",
    async (mode) => {
      vi.useFakeTimers();
      mocks.get.mockResolvedValue({ status: "running", progress: 99.999999999, message: "生成中" });
      const wrapper = setup();
      await wrapper.vm.show("audio", listFixture([photo()]).items);
      wrapper
        .findAllComponents(NSelect)
        .find((entry) => entry.attributes("aria-label") === "批量图文背景音乐")!
        .vm.$emit("update:value", "music-one");
      await flushPromises();
      await click(wrapper, mode === "preview" ? "预览效果" : "开始批量保存 1 条");
      expect(wrapper.findAllComponents(NProgress).some((progress) => progress.props("percentage") === 99)).toBe(true);
      expect(wrapper.text()).not.toContain("99.999999999");
      expect(wrapper.text()).toContain("99%");
    }
  );
  it("左侧 15 秒示意时间不覆盖真实时长，拖动终点和选中关键帧均更新正确位置", async () => {
    const wrapper = setup();
    await wrapper.vm.show("watermark", listFixture([photo()]).items);
    const sandbox = wrapper.getComponent(Sandbox),
      controls = wrapper.getComponent(Controls);
    expect(sandbox.props()).toMatchObject({ width: 720, height: 1280 });
    expect(sandbox.getComponent(Preview).props("virtualVideo")?.duration).toBe(15);
    expect(controls.props("duration")).toBe(6);
    const settings = defaultArchiveWatermarkSettings();
    settings.motion.type = "linear";
    settings.motion.from = { x: 0.1, y: 0.2 };
    settings.motion.to = { x: 0.8, y: 0.9 };
    controls.vm.$emit("update:settings", settings);
    controls.vm.$emit("update:selectedPoint", "to");
    sandbox.vm.$emit("move", { x: 0.4, y: 0.5 });
    await flushPromises();
    expect(controls.props("settings").motion).toMatchObject({ from: { x: 0.1, y: 0.2 }, to: { x: 0.4, y: 0.5 } });
    settings.motion.type = "keyframes";
    settings.motion.keyframes = [
      { timeSeconds: 0, x: 0.1, y: 0.2 },
      { timeSeconds: 6, x: 0.8, y: 0.9 }
    ];
    controls.vm.$emit("update:settings", settings);
    controls.vm.$emit("update:selectedFrame", 1);
    sandbox.vm.$emit("move", { x: 0.7, y: 0.3 });
    await flushPromises();
    expect(controls.props("settings").motion.keyframes).toEqual([
      { timeSeconds: 0, x: 0.1, y: 0.2 },
      { timeSeconds: 6, x: 0.7, y: 0.3 }
    ]);
    controls.vm.$emit("seek", 33);
    await flushPromises();
    expect(controls.props("time")).toBe(33);
    expect(controls.props("duration")).toBe(6);
    expect(controls.props("settings").endSeconds).toBeNull();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("本地水印使用真实宽高比例，替换后忽略旧图片迟到的元数据并释放 Object URL", async () => {
    const images: HTMLImageElement[] = [];
    vi.stubGlobal("Image", function () {
      const image = document.createElement("img");
      images.push(image);
      return image;
    });
    vi.spyOn(URL, "createObjectURL").mockReturnValueOnce("blob:first-logo").mockReturnValueOnce("blob:second-logo");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const wrapper = setup();
    await wrapper.vm.show("watermark", listFixture([photo()]).items);
    const controls = wrapper.getComponent(Controls);
    controls.vm.$emit("upload", new File(["one"], "first.png"));
    const lateLoad = images[0].onload!;
    controls.vm.$emit("upload", new File(["two"], "second.png"));
    Object.defineProperties(images[1], { naturalWidth: { value: 200 }, naturalHeight: { value: 50 } });
    lateLoad.call(images[0], new Event("load"));
    await flushPromises();
    expect(controls.props("asset")).toBeUndefined();
    images[1].dispatchEvent(new Event("load"));
    await flushPromises();
    expect(controls.props("asset")).toMatchObject({ width: 200, height: 50, url: "blob:second-logo" });
    expect(wrapper.getComponent(Sandbox).props("asset")).toMatchObject({ width: 200, height: 50 });
    expect(revoke).toHaveBeenCalledWith("blob:first-logo");
    expect(mocks.uploadWatermark).not.toHaveBeenCalled();
  });
  it("每条图文均可在保存前预览完整效果，关闭暂停播放，改动配方后重新生成", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const first = photo(),
      second = { ...photo(), id: "image-two", title: "第二条图文" };
    second.media = [...second.media, { ...second.media[0], id: "image-third", index: 2 }];
    mocks.detail.mockImplementation(async (id: string) => (id === first.id ? first : second));
    mocks.get.mockResolvedValue({
      status: "completed",
      progress: 100,
      message: "完整效果已生成",
      previewUrl: "/full-preview.mp4"
    });
    const wrapper = setup();
    await wrapper.vm.show("audio", listFixture([first, second]).items);
    wrapper
      .findAllComponents(NSelect)
      .find((entry) => entry.attributes("aria-label") === "批量图文背景音乐")!
      .vm.$emit("update:value", "music-one");
    await flushPromises();
    const rows = () => wrapper.findAll(".image-batch-results article");
    expect(rows()).toHaveLength(2);
    expect(rows().every((row) => row.text().includes("预览效果"))).toBe(true);
    await rows()[1]
      .findAll("button")
      .find((button) => button.text() === "预览效果")!
      .trigger("click");
    await flushPromises();
    expect(mocks.create.mock.calls[0].slice(0, 2)).toEqual([second.id, "image-0"]);
    expect(mocks.create.mock.calls[0][2]).toMatchObject({
      mode: "preview",
      previewFullLength: true,
      slideshow: { images: [{ id: "image-0" }, { id: "image-1" }, { id: "image-third" }] }
    });
    expect(wrapper.get("video.image-batch-video").attributes("src")).toContain("/full-preview.mp4");
    expect(rows()[1].text()).toContain("视频时长 9.00 秒");
    expect(wrapper.emitted("updated")).toBeUndefined();
    expect(wrapper.emitted("finished")).toBeUndefined();
    Object.defineProperty(wrapper.get("video").element, "duration", { configurable: true, value: 9.04 });
    await wrapper.get("video").trigger("loadedmetadata");
    expect(wrapper.text()).toContain("本条视频时长 9.04 秒");
    await click(wrapper, "关闭预览");
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(wrapper.find("video.image-batch-video").exists()).toBe(false);
    await rows()[1]
      .findAll("button")
      .find((button) => button.text() === "预览效果")!
      .trigger("click");
    await flushPromises();
    expect(mocks.create).toHaveBeenCalledOnce();
    await click(wrapper, "关闭预览");
    wrapper.findComponent({ name: "ArchiveMusicRange" }).vm.$emit("update:start", 10);
    await flushPromises();
    await rows()[1]
      .findAll("button")
      .find((button) => button.text() === "预览效果")!
      .trigger("click");
    await flushPromises();
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create.mock.lastCall?.[2].settings.musicStartSeconds).toBe(10);
    const oldVideo = wrapper.get("video").element;
    await click(wrapper, "关闭预览");
    await rows()[0]
      .findAll("button")
      .find((button) => button.text() === "预览效果")!
      .trigger("click");
    await flushPromises();
    oldVideo.dispatchEvent(new Event("error"));
    await flushPromises();
    expect(wrapper.get("video").attributes("src")).toContain("/full-preview.mp4");
    expect(wrapper.text()).not.toContain("加载失败");
  });
  it("水印预览使用当前参数且不自动保存，预览期间禁用批量保存，失败后可重试", async () => {
    const wrapper = setup();
    await wrapper.vm.show("watermark", listFixture([photo()]).items);
    wrapper.getComponent(Controls).vm.$emit("selectLibrary", library.id);
    await flushPromises();
    let finish!: (value: unknown) => void;
    mocks.get.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "预览效果")!
      .trigger("click");
    await flushPromises();
    expect(mocks.create.mock.calls[0][2]).toMatchObject({
      mode: "preview",
      watermark: { settings: { endSeconds: null } }
    });
    expect(
      wrapper
        .findAll("button")
        .find((button) => button.text() === "开始批量保存 1 条")!
        .attributes("disabled")
    ).toBeDefined();
    expect(wrapper.getComponent(Controls).props("disabled")).toBe(true);
    finish({ status: "failed", progress: 0, message: "媒体暂时不可用" });
    await flushPromises();
    expect(wrapper.text()).toContain("媒体暂时不可用");
    expect(wrapper.emitted("updated")).toBeUndefined();
    mocks.get.mockResolvedValueOnce({
      status: "completed",
      progress: 100,
      message: "预览完成",
      previewUrl: "/watermark-preview.mp4"
    });
    await click(wrapper, "重新预览");
    expect(wrapper.get("video").attributes("src")).toContain("/watermark-preview.mp4");
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });
  it("水印与背景音乐可在同一轮一次提交，所有选中项使用同一配方", async () => {
    const wrapper = setup();
    await wrapper.vm.show("watermark", listFixture([photo()]).items);
    wrapper.getComponent(Controls).vm.$emit("selectLibrary", library.id);
    await flushPromises();
    wrapper
      .findAllComponents(NCheckbox)
      .find((entry) => entry.text().includes("同时添加背景音乐"))!
      .vm.$emit("update:checked", true);
    await flushPromises();
    wrapper
      .findAllComponents(NSelect)
      .find((entry) => entry.attributes("aria-label") === "批量图文背景音乐")!
      .vm.$emit("update:value", "music-one");
    await flushPromises();
    await click(wrapper, "开始批量保存 1 条");
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create.mock.calls[0][2]).toMatchObject({
      musicId: "music-one",
      watermark: { draftId: "draft1234567" },
      slideshow: { images: [{ id: "image-0" }, { id: "image-1" }] }
    });
  });
  it("从库选水印并统一保存，自动结束使用 null；完成可打开归档", async () => {
    const wrapper = setup();
    await wrapper.vm.show("watermark", listFixture([photo()]).items);
    await flushPromises();
    expect(wrapper.text()).toContain("原图保留");
    wrapper.getComponent(Controls).vm.$emit("selectLibrary", library.id);
    await flushPromises();
    expect(wrapper.getComponent(Controls).props("asset")).toMatchObject({ width: 40, height: 20 });
    wrapper.getComponent(Controls).vm.$emit("update:settings", { ...defaultArchiveWatermarkSettings(), opacity: 40 });
    await click(wrapper, "开始批量保存 1 条");
    expect(mocks.create.mock.calls[0][2]).toMatchObject({
      slideshow: { secondsPerImage: 3, aspect: "portrait" },
      watermark: { draftId: "draft1234567", settings: { opacity: 40, endSeconds: null } }
    });
    expect(wrapper.emitted("updated")).toHaveLength(1);
    expect(wrapper.emitted("finished")).toHaveLength(1);
    await click(wrapper, "查看归档");
    expect(wrapper.emitted("openArchive")).toEqual([["image-one"]]);
  });
  it("选择配乐支持素材版本、音量、循环与选段起点，保留已有水印语义", async () => {
    const wrapper = setup();
    await wrapper.vm.show("audio", listFixture([photo()]).items);
    expect(mocks.musicList).toHaveBeenCalledWith(expect.objectContaining({ view: "music" }), expect.any(AbortSignal));
    const select = wrapper
      .findAllComponents(NSelect)
      .find((entry) => entry.attributes("aria-label") === "批量图文背景音乐")!;
    select.vm.$emit("update:value", "music-one");
    await flushPromises();
    const range = wrapper.findComponent({ name: "ArchiveMusicRange" });
    expect(range.props("videoDuration")).toBe(6);
    range.vm.$emit("update:start", 12);
    await flushPromises();
    await click(wrapper, "开始批量保存 1 条");
    expect(mocks.create.mock.calls[0][2]).toMatchObject({
      musicId: "music-one",
      musicRevision: 2,
      settings: { musicVolume: 20, musicStartSeconds: 12, loop: true }
    });
    expect(mocks.create.mock.calls[0][2].watermark).toBeUndefined();
  });
  it("刷新页面或离开有提醒，提交回执不明需要明确确认后跳过", async () => {
    const wrapper = setup();
    await wrapper.vm.show("audio", listFixture([photo()]).items);
    wrapper
      .findAllComponents(NSelect)
      .find((entry) => entry.attributes("aria-label") === "批量图文背景音乐")!
      .vm.$emit("update:value", "music-one");
    mocks.create.mockRejectedValueOnce(new Error("网络断开"));
    await flushPromises();
    await click(wrapper, "开始批量保存 1 条");
    expect(wrapper.text()).toContain("尚未确认");
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    mocks.confirm.mockResolvedValueOnce(false);
    await click(wrapper, "跳过待核对项并继续");
    expect(wrapper.text()).toContain("跳过待核对项并继续");
    mocks.confirm.mockResolvedValueOnce(true);
    await click(wrapper, "跳过待核对项并继续");
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain("已跳过待核对项");
  });
});
