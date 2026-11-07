// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import VideoTimeline from "./VideoTimeline.vue";
const ranges = [
  { start: 1, end: 4, rects: [] },
  { start: 6, end: 8, rects: [] }
];
const wrappers: ReturnType<typeof mount>[] = [];
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  vi.restoreAllMocks();
});
function setup() {
  const w = mount(VideoTimeline, { props: { ranges, duration: 10, currentTime: 0, activeIndex: 0 } });
  wrappers.push(w);
  const track = w.get(".timeline-track");
  const element = track.element as HTMLElement;
  element.setPointerCapture = vi.fn();
  element.hasPointerCapture = vi.fn(() => false);
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({ left: 100, width: 1000 } as DOMRect);
  return { w, track };
}
it.each(["Backspace", "Delete"])("deletes only the focused interval with %s", async (key) => {
  const { w, track } = setup();
  const clip = w.findAll(".timeline-clip")[1];
  await clip.trigger("pointerdown", { button: 0, clientX: 800, pointerId: 1 });
  await track.trigger("pointerup", { clientX: 800, pointerId: 1 });
  const seeks = w.emitted("seek")?.length;
  await clip.get(".trim-handle.end").trigger("keydown", { key });
  expect(w.emitted("remove")).toEqual([[1]]);
  expect(w.emitted("update:ranges")).toBeUndefined();
  expect(w.emitted("seek")?.length).toBe(seeks);
  await clip.trigger("keydown", { key, repeat: true });
  expect(w.emitted("remove")).toHaveLength(1);
});
it("does not delete intervals from text inputs, the playhead, modified keys or composition", async () => {
  const { w } = setup();
  const clip = w.findAll(".timeline-clip")[0];
  for (const modifier of ["metaKey", "ctrlKey", "altKey", "shiftKey", "isComposing"])
    await clip.trigger("keydown", { key: "Backspace", [modifier]: true });
  await w.get('[aria-label="播放指针"]').trigger("keydown", { key: "Delete" });
  for (const tag of ["input", "textarea", "select", "div"]) {
    const input = document.createElement(tag);
    if (tag === "div") input.setAttribute("contenteditable", "true");
    clip.element.append(input);
    const event = new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    input.remove();
  }
  expect(w.emitted("remove")).toBeUndefined();
});
it("seeks the video from the playhead or ruler and snaps to interval edges", async () => {
  const { w, track } = setup();
  await track.trigger("pointerdown", { button: 0, clientX: 497, pointerId: 1 });
  expect(w.emitted("seek")?.at(-1)).toEqual([4]);
  await track.trigger("pointermove", { clientX: 497, pointerId: 1, altKey: true });
  expect(w.emitted("seek")?.at(-1)?.[0]).toBeCloseTo(3.97);
  await track.trigger("pointerup", { pointerId: 1, clientX: 497 });
  const count = w.emitted("seek")?.length;
  await track.trigger("pointermove", { clientX: 800, pointerId: 1 });
  expect(w.emitted("seek")?.length).toBe(count);
});
it.each(["ctrlKey", "metaKey"])(
  "%s + wheel zooms around the pointer without seeking or editing ranges",
  async (modifier) => {
    const { w, track } = setup();
    const viewport = w.get(".timeline-scroll");
    const event = new MouseEvent("wheel", { [modifier]: true, clientX: 600, cancelable: true });
    Object.defineProperties(event, { deltaY: { value: -100 }, deltaMode: { value: 0 } });
    viewport.element.dispatchEvent(event);
    await w.vm.$nextTick();
    const ratio = Math.exp(0.25);
    expect(event.defaultPrevented).toBe(true);
    expect((track.element as HTMLElement).style.width).toBe(`${ratio * 100}%`);
    expect(viewport.element.scrollLeft).toBeCloseTo(500 * (ratio - 1));
    expect(w.emitted("seek")).toBeUndefined();
    expect(w.emitted("update:ranges")).toBeUndefined();
    await viewport.trigger("wheel", { [modifier]: true, deltaY: 100, clientX: 600 });
    expect((track.element as HTMLElement).style.width).toBe("100%");
  }
);
it("leaves ordinary wheel scrolling alone and clamps modified wheel zoom at both limits", async () => {
  const { w, track } = setup();
  const viewport = w.get(".timeline-scroll");
  const ordinary = new WheelEvent("wheel", { deltaY: -100, cancelable: true });
  viewport.element.dispatchEvent(ordinary);
  expect(ordinary.defaultPrevented).toBe(false);
  expect((track.element as HTMLElement).style.width).toBe("100%");
  for (let i = 0; i < 12; i++) await viewport.trigger("wheel", { ctrlKey: true, deltaY: -1000 });
  expect((track.element as HTMLElement).style.width).toBe("1600%");
  for (let i = 0; i < 12; i++) await viewport.trigger("wheel", { metaKey: true, deltaY: 1000, deltaMode: 1 });
  expect((track.element as HTMLElement).style.width).toBe("100%");
});
it("resizes clips to neighbours, preserves unrelated ranges and restores state on cancellation", async () => {
  const { w, track } = setup();
  await w.findAll(".trim-handle.end")[0].trigger("pointerdown", { button: 0, clientX: 500, pointerId: 1 });
  await track.trigger("pointermove", { clientX: 697, pointerId: 1 });
  expect(w.emitted("seek")).toBeUndefined();
  const value = w.emitted("update:ranges")?.at(-1)?.[0] as typeof ranges;
  expect(value[0].end).toBe(6);
  expect(value[1]).toEqual(ranges[1]);
  await track.trigger("pointercancel");
  expect(w.emitted("seek")).toBeUndefined();
  expect(w.emitted("update:ranges")?.at(-1)).toEqual([ranges]);
});
it("moves the interval as one clip with snapping, and keyboard trimming remains possible", async () => {
  const { w, track } = setup();
  await w.findAll(".timeline-clip")[0].trigger("pointerdown", { button: 0, clientX: 300, pointerId: 1 });
  await track.trigger("pointermove", { clientX: 497, pointerId: 1 });
  const value = w.emitted("update:ranges")?.at(-1)?.[0] as typeof ranges;
  expect(value[0]).toEqual({ ...ranges[0], start: 3, end: 6 });
  await track.trigger("pointerup", { pointerId: 1, clientX: 497 });
  expect(w.emitted("seek")).toBeUndefined();
  await w.findAll(".trim-handle.end")[0].trigger("keydown", { key: "ArrowRight" });
  expect((w.emitted("update:ranges")?.at(-1)?.[0] as typeof ranges)[0].end).toBe(4.01);
});
it("only seeks after a plain clip click; small click jitter does not trim or move the clip", async () => {
  const { w, track } = setup();
  await w.findAll(".trim-handle.end")[0].trigger("pointerdown", { button: 0, clientX: 500, pointerId: 1 });
  expect(w.emitted("seek")).toBeUndefined();
  await track.trigger("pointermove", { clientX: 501, pointerId: 1 });
  expect(w.emitted("update:ranges")).toBeUndefined();
  await track.trigger("pointerup", { pointerId: 1, clientX: 501 });
  expect(w.emitted("seek")?.at(-1)).toEqual([4]);
});
it("does not seek when a drag returns to its starting point or loses pointer capture", async () => {
  const { w, track } = setup();
  await w.findAll(".trim-handle.start")[0].trigger("pointerdown", { button: 0, clientX: 200, pointerId: 1 });
  await track.trigger("pointermove", { clientX: 250, pointerId: 1 });
  await track.trigger("pointermove", { clientX: 200, pointerId: 1 });
  await track.trigger("pointerup", { pointerId: 1, clientX: 200 });
  expect(w.emitted("seek")).toBeUndefined();
  await w.findAll(".timeline-clip")[0].trigger("pointerdown", { button: 0, clientX: 300, pointerId: 2 });
  await track.trigger("lostpointercapture", { pointerId: 2 });
  await track.trigger("pointerup", { pointerId: 2, clientX: 300 });
  expect(w.emitted("seek")).toBeUndefined();
});
