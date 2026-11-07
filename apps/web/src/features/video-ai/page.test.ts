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
vi.mock("./api", () => ({
  videoAiApi: { ...mocks, outputUrl: (id: string) => `/output/${id}`, inputUrl: (id: string) => `/input/${id}` }
}));
vi.mock("../../shared/composables/useTaskEvents", () => ({ useTaskEvents: () => ({ task: mocks.live }) }));
vi.mock("../../shared/composables/useConfirmDialog", () => ({ useConfirmDialog: () => mocks.confirm }));
import Page from "./page.vue";
import { NPagination } from "naive-ui";
import VideoTimeline from "./VideoTimeline.vue";
import VideoWorkspace from "./VideoWorkspace.vue";
import SubtitleRegion from "./SubtitleRegion.vue";
import VideoHistoryThumbnail from "./VideoHistoryThumbnail.vue";
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
it("automatically enables video processing when the desktop worker becomes ready after opening the page", async () => {
  vi.useFakeTimers();
  try {
    mocks.health.mockRejectedValueOnce(Object.assign(new Error("正在后台准备"), { code: "WORKER_PREPARING" }));
    const w = await setup();
    await select(w);
    expect(w.text()).toContain("无需手动刷新");
    expect(w.find(".availability-note").exists()).toBe(false);
    expect(button(w, "自动检测字幕").attributes("disabled")).toBeDefined();
    expect(button(w, "开始处理").attributes("disabled")).toBeDefined();
    await vi.advanceTimersByTimeAsync(2000);
    await flushPromises();
    expect(mocks.health).toHaveBeenCalledTimes(2);
    expect(button(w, "自动检测字幕").attributes("disabled")).toBeUndefined();
    expect(button(w, "开始处理").attributes("disabled")).toBeUndefined();
    expect(w.text()).not.toContain("无需手动刷新");
    w.unmount();
  } finally {
    vi.useRealTimers();
  }
});
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
  const timeline = () => w.findComponent(VideoTimeline);
  timeline().vm.$emit("seek", 7);
  await flushPromises();
  timeline().vm.$emit("select", 0);
  await flushPromises();
  expect((w.get("video").element as HTMLVideoElement).currentTime).toBe(7);
  timeline().vm.$emit(
    "update:ranges",
    timeline()
      .props("ranges")
      .map((range) => ({ ...range, start: 2, end: 5 }))
  );
  await flushPromises();
  await button(w, "添加区间").trigger("click");
  await flushPromises();
  expect(timeline().props("ranges")[1]).toEqual({ start: 7, end: 10, rects: [] });
  timeline().vm.$emit(
    "update:ranges",
    timeline()
      .props("ranges")
      .map((range, index) => (index === 1 ? { ...range, start: 6, end: 9 } : range))
  );
  await flushPromises();
  await draw(100);
  await button(w, "完成框选").trigger("click");
  timeline().vm.$emit("seek", 7);
  await flushPromises();
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
it("starts the first manual interval at the playhead and refuses an empty interval at the video end", async () => {
  const w = await setup();
  await select(w);
  w.findComponent(VideoWorkspace).vm.$emit("metadata", { width: 400, height: 200, duration: 10 });
  await flushPromises();
  const timeline = w.findComponent(VideoTimeline);
  timeline.vm.$emit("seek", 2.5);
  await flushPromises();
  await button(w, "添加区间").trigger("click");
  await flushPromises();
  expect(timeline.props("ranges")).toEqual([{ start: 2.5, end: 10, rects: [] }]);
  timeline.vm.$emit("seek", 10);
  await flushPromises();
  expect(button(w, "添加区间").attributes("disabled")).toBeDefined();
  await button(w, "添加区间").trigger("click");
  expect(timeline.props("ranges")).toHaveLength(1);
  expect(w.text()).toContain("指针已到视频结尾");
});
it("edits and deletes the selected box without changing other boxes or intervals", async () => {
  const w = await setup();
  await select(w);
  const workspace = w.findComponent(VideoWorkspace);
  workspace.vm.$emit("metadata", { width: 400, height: 200, duration: 10 });
  const first = { x: 0.1, y: 0.1, width: 0.3, height: 0.1 };
  const second = { ...first, y: 0.7 };
  workspace.vm.$emit("update:manual-ranges", [
    { start: 0, end: 5, rects: [first, second] },
    { start: 6, end: 9, rects: [first] }
  ]);
  await flushPromises();
  expect(w.find(".range-tabs").exists()).toBe(false);
  expect(button(w, "添加区间").exists()).toBe(true);
  const region = w.findAllComponents(SubtitleRegion)[0];
  region.vm.$emit("select");
  region.vm.$emit("update", { ...first, x: 0.2 });
  await flushPromises();
  expect(w.findComponent(VideoTimeline).props("ranges")[0].rects[0].x).toBe(0.2);
  await region.trigger("keydown", { key: "Backspace" });
  await flushPromises();
  expect(w.findComponent(VideoTimeline).props("ranges")).toEqual([
    { start: 0, end: 5, rects: [second] },
    { start: 6, end: 9, rects: [first] }
  ]);
  await w.get('input[type="file"]').trigger("keydown", { key: "Delete" });
  expect(w.findComponent(VideoTimeline).props("ranges")[0].rects).toHaveLength(1);
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

it("shows a clickable first-frame preview only for completed history results", async () => {
  const saved = task("completed");
  mocks.history.mockResolvedValue({ items: [saved, { ...task("failed"), id: "failed_task" }], total: 2 });
  mocks.get.mockResolvedValue(saved);
  const w = await setup();
  const thumbnails = w.findAllComponents(VideoHistoryThumbnail);
  expect(thumbnails).toHaveLength(2);
  expect(thumbnails[0].props("src")).toBe("/output/video_task1?preview=1");
  expect(thumbnails[1].props("src")).toBeUndefined();
  thumbnails[0].vm.$emit("view");
  await flushPromises();
  expect(mocks.get).toHaveBeenCalledWith(saved.id, expect.anything());
});

it("re-edits a saved result and restores its saved time ranges and boxes", async () => {
  const saved = {
    ...task("completed"),
    segments: [{ rect: { x: 0.1, y: 0.1, width: 0.5, height: 0.1 }, startFrame: 0, endFrame: 9 }],
    output: { ...task("completed").output!, durationMs: 1000 },
    manualRanges: [{ start: 0, end: 1, rects: [{ x: 0.1, y: 0.1, width: 0.5, height: 0.1 }] }]
  };
  mocks.history.mockResolvedValue({ items: [saved], total: 1 });
  mocks.get.mockResolvedValue(saved);
  const w = await setup();
  await button(w, "编辑成品").trigger("click");
  await flushPromises();
  const workspace = w.findComponent(VideoWorkspace);
  expect(workspace.props()).toMatchObject({
    src: "/output/video_task1?preview=1",
    sourceKind: "original",
    editable: true,
    duration: 1,
    manualRanges: saved.manualRanges,
    segments: []
  });
  expect(w.text()).toContain("原视频和旧结果均保留");
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  const rect = { x: 0.1, y: 0.7, width: 0.5, height: 0.1 };
  const ranges = [{ start: 0.2, end: 0.8, rects: [rect] }];
  workspace.vm.$emit("update:manual-ranges", ranges);
  await flushPromises();
  await button(w, "开始处理").trigger("click");
  await flushPromises();
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ sourceTaskId: saved.id, file: undefined, manualRanges: ranges }),
    expect.anything()
  );
  expect(button(w, "编辑成品").attributes("disabled")).toBeDefined();
  expect(mocks.remove).not.toHaveBeenCalled();
});

