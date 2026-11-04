// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { toRaw } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NSlider } from "naive-ui";
import { defaultArchiveWatermarkSettings } from "@toolbox/shared/archive";
import Sandbox from "./ArchiveWatermarkSandbox.vue";
import Preview from "./ArchiveWatermarkPreview.vue";
let frames: Map<number, FrameRequestCallback>, id: number;
const wrappers: VueWrapper[] = [];
beforeEach(() => {
  frames = new Map();
  id = 0;
  vi.spyOn(performance, "now").mockReturnValue(0);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (key: number) => frames.delete(key));
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function setup() {
  const wrapper = mount(Sandbox, {
    props: {
      active: true,
      disabled: false,
      width: 720,
      height: 1280,
      settings: defaultArchiveWatermarkSettings(),
      asset: { width: 200, height: 50, url: "/logo.png" }
    }
  });
  wrappers.push(wrapper);
  return wrapper;
}
async function frame(time: number) {
  const callbacks = [...frames.values()];
  frames.clear();
  callbacks.forEach((callback) => callback(time));
  await flushPromises();
}
describe("15 秒虚拟水印视频", () => {
  it("从零播放完整 15 秒，时间轴可拖动，结束停止且不改保存配方", async () => {
    const wrapper = setup();
    const original = structuredClone(toRaw(wrapper.props("settings")));
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "播放轨迹")!
      .trigger("click");
    await frame(1000);
    expect(wrapper.getComponent(Preview).props("virtualVideo")).toMatchObject({
      duration: 15,
      currentTime: 1,
      paused: false
    });
    await frame(15100);
    expect(frames.size).toBe(0);
    expect(wrapper.getComponent(Preview).props("virtualVideo")).toMatchObject({ currentTime: 15, paused: true });
    expect(wrapper.props("settings")).toEqual(original);
    expect(wrapper.emitted("time")?.at(-1)).toEqual([15]);
    wrapper.getComponent(NSlider).vm.$emit("update:value", 4.5);
    await flushPromises();
    expect(wrapper.getComponent(Preview).props("virtualVideo")?.currentTime).toBe(4.5);
    wrapper.unmount();
  });
  it("远处关键帧切到对应的 15 秒示意窗口，复用终点和关键帧移动事件", async () => {
    const wrapper = setup();
    wrapper.vm.seek(33);
    await flushPromises();
    expect(wrapper.getComponent(Preview).props("virtualVideo")).toMatchObject({
      duration: 33,
      currentTime: 33,
      paused: true
    });
    expect(wrapper.getComponent(NSlider).props("value")).toBe(15);
    wrapper.getComponent(Preview).vm.$emit("move", { x: 0.4, y: 0.7 });
    expect(wrapper.emitted("move")).toEqual([[{ x: 0.4, y: 0.7 }]]);
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "回到 0 秒")!
      .trigger("click");
    expect(wrapper.getComponent(Preview).props("virtualVideo")).toMatchObject({ duration: 15, currentTime: 0 });
    wrapper.unmount();
  });
  it("收起窗口、禁用、切到后台与卸载时释放动画，不继续修改播放时间", async () => {
    const wrapper = setup();
    const play = () =>
      wrapper
        .findAll("button")
        .find((button) => button.text() === "播放轨迹")!
        .trigger("click");
    await play();
    expect(frames.size).toBe(1);
    await wrapper.setProps({ active: false });
    expect(frames.size).toBe(0);
    await wrapper.setProps({ active: true });
    await play();
    await wrapper.setProps({ disabled: true });
    expect(frames.size).toBe(0);
    await wrapper.setProps({ disabled: false });
    await play();
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(frames.size).toBe(0);
    hidden.mockRestore();
    await play();
    expect(frames.size).toBe(1);
    const remove = vi.spyOn(document, "removeEventListener");
    wrapper.unmount();
    expect(frames.size).toBe(0);
    expect(remove).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });
});
