import { expect, it } from "vitest";
import { manualRangesToSegments } from "../domains/video-ai/manual-ranges";

it.each([25, 29.97, 30000 / 1001, 24000 / 1001, 59.94])(
  "preserves detected frame boundaries after conversion to seconds at %s fps",
  (fps) => {
    const rect = { x: 0.1, y: 0.7, width: 0.8, height: 0.1 };
    for (let startFrame = 0; startFrame < 600; startFrame++) {
      const endFrame = startFrame + 7;
      const ranges = [{ start: startFrame / fps, end: (endFrame + 1) / fps, rects: [rect] }];
      expect(
        manualRangesToSegments(JSON.stringify(ranges), { fps, frameCount: 1000, durationMs: Math.ceil(1000000 / fps) })
      ).toEqual([{ rect, startFrame, endFrame }]);
    }
  }
);

it("keeps real sub-frame user adjustments instead of snapping them to detection boundaries", () => {
  const rect = { x: 0, y: 0, width: 1, height: 0.1 };
  expect(
    manualRangesToSegments(JSON.stringify([{ start: 10.2 / 30, end: 20.2 / 30, rects: [rect] }]), {
      fps: 30,
      frameCount: 30,
      durationMs: 1000
    })
  ).toEqual([{ rect, startFrame: 10, endFrame: 20 }]);
});
