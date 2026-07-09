import { describe, expect, it } from "vitest";
import { analyzeVideoText, parseTranscriptCues } from "../video-text";
import { getToolById } from "../tools";

describe("video text analysis", () => {
  it("parses srt cues with timestamps", () => {
    const cues = parseTranscriptCues(`1
00:00:01,000 --> 00:00:04,500
This summer dress is breathable and easy to match.

2
00:00:05,000 --> 00:00:08,000
Click the shop cart to get the discount.`);

    expect(cues).toEqual([
      {
        index: 1,
        startSeconds: 1,
        endSeconds: 4.5,
        text: "This summer dress is breathable and easy to match."
      },
      {
        index: 2,
        startSeconds: 5,
        endSeconds: 8,
        text: "Click the shop cart to get the discount."
      }
    ]);
  });

  it("analyzes transcript stats, summary, chapters, and timeline without keyword suggestions", () => {
    const result = analyzeVideoText({
      title: "dress-demo.mp4",
      transcript: `1
00:00:01,000 --> 00:00:04,000
Summer dress breathable fabric for commute and travel.

2
00:00:05,000 --> 00:00:08,000
Summer dress has pockets and soft fabric.

3
00:00:09,000 --> 00:00:11,000
Click shop cart for discount today.`
    });

    expect(result.stats.cueCount).toBe(3);
    expect(result.stats.characterCount).toBeGreaterThan(80);
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.chapters[0]).toMatchObject({
      startSeconds: 1,
      endSeconds: 11
    });
    expect(result.timeline).toHaveLength(3);
    expect(Object.hasOwn(result, "keywords")).toBe(false);
    expect(Object.hasOwn(result, "suggestions")).toBe(false);
    expect(Object.hasOwn(result.timeline[0], "keywords")).toBe(false);
  });

  it("preserves optional recognition quality metadata on analyzed transcripts", () => {
    const result = analyzeVideoText({
      title: "quality.mp4",
      transcript: "1\n00:00:00,000 --> 00:00:02,000\n精准中文口播。",
      recognitionQuality: {
        model: "large-v3-turbo",
        language: "zh",
        device: "cuda",
        computeType: "int8_float16",
        averageLogProbability: -0.18,
        lowConfidenceSegments: []
      }
    });

    expect(result.recognitionQuality).toMatchObject({
      model: "large-v3-turbo",
      language: "zh",
      device: "cuda",
      computeType: "int8_float16",
      averageLogProbability: -0.18
    });
  });

  it("normalizes traditional Chinese transcript text to simplified Chinese", () => {
    const result = analyzeVideoText({
      title: "weather.mp4",
      transcript: `1
00:00:00,000 --> 00:00:03,000
江浙滬的家人們 這次真的要睡不著覺了

2
00:00:03,000 --> 00:00:06,000
颱風還在不斷增強 請提前做好防護準備`
    });

    expect(result.fullText).toContain("江浙沪的家人们 这次真的要睡不着觉了");
    expect(result.fullText).toContain("台风还在不断增强 请提前做好防护准备");
    expect(result.segments[0].text).toContain("这次真的");
  });

  it("exposes the video text tool as ready", () => {
    expect(getToolById("video-text")?.status).toBe("ready");
  });
});
