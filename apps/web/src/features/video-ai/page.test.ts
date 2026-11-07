// @vitest-environment happy-dom
import { defineComponent, ref, nextTick } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  health: vi.fn(),
  create: vi.fn(),
  detect: vi.fn(),
  get: vi.fn(),
  cancel: vi.fn(),
  remove: vi.fn(),
  history: vi.fn(),
  confirm: vi.fn(),
  live: undefined as unknown
}));
vi.mock("./api", () => ({ videoAiApi: { ...mocks, outputUrl: (id: string) => `/output/${id}` } }));
vi.mock("../../shared/composables/useTaskEvents", () => ({ useTaskEvents: () => ({ task: mocks.live }) }));
vi.mock("../../shared/composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
import Page from "./page.vue";
import { NPagination, NSlider } from "naive-ui";
import VideoWorkspace from "./VideoWorkspace.vue";
const Button = defineComponent({
  props: { disabled: Boolean, loading: Boolean },
  emits: ["click"],
  template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>'
});
const Pagination = defineComponent({
  name: "TestPagination",
  props: { page: Number, itemCount: Number },
  emits: ["update:page"],
  template: '<div><slot name="prefix" /></div>'
});
const wrappers: ReturnType<typeof mount>[] = [];
const task = (status = "pending") => ({
  id: "video_task1",
  status,
  mode: "delogo",
  progress: status === "pending" ? 0 : 100,
  inputName: "clip.mp4",
  inputBytes: 5,
  warnings: [],
  segments: [],
  queuePosition: null,
  createdAt: "2026-11-05T00:00:00Z",
  updatedAt: "2026-11-05T00:00:00Z",
  expiresAt: null,
  output: status === "completed" ? { width: 64, height: 48, bytes: 50, downloadUrl: "/output/video_task1" } : null
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.live = ref();
  mocks.confirm.mockResolvedValue(true);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:video");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  mocks.health.mockResolvedValue({
    available: true,
    engines: [
      { provider: "delogo", available: true },
      { provider: "fast", available: true },
      { provider: "balanced", available: false, reason: "引擎未安装" }
    ]
  });
  mocks.history.mockResolvedValue({ items: [], total: 0 });
  mocks.create.mockResolvedValue(task());
  mocks.get.mockResolvedValue(task("canceled"));
  mocks.cancel.mockResolvedValue(task("canceled"));
  mocks.remove.mockResolvedValue({ deleted: true });
});
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  vi.restoreAllMocks();
});
async function setup() {
  const wrapper = mount(Page, {
    global: {
      stubs: {
        ToolLayout: { template: "<main><slot /></main>" },
        ToolPageHeader: true,
        NButton: Button,
        NAlert: { template: "<div><slot /></div>" },
        NProgress: true,
        NPagination: Pagination,
        RouterLink: { props: ["to"], template: '<a :href="to"><slot /></a>' }
      }
    }
  });
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}
async function select(wrapper: ReturnType<typeof mount>) {
  const input = wrapper.get('input[type="file"]');
  Object.defineProperty(input.element, "files", { configurable: true, value: [new File(["video"], "clip.mp4")] });
  await input.trigger("change");
  await flushPromises();
}
const button = (w: ReturnType<typeof mount>, text: string) => w.findAll("button").find((b) => b.text() === text)!;
it("explains each unavailable sequence tier and links to the GPU capability update without claiming an installation exists", async () => {
  const w = await setup();
  expect(w.text()).toContain("均衡不可用：引擎未安装");
  expect(w.text()).toContain("极致不可用：当前能力未提供该引擎");
  expect(w.text()).toContain("查看视频能力更新");
});
it("exposes both sequence tiers when the real health protocol says they are available", async () => {
  mocks.health.mockResolvedValue({
    available: true,
    engines: ["delogo", "fast", "balanced", "extreme"].map((provider) => ({ provider, available: true }))
  });
  const w = await setup();
  for (const label of ["均衡时序修复", "极致光流修复"])
    expect(
      w
        .findAll(".mode-card")
        .find((item) => item.text() === label)
        ?.attributes("disabled")
    ).toBeUndefined();
  expect(w.text()).not.toContain("查看视频能力更新");
});
it("disables missing engines, keeps the pending task busy and only exposes real completed results", async () => {
  const w = await setup();
  await select(w);
  expect(
    w
      .findAll(".mode-card")
      .find((item) => item.text() === "均衡时序修复")
      ?.attributes("disabled")
  ).toBeDefined();
  await button(w, "开始处理").trigger("click");
  await flushPromises();
  expect(mocks.create).toHaveBeenCalledTimes(1);
  expect(button(w, "开始处理").attributes("disabled")).toBeDefined();
  expect(w.text()).not.toContain("处理完成：");
  expect(w.find(".completed-card").exists()).toBe(false);
  await button(w, "取消任务").trigger("click");
  await flushPromises();
  expect(mocks.cancel).toHaveBeenCalledWith("video_task1");
  expect(button(w, "开始处理").attributes("disabled")).toBeUndefined();
});
it("keeps the confirmed manual rectangle and measures pointer movement against the whole preview", async () => {
  const w = await setup();
  await select(w);
  await button(w, "手动框选").trigger("click");
  const overlay = w.get(".overlay"),
    element = overlay.element as HTMLElement;
  element.setPointerCapture = vi.fn();
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    left: 100,
    top: 50,
    width: 400,
    height: 200
  } as DOMRect);
  await overlay.trigger("pointerdown", { clientX: 200, clientY: 100, pointerId: 1 });
  await overlay.trigger("pointermove", { clientX: 400, clientY: 200, pointerId: 1 });
  await overlay.trigger("pointerup");
  await button(w, "完成框选").trigger("click");
  await button(w, "开始处理").trigger("click");
  await flushPromises();
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ manualArea: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } }),
    expect.anything()
  );
  w.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:video");
});
it("keeps multiple boxes per time range and submits seconds without assuming a frame rate", async () => {
  const w = await setup();
  await select(w);
  w.findComponent(VideoWorkspace).vm.$emit("metadata", { width: 400, height: 200, duration: 10 });
  await flushPromises();
  await button(w, "手动框选").trigger("click");
  await flushPromises();
  const overlay = w.get(".overlay"),
    element = overlay.element as HTMLElement;
  element.setPointerCapture = vi.fn();
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 400, height: 200 } as DOMRect);
  async function draw(y: number) {
    await overlay.trigger("pointerdown", { clientX: 40, clientY: y, pointerId: 1 });
    await overlay.trigger("pointermove", { clientX: 360, clientY: y + 20, pointerId: 1 });
    await overlay.trigger("pointerup");
    await flushPromises();
  }
  await draw(20);
  await draw(140);
  expect(w.findAll(".subtitle-rect.saved")).toHaveLength(2);
  w.findComponent(NSlider).vm.$emit("update:value", [2, 5]);
  await flushPromises();
  await button(w, "添加区间").trigger("click");
  await flushPromises();
  w.findComponent(NSlider).vm.$emit("update:value", [6, 9]);
  await flushPromises();
  await draw(100);
  await button(w, "完成框选").trigger("click");
  expect(w.findAll(".subtitle-rect.saved")).toHaveLength(1);
  await button(w, "开始处理").trigger("click");
  await flushPromises();
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({
      manualArea: undefined,
      segments: undefined,
      manualRanges: [
        {
          start: 2,
          end: 5,
          rects: [
            { x: 0.1, y: 0.1, width: 0.8, height: 0.1 },
            { x: 0.1, y: 0.7, width: 0.8, height: 0.1 }
          ]
        },
        { start: 6, end: 9, rects: [{ x: 0.1, y: 0.5, width: 0.8, height: 0.1 }] }
      ]
    }),
    expect.anything()
  );
});
it("paginates history with totals and asks before permanent deletion", async () => {
  mocks.history.mockResolvedValue({ items: [task("completed")], total: 41 });
  const w = await setup();
  expect(w.text()).toContain("共 41 条");
  w.findComponent(NPagination).vm.$emit("update:page", 2);
  await flushPromises();
  expect(mocks.history).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 }, expect.anything());
  mocks.confirm.mockResolvedValueOnce(false);
  await button(w, "删除").trigger("click");
  await flushPromises();
  expect(mocks.remove).not.toHaveBeenCalled();
  await button(w, "删除").trigger("click");
  await flushPromises();
  expect(mocks.remove).toHaveBeenCalledWith("video_task1");
});

