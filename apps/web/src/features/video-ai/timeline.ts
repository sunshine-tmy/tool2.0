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

export function timelineRangesOverlap(a: VideoAiTimedRegion, b: VideoAiTimedRegion) {
  const tolerance = 1e-7;
  return a.start < b.end - tolerance && b.start < a.end - tolerance;
}

export function layoutTimelineLanes(ranges: VideoAiTimedRegion[]) {
  const occupied: VideoAiTimedRegion[][] = [];
  const rows: number[] = [];
  const ordered = ranges.map((range, index) => ({ range, index })).sort((a, b) => a.range.start - b.range.start);
  const place = (range: VideoAiTimedRegion, index: number, row: number) => {
    rows[index] = row;
    (occupied[row] ??= []).push(range);
  };
  for (const { range, index } of ordered) {
    if (range.lane === undefined || !Number.isSafeInteger(range.lane) || range.lane < 0) continue;
    const row = Math.min(range.lane, ranges.length);
    if (!occupied[row]?.some((other) => timelineRangesOverlap(range, other))) place(range, index, row);
  }
  for (const { range, index } of ordered) {
    if (rows[index] !== undefined) continue;
    const row = occupied.findIndex((lane) => !lane?.some((other) => timelineRangesOverlap(range, other)));
    place(range, index, row < 0 ? occupied.length : row);
  }
  return { rows, count: Math.max(1, occupied.length) };
}

export function editTimelineRange(
  range: VideoAiTimedRegion,
  operation: "move" | "start" | "end",
  delta: number,
  duration: number,
  targets: number[],
  tolerance: number
) {
  return previewTimelineRangeEdit(range, operation, delta, duration, targets, tolerance).range;
}

export function previewTimelineRangeEdit(
  range: VideoAiTimedRegion,
  operation: "move" | "start" | "end",
  delta: number,
  duration: number,
  targets: number[],
  tolerance: number
): { range: VideoAiTimedRegion; snappedAt?: number } {
  const minimum = Math.min(0.01, duration);
  const length = range.end - range.start;
  const requested = (operation === "end" ? range.end : range.start) + delta;
  const min = operation === "end" ? range.start + minimum : 0;
  const max = operation === "start" ? range.end - minimum : operation === "move" ? duration - length : duration;
  let position = Math.max(min, Math.min(max, requested));
  let snappedAt: number | undefined;
  let snappedEnd = false;
  if (tolerance > 0) {
    const offsets = operation === "move" ? [0, length] : [0];
    let nearestDistance = Infinity;
    for (const target of targets) {
      for (const offset of offsets) {
        const candidate = target - offset;
        const distance = Math.abs(candidate - requested);
        if (candidate < min || candidate > max || distance > tolerance || distance >= nearestDistance) continue;
        position = candidate;
        snappedAt = target;
        snappedEnd = offset !== 0;
        nearestDistance = distance;
      }
    }
  }
  if (operation === "start") return { range: { ...range, start: position }, snappedAt };
  if (operation === "end") return { range: { ...range, end: position }, snappedAt };
  const end = snappedEnd && snappedAt !== undefined ? snappedAt : Math.min(duration, position + length);
  return { range: { ...range, start: position, end }, snappedAt };
}
