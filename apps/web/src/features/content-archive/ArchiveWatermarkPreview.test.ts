// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ARCHIVE_WATERMARK_BOUNCE_STYLES, defaultArchiveWatermarkSettings } from "@toolbox/shared/archive";
import Preview from "./ArchiveWatermarkPreview.vue";
afterEach(() => vi.restoreAllMocks());
describe("水印画面坐标及生命周期", () => {
  it("虚拟画布共用真实视频的轨迹及拖动坐标，但不报告 15 秒为原片时长", async () => {
    const bounds = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue(new DOMRect(0, 0, 400, 400));
    const settings = defaultArchiveWatermarkSettings();
    settings.motion.type = "linear";
    settings.motion.from = { x: 0, y: 0 };
    settings.motion.to = { x: 1, y: 1 };
    settings.motion.periodSeconds = 4;
    settings.startSeconds = 2;
    settings.endSeconds = 6;
    const virtual = { width: 200, height: 100, duration: 15, currentTime: 4, paused: true };
    const wrapper = mount(Preview, {
      props: {
        active: true,
        disabled: false,
        settings,
        virtualVideo: virtual,
        asset: { width: 100, height: 50, url: "/logo.png" }
      }
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".watermark-viewport").attributes("style")).toContain("top: 100px");
    expect(wrapper.get(".watermark-viewport").attributes("style")).toContain("height: 200px");
    expect(wrapper.get(".watermark-handle").attributes("style")).toContain("left: 42.5%");
    expect(wrapper.get(".watermark-path polyline").attributes("points")).not.toMatch(/NaN|Infinity/);
    expect(wrapper.emitted("duration")).toBeUndefined();
    const measured = bounds.mock.calls.length;
    await wrapper.setProps({ virtualVideo: { ...virtual, currentTime: 5 } });
    expect(bounds.mock.calls.length).toBe(measured); // 播放每帧仅更新位置，不重建测量和观察器。
    const handle = wrapper.get(".watermark-handle");
    await handle.trigger("pointerdown", { pointerId: 1, clientX: 100, clientY: 100 });
    await handle.trigger("pointermove", { pointerId: 1, clientX: 10000, clientY: -10000 });
    expect(wrapper.emitted("move")?.at(-1)).toEqual([{ x: 1, y: 0 }]);
    expect(wrapper.emitted("pause")).toHaveLength(1);
    await wrapper.setProps({ virtualVideo: { ...virtual, currentTime: 7 } });
    expect(wrapper.find(".watermark-handle").exists()).toBe(false);
    await wrapper.setProps({ virtualVideo: undefined });
    expect(wrapper.find(".watermark-viewport").exists()).toBe(false);
    wrapper.unmount();
  });
  it("切换视频引用后清除旧坐标，忽略旧元素迟到事件并释放新旧监听", async () => {
    const first = document.createElement("video"),
      second = document.createElement("video");
    for (const video of [first, second]) {
      Object.defineProperties(video, {
        videoWidth: { value: 200 },
        videoHeight: { value: 100 },
        duration: { value: video === first ? 9 : NaN, configurable: true },
        paused: { value: true }
      });
      vi.spyOn(video, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 400, 200));
    }
    const firstRemove = vi.spyOn(first, "removeEventListener"),
      secondRemove = vi.spyOn(second, "removeEventListener");
    const settings = defaultArchiveWatermarkSettings();
    settings.motion.type = "bounce";
    settings.motion.bounceStyle = "cross";
    const wrapper = mount(Preview, {
      props: { active: true, disabled: false, settings, asset: { width: 100, height: 50, url: "/logo.png" } }
    });
    try {
      await wrapper.setProps({ video: first });
      expect(wrapper.find(".watermark-path").exists()).toBe(true);
      await wrapper.setProps({ video: second });
      expect(wrapper.find(".watermark-viewport").exists()).toBe(false);
      const calls = wrapper.emitted("duration")?.length;
      first.dispatchEvent(new Event("loadedmetadata"));
      await wrapper.vm.$nextTick();
      expect(wrapper.emitted("duration")?.length).toBe(calls);
      for (const invalidDuration of [0, Infinity]) {
        Object.defineProperty(second, "duration", { value: invalidDuration });
        second.dispatchEvent(new Event("durationchange"));
        await wrapper.vm.$nextTick();
        expect(wrapper.find(".watermark-viewport").exists()).toBe(false);
      }
      Object.defineProperty(second, "duration", { value: 6 });
      second.dispatchEvent(new Event("loadedmetadata"));
      await wrapper.vm.$nextTick();
      expect(wrapper.emitted("duration")?.at(-1)).toEqual([6]);
      expect(wrapper.find(".watermark-path").exists()).toBe(true);
    } finally {
      wrapper.unmount();
    }
    for (const remove of [firstRemove, secondRemove])
      for (const name of ["loadedmetadata", "durationchange", "loadstart", "emptied", "error"])
        expect(remove).toHaveBeenCalledWith(name, expect.any(Function));
  });
  it.each(ARCHIVE_WATERMARK_BOUNCE_STYLES.filter((style) => style.value !== "standard"))(
    "切换到 $label 时等待新视频元数据，不以 NaN 时长计算轨迹，加载后恢复预览",
    async ({ value }) => {
      const video = document.createElement("video");
      Object.defineProperties(video, {
        videoWidth: { value: 200 },
        videoHeight: { value: 100 },
        duration: { value: NaN, configurable: true },
        paused: { value: true }
      });
      vi.spyOn(video, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 400, 200));
      const settings = defaultArchiveWatermarkSettings();
      settings.motion.type = "bounce";
      settings.motion.bounceStyle = value;
      const errors: unknown[] = [];
      const wrapper = mount(Preview, {
        props: { active: false, disabled: false, settings, asset: { width: 100, height: 50, url: "/logo.png" } },
        global: { config: { errorHandler: (error) => errors.push(error) } }
      });
      try {
        await wrapper.setProps({ video });
        await wrapper.setProps({ active: true });
        expect(errors).toEqual([]);
        expect(wrapper.find(".watermark-path").exists()).toBe(false);
        Object.defineProperty(video, "duration", { value: 9 });
        video.dispatchEvent(new Event("loadedmetadata"));
        await wrapper.vm.$nextTick();
        expect(wrapper.get(".watermark-path polyline").attributes("points")).not.toMatch(/NaN|Infinity/);
        expect(wrapper.find(".watermark-handle").exists()).toBe(true);
        video.dispatchEvent(new Event("emptied"));
        await wrapper.vm.$nextTick();
        expect(wrapper.find(".watermark-viewport").exists()).toBe(false);
        video.dispatchEvent(new Event("loadedmetadata"));
        await wrapper.vm.$nextTick();
        expect(wrapper.find(".watermark-path").exists()).toBe(true);
      } finally {
        wrapper.unmount();
      }
    }
  );
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
