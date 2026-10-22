// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, onMounted, type ComponentPublicInstance } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { defaultProductImageRecipe } from "@toolbox/shared";
import ProductImageEditor from "./ProductImageEditor.vue";

const mocks = vi.hoisted(() => ({
  editSource: vi.fn(),
  compose: vi.fn(),
  getTask: vi.fn(),
  cancelTask: vi.fn(),
  confirm: vi.fn(),
  download: vi.fn(),
  message: { error: vi.fn(), warning: vi.fn(), success: vi.fn() }
}));
vi.mock("./api", () => ({
  imageAiApi: mocks,
  absoluteImageAiUrl: (url: string) => url,
  triggerImageAiDownload: mocks.download
}));
vi.mock("vue-router", () => ({ onBeforeRouteLeave: vi.fn() }));
vi.mock("../../composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
vi.mock("naive-ui", async (original) => ({
  ...(await original<typeof import("naive-ui")>()),
  useMessage: () => mocks.message
}));
const source = {
  taskId: "source-123",
  resultId: "source-123-1",
  width: 20,
  height: 20,
  foregroundUrl: "/foreground",
  originalUrl: "/original",
  canRestore: true,
  recipe: defaultProductImageRecipe()
};
const saved = {
  id: "edited-123",
  operation: "product_image",
  status: "completed",
  phase: "已留档",
  recipe: source.recipe,
  results: [{ id: "edited-123-1", downloadUrl: "/result.png" }]
};
const wrappers: ReturnType<typeof mount>[] = [];
function editor(realColorPicker = false) {
  const wrapper = mount(ProductImageEditor, {
    props: { taskId: source.taskId, resultId: source.resultId },
    global: {
      stubs: {
        NButton: defineComponent({
          props: { disabled: Boolean },
          template: '<button :disabled="disabled"><slot /></button>'
        }),
        NSpin: defineComponent({ template: "<div><slot /></div>" }),
        NAlert: defineComponent({ template: "<div><slot /></div>" }),
        NSelect: defineComponent({ name: "TestSelect", props: { value: [String, Number] }, template: "<div />" }),
        NColorPicker: !realColorPicker,
        NInputNumber: true,
        NSlider: true,
        ProductImageCanvas: defineComponent({
          setup(_props, { emit, expose }) {
            expose({
              masks: async () => [new Blob(["erase"]), new Blob(["restore"])],
              resetRefinement: () => emit("dirty")
            });
            onMounted(() => emit("ready"));
            return {};
          },
          template: '<div class="test-canvas" @click="$emit(\'dirty\')" />'
        })
      }
    }
  });
  wrappers.push(wrapper);
  return wrapper;
}
function button(wrapper: ReturnType<typeof mount>, text: string) {
  const value = wrapper.findAll("button").find((item) => item.text() === text);
  if (!value) throw new Error(`Missing ${text}`);
  return value;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.confirm.mockResolvedValue(true);
  mocks.editSource.mockImplementation(async (taskId: string, resultId: string) => ({ ...source, taskId, resultId }));
  mocks.compose.mockResolvedValue(saved);
});
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount();
  vi.restoreAllMocks();
});
describe("商品图编辑器", () => {
  it("检查底色显示纯色块而非被挤压的色值，点击仍能打开真实选色面板", async () => {
    const wrapper = editor(true);
    await flushPromises();
    const swatch = wrapper.get(".product-check-swatch");
    expect(swatch.text()).toBe("");
    expect(swatch.get("span").attributes("style")).toContain("background-color");
    await swatch.trigger("click");
    await flushPromises();
    expect(document.body.querySelector(".n-color-picker-panel")).not.toBeNull();
    expect(mocks.compose).not.toHaveBeenCalled();
  });

  it("打开横版历史时规格标签与实际尺寸一致", async () => {
    mocks.editSource.mockResolvedValue({
      ...source,
      recipe: { ...source.recipe, canvas: { width: 1600, height: 1200 } }
    });
    const wrapper = editor();
    await flushPromises();
    expect(
      (wrapper.findComponent<ComponentPublicInstance>('[aria-label="主图规格"]').props() as { value: string }).value
    ).toBe("1600x1200");
  });
  it("使用隐藏文件控件和上传卡片，选图后展示预览及文件名但不自动保存", async () => {
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:background-preview");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const wrapper = editor();
    await flushPromises();
    wrapper.findComponent<ComponentPublicInstance>('[aria-label="背景类型"]').vm.$emit("update:value", "image");
    await flushPromises();
    const input = wrapper.get<HTMLInputElement>('input[type="file"]');
    expect(input.attributes("hidden")).toBeDefined();
    expect(wrapper.get(".product-background-upload").text()).toContain("上传背景图片");
    const file = new File(["image"], "商品展示背景.png", { type: "image/png" });
    Object.defineProperty(input.element, "files", { value: [file], configurable: true });
    await input.trigger("change");
    expect(create).toHaveBeenCalledWith(file);
    expect(wrapper.get(".product-background-thumbnail").attributes("src")).toBe("blob:background-preview");
    expect(wrapper.get(".product-background-upload").text()).toContain("商品展示背景.png");
    expect(mocks.compose).not.toHaveBeenCalled();
    wrapper.unmount();
    wrappers.splice(wrappers.indexOf(wrapper), 1);
    expect(revoke).toHaveBeenCalledWith("blob:background-preview");
  });

  it("上传卡片支持拖入图片，非法文件不替换当前背景", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:dropped-background");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const wrapper = editor();
    await flushPromises();
    wrapper.findComponent<ComponentPublicInstance>('[aria-label="背景类型"]').vm.$emit("update:value", "image");
    await flushPromises();
    const card = wrapper.get(".product-background-upload");
    await card.trigger("drop", { dataTransfer: { files: [new File(["image"], "背景.webp", { type: "image/webp" })] } });
    expect(card.text()).toContain("背景.webp");
    await card.trigger("drop", { dataTransfer: { files: [new File(["x"], "not-image.txt", { type: "text/plain" })] } });
    expect(mocks.message.error).toHaveBeenCalled();
    expect(card.text()).toContain("背景.webp");
    expect(mocks.compose).not.toHaveBeenCalled();
  });
  it("读取素材不会自动保存，只有明确保存后才创建独立任务", async () => {
    const wrapper = editor();
    await flushPromises();
    expect(mocks.compose).not.toHaveBeenCalled();
    await button(wrapper, "保存并留档").trigger("click");
    await flushPromises();
    expect(mocks.compose).toHaveBeenCalledTimes(1);
    const form = mocks.compose.mock.calls[0][0] as FormData;
    expect(form.get("taskId")).toBe(source.taskId);
    expect(form.get("erase")).toBeInstanceOf(Blob);
    expect(form.get("restore")).toBeInstanceOf(Blob);
    expect(wrapper.emitted("saved")?.[0][0]).toEqual(saved);
    expect(mocks.editSource).toHaveBeenLastCalledWith("edited-123", "edited-123-1", expect.any(AbortSignal));
  });
  it("素材不可恢复时不会提交恢复蒙版", async () => {
    mocks.editSource.mockResolvedValue({ ...source, originalUrl: undefined, canRestore: false, reason: "原图已缺失" });
    const wrapper = editor();
    await flushPromises();
    expect(button(wrapper, "恢复").attributes("disabled")).toBeDefined();
    await button(wrapper, "保存并留档").trigger("click");
    await flushPromises();
    expect((mocks.compose.mock.calls[0][0] as FormData).has("restore")).toBe(false);
  });
  it("保存中阻止重复提交，未保存离开需要确认", async () => {
    let finish!: (value: unknown) => void;
    mocks.compose.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const wrapper = editor();
    await flushPromises();
    await wrapper.find(".test-canvas").trigger("click");
    mocks.confirm.mockResolvedValue(false);
    await button(wrapper, "返回图片处理").trigger("click");
    await flushPromises();
    expect(wrapper.emitted("close")).toBeUndefined();
    await button(wrapper, "保存并留档").trigger("click");
    await flushPromises();
    expect(button(wrapper, "保存并留档").attributes("disabled")).toBeDefined();
    await button(wrapper, "保存并留档").trigger("click");
    expect(mocks.compose).toHaveBeenCalledTimes(1);
    finish(saved);
    await flushPromises();
  });
  it("透明结果导出 JPEG 必须确认白底填充", async () => {
    const transparent = {
      ...saved,
      recipe: { ...saved.recipe, background: { kind: "transparent", color: "#FFFFFF" } }
    };
    mocks.compose.mockResolvedValue(transparent);
    const wrapper = editor();
    await flushPromises();
    await button(wrapper, "保存并留档").trigger("click");
    await flushPromises();
    const selector = wrapper.findComponent<ComponentPublicInstance>('[aria-label="下载格式"]');
    expect(selector.exists(), wrapper.html()).toBe(true);
    selector.vm.$emit("update:value", "jpeg");
    await flushPromises();
    mocks.confirm.mockResolvedValue(false);
    await button(wrapper, "下载已保存结果").trigger("click");
    await flushPromises();
    expect(mocks.download).not.toHaveBeenCalled();
    mocks.confirm.mockResolvedValue(true);
    await button(wrapper, "下载已保存结果").trigger("click");
    await flushPromises();
    expect(mocks.download).toHaveBeenCalledWith("/result.png?download=1&format=jpeg&flatten=white");
  });
});
