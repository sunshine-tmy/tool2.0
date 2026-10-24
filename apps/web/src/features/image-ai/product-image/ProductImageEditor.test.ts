// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, onMounted, type ComponentPublicInstance } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { defaultProductImageRecipe } from "@toolbox/shared";
import ProductImageEditor from "./ProductImageEditor.vue";
import { NColorPicker, NSlider } from "naive-ui";
import { onBeforeRouteLeave, type NavigationGuard } from "vue-router";

const mocks = vi.hoisted(() => ({
  editSource: vi.fn(),
  compose: vi.fn(),
  getTask: vi.fn(),
  cancelTask: vi.fn(),
  confirm: vi.fn(),
  download: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  message: { error: vi.fn(), warning: vi.fn(), success: vi.fn() }
}));
vi.mock("../api", () => ({ imageAiApi: mocks }));
vi.mock("../media-links", () => ({
  absoluteImageAiUrl: (url: string) => url,
  triggerImageAiDownload: mocks.download
}));
vi.mock("vue-router", () => ({ onBeforeRouteLeave: vi.fn() }));
vi.mock("../../../shared/composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
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
type TestCanvasProps = {
  zoom: number;
  checkColor: string;
  brush: number;
  strength: number;
  tool: string;
  recipe: ReturnType<typeof defaultProductImageRecipe>;
};
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
          props: {
            source: Object,
            recipe: Object,
            tool: String,
            zoom: Number,
            brush: Number,
            strength: Number,
            subjectView: Boolean,
            checkColor: String
          },
          setup(_props, { emit, expose }) {
            expose({
              masks: async () => [new Blob(["erase"]), new Blob(["restore"])],
              resetRefinement: () => emit("dirty"),
              undo: mocks.undo,
              redo: mocks.redo
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
  vi.useRealTimers();
});
describe("商品图编辑器", () => {
  it("aborts source loading and ignores its late response when the editor leaves", async () => {
    let resolve!: (value: typeof source) => void;
    mocks.editSource.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const wrapper = editor();
    const signal = mocks.editSource.mock.calls[0][2] as AbortSignal;
    wrapper.unmount();
    wrappers.splice(wrappers.indexOf(wrapper), 1);
    expect(signal.aborted).toBe(true);
    resolve(source);
    await flushPromises();
    expect(wrapper.emitted("saved")).toBeUndefined();
    expect(mocks.compose).not.toHaveBeenCalled();
  });
  it("releases each replaced background and reset background exactly once", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValueOnce("blob:first").mockReturnValueOnce("blob:second");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const wrapper = editor();
    await flushPromises();
    wrapper.findComponent<ComponentPublicInstance>('[aria-label="背景类型"]').vm.$emit("update:value", "image");
    await flushPromises();
    const input = wrapper.get<HTMLInputElement>('input[type="file"]');
    for (const name of ["first.png", "second.png"]) {
      Object.defineProperty(input.element, "files", {
        value: [new File(["x"], name, { type: "image/png" })],
        configurable: true
      });
      await input.trigger("change");
    }
    expect(revoke.mock.calls).toEqual([["blob:first"]]);
    await button(wrapper, "重置编辑").trigger("click");
    await flushPromises();
    expect(revoke.mock.calls).toEqual([["blob:first"], ["blob:second"]]);
    wrapper.unmount();
    wrappers.splice(wrappers.indexOf(wrapper), 1);
    expect(revoke).toHaveBeenCalledTimes(2);
  });
  it("retains route and browser leave protection and does not publish a cancelled save as success", async () => {
    vi.useFakeTimers();
    mocks.compose.mockResolvedValueOnce({ ...saved, status: "running" });
    mocks.cancelTask.mockResolvedValueOnce({ ...saved, status: "canceled" });
    const wrapper = editor();
    await flushPromises();
    await wrapper.get(".test-canvas").trigger("click");
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    await button(wrapper, "保存并留档").trigger("click");
    await flushPromises();
    const guard = vi.mocked(onBeforeRouteLeave).mock.calls.at(-1)![0] as NavigationGuard;
    expect(await Reflect.apply(guard, undefined, [])).toBe(false);
    await button(wrapper, "取消保存").trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(600);
    await flushPromises();
    expect(mocks.cancelTask).toHaveBeenCalledWith("edited-123");
    expect(wrapper.emitted("saved")).toBeUndefined();
    expect(mocks.message.success).not.toHaveBeenCalled();
  });
  it("keeps canvas inspection local and serializes explicit layout/background changes only on save", async () => {
    const wrapper = editor();
    await flushPromises();
    const emitControl = async (label: string, value: unknown) => {
      wrapper.findComponent<ComponentPublicInstance>(`[aria-label="${label}"]`).vm.$emit("update:value", value);
      await flushPromises();
    };
    const canvas = wrapper.findComponent<ComponentPublicInstance>(".test-canvas");
    const rendered = () => canvas.props() as TestCanvasProps;
    await emitControl("画布缩放", 2);
    expect(rendered().zoom).toBe(2);
    await button(wrapper, "适应画布").trigger("click");
    expect(rendered().zoom).toBe(1);
    await emitControl("检查底色（不导出）", "#808080");
    wrapper.findAllComponents(NColorPicker)[0].vm.$emit("update:value", "#ABCDEF");
    await flushPromises();
    expect(rendered().checkColor).toBe("#abcdef");
    await emitControl("主图规格", "2000x2000");
    await emitControl("主图规格", "custom");
    await emitControl("画布宽度", null);
    await emitControl("画布宽度", 1200);
    await emitControl("画布高度", 1600);
    await emitControl("背景类型", "color");
    wrapper.findAllComponents(NColorPicker)[1].vm.$emit("update:value", "invalid");
    wrapper.findAllComponents(NColorPicker)[1].vm.$emit("update:value", "#AABBCC");
    const sliders = wrapper.findAllComponents(NSlider);
    sliders[1].vm.$emit("update:value", 60);
    sliders[2].vm.$emit("update:value", 80);
    sliders[3].vm.$emit("update:value", 80);
    sliders[4].vm.$emit("update:value", 0.7);
    await emitControl("商品对齐", "bottom");
    canvas.vm.$emit("offset", 0.2, -0.1);
    canvas.vm.$emit("history", true, true);
    canvas.vm.$emit("error", "Canvas preview failed");
    await flushPromises();
    expect(wrapper.text()).toContain("Canvas preview failed");
    expect(rendered().brush).toBe(60);
    expect(rendered().strength).toBe(80);
    await button(wrapper, "擦除").trigger("click");
    expect(rendered().tool).toBe("erase");
    await button(wrapper, "恢复").trigger("click");
    expect(rendered().tool).toBe("restore");
    await button(wrapper, "平移视图").trigger("click");
    expect(rendered().tool).toBe("pan");
    await button(wrapper, "拖动商品").trigger("click");
    expect(rendered().tool).toBe("layout");
    await button(wrapper, "撤销").trigger("click");
    await button(wrapper, "重做").trigger("click");
    expect(mocks.undo).toHaveBeenCalledOnce();
    expect(mocks.redo).toHaveBeenCalledOnce();
    expect(mocks.compose).not.toHaveBeenCalled();
    await button(wrapper, "保存并留档").trigger("click");
    await flushPromises();
    const recipe = JSON.parse((mocks.compose.mock.calls[0][0] as FormData).get("recipe") as string);
    expect(recipe.canvas).toEqual({ width: 1200, height: 1600 });
    expect(recipe.background).toMatchObject({ kind: "color", color: "#AABBCC" });
    expect(recipe.layout).toMatchObject({ fill: 0.8, scale: 0.7, align: "bottom", offsetX: 0.2, offsetY: -0.1 });
    expect(recipe).not.toHaveProperty("checkColor");
  });

  it("resets refinement and layout independently, then reloads the original edit document on explicit reset", async () => {
    const wrapper = editor();
    await flushPromises();
    await button(wrapper, "重置精修").trigger("click");
    await flushPromises();
    expect(mocks.confirm).toHaveBeenCalled();
    await button(wrapper, "恢复自动布局").trigger("click");
    const canvas = wrapper.findComponent<ComponentPublicInstance>(".test-canvas");
    expect((canvas.props() as TestCanvasProps).recipe.layout).toEqual(defaultProductImageRecipe().layout);
    await button(wrapper, "重置编辑").trigger("click");
    await flushPromises();
    expect(mocks.editSource).toHaveBeenCalledTimes(2);
    expect(mocks.compose).not.toHaveBeenCalled();
    await button(wrapper, "返回图片处理").trigger("click");
    await flushPromises();
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
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
