// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import SubtitleRegion from "./SubtitleRegion.vue";
const rect = { x: 0.2, y: 0.3, width: 0.5, height: 0.1 };
const wrappers: ReturnType<typeof mount>[] = [];
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  vi.restoreAllMocks();
});
function setup(editable = true) {
  const w = mount(SubtitleRegion, {
    props: { rect, label: 1, selected: true, editable, surfaceWidth: 500, surfaceHeight: 1000 }
  });
  wrappers.push(w);
  const element = w.element as HTMLElement;
  element.setPointerCapture = vi.fn();
  element.hasPointerCapture = vi.fn(() => false);
  return w;
}
it("moves in image coordinates and clamps the entire box inside the video", async () => {
  const w = setup();
  await w.trigger("pointerdown", { button: 0, clientX: 100, clientY: 300, pointerId: 1 });
  await w.trigger("pointermove", { clientX: 150, clientY: 400, pointerId: 1 });
  const moved = w.emitted("update")?.at(-1)?.[0] as typeof rect;
  expect(moved.x).toBeCloseTo(0.3);
  expect(moved.y).toBeCloseTo(0.4);
  expect(moved.width).toBe(rect.width);
  expect(moved.height).toBe(rect.height);
  await w.trigger("pointermove", { clientX: 10000, clientY: -1000, pointerId: 1 });
  expect(w.emitted("update")?.at(-1)).toEqual([{ ...rect, x: 0.5, y: 0 }]);
  await w.trigger("pointerup");
});
it("resizes width and height using corner handles and restores the original box on cancel", async () => {
  const w = setup();
  expect(w.findAll(".region-handle")).toHaveLength(8);
  await w.get(".se").trigger("pointerdown", { button: 0, clientX: 350, clientY: 400, pointerId: 1 });
  await w.trigger("pointermove", { clientX: 400, clientY: 500, pointerId: 1 });
  const resized = w.emitted("update")?.at(-1)?.[0] as typeof rect;
  expect(resized.width).toBeCloseTo(0.6);
  expect(resized.height).toBeCloseTo(0.2);
  expect(resized.x).toBe(rect.x);
  expect(resized.y).toBe(rect.y);
  await w.trigger("pointercancel");
  expect(w.emitted("update")?.at(-1)).toEqual([rect]);
});
it.each(["Backspace", "Delete"])("%s deletes only the selected editable box", async (key) => {
  const w = setup();
  await w.trigger("keydown", { key });
  expect(w.emitted("remove")).toHaveLength(1);
  await w.setProps({ selected: false });
  await w.trigger("keydown", { key });
  expect(w.emitted("remove")).toHaveLength(1);
  await w.setProps({ selected: true, editable: false });
  await w.trigger("keydown", { key });
  expect(w.emitted("remove")).toHaveLength(1);
});
it("read-only result boxes do not consume pointer editing or deletion", async () => {
  const w = setup(false);
  await w.trigger("pointerdown", { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
  await w.trigger("pointermove", { clientX: 50, clientY: 50, pointerId: 1 });
  expect(w.emitted("update")).toBeUndefined();
  expect(w.findAll(".region-handle")).toHaveLength(0);
});
