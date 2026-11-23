import { describe, expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import {
  ArchiveVideoEditInputSchema,
  defaultArchiveAudioSettings,
  AudioLibraryPurposeSchema,
  ArchiveSubtitleSchema,
  audioLibraryPurpose
} from "../index";
describe("配乐参数与用途契约", () => {
  const input = () => ({
    mode: "save",
    revision: 0,
    checksum: "a".repeat(64),
    settings: defaultArchiveAudioSettings(),
    useSavedMusic: false
  });
  it("成片输出参数与剪辑分离，关闭补帧有效，拒绝任意路径及不支持帧率", () => {
    expect(Value.Check(ArchiveVideoEditInputSchema, { ...input(), outputSettings: {} })).toBe(true);
    const outputSettings = {
      fps: 60,
      interpolation: { engine: "rife", quality: "high", sceneProtection: true, allowFallback: false }
    };
    expect(Value.Check(ArchiveVideoEditInputSchema, { ...input(), outputSettings })).toBe(true);
    expect(
      Value.Check(ArchiveVideoEditInputSchema, { ...input(), outputSettings: { ...outputSettings, fps: 59 } })
    ).toBe(false);
    expect(Value.Check(ArchiveVideoEditInputSchema, { ...input(), outputSettings: { path: "C:/video.mp4" } })).toBe(
      false
    );
  });
  it("默认参数有效，允许无音乐及独立静音，不修改历史用途", () => {
    expect(
      Value.Check(ArchiveVideoEditInputSchema, {
        ...input(),
        sourceMusicId: "source_music123",
        sourceMusicChecksum: "b".repeat(64)
      })
    ).toBe(true);
    expect(
      Value.Check(ArchiveVideoEditInputSchema, {
        ...input(),
        sourceMusicId: "source_music123",
        sourceMusicChecksum: "not-a-digest"
      })
    ).toBe(false);
    expect(Value.Check(ArchiveVideoEditInputSchema, input())).toBe(true);
    expect(Value.Check(ArchiveVideoEditInputSchema, { ...input(), mode: "preview", previewFullLength: true })).toBe(
      true
    );
    expect(
      Value.Check(ArchiveVideoEditInputSchema, {
        ...input(),
        settings: { ...defaultArchiveAudioSettings(), originalVolume: 0, musicVolume: 100 }
      })
    ).toBe(true);
    const legacy = { source: { kind: "chatterbox" as const } };
    expect(audioLibraryPurpose(legacy)).toBe("speech");
    expect(legacy).not.toHaveProperty("purpose");
    expect(audioLibraryPurpose({ source: { kind: "upload" } })).toBe("general");
    expect(Value.Check(AudioLibraryPurposeSchema, "music")).toBe(true);
  });
  it("拒绝任意路径、表达式、非有限增益、无版本及越界图集", () => {
    for (const invalid of [
      { ...input(), path: "C:/x" },
      { ...input(), settings: { ...defaultArchiveAudioSettings(), originalVolume: NaN } },
      { ...input(), settings: { ...defaultArchiveAudioSettings(), musicVolume: -1 } },
      { ...input(), revision: -1 },
      { ...input(), previewFullLength: "true" },
      { ...input(), slideshow: { images: [], secondsPerImage: 3, aspect: "portrait" } }
    ])
      expect(Value.Check(ArchiveVideoEditInputSchema, invalid)).toBe(false);
  });
});

it("文本样式兼容旧字幕，限制字体、间距、透明度及排版数据", () => {
  const legacy = {
    id: "subtitle_001",
    start: 0,
    end: 3,
    text: "文本",
    fontSize: 36,
    color: "#ffffff",
    position: "bottom"
  };
  expect(Value.Check(ArchiveSubtitleSchema, legacy)).toBe(true);
  const styled = {
    ...legacy,
    fontSize: 15,
    fontFamily: "Microsoft YaHei",
    bold: true,
    italic: true,
    underline: true,
    letterSpacing: 4,
    lineSpacing: 12,
    opacity: 0.5,
    textAlign: "left",
    linkedScale: true,
    textLayout: { width: 405, lines: [{ text: "文本", width: 76 }] }
  };
  expect(Value.Check(ArchiveSubtitleSchema, styled)).toBe(true);
  for (const textAlign of ["vertical-top", "vertical-center", "vertical-bottom"])
    expect(Value.Check(ArchiveSubtitleSchema, { ...styled, textAlign })).toBe(true);
  expect(Value.Check(ArchiveSubtitleSchema, { ...styled, textAlign: "vertical-unknown" })).toBe(false);
  expect(Value.Check(ArchiveSubtitleSchema, { ...styled, x: 1.2, y: -0.2 })).toBe(true);
  expect(Value.Check(ArchiveSubtitleSchema, { ...styled, x: 12 })).toBe(false);
  expect(Value.Check(ArchiveSubtitleSchema, { ...styled, decoration: "flame-blue" })).toBe(true);
  expect(Value.Check(ArchiveSubtitleSchema, { ...styled, decoration: "unregistered-effect" })).toBe(false);
  expect(
    Value.Check(ArchiveSubtitleSchema, {
      ...styled,
      outlineWidth: 2,
      outlineColor: "#ff0000",
      shadowOpacity: 0.5,
      shadowX: 2,
      backgroundOpacity: 1,
      backgroundColor: "#ffe600",
      backgroundPadding: 6
    })
  ).toBe(true);
  for (const effect of [
    { outlineWidth: -1 },
    { outlineWidth: 21 },
    { shadowX: 21 },
    { shadowOpacity: 1.1 },
    { backgroundOpacity: -0.1 },
    { backgroundColor: "red" }
  ])
    expect(Value.Check(ArchiveSubtitleSchema, { ...styled, ...effect })).toBe(false);
  for (const changes of [
    { fontFamily: "{\\fninvalid}" },
    { opacity: 1.1 },
    { letterSpacing: 51 },
    { lineSpacing: -1 },
    { fontSize: 0 }
  ])
    expect(Value.Check(ArchiveSubtitleSchema, { ...styled, ...changes })).toBe(false);
});
