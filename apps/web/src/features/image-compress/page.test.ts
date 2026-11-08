// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { NButton, NProgress, NSlider } from "naive-ui";
import Page from "./page.vue";
const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  downloadAll: vi.fn(),
  downloadOne: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  revoke: vi.fn()
}));
vi.mock("./api", () => ({ imageCompressApi: mocks }));
vi.mock("naive-ui", async (original) => ({
  ...(await original<typeof import("naive-ui")>()),
  useMessage: () => ({ success: mocks.success, error: mocks.error, warning: mocks.warning })
}));
let wrapper: VueWrapper;
beforeEach(() => {
  vi.clearAllMocks();
  const NativeURL = URL;
  vi.stubGlobal(
    "URL",
    class extends NativeURL {
      static createObjectURL = vi.fn(() => "blob:compression-fixture");
      static revokeObjectURL = mocks.revoke;
    }
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  mocks.downloadAll.mockResolvedValue({ blob: new Blob(["zip"]) });
  wrapper = mount(Page, {
    global: {
      stubs: {
        ToolLayout: defineComponent({ template: "<main><slot /></main>" }),
        ToolPageHeader: true
      }
    }
  });
});
afterEach(() => {
  wrapper.unmount();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function button(label: string) {
  const found = wrapper.findAllComponents(NButton).find((b) => b.text().trim() === label);
  if (!found) throw new Error(`Button missing: ${label}`);
  return found;
}
async function add(names: string[]) {
  const input = wrapper.get('input[type="file"]');
  Object.defineProperty(input.element, "files", {
    configurable: true,
    value: names.map((name) => new File([new Uint8Array(1000)], name, { type: "image/png" }))
  });
  await input.trigger("change");
}
function result(name: string, outputSize: number) {
  return {
    task: { id: name },
    originalName: name,
    originalSize: 1000,
    outputSize,
    outputName: `${name}.webp`,
    outputFormat: "webp",
    width: 1200,
    height: 800
  };
}
it("keeps format buttons and presets connected to the submitted compression settings", async () => {
  await add(["sample.png"]);
  await wrapper.get(".compression-format-options button:last-child").trigger("click");
  expect(wrapper.get(".compression-format-options button:last-child").attributes("aria-pressed")).toBe("true");
  await wrapper.get(".preset-tabs button:nth-child(2)").trigger("click");
  expect(wrapper.get(".compression-format-options button:nth-child(2)").attributes("aria-pressed")).toBe("true");
  mocks.upload.mockResolvedValue(result("sample.png", 500));
  await button("开始压缩").trigger("click");
  await flushPromises();
  const form = mocks.upload.mock.calls[0][0] as FormData;
  expect(form.get("quality")).toBe("88");
  expect(form.get("outputFormat")).toBe("png");
});
it("shows live progress then result metadata, preserves size increases and downloads every successful task", async () => {
  await add(["first.png", "second.png"]);
  let finish!: (value: ReturnType<typeof result>) => void;
  mocks.upload
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    )
    .mockResolvedValueOnce(result("second.png", 2000));
  await button("开始压缩").trigger("click");
  expect(wrapper.findAllComponents(NProgress)).toHaveLength(1);
  finish(result("first.png", 500));
  await flushPromises();
  expect(wrapper.findAllComponents(NProgress)).toHaveLength(0);
  expect(wrapper.findAll(".image-result-status.done")).toHaveLength(2);
  expect(wrapper.get(".image-compress-summary .is-larger").text()).toBe("增大 25%");
  expect(wrapper.get(".image-result-savings.is-larger").text()).toBe("增大 100%");
  await button("批量下载").trigger("click");
  await flushPromises();
  expect(mocks.downloadAll).toHaveBeenCalledWith([
    { taskId: "first.png", fileName: "first.webp" },
    { taskId: "second.png", fileName: "second.webp" }
  ]);
});
it("retains the failed row and permits retry without losing its local preview", async () => {
  await add(["retry.png"]);
  mocks.upload.mockRejectedValueOnce(new Error("test failure")).mockResolvedValueOnce(result("retry.png", 400));
  await button("开始压缩").trigger("click");
  await flushPromises();
  expect(wrapper.get(".image-result-status.failed").text()).toBe("失败");
  expect(button("开始压缩").attributes("disabled")).toBeUndefined();
  await button("开始压缩").trigger("click");
  await flushPromises();
  expect(wrapper.get(".image-result-status.done").text()).toBe("已完成");
  expect(wrapper.findAll(".image-result-row")).toHaveLength(1);
  expect(mocks.revoke).not.toHaveBeenCalled();
});
it("names the actual quality slider and keeps numeric editing synchronized with submitted quality", async () => {
  const slider = () => wrapper.getComponent(NSlider);
  const qualityInput = () => wrapper.get('input[aria-label="压缩质量百分比"]');
  expect(wrapper.get('[role="slider"]').attributes("aria-label")).toBe("压缩质量");
  slider().vm.$emit("update:value", 67);
  await flushPromises();
  expect((qualityInput().element as HTMLInputElement).value).toBe("67");
  expect(wrapper.get('[role="slider"]').attributes("aria-valuetext")).toBe("67%");
  await qualityInput().setValue("72");
  await qualityInput().trigger("blur");
  await flushPromises();
  expect(slider().props("value")).toBe(72);
  await qualityInput().setValue("");
  await qualityInput().trigger("blur");
  await flushPromises();
  expect(slider().props("value")).toBe(72);
  await add(["mobile.png"]);
  mocks.upload.mockResolvedValue(result("mobile.png", 500));
  await button("开始压缩").trigger("click");
  await flushPromises();
  expect((mocks.upload.mock.calls[0][0] as FormData).get("quality")).toBe("72");
});
