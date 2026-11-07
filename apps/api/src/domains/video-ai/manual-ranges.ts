import type { VideoAiSegment, VideoAiTimedRegion } from "@toolbox/shared";

export function manualRangesToSegments(
  raw: string,
  metadata: { fps: number; frameCount: number; durationMs: number }
): VideoAiSegment[] {
  const invalid = () =>
    Object.assign(new Error("手动区间或框选区域无效；最多 20 处，且时间必须位于视频内"), {
      code: "INVALID_SEGMENTS",
      status: 422
    });
  let ranges: VideoAiTimedRegion[];
  try {
    ranges = JSON.parse(raw);
  } catch {
    throw invalid();
  }
  if (!Array.isArray(ranges) || !ranges.length || ranges.length > 20) throw invalid();
  const segments: VideoAiSegment[] = [];
  if (
    !Number.isFinite(metadata.fps) ||
    metadata.fps <= 0 ||
    !Number.isSafeInteger(metadata.frameCount) ||
    metadata.frameCount < 1
  )
    throw invalid();
  for (const range of ranges) {
    if (
      !range ||
      !Number.isFinite(range.start) ||
      !Number.isFinite(range.end) ||
      range.start < 0 ||
      range.end <= range.start ||
      range.end > metadata.durationMs / 1000 + 0.05 ||
      !Array.isArray(range.rects) ||
      !range.rects.length
    )
      throw invalid();
    const startFrame = Math.floor(range.start * metadata.fps);
    const endFrame = Math.min(metadata.frameCount - 1, Math.ceil(range.end * metadata.fps) - 1);
    if (startFrame > endFrame) throw invalid();
    for (const rect of range.rects) {
      if (
        !rect ||
        ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) ||
        rect.x < 0 ||
        rect.y < 0 ||
        rect.width <= 0 ||
        rect.height <= 0 ||
        rect.x + rect.width > 1.000001 ||
        rect.y + rect.height > 1.000001
      )
        throw invalid();
      segments.push({ rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, startFrame, endFrame });
      if (segments.length > 20) throw invalid();
    }
  }
  return segments;
}