it("edits the retained original, restores multi-box intervals and submits the selected source version", async () => {
  const rect = { x: 0.1, y: 0.2, width: 0.5, height: 0.1 };
  const ranges = [{ start: 0.2, end: 0.8, rects: [rect, { ...rect, y: 0.7 }] }];
  const saved = {
    ...task("completed"),
    inputRetained: true,
    manualRanges: ranges,
    inputMetadata: { width: 64, height: 48, fps: 10, frameCount: 10, durationMs: 1000 },
    output: { ...task("completed").output!, durationMs: 1000 }
  };
  mocks.history.mockResolvedValue({ items: [saved], total: 1 });
  mocks.get.mockResolvedValue(saved);
  const w = await setup();
  await button(w, "查看").trigger("click");
  await flushPromises();
  expect(w.findComponent(VideoWorkspace).props("showSourceSwitch")).toBe(true);
  w.findComponent(VideoWorkspace).vm.$emit("change-source", "original");
  await flushPromises();
  expect(w.findComponent(VideoWorkspace).props("src")).toBe("/input/video_task1?preview=1");
  await button(w, "编辑原视频").trigger("click");
  await flushPromises();
  const workspace = w.findComponent(VideoWorkspace);
  expect(workspace.props()).toMatchObject({
    src: "/input/video_task1?preview=1",
    manualRanges: ranges,
    editable: true,
    duration: 1
  });
  expect(w.text()).toContain("正在编辑留档原视频");
  const changed = [{ ...ranges[0], start: 0.3, rects: [rect] }];
  workspace.vm.$emit("update:manual-ranges", changed);
  await flushPromises();
  expect(saved.manualRanges).toEqual(ranges);
  await button(w, "开始处理").trigger("click");
  await flushPromises();
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ sourceTaskId: saved.id, sourceVersion: "original", manualRanges: changed }),
    expect.anything()
  );
});

