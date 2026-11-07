import { expect, it } from "vitest";
import { snapTime, editTimelineRange, segmentsToTimelineRanges } from "./timeline";
const range = { start: 1, end: 4, rects: [] };
it("creates editable intervals from inclusive frame ranges and groups only simultaneous boxes", () => {
  const rect = { x: 0.1, y: 0.2, width: 0.6, height: 0.1 };
  const segments = [
    { rect, startFrame: 60, endFrame: 89 },
    { rect, startFrame: 10, endFrame: 29 },
    { rect: { ...rect, y: 0.7 }, startFrame: 10, endFrame: 29 },
    { rect, startFrame: 20, endFrame: 39 }
  ];
  const ranges = segmentsToTimelineRanges(segments, 30, 3);
  expect(ranges).toEqual([
    { start: 10 / 30, end: 1, rects: [rect, { ...rect, y: 0.7 }] },
    { start: 20 / 30, end: 40 / 30, rects: [rect] },
    { start: 2, end: 3, rects: [rect] }
  ]);
  ranges[0].rects[0].x = 0.4;
  expect(segments[1].rect.x).toBe(0.1);
});
it("uses the actual fractional frame rate, clamps the final frame and rejects unusable timing", () => {
  const segment = { rect: { x: 0, y: 0, width: 1, height: 0.1 }, startFrame: 30, endFrame: 299 };
  const fps = 30000 / 1001;
  expect(segmentsToTimelineRanges([segment], fps, 10)[0]).toMatchObject({ start: 30 / fps, end: 10 });
  expect(() => segmentsToTimelineRanges([segment], 0, 10)).toThrow("帧率");
  expect(() => segmentsToTimelineRanges([segment], fps, 0.5)).toThrow("时长不一致");
  expect(segmentsToTimelineRanges([], 0, 0)).toEqual([]);
});
it("snaps playhead to the nearest edge only within the visible tolerance", () => {
  expect(snapTime(3.96, [1, 4, 6, 8], 0.08)).toBe(4);
  expect(snapTime(4.2, [1, 4, 6, 8], 0.08)).toBe(4.2);
  expect(snapTime(3.96, [4], 0)).toBe(3.96);
});
it("moves a whole interval to an adjacent edge while preserving length and boxes", () => {
  expect(editTimelineRange(range, "move", 1.96, 10, [6, 8], 0.08)).toEqual({ ...range, start: 3, end: 6 });
  expect(editTimelineRange(range, "move", 5.04, 10, [6, 8], 0.08)).toEqual({ ...range, start: 6, end: 9 });
  expect(editTimelineRange(range, "move", 100, 10, [], 0)).toEqual({ ...range, start: 7, end: 10 });
  expect(editTimelineRange(range, "move", -100, 10, [], 0)).toEqual({ ...range, start: 0, end: 3 });
});
it("trims either end with snapping and prevents reversed or out-of-video ranges", () => {
  expect(editTimelineRange(range, "end", 1.96, 10, [6], 0.08).end).toBe(6);
  expect(editTimelineRange(range, "start", 0.96, 10, [2], 0.08).start).toBe(2);
  expect(editTimelineRange(range, "start", 10, 10, [], 0).start).toBe(3.99);
  expect(editTimelineRange(range, "end", -10, 10, [], 0).end).toBe(1.01);
});
