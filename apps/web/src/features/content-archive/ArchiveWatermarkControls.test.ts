// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { NButton, NInputNumber, NSelect, NSlider } from "naive-ui";
import { defaultArchiveWatermarkSettings } from "@toolbox/shared/archive";
import Controls from "./ArchiveWatermarkControls.vue";
vi.mock("./ArchiveWatermarkPresets.vue", () => ({ default: { template: "<div />" } }));
vi.mock("./ArchiveWatermarkLibrary.vue", () => ({ default: { template: "<div />" } }));
const asset = { width: 100, height: 50, url: "/logo.png" };
describe("水印面板", () => {
  it("保留经典反弹并增加六种样式，切换 Z 型使用规范起点，随机路线种子显式保存", async () => {
    const settings = defaultArchiveWatermarkSettings();
    settings.motion.type = "bounce";
    const wrapper = mount(Controls, {
      props: { settings, asset, duration: 22, time: 0, disabled: false, selectedPoint: "from", selectedFrame: 0 }
    });
    const select = wrapper
      .findAllComponents(NSelect)
      .find((component) => component.attributes("aria-label") === "反弹轨迹样式")!;
    expect(select.props("options")).toHaveLength(7);
    select.vm.$emit("update:value", "z");
    const config = wrapper.emitted("update:settings")!.at(-1)![0] as typeof settings;
    expect(config.motion).toMatchObject({ bounceStyle: "z", from: { x: 0, y: 0 }, directionX: 1, directionY: 1 });
    expect(settings.motion.bounceStyle).toBeUndefined();
    select.vm.$emit("update:value", "random");
    expect((wrapper.emitted("update:settings")!.at(-1)![0] as typeof settings).motion.bounceSeed).toBeTypeOf("number");
    wrapper.unmount();
  });
  it("独立修改透明度和大小，不直接修改父配置，九宫格发出位置", async () => {
    const settings = defaultArchiveWatermarkSettings();
    const wrapper = mount(Controls, {
      props: { settings, asset, duration: 10, time: 0, disabled: false, selectedPoint: "from", selectedFrame: 0 }
    });
    wrapper.findAllComponents(NSlider)[0].vm.$emit("update:value", 30);
    expect(wrapper.emitted("update:settings")?.[0]?.[0]).toMatchObject({ opacity: 30 });
    expect(settings.opacity).toBe(70);
    await wrapper
      .findAllComponents(NButton)
      .find((button) => button.text() === "居中")!
      .trigger("click");
    expect(wrapper.emitted("move")?.[0]).toEqual([{ x: 0.5, y: 0.5 }]);
    wrapper.unmount();
  });
  it("关键帧初始化、按当前播放位置插入、时间修改排序和定位，重复时间不插入", async () => {
    const wrapper = mount(Controls, {
      props: {
        settings: defaultArchiveWatermarkSettings(),
        asset,
        duration: 10,
        time: 5,
        disabled: false,
        selectedPoint: "from",
        selectedFrame: 0
      }
    });
    wrapper.findComponent(NSelect).vm.$emit("update:value", "keyframes");
    const config = wrapper.emitted("update:settings")!.at(-1)![0] as ReturnType<typeof defaultArchiveWatermarkSettings>;
    expect(config.motion.keyframes.map((frame) => frame.timeSeconds)).toEqual([0, 10]);
    await wrapper.setProps({ settings: config });
    await wrapper
      .findAllComponents(NButton)
      .find((button) => button.text().includes("添加关键帧"))!
      .trigger("click");
    const added = wrapper.emitted("update:settings")!.at(-1)![0] as typeof config;
    expect(added.motion.keyframes.map((frame) => frame.timeSeconds)).toEqual([0, 5, 10]);
    await wrapper.setProps({ settings: added });
    const count = wrapper.emitted("update:settings")!.length;
    await wrapper
      .findAllComponents(NButton)
      .find((button) => button.text().includes("添加关键帧"))!
      .trigger("click");
    expect(wrapper.emitted("update:settings")).toHaveLength(count);
    wrapper
      .findAllComponents(NInputNumber)
      .find((input) => input.attributes("aria-label") === "关键帧 2 时间")!
      .vm.$emit("update:value", 6);
    expect((wrapper.emitted("update:settings")!.at(-1)![0] as typeof config).motion.keyframes[1].timeSeconds).toBe(6);
    expect(wrapper.emitted("seek")!.at(-1)).toEqual([6]);
    wrapper.unmount();
  });
  it("上传与拖放只发出文件，忙碌时不接受新素材", async () => {
    const wrapper = mount(Controls, {
      props: {
        settings: defaultArchiveWatermarkSettings(),
        duration: 10,
        time: 0,
        disabled: false,
        selectedPoint: "from",
        selectedFrame: 0
      }
    });
    const file = new File(["png"], "logo.png", { type: "image/png" });
    Object.defineProperty(wrapper.get("input[type=file]").element, "files", { configurable: true, value: [file] });
    await wrapper.get("input[type=file]").trigger("change");
    expect(wrapper.emitted("upload")?.[0]).toEqual([file]);
    await wrapper.setProps({ disabled: true });
    await wrapper.get(".watermark-upload").trigger("drop", { dataTransfer: { files: [file] } });
    expect(wrapper.emitted("upload")).toHaveLength(1);
    wrapper.unmount();
  });
});