it("restores frame-based or whole-video boxes and disables originals unavailable in old records", async () => {
  const rect = { x: 0.1, y: 0.2, width: 0.5, height: 0.1 };
  const saved = {
    ...task("completed"),
    segments: [{ rect, startFrame: 2, endFrame: 7 }],
    inputMetadata: { width: 64, height: 48, fps: 10, frameCount: 10, durationMs: 1000 },
    output: { ...task("completed").output!, durationMs: 1000 }
  };
  mocks.history.mockResolvedValue({ items: [saved], total: 1 });
  mocks.get.mockResolvedValue(saved);
  const w = await setup();
  expect(button(w, "编辑原视频").attributes("disabled")).toBeDefined();
  await button(w, "编辑成品").trigger("click");
  await flushPromises();
  expect(w.findComponent(VideoWorkspace).props("manualRanges")).toEqual([{ start: 0.2, end: 0.8, rects: [rect] }]);
  mocks.get.mockResolvedValue({ ...saved, manualArea: rect });
  await button(w, "编辑成品").trigger("click");
  await flushPromises();
  expect(w.findComponent(VideoWorkspace).props("manualRanges")).toEqual([{ start: 0, end: 1, rects: [rect] }]);
});

it("detects a saved result and replaces the editing source when a new file is selected", async () => {
  const saved = task("completed");
  mocks.history.mockResolvedValue({ items: [saved], total: 1 });
  mocks.get.mockResolvedValue(saved);
  mocks.detect.mockResolvedValue({ segments: [], warnings: [], frameCount: 10, width: 64, height: 48 });
  const w = await setup();
  await button(w, "编辑成品").trigger("click");
  await flushPromises();
  await button(w, "自动检测字幕").trigger("click");
  await flushPromises();
  expect(mocks.detect).toHaveBeenCalledWith({ sourceTaskId: saved.id, sourceVersion: "output" }, expect.anything());
  await select(w);
  expect(w.text()).not.toContain("正在编辑处理后的视频");
  await button(w, "开始处理").trigger("click");
  await flushPromises();
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ file: expect.any(File), sourceTaskId: undefined }),
    expect.anything()
  );
  w.unmount();
  expect(URL.revokeObjectURL).not.toHaveBeenCalledWith("/output/video_task1?preview=1");
});

it("keeps the current upload when re-editing fails and only offers editing for completed outputs", async () => {
  mocks.history.mockResolvedValue({ items: [task("failed"), { ...task("completed"), id: "saved_result" }], total: 2 });
  const w = await setup();
  expect(w.findAll("button").filter((b) => b.text() === "编辑成品")).toHaveLength(1);
  await select(w);
  mocks.get.mockRejectedValueOnce(new Error("该视频已被删除"));
  await button(w, "编辑成品").trigger("click");
  await flushPromises();
  expect(w.text()).toContain("该视频已被删除");
  expect(w.findComponent(VideoWorkspace).props("src")).toBe("blob:video");
  expect(w.findComponent(VideoWorkspace).props("editable")).toBe(true);
});

it("ignores a late edit response after another history record was opened", async () => {
  const first = task("completed");
  const second = { ...task("completed"), id: "saved_second", inputName: "second.mp4" };
  mocks.history.mockResolvedValue({ items: [first, second], total: 2 });
  let finish!: (value: unknown) => void;
  mocks.get.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const w = await setup();
  await button(w, "编辑成品").trigger("click");
  mocks.get.mockResolvedValueOnce(second);
  await w
    .findAll("button")
    .filter((b) => b.text() === "查看")[1]
    .trigger("click");
  await flushPromises();
  finish(first);
  await flushPromises();
  expect(w.text()).toContain("正在查看历史任务：second.mp4");
  expect(w.text()).not.toContain("正在编辑处理后的视频");
});

