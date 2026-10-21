// @vitest-environment happy-dom
/** Regression tests for explicit submission, per-operation status and final result hydration. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import type { ImageAiHealth, ImageAiTask } from "@toolbox/shared";
import Page from "./page.vue";
import ImageAiOperationPanel from "./ImageAiOperationPanel.vue";
import ImageAiTaskStatusCard from "./ImageAiTaskStatusCard.vue";
import ImageAiResultGallery from "./ImageAiResultGallery.vue";

const mocks = vi.hoisted(() => ({
  health: vi.fn(),
  createTask: vi.fn(),
  getTask: vi.fn(),
  cancelTask: vi.fn(),
  message: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
  streams: [] as Array<{ task: ReturnType<typeof ref>; error: ReturnType<typeof ref> }>
}));
vi.mock("./api", () => ({
  imageAiApi: mocks,
  absoluteImageAiUrl: (url: string) => url,
  resultDownloadUrl: (url: string) => url,
  triggerImageAiDownload: vi.fn()
}));
vi.mock("naive-ui", async (original) => {
  const { defineComponent } = await import("vue");
  const passthrough = () => defineComponent({ template: "<div><slot /></div>" });
  return {
    ...(await original<object>()),
    useMessage: () => mocks.message,
    NTabs: passthrough(),
    NTabPane: passthrough(),
    NAlert: passthrough(),
    NTag: passthrough(),
    NRadioGroup: passthrough(),
    NRadioButton: passthrough(),
    NProgress: passthrough(),
    NButton: defineComponent({
      props: { disabled: Boolean, loading: Boolean },
      template: '<button :disabled="disabled || loading"><slot /></button>'
    })
  };
});
vi.mock("../../composables/useTaskEvents", () => ({
  useTaskEvents: () => {
    const stream = { task: ref(), error: ref() };
    mocks.streams.push(stream);
    return stream;
  }
}));
const slot = defineComponent({ template: "<div><slot /></div>" });
const wrappers: ReturnType<typeof mount>[] = [];
function task(overrides: Partial<ImageAiTask> = {}): ImageAiTask {
  return {
    id: "image-task-123",
    operation: "enhance",
    status: "completed",
    progress: 100,
    queuePosition: null,
    warnings: [],
    results: [
      {
        id: "image-task-123-1",
        originalName: "input.png",
        outputName: "output.png",
        downloadUrl: "/result.png",
        width: 10,
        height: 10,
        provider: "birefnet-general",
        model: "BiRefNet",
        warnings: []
      }
    ],
    createdAt: "2026-10-22T00:00:00Z",
    updatedAt: "2026-10-22T00:00:01Z",
    expiresAt: "2026-10-23T00:00:00Z",
    ...overrides
  };
}
async function page() {
  const wrapper = mount(Page, {
    global: {
      stubs: {
        ToolLayout: slot,
        ToolPageHeader: true,
        DiagnosticErrorLink: true,
        ImageAiBatchPicker: true,
        ImageAiWatermarkPanel: true,
        ImageAiResultGallery: true
      }
    }
  });
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}
function panel(wrapper: ReturnType<typeof mount>, operation = "background_remove") {
  const found = wrapper
    .findAllComponents(ImageAiOperationPanel)
    .find((entry) => entry.props("operation") === operation);
  expect(found, `missing operation panel: ${operation}`).toBeDefined();
  return found!;
}
async function choose(target: ReturnType<typeof panel>, name = "input.png") {
  target.vm.$emit("update:files", [new File(["image"], name, { type: "image/png" })]);
  await flushPromises();
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.streams.length = 0;
  mocks.health.mockResolvedValue({
    available: true,
    deploymentUsage: "commercial",
    models: [
      { provider: "real-esrgan", available: true, model: "RealESRGAN" },
      { provider: "birefnet-general", available: true, model: "BiRefNet" }
    ]
  } as ImageAiHealth);
  mocks.createTask.mockResolvedValue(task());
  mocks.getTask.mockResolvedValue(task());
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
});

describe("image AI page", () => {
  it("never submits on upload or displays a completed enhancement task as a cutout result", async () => {
    const wrapper = await page();
    const enhance = panel(wrapper, "enhance");
    await choose(enhance);
    expect(mocks.createTask).not.toHaveBeenCalled();
    await enhance.props("submitBatch")("enhance");
    await flushPromises();
    expect(enhance.findComponent(ImageAiTaskStatusCard).text()).toContain("处理完成");
    const cutout = panel(wrapper);
    await choose(cutout);
    expect(cutout.findComponent(ImageAiTaskStatusCard).props("task")).toBeUndefined();
    expect(cutout.findComponent(ImageAiResultGallery).exists()).toBe(false);
    expect(cutout.get("button").attributes("disabled")).toBeUndefined();
    expect(mocks.createTask).toHaveBeenCalledOnce();
  });

  it("shows why cutout is unavailable instead of silently disabling it", async () => {
    mocks.health.mockResolvedValue({
      available: true,
      deploymentUsage: "commercial",
      models: [{ provider: "birefnet-general", model: "BiRefNet", available: false, reason: "缺少本地模型权重" }]
    });
    const target = panel(await page());
    await choose(target);
    expect(target.text()).toContain("BiRefNet：缺少本地模型权重");
    expect(target.text()).toContain("上传图片不会自动开始处理");
    expect(target.get("button").attributes("disabled")).toBeDefined();
    await target.props("submitBatch")("background_remove");
    expect(mocks.createTask).not.toHaveBeenCalled();
  });

  it("hydrates cutout previews and download results after completion, then clears old status on new input", async () => {
    mocks.createTask.mockResolvedValue(
      task({ operation: "background_remove", status: "pending", progress: 0, results: [] })
    );
    mocks.getTask.mockResolvedValue(task({ operation: "background_remove" }));
    const target = panel(await page());
    await choose(target);
    await target.props("submitBatch")("background_remove");
    await flushPromises();
    expect(target.props("isBusy")).toBe(true);
    mocks.streams[0].task.value = { id: "image-task-123", status: "completed", progress: 100 };
    await flushPromises();
    expect(target.props("isBusy")).toBe(false);
    expect(target.findComponent(ImageAiResultGallery).props("task").results).toHaveLength(1);
    expect(target.get("button").attributes("disabled")).toBeUndefined();
    await choose(target, "next.png");
    expect(target.findComponent(ImageAiTaskStatusCard).props("task")).toBeUndefined();
    expect(target.findComponent(ImageAiResultGallery).exists()).toBe(false);
    expect(mocks.createTask).toHaveBeenCalledOnce();
  });

  it("prevents duplicate submissions while creating a task and releases the button on failure", async () => {
    let reject!: (error: Error) => void;
    mocks.createTask.mockImplementation(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        })
    );
    const target = panel(await page());
    await choose(target);
    const pending = target.props("submitBatch")("background_remove");
    await flushPromises();
    await target.props("submitBatch")("background_remove");
    expect(mocks.createTask).toHaveBeenCalledOnce();
    reject(new Error("creation failed"));
    await pending;
    await flushPromises();
    expect(target.props("isBusy")).toBe(false);
    expect(mocks.message.error).toHaveBeenCalledOnce();
  });
});
