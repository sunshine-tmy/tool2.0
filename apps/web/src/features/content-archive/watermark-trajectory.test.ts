import { expect, it } from "vitest";
import { defaultArchiveWatermarkSettings, type ArchiveStudioWatermark } from "@toolbox/shared/archive";
import { watermarkTrajectory } from "./watermark-trajectory";

function mark(): ArchiveStudioWatermark {
  return {
    id: "mark_001",
    title: "水印",
    start: 2,
    end: 4,
    sourceStart: 1,
    offsetX: 0.1,
    asset: { id: "asset_001", kind: "saved", width: 100, height: 50 },
    settings: {
      ...defaultArchiveWatermarkSettings(),
      widthPercent: 20,
      motion: {
        ...defaultArchiveWatermarkSettings().motion,
        type: "linear",
        from: { x: 0, y: 0 },
        to: { x: 1, y: 1 },
        periodSeconds: 4
      }
    }
  };
}
it("轨迹使用裁剪后的源运动时钟与画布平移，范围不超出保留片段", () => {
  const path = watermarkTrajectory(mark(), 300, 300)!;
  expect(path.anchors[0]).toMatchObject({ time: 2, x: 120, y: 82.5 });
  expect(path.anchors.at(-1)).toMatchObject({ time: 4, x: 240, y: 217.5 });
  expect(path.points).not.toMatch(/NaN|Infinity/);
});
it("关键帧拐点精确包含在路径中，缩放改变水印中心的可移动范围", () => {
  const data = mark();
  data.scaleX = 2;
  data.settings.motion.type = "keyframes";
  data.settings.motion.keyframes = [
    { timeSeconds: 0, x: 0, y: 0 },
    { timeSeconds: 1.37, x: 1, y: 0 },
    { timeSeconds: 4, x: 0, y: 1 }
  ];
  const path = watermarkTrajectory(data, 300, 300)!;
  expect(path.anchors.find((point) => point.time === 2.37)).toMatchObject({ x: 270, y: 15 });
  expect(path.points.split(" ")).toContain("270,15");
});
it("反弹长片段只采样有限周期，保留精确碰边拐点；固定水印没有运动轨迹", () => {
  const data = mark();
  data.end = 7200;
  data.sourceStart = 0;
  data.offsetX = 0;
  data.settings.motion = {
    ...data.settings.motion,
    type: "bounce",
    bounceStyle: "standard",
    from: { x: 0.25, y: 0.5 },
    periodSeconds: 0.25
  };
  const path = watermarkTrajectory(data, 300, 300)!;
  expect(path.points.split(" ").length).toBeLessThan(100);
  expect(path.points.split(" ").some((point) => point.startsWith("270,"))).toBe(true);
  data.settings.motion.type = "fixed";
  expect(watermarkTrajectory(data, 300, 300)).toBeUndefined();
});
