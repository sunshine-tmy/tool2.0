// @vitest-environment happy-dom
import { mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, expect, it } from "vitest";
import { NSelect, NSwitch, NButton, NAlert } from "naive-ui";
import Output from "./ArchiveOutputSettings.vue";
import { defaultArchiveInterpolation, type ArchiveVideoOutput } from "@toolbox/shared/archive";
let view: VueWrapper | undefined;
afterEach(() => view?.unmount());
const runtime = { flowReady: true, rifeReady: true, componentId: "video-interpolation" as const, message: "补帧可用" };
function setup(initial?: ArchiveVideoOutput) {
  return (view = mount(Output, {
    props: { show: true, runtime, initial },
    global: { stubs: { NModal: { template: '<section><slot /><slot name="footer" /></section>' } } }
  }));
}
it("默认关闭并收起补帧参数，开启后才展开并检测能力，确认后才输出处理设置", async () => {
  const wrapper = setup();
  expect(wrapper.findAllComponents(NSelect)).toHaveLength(1);
  expect(wrapper.findAllComponents(NSwitch)).toHaveLength(1);
  expect(wrapper.emitted("refresh")).toBeUndefined();
  expect(wrapper.findAllComponents(NSwitch)[0].props("value")).toBe(false);
  wrapper.findAllComponents(NSwitch)[0].vm.$emit("update:value", true);
  await wrapper.vm.$nextTick();
  expect(wrapper.findAllComponents(NSelect)).toHaveLength(3);
  expect(wrapper.emitted("refresh")).toHaveLength(1);
  wrapper.findAllComponents(NSelect)[0].vm.$emit("update:value", 120);
  wrapper.findAllComponents(NSelect)[1].vm.$emit("update:value", "rife");
  wrapper.findAllComponents(NSelect)[2].vm.$emit("update:value", "high");
  await wrapper.vm.$nextTick();
  expect(wrapper.emitted("start")).toBeUndefined();
  await wrapper
    .findAllComponents(NButton)
    .find((button) => button.text() === "开始处理并保存")!
    .trigger("click");
  expect(wrapper.emitted("start")?.[0]).toEqual([
    { fps: 120, interpolation: { engine: "rife", quality: "high", sceneProtection: true, allowFallback: false } }
  ]);
});
it("上次开启也不会自动沿用，关闭时不受补帧能力限制且不提交补帧参数，重新打开仍默认关闭", async () => {
  const wrapper = setup({ fps: 60, interpolation: { ...defaultArchiveInterpolation(), engine: "rife" } });
  await wrapper.setProps({ runtime: { ...runtime, rifeReady: false, flowReady: false } });
  expect(wrapper.findAllComponents(NSwitch)[0].props("value")).toBe(false);
  expect(wrapper.findAllComponents(NSelect)).toHaveLength(1);
  const start = () => wrapper.findAllComponents(NButton).find((button) => button.text() === "开始处理并保存")!;
  expect(start().props("disabled")).toBe(false);
  await start().trigger("click");
  expect(wrapper.emitted("start")?.[0]).toEqual([{ fps: 60 }]);
  wrapper.findAllComponents(NSwitch)[0].vm.$emit("update:value", true);
  await wrapper.vm.$nextTick();
  expect(start().props("disabled")).toBe(true);
  wrapper.findAllComponents(NSwitch)[0].vm.$emit("update:value", false);
  await wrapper.vm.$nextTick();
  expect(wrapper.findAllComponents(NSelect)).toHaveLength(1);
  await start().trigger("click");
  expect(wrapper.emitted("start")?.[1]).toEqual([{ fps: 60 }]);
  wrapper.findAllComponents(NSwitch)[0].vm.$emit("update:value", true);
  await wrapper.vm.$nextTick();
  await wrapper.setProps({ show: false });
  await wrapper.setProps({ show: true });
  expect(wrapper.findAllComponents(NSwitch)[0].props("value")).toBe(false);
});
it("补帧缺少目标帧率时阻止提交，取消不输出处理设置", async () => {
  const wrapper = setup();
  wrapper.findAllComponents(NSwitch)[0].vm.$emit("update:value", true);
  await wrapper.vm.$nextTick();
  expect(
    wrapper
      .findAllComponents(NButton)
      .find((button) => button.text() === "开始处理并保存")!
      .props("disabled")
  ).toBe(true);
  expect(wrapper.getComponent(NAlert).text()).toContain("请先选择目标输出帧率");
  await wrapper
    .findAllComponents(NButton)
    .find((button) => button.text() === "取消")!
    .trigger("click");
  expect(wrapper.emitted("cancel")).toHaveLength(1);
  expect(wrapper.emitted("start")).toBeUndefined();
});
