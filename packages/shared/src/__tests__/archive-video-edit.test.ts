import { describe, expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import {
  ArchiveVideoEditInputSchema,
  defaultArchiveAudioSettings,
  AudioLibraryPurposeSchema,
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
  it("默认参数有效，允许无音乐及独立静音，不修改历史用途", () => {
    expect(Value.Check(ArchiveVideoEditInputSchema, input())).toBe(true);
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
      { ...input(), slideshow: { images: [], secondsPerImage: 3, aspect: "portrait" } }
    ])
      expect(Value.Check(ArchiveVideoEditInputSchema, invalid)).toBe(false);
  });
});
