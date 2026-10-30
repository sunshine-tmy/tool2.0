// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultArchiveWatermarkSettings } from "@toolbox/shared/archive";
import Preview from "./ArchiveWatermarkPreview.vue";
afterEach(() => vi.restoreAllMocks());
describe("水印画面坐标及生命周期", () => {
  it("只在实际画面定位，避开上下黑边，拖动钳制边界，移除时释放监听", async () => {
    const video = document.createElement("video");
    Object.defineProperties(video, {
      videoWidth: { value: 200 },
      videoHeight: { value: 100 },
      duration: { value: 10 },
      paused: { value: true }
    });
    vi.spyOn(video, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 400,
      width: 400,
      height: 400,
      toJSON: () => ({})
    });
    vi.spyOn(video, "pause").mockImplementation(() => undefined);
    const remove = vi.spyOn(video, "removeEventListener");
    const wrapper = mount(Preview, {
      props: {
        active: true,
        disabled: false,
        settings: defaultArchiveWatermarkSettings(),
        asset: { width: 100, height: 50, url: "/logo.png" }
      }
    });
    await wrapper.setProps({ video });
    expect(wrapper.get(".watermark-viewport").attributes("style")).toContain("top: 100px");
    expect(wrapper.get(".watermark-viewport").attributes("style")).toContain("height: 200px");
    const handle = wrapper.get(".watermark-handle");
    await handle.trigger("pointerdown", { pointerId: 1, clientX: 100, clientY: 100 });
    await handle.trigger("pointermove", { pointerId: 1, clientX: 10000, clientY: -10000 });
    expect(wrapper.emitted("move")!.at(-1)).toEqual([{ x: 1, y: 0 }]);
    await handle.trigger("pointerup", { pointerId: 1 });
    await handle.trigger("keydown", { key: "ArrowLeft" });
    expect(wrapper.emitted("move")!.at(-1)![0]).toMatchObject({ x: 0.96 });
    wrapper.unmount();
    expect(remove).toHaveBeenCalledWith("timeupdate", expect.any(Function));
  });
  it("拖动进度条立即按视频绝对时间更新，范围之外隐藏水印", async () => {
    const video = document.createElement("video");
    Object.defineProperties(video, {
      videoWidth: { value: 200 },
      videoHeight: { value: 100 },
      duration: { value: 10 }
    });
    vi.spyOn(video, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 100,
      width: 200,
      height: 100,
      toJSON: () => ({})
    });
    const settings = defaultArchiveWatermarkSettings();
    settings.startSeconds = 2;
    settings.endSeconds = 6;
    settings.motion.type = "linear";
    settings.motion.from = { x: 0, y: 0 };
    settings.motion.to = { x: 1, y: 1 };
    settings.motion.periodSeconds = 4;
    const wrapper = mount(Preview, {
      props: { active: true, disabled: false, settings, asset: { width: 100, height: 50, url: "/logo.png" } }
    });
    await wrapper.setProps({ video });
    expect(wrapper.find(".watermark-handle").exists()).toBe(false);
    video.currentTime = 4;
    video.dispatchEvent(new Event("seeked"));
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".watermark-handle").attributes("style")).toContain("left: 42.5%");
    video.currentTime = 7;
    video.dispatchEvent(new Event("timeupdate"));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".watermark-handle").exists()).toBe(false);
    wrapper.unmount();
  });
});
