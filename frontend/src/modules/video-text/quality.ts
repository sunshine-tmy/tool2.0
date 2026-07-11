import type { VideoTextResult } from "./types";

type RecognitionQualityRow = {
  label: string;
  value: string;
};

export function describeRecognitionQuality(result: VideoTextResult | null): RecognitionQualityRow[] {
  const quality = result?.recognitionQuality;
  if (!quality) return [];

  const rows: RecognitionQualityRow[] = [];
  if (quality.model) rows.push({ label: "模型", value: quality.model });
  if (quality.language) rows.push({ label: "语言", value: quality.language });
  if (quality.device || quality.computeType) {
    rows.push({ label: "运行", value: [quality.device, quality.computeType].filter(Boolean).join(" / ") });
  }
  if (typeof quality.averageLogProbability === "number") {
    rows.push({ label: "平均置信", value: quality.averageLogProbability.toFixed(2) });
  }
  if (quality.lowConfidenceSegments?.length) {
    rows.push({ label: "需复核片段", value: `${quality.lowConfidenceSegments.length} 段` });
  }

  return rows;
}