it("uses confirmed automatic detection segments and displays only the matching completed task", async () => {
  const segment = { rect: { x: 0.1, y: 0.8, width: 0.8, height: 0.1 }, startFrame: 0, endFrame: 9, confidence: 0.9 };
  mocks.detect.mockResolvedValue({ width: 64, height: 48, frameCount: 10, segments: [segment], warnings: [] });
  const w = await setup();
  await select(w);
  await button(w, "自动检测字幕").trigger("click");
  await flushPromises();
  expect(w.text()).toContain("检测到 1 处字幕区域");
  await button(w, "开始处理").trigger("click");
  await flushPromises();
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ segments: [{ rect: segment.rect, startFrame: 0, endFrame: 9 }] }),
    expect.anything()
  );
  const live = mocks.live as { value: unknown };
  mocks.get.mockClear();
  live.value = { ...task("completed"), id: "another_task" };
  await flushPromises();
  expect(mocks.get).not.toHaveBeenCalled();
  mocks.get.mockResolvedValue(task("completed"));
  live.value = task("completed");
  await flushPromises();
  expect(w.get(".workspace-video").attributes("src")).toBe("/output/video_task1?preview=1");
  expect(w.text()).toContain("64 × 48");
});
it("ignores late history and health responses after navigation or a newer page request", async () => {
  let finish!: (value: unknown) => void;
  mocks.health.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const w = await setup();
  w.unmount();
  finish({ available: true, engines: [] });
  await flushPromises();
  expect(mocks.history).toHaveBeenCalledTimes(1);
  expect((mocks.history.mock.calls[0]?.[1] as AbortSignal).aborted).toBe(true);
  mocks.history.mockResolvedValue({ items: [task("completed")], total: 41 });
  const second = await setup();
  let stale!: (value: unknown) => void;
  mocks.history.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        stale = resolve;
      })
  );
  second.findComponent(NPagination).vm.$emit("update:page", 2);
  await nextTick();
  mocks.history.mockResolvedValue({ items: [{ ...task("completed"), inputName: "new page.mp4" }], total: 41 });
  second.findComponent(NPagination).vm.$emit("update:page", 3);
  await flushPromises();
  stale({ items: [{ ...task("completed"), inputName: "stale.mp4" }], total: 41 });
  await flushPromises();
  expect(second.text()).toContain("new page.mp4");
  expect(second.text()).not.toContain("stale.mp4");
});
it.each([
  ["loading", "正在加载修复模型"],
  ["estimating-flow", "估计连续帧光流"],
  ["propagating", "补全光流与传播画面"]
])("shows %s as a running phase without exposing a successful output", async (phase, label) => {
  mocks.create.mockResolvedValue({ ...task("running"), phase, progress: 1 });
  const w = await setup();
  await select(w);
  await button(w, "开始处理").trigger("click");
  await flushPromises();
  expect(w.text()).toContain(label);
  expect(w.find(".completed-card").exists()).toBe(false);
});

