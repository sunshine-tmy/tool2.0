import { expect, it } from "vitest";
import { manualRangesToSegments } from "./manual-ranges";
const rect = { x: 0.1, y: 0.7, width: 0.8, height: 0.1 };
const metadata = { fps: 25, frameCount: 250, durationMs: 10000 };
it("uses actual frame rate and preserves multiple boxes in each interval", () => {
  expect(
    manualRangesToSegments(
      JSON.stringify([
        { start: 2, end: 4, rects: [rect, { ...rect, y: 0.1 }] },
        { start: 7, end: 10, rects: [rect] }
      ]),
      metadata
    )
  ).toEqual([
    { rect, startFrame: 50, endFrame: 99 },
    { rect: { ...rect, y: 0.1 }, startFrame: 50, endFrame: 99 },
    { rect, startFrame: 175, endFrame: 249 }
  ]);
});
it.each([
  "null",
  "[]",
  "invalid",
  JSON.stringify([{ start: -1, end: 4, rects: [rect] }]),
  JSON.stringify([{ start: 0, end: 12, rects: [rect] }]),
  JSON.stringify([{ start: 0, end: 4, rects: [] }]),
  JSON.stringify([{ start: 0, end: 4, rects: [{ ...rect, width: 2 }] }]),
  JSON.stringify([{ start: 0, end: 4, rects: Array(21).fill(rect) }])
])("rejects malformed or oversized ranges %s", (raw) => {
  expect(() => manualRangesToSegments(raw, metadata)).toThrow("手动区间或框选区域无效");
});
