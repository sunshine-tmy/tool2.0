import { expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { ArchiveCutClipSchema, archiveClipDuration, defaultArchiveFrame } from "../archive/video-edit";
import { archiveClipSourceTime, archiveClipRangeValid, archiveSliceClip } from "../archive/video-clip-tools";
import { ArchiveFrameSchema } from "../archive/video-edit";
import { defaultArchiveInterpolation } from "../archive/video-interpolation";

it("正放、倍速、倒放与静帧使用一致的源时间映射", () => {
  const clip = { id: "clip_001", start: 2, end: 8, speed: 2 };
  expect(archiveClipSourceTime(clip, 1, 25)).toBe(4);
  expect(archiveClipSourceTime({ ...clip, reverse: true }, 1, 25)).toBeCloseTo(5.96);
  expect(archiveClipSourceTime({ ...clip, freezeAt: 5 }, 2, 25)).toBe(5);
  expect(archiveSliceClip({ ...clip, reverse: true }, 1, 2)).toMatchObject({ start: 4, end: 6 });
});
it("静帧独立时长可超过原短视频，但取帧位置不能超出原片", () => {
  const clip = { id: "clip_001", start: 0, end: 3, freezeAt: 0.4 };
  expect(Value.Check(ArchiveCutClipSchema, clip)).toBe(true);
  expect(archiveClipDuration(clip)).toBe(3);
  expect(archiveClipRangeValid(clip, 0.5)).toBe(true);
  expect(archiveClipRangeValid({ ...clip, freezeAt: 0.5 }, 0.5)).toBe(false);
  expect(archiveClipRangeValid({ id: clip.id, start: 0, end: 3 }, 0.5)).toBe(false);
});

it("补帧及生成帧的定格配方可持久化，并拒绝无效引擎和越界采样", () => {
  const interpolation = defaultArchiveInterpolation();
  const clip = {
    id: "clip_001",
    start: 0,
    end: 3,
    freezeAt: 1,
    freezeSample: { start: 0, end: 2, speed: 0.5, reverse: false, interpolation, time: 3.5, fps: 120 }
  };
  expect(Value.Check(ArchiveCutClipSchema, JSON.parse(JSON.stringify(clip)))).toBe(true);
  expect(archiveClipRangeValid(clip, 2)).toBe(true);
  expect(archiveClipRangeValid({ ...clip, freezeSample: { ...clip.freezeSample, time: 4 } }, 2)).toBe(false);
  expect(
    Value.Check(ArchiveCutClipSchema, {
      id: clip.id,
      start: 0,
      end: 2,
      interpolation: { ...interpolation, engine: "unknown" }
    })
  ).toBe(false);
  expect(Value.Check(ArchiveFrameSchema, { ...defaultArchiveFrame(), fps: 120 })).toBe(true);
  expect(Value.Check(ArchiveFrameSchema, { ...defaultArchiveFrame(), fps: 59 })).toBe(false);
});