it("uses confirmed automatic detection segments and displays only the matching completed task", async () => {
  const segment = { rect: { x: 0.1, y: 0.8, width: 0.8, height: 0.1 }, startFrame: 0, endFrame: 9, confidence: 0.9 };
  mocks.detect.mockResolvedValue({ width: 64, height: 48, frameCount: 10, fps: 10, segments: [segment], warnings: [] });
  const w = await setup();
  await select(w);
  await button(w, "自动检测字幕").trigger("click");
  await flushPromises();
  expect(w.text()).toContain("检测到 1 处字幕区域");
  await button(w, "开始处理").trigger("click");
  await flushPromises();
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ manualRanges: [{ start: 0, end: 1, rects: [segment.rect] }], segments: undefined }),
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

it("automatically creates editable multi-box ranges, reveals the first interval and submits manual adjustments", async () => {
  const rect = { x: 0.1, y: 0.2, width: 0.5, height: 0.1 };
  const segments = [
    { rect, startFrame: 10, endFrame: 19, confidence: 0.9 },
    { rect: { ...rect, y: 0.7 }, startFrame: 10, endFrame: 19, confidence: 0.9 },
    { rect, startFrame: 30, endFrame: 39, confidence: 0.9 }
  ];
  mocks.detect.mockResolvedValue({
    width: 400,
    height: 200,
    frameCount: 50,
    fps: 10,
    segments,
    warnings: ["请检查框选"]
  });
  const w = await setup();
  await select(w);
  await button(w, "自动检测字幕").trigger("click");
  await flushPromises();
  expect(w.text()).toContain("已创建 2 个区间");
  expect(w.text()).toContain("请检查框选");
  const timeline = w.findComponent(VideoTimeline);
  expect(timeline.props("duration")).toBe(5);
  expect(timeline.props("currentTime")).toBe(1);
  expect(timeline.props("ranges")).toEqual([
    { start: 1, end: 2, rects: [rect, { ...rect, y: 0.7 }] },
    { start: 3, end: 4, rects: [rect] }
  ]);
  expect(w.findAllComponents(SubtitleRegion)).toHaveLength(2);
  const region = w.findAllComponents(SubtitleRegion)[0];
  region.vm.$emit("select");
  await flushPromises();
  expect(w.findAll(".region-handle")).toHaveLength(8);
  region.vm.$emit("update", { ...rect, x: 0.2, width: 0.6 });
  await flushPromises();
  timeline.vm.$emit(
    "update:ranges",
    timeline.props("ranges").map((range, i) => (i === 1 ? { ...range, end: 4.5 } : range))
  );
  await flushPromises();
  expect(segments[0].rect.x).toBe(0.1);
  await button(w, "开始处理").trigger("click");
  await flushPromises();
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({
      manualRanges: [
        {
          start: 1,
          end: 2,
          rects: [
            { ...rect, x: 0.2, width: 0.6 },
            { ...rect, y: 0.7 }
          ]
        },
        { start: 3, end: 4.5, rects: [rect] }
      ],
      segments: undefined
    }),
    expect.anything()
  );
});

it("preserves existing edits if timing is invalid and never truncates a detection above the editing limit", async () => {
  const rect = { x: 0, y: 0.7, width: 1, height: 0.1 };
  const w = await setup();
  await select(w);
  w.findComponent(VideoWorkspace).vm.$emit("metadata", { width: 64, height: 48, duration: 3 });
  w.findComponent(VideoWorkspace).vm.$emit("update:manual-ranges", [{ start: 0, end: 1, rects: [rect] }]);
  await flushPromises();
  mocks.detect.mockResolvedValue({
    width: 64,
    height: 48,
    frameCount: 30,
    fps: 0,
    segments: [{ rect, startFrame: 0, endFrame: 1 }],
    warnings: []
  });
  await button(w, "自动检测字幕").trigger("click");
  await flushPromises();
  expect(w.findComponent(VideoTimeline).props("ranges")).toEqual([{ start: 0, end: 1, rects: [rect] }]);
  expect(w.text()).toContain("帧率或视频时长");
  mocks.detect.mockResolvedValue({
    width: 64,
    height: 48,
    frameCount: 30,
    fps: 10,
    segments: Array.from({ length: 21 }, (_, i) => ({ rect, startFrame: i, endFrame: i, confidence: 0.9 })),
    warnings: []
  });
  await button(w, "自动检测字幕").trigger("click");
  await flushPromises();
  expect(w.findComponent(VideoTimeline).props("ranges")).toHaveLength(21);
  expect(w.text()).toContain("识别结果已全部保留");
  expect(button(w, "开始处理").attributes("disabled")).toBeDefined();
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
