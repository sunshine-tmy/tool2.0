// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { toRaw } from "vue";
import { afterEach, expect, it } from "vitest";
import VideoWorkspace from "./VideoWorkspace.vue";
import VideoTimeline from "./VideoTimeline.vue";
const wrappers: ReturnType<typeof mount>[] = [];
afterEach(() => wrappers.splice(0).forEach((w) => w.unmount()));
it.each([
  { duration: 10, time: 3, end: 5 },
  { duration: 10, time: 9.25, end: 10 },
  { duration: 1.5, time: 0, end: 1.5 },
  { duration: 10, time: 10, end: undefined }
])("adds at the playhead with a two-second duration capped at the video end: %o", async ({ duration, time, end }) => {
  const w = mount(VideoWorkspace, {
    props: { src: "blob:preview", sourceKind: "original", editable: true, duration, segments: [], manualRanges: [] }
  });
  wrappers.push(w);
  w.findComponent(VideoTimeline).vm.$emit("seek", time);
  await flushPromises();
  await w
    .findAll("button")
    .find((button) => button.text() === "添加区间")!
    .trigger("click");
  expect(w.emitted("update:manual-ranges")?.at(-1)).toEqual(
    end === undefined ? undefined : [[{ start: time, end, rects: [] }]]
  );
});
it("splits only the selected range, independently copies every box and keeps the playhead at the cut", async () => {
  const rect = { x: 0.1, y: 0.2, width: 0.5, height: 0.1 };
  const ranges = [
    { start: 0, end: 4, rects: [rect] },
    { start: 6, end: 10, rects: [rect, { ...rect, y: 0.6 }] }
  ];
  const w = mount(VideoWorkspace, {
    props: {
      src: "blob:preview",
      sourceKind: "original",
      editable: true,
      duration: 10,
      segments: [],
      manualRanges: ranges,
      "onUpdate:manual-ranges": (value) => {
        void w.setProps({ manualRanges: value });
      }
    }
  });
  wrappers.push(w);
  const timeline = w.findComponent(VideoTimeline);
  timeline.vm.$emit("select", 1);
  timeline.vm.$emit("seek", 7);
  await flushPromises();
  await w
    .findAll("button")
    .find((button) => button.text() === "按指针拆分")!
    .trigger("click");
  await flushPromises();
  const next = timeline.props("ranges");
  expect(next).toEqual([ranges[0], { ...ranges[1], end: 7 }, { ...ranges[1], start: 7 }]);
  expect(timeline.props("activeIndex")).toBe(2);
  expect(timeline.props("currentTime")).toBe(7);
  expect(toRaw(next[0])).toBe(ranges[0]);
  next[1].rects[0].x = 0.4;
  expect(next[2].rects[0].x).toBe(0.1);
  expect(rect.x).toBe(0.1);
});
it("rejects cuts outside the selected range, at its endpoints or beyond existing range and box limits", async () => {
  const rect = { x: 0.1, y: 0.2, width: 0.5, height: 0.1 };
  const range = { start: 2, end: 4, rects: [rect] };
  const w = mount(VideoWorkspace, {
    props: {
      src: "blob:preview",
      sourceKind: "original",
      editable: true,
      duration: 10,
      segments: [],
      manualRanges: [range]
    }
  });
  wrappers.push(w);
  const split = () => w.findAll("button").find((button) => button.text() === "按指针拆分")!;
  for (const time of [0, 2, 4, 9]) {
    w.findComponent(VideoTimeline).vm.$emit("seek", time);
    await flushPromises();
    expect(split().attributes("disabled")).toBeDefined();
    await split().trigger("click");
  }
  expect(w.emitted("update:manual-ranges")).toBeUndefined();
  w.findComponent(VideoTimeline).vm.$emit("seek", 3);
  await flushPromises();
  expect(split().attributes("disabled")).toBeUndefined();
  await w.setProps({ manualRanges: Array.from({ length: 20 }, () => ({ ...range })) });
  expect(split().attributes("disabled")).toBeDefined();
  await w.setProps({ manualRanges: [{ ...range, rects: Array.from({ length: 20 }, () => ({ ...rect })) }] });
  expect(split().attributes("disabled")).toBeDefined();
});
it("selects the owning interval when a box in an overlapping detected interval is focused", async () => {
  const rect = { x: 0.1, y: 0.1, width: 0.5, height: 0.1 };
  const w = mount(VideoWorkspace, {
    props: {
      src: "blob:preview",
      sourceKind: "original",
      editable: true,
      duration: 10,
      segments: [],
      manualRanges: [
        { start: 0, end: 5, rects: [rect] },
        { start: 0, end: 7, rects: [{ ...rect, y: 0.7 }] }
      ]
    }
  });
  wrappers.push(w);
  await w.findAll(".subtitle-rect.saved")[1].trigger("focus");
  await flushPromises();
  expect(w.findComponent(VideoTimeline).props("activeIndex")).toBe(1);
  expect(w.findAll(".region-handle")).toHaveLength(8);
});
it("removes the selected interval and its boxes, retaining other intervals and the playhead", async () => {
  const ranges = [
    { start: 0, end: 4, rects: [{ x: 0.1, y: 0.1, width: 0.5, height: 0.1 }] },
    { start: 6, end: 8, rects: [{ x: 0.2, y: 0.7, width: 0.5, height: 0.1 }] }
  ];
  const w = mount(VideoWorkspace, {
    props: {
      src: "blob:preview",
      sourceKind: "original",
      editable: true,
      duration: 10,
      segments: [],
      manualRanges: ranges,
      "onUpdate:manual-ranges": (value) => {
        void w.setProps({ manualRanges: value });
      }
    }
  });
  wrappers.push(w);
  const timeline = w.findComponent(VideoTimeline);
  timeline.vm.$emit("seek", 3);
  await flushPromises();
  await w.findAll(".clip-label")[1].trigger("keydown", { key: "Backspace" });
  await flushPromises();
  expect(w.emitted("update:manual-ranges")?.at(-1)).toEqual([[ranges[0]]]);
  expect(w.findAll(".timeline-clip")).toHaveLength(1);
  expect(w.findAll(".subtitle-rect.saved")).toHaveLength(1);
  expect(timeline.props("activeIndex")).toBe(0);
  expect(timeline.props("currentTime")).toBe(3);
  await w.get(".clip-label").trigger("keydown", { key: "Delete" });
  await flushPromises();
  expect(w.findAll(".timeline-clip")).toHaveLength(0);
  expect(w.findAll(".subtitle-rect.saved")).toHaveLength(0);
});
it.each([false, true])(
  "shows rectangles only while the playhead is inside their interval (manual=%s)",
  async (manualMode) => {
    const w = mount(VideoWorkspace, {
      props: {
        src: "blob:preview",
        sourceKind: "original",
        editable: true,
        duration: 10,
        segments: [],
        manualMode,
        manualRanges: [
          { start: 2, end: 4, rects: [{ x: 0.1, y: 0.1, width: 0.5, height: 0.1 }] },
          { start: 6, end: 8, rects: [{ x: 0.2, y: 0.7, width: 0.5, height: 0.1 }] }
        ]
      }
    });
    wrappers.push(w);
    const timeline = w.findComponent(VideoTimeline);
    expect(w.findAll(".subtitle-rect.saved")).toHaveLength(0);
    timeline.vm.$emit("seek", 2);
    await flushPromises();
    expect(w.findAll(".subtitle-rect.saved")).toHaveLength(1);
    await w.get(".subtitle-rect.saved").trigger("focus");
    expect(w.findAll(".region-handle")).toHaveLength(8);
    timeline.vm.$emit("seek", 4);
    await flushPromises();
    expect(w.findAll(".subtitle-rect.saved")).toHaveLength(0);
    expect(w.findAll(".region-handle")).toHaveLength(0);
    if (manualMode) expect(w.find(".overlay").exists()).toBe(false);
    const video = w.get("video");
    (video.element as HTMLVideoElement).currentTime = 6.5;
    await video.trigger("timeupdate");
    expect(w.findAll(".subtitle-rect.saved")).toHaveLength(1);
    expect((w.get(".subtitle-rect.saved").element as HTMLElement).style.top).toBe("70%");
    timeline.vm.$emit("seek", 3);
    await flushPromises();
    expect(w.findAll(".subtitle-rect.saved")).toHaveLength(1);
    expect(w.findAll(".region-handle")).toHaveLength(0);
  }
);
