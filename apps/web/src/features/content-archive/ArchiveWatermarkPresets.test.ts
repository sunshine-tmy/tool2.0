// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NButton, NInput, NSelect } from "naive-ui";
import { defaultArchiveWatermarkSettings, type ArchiveWatermarkPreset } from "@toolbox/shared/archive";
import Presets from "./ArchiveWatermarkPresets.vue";
const mocks = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn(), remove: vi.fn(), confirm: vi.fn() }));
vi.mock("./video-edit-api", () => ({
  videoEditApi: { watermarkPresets: mocks.list, saveWatermarkPreset: mocks.save, removeWatermarkPreset: mocks.remove }
}));
vi.mock("../../shared/composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
const preset: ArchiveWatermarkPreset = {
  id: "abcdefghijkl",
  name: "Z 型品牌轨迹",
  revision: 1,
  createdAt: "2026-10-29",
  updatedAt: "2026-10-29",
  points: [
    { progress: 0, x: 0, y: 0 },
    { progress: 0.5, x: 1, y: 0 },
    { progress: 1, x: 0, y: 1 }
  ]
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue([structuredClone(preset)]);
  mocks.save.mockResolvedValue({ ...preset, id: "mnopqrstuvwx", name: "新方案" });
  mocks.remove.mockResolvedValue({ id: preset.id });
  mocks.confirm.mockResolvedValue(true);
});
function setup(duration = 20) {
  const settings = defaultArchiveWatermarkSettings();
  settings.motion.type = "keyframes";
  settings.motion.keyframes = [
    { timeSeconds: 0, x: 0, y: 0 },
    { timeSeconds: duration, x: 1, y: 1 }
  ];
  return mount(Presets, { props: { settings, duration, disabled: false } });
}
function button(wrapper: ReturnType<typeof setup>, text: string) {
  return wrapper.findAllComponents(NButton).find((component) => component.text() === text)!;
}
describe("可复用关键帧轨迹预设", () => {
  it("从服务读取预设并按目标视频时长应用，保存仅提交归一化轨迹，不包含图片和配乐", async () => {
    const wrapper = setup(40);
    await flushPromises();
    wrapper.findComponent(NSelect).vm.$emit("update:value", preset.id);
    await flushPromises();
    await button(wrapper, "应用预设").trigger("click");
    const result = wrapper.emitted("apply")![0][0] as ReturnType<typeof defaultArchiveWatermarkSettings>;
    expect(result.motion.keyframes.map((frame) => frame.timeSeconds)).toEqual([0, 20, 40]);
    expect(() => structuredClone(result)).not.toThrow();
    expect(result.opacity).toBe(70);
    wrapper.findComponent(NInput).vm.$emit("update:value", "新方案");
    await flushPromises();
    await button(wrapper, "保存当前轨迹为预设").trigger("click");
    await flushPromises();
    expect(mocks.save).toHaveBeenCalledWith(
      {
        name: "新方案",
        points: [
          { progress: 0, x: 0, y: 0 },
          { progress: 1, x: 1, y: 1 }
        ]
      },
      expect.any(AbortSignal)
    );
    expect(wrapper.text()).toContain("可在其他视频中选择使用");
    wrapper.unmount();
  });
  it("删除需确认，清空已删除的选择，不改变当前视频；失败不谎报成功", async () => {
    const wrapper = setup();
    await flushPromises();
    wrapper.findComponent(NSelect).vm.$emit("update:value", preset.id);
    await flushPromises();
    mocks.confirm.mockResolvedValueOnce(false);
    await button(wrapper, "删除预设").trigger("click");
    await flushPromises();
    expect(mocks.remove).not.toHaveBeenCalled();
    mocks.remove.mockRejectedValueOnce(new Error("write failed"));
    await button(wrapper, "删除预设").trigger("click");
    await flushPromises();
    expect(wrapper.findComponent(NSelect).props("value")).toBe(preset.id);
    await button(wrapper, "删除预设").trigger("click");
    await flushPromises();
    expect(wrapper.findComponent(NSelect).props("value")).toBeNull();
    expect(wrapper.emitted("apply")).toBeUndefined();
    wrapper.unmount();
  });
  it("卸载后中止请求，迟到列表不更新失效页面", async () => {
    let finish!: (value: ArchiveWatermarkPreset[]) => void;
    mocks.list.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const wrapper = setup();
    const signal = mocks.list.mock.calls[0][0] as AbortSignal;
    wrapper.unmount();
    expect(signal.aborted).toBe(true);
    finish([preset]);
    await flushPromises();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
