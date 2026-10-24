import fsp from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeSubtitle } from "../domains/speech/chatterbox/subtitle";
import { writeSrt } from "../domains/speech/shared/batch-subtitles";
import { srtTimestamp } from "../domains/speech/shared/subtitle-time";

afterEach(() => vi.restoreAllMocks());

describe("speech subtitle timestamp compatibility", () => {
  it("retains zero clamping, millisecond rounding and unbounded hour padding", () => {
    for (const [seconds, expected] of [
      [-1, "00:00:00,000"],
      [-0, "00:00:00,000"],
      [0, "00:00:00,000"],
      [0.0004, "00:00:00,000"],
      [0.0005, "00:00:00,001"],
      [1.234, "00:00:01,234"],
      [59.9996, "00:01:00,000"],
      [3599.9996, "01:00:00,000"],
      [360000.001, "100:00:00,001"]
    ] as const) {
      expect(srtTimestamp(seconds)).toBe(expected);
    }
  });

  it("does not introduce new nonfinite-input handling during extraction", () => {
    expect(srtTimestamp(Number.NaN)).toBe("NaN:NaN:NaN,NaN");
    expect(srtTimestamp(Number.POSITIVE_INFINITY)).toBe("Infinity:NaN:NaN,NaN");
    expect(srtTimestamp(Number.NEGATIVE_INFINITY)).toBe("00:00:00,000");
  });

  it.each([
    [0.001, "00:00:00,001"],
    [0.0014, "00:00:00,001"],
    [0.0015, "00:00:00,002"],
    [59.9994, "00:00:59,999"],
    [59.9996, "00:01:00,000"],
    [3599.9996, "01:00:00,000"],
    [360000.001, "100:00:00,001"]
  ] as const)("preserves both writers at %s seconds", async (seconds, timestamp) => {
    const write = vi.spyOn(fsp, "writeFile").mockResolvedValue(undefined);
    const content = `1\n00:00:00,000 --> ${timestamp}\n商品\n`;
    await writeSubtitle("single.srt", "商品", seconds);
    expect(write).toHaveBeenLastCalledWith("single.srt", content, "utf8");
    await writeSrt("batch.srt", [{ text: "商品", startSeconds: 0, endSeconds: seconds }]);
    expect(write).toHaveBeenLastCalledWith("batch.srt", content, "utf8");
  });

  it("keeps the single writer duration floor independent from raw batch cues", async () => {
    const write = vi.spyOn(fsp, "writeFile").mockResolvedValue(undefined);
    await writeSubtitle("single.srt", "商品", 0);
    expect(write).toHaveBeenLastCalledWith("single.srt", "1\n00:00:00,000 --> 00:00:00,001\n商品\n", "utf8");
    await writeSrt("batch.srt", [{ text: "商品", startSeconds: 0, endSeconds: 0 }]);
    expect(write).toHaveBeenLastCalledWith("batch.srt", "1\n00:00:00,000 --> 00:00:00,000\n商品\n", "utf8");
  });

  it("does not conflate the distinct single and batch Chinese wrapping rules", async () => {
    const write = vi.spyOn(fsp, "writeFile").mockResolvedValue(undefined);
    const text = "图".repeat(40);
    await writeSubtitle("single.srt", text, 1);
    expect(write).toHaveBeenLastCalledWith("single.srt", `1\n00:00:00,000 --> 00:00:01,000\n${text}\n`, "utf8");
    await writeSrt("batch.srt", [{ text, startSeconds: 0, endSeconds: 1 }]);
    expect(write).toHaveBeenLastCalledWith(
      "batch.srt",
      `1\n00:00:00,000 --> 00:00:01,000\n${"图".repeat(38)}\n图图\n`,
      "utf8"
    );
  });
});
