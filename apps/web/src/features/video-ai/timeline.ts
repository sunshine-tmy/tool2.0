import type { VideoAiSegment, VideoAiTimedRegion } from "@toolbox/shared";

/** Worker endFrame is inclusive; timeline end is exclusive. Keep distinct time
 * spans separate and group simultaneous boxes without widening their coverage. */
export function segmentsToTimelineRanges(
  segments: VideoAiSegment[],
  fps: number,
  duration: number
): VideoAiTimedRegion[] {
  if (!segments.length) return [];
  if (!Number.isFinite(fps) || fps <= 0 || !Number.isFinite(duration) || duration <= 0)
    throw new Error("无法读取识别结果的帧率或视频时长，请重试自动检测");
  const grouped = new Map<string, VideoAiTimedRegion>();
  for (const segment of segments) {
    const start = segment.startFrame / fps;
    const end = Math.min((segment.endFrame + 1) / fps, duration);
    if (
      !Number.isSafeInteger(segment.startFrame) ||
      !Number.isSafeInteger(segment.endFrame) ||
      segment.startFrame < 0 ||
      segment.endFrame < segment.startFrame ||
      start >= end
    )
      throw new Error("识别区间与视频时长不一致，请重试自动检测");
    const key = `${segment.startFrame}-${segment.endFrame}`;
    const range = grouped.get(key) ?? { start, end, rects: [] };
    range.rects.push({ ...segment.rect });
    grouped.set(key, range);
  }
  return [...grouped.values()].sort((a, b) => a.start - b.start || a.end - b.end);
}

export function snapTime(value: number, targets: number[], tolerance: number) {
  let nearest = value,
    distance = tolerance + Number.EPSILON;
  for (const target of targets) {
    const difference = Math.abs(target - value);
    if (difference <= tolerance && difference < distance) {
      nearest = target;
      distance = difference;
    }
  }
  return nearest;
}

export function editTimelineRange(
  range: VideoAiTimedRegion,
  operation: "move" | "start" | "end",
  delta: number,
  duration: number,
  targets: number[],
  tolerance: number
) {
  const minimum = Math.min(0.01, duration);
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  if (operation === "start")
    return { ...range, start: clamp(snapTime(range.start + delta, targets, tolerance), 0, range.end - minimum) };
  if (operation === "end")
    return { ...range, end: clamp(snapTime(range.end + delta, targets, tolerance), range.start + minimum, duration) };
  const length = range.end - range.start;
  let start = clamp(range.start + delta, 0, duration - length);
  const candidates = targets
    .flatMap((target) => [target, target - length])
    .filter((candidate) => Math.abs(candidate - start) <= tolerance && candidate >= 0 && candidate + length <= duration)
    .sort((a, b) => Math.abs(a - start) - Math.abs(b - start));
  start = clamp(candidates[0] ?? start, 0, duration - length);
  return { ...range, start, end: start + length };
}
