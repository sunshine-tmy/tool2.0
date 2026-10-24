import fsp from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildBilingualCues,
  buildSentenceCues,
  buildTranslationCues,
  writeSrt,
  type TimingSegment
} from "../domains/speech/shared/batch-subtitles";

afterEach(() => vi.restoreAllMocks());
const cues = (): TimingSegment[] => [
  { text: "甲。", startSeconds: 0, endSeconds: 1 },
  { text: "乙！", startSeconds: 2, endSeconds: 4 }
];

describe("shared batch subtitle behavior", () => {
  it("retains weighted sentences, punctuation, empty text and source timing gaps", () => {
    expect(buildSentenceCues(" 甲。\n乙！ ", 4)).toEqual([
      { text: "甲。", startSeconds: 0, endSeconds: 2 },
      { text: "乙！", startSeconds: 2, endSeconds: 4 }
    ]);
    expect(buildSentenceCues("", 1)).toEqual([{ text: "", startSeconds: 0, endSeconds: 1 }]);
    const timing = [
      { text: "a", startSeconds: 0, endSeconds: 1 },
      { text: "b", startSeconds: 2, endSeconds: 4 }
    ];
    expect(buildSentenceCues("甲。 乙！", 4, timing)).toEqual(cues());
    expect(timing).toEqual([
      { text: "a", startSeconds: 0, endSeconds: 1 },
      { text: "b", startSeconds: 2, endSeconds: 4 }
    ]);
  });
  it("falls back for invalid timing without repairing or accepting it", () => {
    const expected = buildSentenceCues("甲。 乙！", 4);
    for (const segment of [
      { text: "a", startSeconds: -1, endSeconds: 1 },
      { text: "a", startSeconds: 0, endSeconds: 4.26 },
      { text: "a", startSeconds: 1, endSeconds: 1 },
      { text: "a", startSeconds: Number.NaN, endSeconds: 1 },
      { text: " ", startSeconds: 0, endSeconds: 1 }
    ])
      expect(buildSentenceCues("甲。 乙！", 4, [segment])).toEqual(expected);
  });
  it("retains the original cue array when translation is absent", () => {
    const source = cues();
    expect(buildBilingualCues(source, "source", "  ", 4)).toBe(source);
    expect(buildBilingualCues(source, "source", undefined, 4)).toBe(source);
    expect(buildTranslationCues(source, undefined, 4)).toEqual([]);
  });
  it("maps matching translated sentences without mutating source cues", () => {
    const source = cues();
    expect(buildTranslationCues(source, " 译一。\n译二！ ", 4)).toEqual([
      { ...source[0], text: "译一。" },
      { ...source[1], text: "译二！" }
    ]);
    expect(buildBilingualCues(source, "甲。 乙！", "译一。 译二！", 4)).toEqual([
      { ...source[0], text: "甲。\n译一。" },
      { ...source[1], text: "乙！\n译二！" }
    ]);
    expect(source).toEqual(cues());
  });
  it("uses one full-duration fallback when translation counts do not match", () => {
    expect(buildTranslationCues(cues(), " 仅\n一条 ", 4)).toEqual([
      { text: "仅 一条", startSeconds: 0, endSeconds: 4 }
    ]);
    expect(buildBilingualCues(cues(), " source\ntext ", " 仅一条 ", 4)).toEqual([
      { text: " source\ntext \n仅一条", startSeconds: 0, endSeconds: 4 }
    ]);
  });
  it("keeps numbered SRT, multiline Unicode wrapping and final newline", async () => {
    const write = vi.spyOn(fsp, "writeFile").mockResolvedValue(undefined);
    await writeSrt("batch.srt", [{ text: `译文\n${"图".repeat(40)}`, startSeconds: 0, endSeconds: 59.9996 }]);
    expect(write).toHaveBeenLastCalledWith(
      "batch.srt",
      `1\n00:00:00,000 --> 00:01:00,000\n译文\n${"图".repeat(38)}\n图图\n`,
      "utf8"
    );
    await writeSrt("empty.srt", []);
    expect(write).toHaveBeenLastCalledWith("empty.srt", "\n", "utf8");
  });
});