it("keeps the active task subscription when a history result is inspected", async () => {
  const archived = { ...task("completed"), id: "video_history", inputName: "history.mp4" };
  mocks.history.mockResolvedValue({ items: [archived], total: 1 });
  const w = await setup();
  await select(w);
  await button(w, "开始处理").trigger("click");
  await flushPromises();

  mocks.get.mockResolvedValueOnce(archived);
  await button(w, "查看").trigger("click");
  await flushPromises();
  expect(w.text()).toContain("正在查看历史任务：history.mp4");

  mocks.get.mockClear();
  mocks.get.mockResolvedValue(task("running"));
  const live = mocks.live as { value: unknown };
  live.value = { ...task("running"), progress: 25 };
  await flushPromises();
  expect(mocks.get).toHaveBeenCalledWith("video_task1", expect.anything());
  expect(w.text()).toContain("正在查看历史任务：history.mp4");
});

it("shows a failed task error once and removes duplicate warning messages", async () => {
  const failed = {
    ...task("failed"),
    id: "video_failed",
    error: "处理服务连接中断",
    warnings: ["处理服务连接中断", "可以检查运行诊断", "可以检查运行诊断"]
  };
  mocks.history.mockResolvedValue({ items: [failed], total: 1 });
  mocks.get.mockResolvedValue(failed);
  const w = await setup();
  await button(w, "查看").trigger("click");
  await flushPromises();
  expect(w.get(".error-card").text()).toContain("处理服务连接中断");
  expect(w.findAll(".warning-card li")).toHaveLength(1);
  expect(w.get(".warning-card").text()).toContain("可以检查运行诊断");
});
