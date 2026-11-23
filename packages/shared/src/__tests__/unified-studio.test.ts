import { expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import {
  ArchiveStudioSchema,
  defaultArchiveStudio,
  defaultArchiveAudioSettings,
  defaultArchiveWatermarkSettings,
  migrateArchiveStudio,
  watermarkTrackGeometry,
  watermarkTrackSettings,
  archiveWatermarkPosition,
  type ArchiveVideoEdit
} from "../archive";
const file = { fileName: "logo.png", mimeType: "image/png", size: 100, checksum: "a".repeat(64) };
const saved: ArchiveVideoEdit = {
  revision: 1,
  original: file,
  settings: { ...defaultArchiveAudioSettings(), originalVolume: 70, musicStartSeconds: 2, musicVolume: 35 },
  music: { ...file, title: "旧配乐" },
  watermark: {
    file,
    width: 100,
    height: 50,
    settings: {
      ...defaultArchiveWatermarkSettings(),
      startSeconds: 1,
      endSeconds: 7,
      motion: {
        ...defaultArchiveWatermarkSettings().motion,
        type: "keyframes",
        keyframes: [
          { timeSeconds: 1, x: 0, y: 0 },
          { timeSeconds: 7, x: 1, y: 1 }
        ]
      }
    }
  },
  updatedAt: "2026-11-23"
};
it("旧全局配乐、水印迁为独立轨道，原配置保持不变且迁移幂等", () => {
  const original = JSON.stringify(saved),
    studio = migrateArchiveStudio(saved, defaultArchiveStudio(), 10);
  expect(Value.Check(ArchiveStudioSchema, studio)).toBe(true);
  expect(studio).toMatchObject({
    unified: true,
    masterVolume: 70,
    musicTracks: [{ snapshotId: "legacy_music", sourceStart: 2, volume: 35, start: 0, end: 10 }]
  });
  expect(studio.watermarks?.[0]).toMatchObject({
    start: 1,
    end: 7,
    sourceStart: 0,
    asset: { id: "legacy_watermark", kind: "saved" },
    settings: { startSeconds: 0, endSeconds: 6 }
  });
  expect(migrateArchiveStudio(saved, studio, 10)).toEqual(studio);
  expect(JSON.stringify(saved)).toBe(original);
});
it("移动、左裁剪和拆分保留相同源时刻的运动轨迹", () => {
  const mark = migrateArchiveStudio(saved, defaultArchiveStudio(), 10).watermarks![0];
  const at = (m: typeof mark, t: number) => archiveWatermarkPosition(watermarkTrackSettings(m, 10), t);
  expect(at(mark, 4)).toEqual({ x: 0.5, y: 0.5, visible: true });
  const right = { ...mark, start: 4, sourceStart: 3 };
  expect(at(right, 4)).toEqual(at(mark, 4));
  expect(watermarkTrackGeometry(right, 4, 1000, 500)).toEqual(watermarkTrackGeometry(mark, 4, 1000, 500));
  const moved = { ...right, start: 6, end: 9 };
  expect(at(moved, 6)).toEqual(at(mark, 4));
});

it("旧工程省略文本轨道号时保留文字在视频上方，旧全局音乐避开已有轨道", () => {
  const studio = defaultArchiveStudio();
  studio.subtitles.push({
    id: "text_001",
    text: "文字",
    start: 0,
    end: 10,
    color: "#ffffff",
    fontSize: 36,
    position: "center"
  });
  const result = migrateArchiveStudio(saved, studio, 10, [{ id: "video_001", start: 0, end: 10, lane: 5 }]);
  expect(result.subtitles[0].lane).toBe(1);
  expect(result.musicTracks[0].lane).toBe(7);
  expect(result.watermarks![0].lane).toBe(0);
});

it("拖拽平移反弹轨迹时保持每个源时刻相同位移，不改变原运动路线", () => {
  const mark = migrateArchiveStudio(saved, defaultArchiveStudio(), 10).watermarks![0];
  mark.settings.motion.type = "bounce";
  mark.settings.motion.bounceStyle = "polygon";
  for (const time of [1, 2, 4, 6]) {
    const before = watermarkTrackGeometry(mark, time, 1000, 500),
      after = watermarkTrackGeometry({ ...mark, offsetX: 0.1, offsetY: -0.2 }, time, 1000, 500);
    expect(after.x - before.x).toBeCloseTo(100);
    expect(after.y - before.y).toBeCloseTo(-100);
  }
});
