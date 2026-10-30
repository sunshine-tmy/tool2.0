import { describe, expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import {
  ArchiveVideoEditInputSchema,
  ArchiveWatermarkSettingsSchema,
  ArchiveWatermarkLibraryItemSchema,
  defaultArchiveAudioSettings,
  defaultArchiveWatermarkSettings,
  archiveWatermarkPosition,
  archiveWatermarkSize,
  watermarkTimingError,
  ARCHIVE_WATERMARK_BOUNCE_STYLES,
  archiveWatermarkBouncePath,
  archiveWatermarkPresetPoints,
  applyArchiveWatermarkPreset
} from "../index";
describe("归档水印契约与轨迹", () => {
  it("水印库返回严格的图片元数据，不接受路径、超限大小或空名称", () => {
    const item = {
      id: "abcdefghijkl",
      name: "品牌.png",
      width: 100,
      height: 50,
      size: 1000,
      checksum: "a".repeat(64),
      previewUrl: "/api/v1/tools/media-archive/watermark-library/abcdefghijkl/image",
      revision: 1,
      createdAt: "2026-10-29",
      updatedAt: "2026-10-29"
    };
    expect(Value.Check(ArchiveWatermarkLibraryItemSchema, item)).toBe(true);
    for (const value of [
      { ...item, path: "C:/private.png" },
      { ...item, name: "" },
      { ...item, id: "../private" },
      { ...item, size: 21 * 1024 * 1024 },
      { ...item, width: 8193 }
    ])
      expect(Value.Check(ArchiveWatermarkLibraryItemSchema, value)).toBe(false);
  });
  it("新增六种轨迹均有边界路点，按完整周期往返，随机种子可复现且兼容旧反弹", () => {
    const settings = defaultArchiveWatermarkSettings();
    settings.motion.type = "bounce";
    settings.motion.from = { x: 0, y: 0 };
    settings.motion.directionX = 1;
    settings.motion.directionY = 1;
    settings.motion.periodSeconds = 8;
    const styles = ARCHIVE_WATERMARK_BOUNCE_STYLES.filter((style) => style.value !== "standard");
    expect(styles).toHaveLength(6);
    const paths = new Set<string>();
    for (const style of styles) {
      settings.motion.bounceStyle = style.value;
      settings.motion.bounceSeed = 1234;
      const path = archiveWatermarkBouncePath(settings)!;
      paths.add(JSON.stringify(path));
      expect(path.slice(1).every((point) => point.x === 0 || point.x === 1 || point.y === 0 || point.y === 1)).toBe(
        true
      );
      for (let time = 0; time <= 24; time += 0.13) {
        const point = archiveWatermarkPosition(settings, time);
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(1);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(1);
      }
      expect(archiveWatermarkPosition(settings, 8)).toMatchObject({ x: 0, y: 0 });
      expect(archiveWatermarkBouncePath(settings)).toEqual(path);
    }
    expect(paths.size).toBe(6);
    settings.motion.bounceStyle = "z";
    expect(archiveWatermarkBouncePath(settings)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 }
    ]);
    settings.motion.bounceStyle = "random";
    const first = archiveWatermarkBouncePath(settings);
    settings.motion.bounceSeed = 9876;
    expect(archiveWatermarkBouncePath(settings)).not.toEqual(first);
    delete settings.motion.bounceStyle;
    expect(archiveWatermarkBouncePath(settings)).toBeUndefined();
    expect(archiveWatermarkPosition(settings, 4)).toMatchObject({ x: 0.5, y: 0.5 });
    for (const motion of [
      { ...settings.motion, bounceStyle: "unknown" },
      { ...settings.motion, bounceSeed: -1 }
    ])
      expect(Value.Check(ArchiveWatermarkSettingsSchema, { ...settings, motion })).toBe(false);
  });
  it("关键帧预设按显示区间比例适配新视频，不包含或修改图片、透明度和配乐", () => {
    const settings = defaultArchiveWatermarkSettings();
    settings.startSeconds = 2;
    settings.endSeconds = 10;
    settings.motion.type = "keyframes";
    settings.motion.keyframes = [
      { timeSeconds: 2, x: 0, y: 0 },
      { timeSeconds: 6, x: 1, y: 0 },
      { timeSeconds: 10, x: 1, y: 1 }
    ];
    const points = archiveWatermarkPresetPoints(settings, 12);
    expect(points.map((point) => point.progress)).toEqual([0, 0.5, 1]);
    const next = {
      ...defaultArchiveWatermarkSettings(),
      startSeconds: 5,
      endSeconds: 25,
      opacity: 35,
      widthPercent: 20
    };
    const result = applyArchiveWatermarkPreset(next, points, 40);
    expect(result.motion.keyframes.map((frame) => frame.timeSeconds)).toEqual([5, 15, 25]);
    expect(result).toMatchObject({ opacity: 35, widthPercent: 20, startSeconds: 5, endSeconds: 25 });
    expect(next.motion.type).toBe("fixed");
    expect(settings.motion.keyframes[1].timeSeconds).toBe(6);
    expect(() => applyArchiveWatermarkPreset({ ...next, startSeconds: 30 }, points, 20)).toThrow();
  });
  it("兼容旧配乐请求，区分省略、移除与设置，不接收客户端表达式和路径", () => {
    const base = {
      mode: "save",
      revision: 0,
      checksum: "a".repeat(64),
      useSavedMusic: false,
      settings: defaultArchiveAudioSettings()
    };
    for (const extra of [{}, { watermark: null }, { watermark: { settings: defaultArchiveWatermarkSettings() } }])
      expect(Value.Check(ArchiveVideoEditInputSchema, { ...base, ...extra })).toBe(true);
    for (const watermark of [
      { settings: defaultArchiveWatermarkSettings(), path: "C:/file.png" },
      { settings: { ...defaultArchiveWatermarkSettings(), opacity: NaN } },
      { settings: { ...defaultArchiveWatermarkSettings(), widthPercent: 51 } },
      { settings: { ...defaultArchiveWatermarkSettings(), expression: "t*2" } }
    ])
      expect(Value.Check(ArchiveVideoEditInputSchema, { ...base, watermark })).toBe(false);
    expect(Value.Check(ArchiveWatermarkSettingsSchema, defaultArchiveWatermarkSettings())).toBe(true);
  });
  it("显示范围和关键帧必须在视频中，拒绝同一时间、逆序和不足两个点", () => {
    const value = defaultArchiveWatermarkSettings();
    expect(watermarkTimingError(value, 10)).toBeUndefined();
    expect(watermarkTimingError({ ...value, startSeconds: 10 }, 10)).toBeTruthy();
    expect(watermarkTimingError({ ...value, endSeconds: 11 }, 10)).toBeTruthy();
    value.motion.type = "keyframes";
    expect(watermarkTimingError(value, 10)).toBeTruthy();
    value.motion.keyframes = [
      { timeSeconds: 0, x: 0, y: 0 },
      { timeSeconds: 10, x: 1, y: 1 }
    ];
    expect(watermarkTimingError(value, 10)).toBeUndefined();
    value.motion.keyframes[1].timeSeconds = 0;
    expect(watermarkTimingError(value, 10)).toBeTruthy();
  });
  it("线性、往返和反弹均按绝对视频时间计算且在画面内", () => {
    const value = defaultArchiveWatermarkSettings();
    value.startSeconds = 2;
    value.motion.from = { x: 0, y: 0 };
    value.motion.to = { x: 1, y: 1 };
    value.motion.periodSeconds = 4;
    value.motion.type = "linear";
    expect(archiveWatermarkPosition(value, 4)).toEqual({ x: 0.5, y: 0.5, visible: true });
    expect(archiveWatermarkPosition(value, 1).visible).toBe(false);
    expect(archiveWatermarkPosition(value, 20).x).toBe(1);
    value.motion.type = "ping-pong";
    expect(archiveWatermarkPosition(value, 4).x).toBe(1);
    expect(archiveWatermarkPosition(value, 6).x).toBe(0);
    value.motion.type = "bounce";
    for (const time of [2, 3, 100, 7200]) {
      const point = archiveWatermarkPosition(value, time);
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(1);
    }
  });
  it("关键帧插值，前后保持，超出显示区隐藏，极高水印仍不出界", () => {
    const value = defaultArchiveWatermarkSettings();
    value.endSeconds = 15;
    value.motion.type = "keyframes";
    value.motion.keyframes = [
      { timeSeconds: 2, x: 0, y: 1 },
      { timeSeconds: 10, x: 1, y: 0 }
    ];
    expect(archiveWatermarkPosition(value, 0)).toMatchObject({ x: 0, y: 1 });
    expect(archiveWatermarkPosition(value, 6)).toMatchObject({ x: 0.5, y: 0.5 });
    expect(archiveWatermarkPosition(value, 15)).toMatchObject({ x: 1, y: 0, visible: true });
    expect(archiveWatermarkPosition(value, 16).visible).toBe(false);
    expect(archiveWatermarkSize(value, { width: 100, height: 10000 }, { width: 1920, height: 1080 })).toEqual({
      width: 11,
      height: 1080
    });
  });
});
