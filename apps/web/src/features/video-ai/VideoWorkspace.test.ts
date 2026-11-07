// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, expect, it } from "vitest";
import VideoWorkspace from "./VideoWorkspace.vue";
import VideoTimeline from "./VideoTimeline.vue";
const wrappers: ReturnType<typeof mount>[] = [];
afterEach(() => wrappers.splice(0).forEach((w) => w.unmount()));
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
