import { expect, it } from "vitest";
import { snapPreviewAxis, previewRotatedExtents } from "./preview-snap";

it("snaps to center in screen pixels and keeps the lock until the release distance", () => {
  const first = snapPreviewAxis(216, 20, 400, 0.25);
  expect(first.value).toBe(200);
  expect(first.guides).toEqual([200]);
  const held = snapPreviewAxis(236, 20, 400, 0.25, first.lock);
  expect(held.value).toBe(200);
  const released = snapPreviewAxis(244, 20, 400, 0.25, held.lock);
  expect(released.value).toBe(244);
  expect(released.guides).toEqual([]);
});

it.each([
  [49, 50, 0],
  [349, 350, 400],
  [449, 450, 400],
  [-49, -50, 0]
])("snaps material edges from either side of the canvas: center %s", (center, expected, guide) => {
  const result = snapPreviewAxis(center, 50, 400, 1);
  expect(result.value).toBe(expected);
  expect(result.guides).toEqual([guide]);
});

it("shows all exact alignments of a full-canvas object and leaves distant positions free", () => {
  expect(snapPreviewAxis(203, 200, 400, 1).guides).toEqual([200, 0, 400]);
  expect(snapPreviewAxis(123, 20, 400, 1)).toMatchObject({ value: 123, guides: [], lock: undefined });
});

it("uses the rotated outer boundary for edge contacts", () => {
  const extents = previewRotatedExtents(100, 40, 90);
  expect(extents.halfW).toBeCloseTo(20);
  expect(extents.halfH).toBeCloseTo(50);
  const diagonal = previewRotatedExtents(100, 40, 45);
  expect(diagonal.halfW).toBeCloseTo(70 / Math.sqrt(2));
  expect(diagonal.halfH).toBeCloseTo(70 / Math.sqrt(2));
});
