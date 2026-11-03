// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Waveform from "./AudioWaveform.vue";
const mocks = vi.hoisted(() => ({
  waveEvents: new Map<string, (...args: unknown[]) => void>(),
  regionEvents: new Map<string, (...args: unknown[]) => void>(),
  create: vi.fn(),
  add: vi.fn(),
  drag: vi.fn(),
  destroy: vi.fn(),
  peaks: vi.fn()
}));
vi.mock("wavesurfer.js", () => ({ default: { create: mocks.create } }));
vi.mock("wavesurfer.js/dist/plugins/regions.js", () => ({
  default: {
    create: () => ({
      on: (name: string, fn: (...args: unknown[]) => void) => mocks.regionEvents.set(name, fn),
      addRegion: mocks.add,
      enableDragSelection: mocks.drag
    })
  }
}));
vi.mock("./waveform-peaks", () => ({ loadWaveformPeaks: mocks.peaks }));
let wrapper: VueWrapper | undefined;
beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", undefined);
  vi.clearAllMocks();
  mocks.waveEvents.clear();
  mocks.regionEvents.clear();
  mocks.peaks.mockResolvedValue(new Float32Array([0.1, 0.4]));
  mocks.create.mockImplementation(() => ({
    on: (name: string, fn: (...args: unknown[]) => void) => mocks.waveEvents.set(name, fn),
    destroy: mocks.destroy,
    setTime: vi.fn(),
    toggleInteraction: vi.fn(),
    getRenderer: () => ({ getVisibleRange: () => ({ value: { startTime: 0, endTime: 20 } }) }),
    setScrollTime: vi.fn(),
    getCurrentTime: () => 0
  }));
  mocks.add.mockImplementation((options) => ({
    ...options,
    element: document.createElement("div"),
    setOptions: vi.fn(),
    remove: vi.fn()
  }));
  mocks.drag.mockReturnValue(vi.fn());
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.unstubAllGlobals();
});
async function open(fixed = false, editing = true) {
  wrapper = mount(Waveform, {
    props: {
      url: "/track.mp3",
      title: "歌曲",
      duration: 120,
      position: 0,
      range: [0, 22],
      editing,
      disabled: false,
      available: true,
      ...(fixed ? { fixedRangeDuration: 22 } : {})
    }
  });
  await flushPromises();
  mocks.waveEvents.get("ready")!();
  await flushPromises();
  return wrapper;
}
it("locks a video-length region against resizing and clamps dragging and keyboard moves", async () => {
  const w = await open(true);
  expect(mocks.add).toHaveBeenCalledWith(
    expect.objectContaining({ start: 0, end: 22, minLength: 0, maxLength: Infinity, resize: false, drag: true })
  );
  expect(mocks.drag).not.toHaveBeenCalled();
  expect(w.classes()).toContain("is-fixed-range");
  expect(w.text()).toContain("拖动蓝色选区");
  expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ color: "rgba(37,99,235,0.26)", content: "拖动" }));
  expect(mocks.create).toHaveBeenCalledWith(
    expect.objectContaining({ waveColor: "#64748b", progressColor: "#64748b" })
  );
  mocks.regionEvents.get("region-update")!({ start: 110, end: 132 });
  expect(w.emitted("update:range")?.at(-1)).toEqual([[98, 120]]);
  // The SDK adds deltas to both ends independently: tiny float differences must not block a move.
  mocks.regionEvents.get("region-update")!({ start: 56.1, end: 78.10000000000001 });
  expect(w.emitted("update:range")?.at(-1)).toEqual([[56.1, 78.1]]);
  await w.get('[role="group"]').trigger("keydown", { key: "End" });
  expect(w.emitted("update:range")?.at(-1)).toEqual([[98, 120]]);
  await w.setProps({ disabled: true });
  const count = w.emitted("update:range")!.length;
  mocks.regionEvents.get("region-update")!({ start: 20, end: 42 });
  expect(w.emitted("update:range")).toHaveLength(count);
  const signal = mocks.peaks.mock.calls[0][2] as AbortSignal;
  w.unmount();
  wrapper = undefined;
  expect(signal.aborted).toBe(true);
  expect(mocks.destroy).toHaveBeenCalledOnce();
});
it("preserves freely resizable library regions and drag selection by default", async () => {
  const w = await open();
  expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ minLength: 0.05, resize: true }));
  expect(mocks.drag).toHaveBeenCalledOnce();
  mocks.regionEvents.get("region-update")!({ start: 10, end: 11 });
  expect(w.emitted("update:range")?.at(-1)).toEqual([[10, 11]]);
});
it("seeks on waveform interaction and keyboard without creating an editing region", async () => {
  const w = await open(false, false);
  expect(mocks.add).not.toHaveBeenCalled();
  mocks.waveEvents.get("interaction")!(35);
  expect(w.emitted("seek")?.at(-1)).toEqual([35]);
  await w.get('[role="slider"]').trigger("keydown", { key: "End" });
  expect(w.emitted("seek")?.at(-1)).toEqual([120]);
  await w.setProps({ position: 35 });
  await w.get('[role="slider"]').trigger("keydown", { key: "ArrowLeft" });
  expect(w.emitted("seek")?.at(-1)?.[0]).toBeCloseTo(34.9);
  await w.setProps({ disabled: true });
  const count = w.emitted("seek")!.length;
  mocks.waveEvents.get("interaction")!(10);
  expect(w.emitted("seek")).toHaveLength(count);
});
