import { describe, expect, it } from "vitest";
import { describeRecognitionQuality } from "./quality";
import type { VideoTextResult } from "./types";

describe("video text recognition quality display", () => {
  it("returns no rows when a result has no recognition quality metadata", () => {
    expect(describeRecognitionQuality(null)).toEqual([]);
    expect(describeRecognitionQuality({} as VideoTextResult)).toEqual([]);
  });

  it("summarizes model, runtime, confidence, and low confidence counts", () => {
    const rows = describeRecognitionQuality({
      recognitionQuality: {
        model: "large-v3-turbo",
        language: "zh",
        device: "cuda",
        computeType: "int8_float16",
        averageLogProbability: -0.18,
        lowConfidenceSegments: [{ index: 1, text: "可能需要复核", averageLogProbability: -0.92 }]
      }
    } as VideoTextResult);

    expect(rows).toEqual([
      { label: "模型", value: "large-v3-turbo" },
      { label: "语言", value: "zh" },
      { label: "运行", value: "cuda / int8_float16" },
      { label: "平均置信", value: "-0.18" },
      { label: "需复核片段", value: "1 段" }
    ]);
  });
});
