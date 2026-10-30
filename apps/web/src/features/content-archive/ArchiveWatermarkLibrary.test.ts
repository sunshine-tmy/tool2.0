// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NButton, NInput, NPagination } from "naive-ui";
import type { ArchiveWatermarkLibraryItem } from "@toolbox/shared/archive";
import Library from "./ArchiveWatermarkLibrary.vue";
const mocks = vi.hoisted(() => ({ list: vi.fn(), upload: vi.fn(), remove: vi.fn(), confirm: vi.fn() }));
vi.mock("./video-edit-api", () => ({
  videoEditApi: {
    watermarkLibrary: mocks.list,
    uploadLibraryWatermark: mocks.upload,
    removeLibraryWatermark: mocks.remove
  }
}));
vi.mock("../../shared/composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
const item: ArchiveWatermarkLibraryItem = {
  id: "abcdefghijkl",
  name: "品牌.png",
  width: 12,
  height: 8,
  size: 100,
  checksum: "a".repeat(64),
  previewUrl: "/api/v1/tools/media-archive/watermark-library/abcdefghijkl/image",
  revision: 1,
  createdAt: "2026-10-29",
  updatedAt: "2026-10-29"
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockReset().mockResolvedValue([structuredClone(item)]);
  mocks.upload.mockReset().mockResolvedValue(structuredClone(item));
  mocks.remove.mockReset().mockResolvedValue({ id: item.id });
  mocks.confirm.mockReset().mockResolvedValue(true);
});
function button(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAllComponents(NButton).find((entry) => entry.text() === text)!;
}
async function setup() {
  const wrapper = mount(Library, { props: { disabled: false } });
  await button(wrapper, "从库中选择").trigger("click");
  await flushPromises();
  return wrapper;
}
describe("水印库选择与管理", () => {
  it("分页总数采用筛选结果，翻页、搜索和删除后保持正确", async () => {
    mocks.list.mockResolvedValue(
      Array.from({ length: 9 }, (_, index) => ({
        ...item,
        id: `watermark_${index}`,
        name: index < 8 ? `品牌-${index}.png` : "其他.png"
      }))
    );
    const wrapper = await setup();
    try {
      expect(wrapper.findAll(".library-grid article")).toHaveLength(6);
      expect(wrapper.get(".n-pagination-prefix").text()).toBe("共 9 条");
      wrapper.getComponent(NPagination).vm.$emit("update:page", 2);
      await flushPromises();
      expect(wrapper.findAll(".library-grid article")).toHaveLength(3);
      expect(wrapper.get(".n-pagination-prefix").text()).toBe("共 9 条");
      wrapper.getComponent(NInput).vm.$emit("update:value", "品牌");
      await flushPromises();
      expect(wrapper.get(".n-pagination-prefix").text()).toBe("共 8 条");
      await button(wrapper, "删除").trigger("click");
      await flushPromises();
      expect(wrapper.get(".n-pagination-prefix").text()).toBe("共 7 条");
    } finally {
      wrapper.unmount();
    }
  });
  it("缩略图和名称搜索快速选择，禁用时不能选用或删除", async () => {
    const wrapper = await setup();
    expect(wrapper.get("img").attributes("loading")).toBe("lazy");
    await wrapper.get(".library-thumbnail").trigger("click");
    expect(wrapper.emitted("select")).toEqual([[item.id]]);
    wrapper.getComponent(NInput).vm.$emit("update:value", "不存在");
    await flushPromises();
    expect(wrapper.find("img").exists()).toBe(false);
    wrapper.getComponent(NInput).vm.$emit("update:value", "品牌");
    await flushPromises();
    expect(wrapper.find("img").exists()).toBe(true);
    await wrapper.setProps({ disabled: true });
    expect(wrapper.get(".library-thumbnail").attributes("disabled")).toBeDefined();
    expect(button(wrapper, "删除").props("disabled")).toBe(true);
    wrapper.unmount();
  });
  it("上传入库后自动选择，重复素材仅保留一条；格式错误不会发起上传", async () => {
    const wrapper = await setup(),
      input = wrapper.get<HTMLInputElement>('input[type="file"]');
    const file = new File(["png"], "品牌.png", { type: "image/png" });
    Object.defineProperty(input.element, "files", { configurable: true, value: [file] });
    await input.trigger("change");
    await flushPromises();
    expect(mocks.upload).toHaveBeenCalledWith(file, expect.any(AbortSignal));
    expect(wrapper.findAll(".library-grid article")).toHaveLength(1);
    expect(wrapper.emitted("select")).toEqual([[item.id]]);
    Object.defineProperty(input.element, "files", { configurable: true, value: [new File(["svg"], "bad.svg")] });
    await input.trigger("change");
    await flushPromises();
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("静态图片");
    wrapper.unmount();
  });
  it("删除需确认，失败保留记录，成功只删除素材且不触发视频选择", async () => {
    const wrapper = await setup();
    mocks.confirm.mockResolvedValueOnce(false);
    await button(wrapper, "删除").trigger("click");
    await flushPromises();
    expect(mocks.remove).not.toHaveBeenCalled();
    mocks.remove.mockRejectedValueOnce(new Error("delete failed"));
    await button(wrapper, "删除").trigger("click");
    await flushPromises();
    expect(wrapper.findAll(".library-grid article")).toHaveLength(1);
    await button(wrapper, "删除").trigger("click");
    await flushPromises();
    expect(mocks.remove).toHaveBeenLastCalledWith(item.id, 1, expect.any(AbortSignal));
    expect(wrapper.findAll(".library-grid article")).toHaveLength(0);
    expect(wrapper.emitted("select")).toBeUndefined();
    expect(wrapper.text()).toContain("当前视频保持不变");
    wrapper.unmount();
  });
  it("读取失败可刷新重试；卸载后的上传响应不会自动选择", async () => {
    mocks.list.mockRejectedValueOnce(new Error("network failed"));
    const wrapper = await setup();
    await button(wrapper, "刷新").trigger("click");
    await flushPromises();
    expect(wrapper.find("img").exists()).toBe(true);
    let finish!: (value: ArchiveWatermarkLibraryItem) => void;
    mocks.upload.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const input = wrapper.get<HTMLInputElement>('input[type="file"]');
    Object.defineProperty(input.element, "files", { value: [new File(["png"], "logo.png")] });
    await input.trigger("change");
    await flushPromises();
    const signal = mocks.upload.mock.calls[0][1] as AbortSignal;
    wrapper.unmount();
    expect(signal.aborted).toBe(true);
    finish(item);
    await flushPromises();
    expect(wrapper.emitted("select")).toBeUndefined();
  });
});
