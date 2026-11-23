import {
  archiveWatermarkBouncePath,
  watermarkTrackGeometry,
  watermarkTrackMotionSettings,
  type ArchiveStudioWatermark
} from "@toolbox/shared/archive";

/** Preview-only guides use the same source clock and geometry as the rendered watermark. */
export function watermarkTrajectory(mark: ArchiveStudioWatermark, width: number, height: number) {
  const settings = watermarkTrackMotionSettings(mark, width, height);
  const motion = settings.motion;
  if (motion.type === "fixed" || mark.end <= mark.start) return undefined;
  const origin = mark.start - mark.sourceStart - (mark.motionOffsetSeconds ?? 0);
  const start = Math.max(mark.start, origin);
  const sourceStart = Math.max(0, start - origin);
  const path = motion.type === "bounce" ? archiveWatermarkBouncePath(settings) : undefined;
  // 反弹提示线展示完整周期的规划，不因片段剩余时长较短而把 Z 型等路线截断。
  // 实际水印仍由时间线显示区间控制，不延长片段或导出时长。
  const end =
    motion.type === "bounce"
      ? start + (path ? 1 : 2) * motion.periodSeconds
      : motion.type === "ping-pong"
        ? start + motion.periodSeconds
        : motion.type === "linear"
          ? Math.max(start, origin + motion.periodSeconds)
          : mark.end;
  const times = new Set(Array.from({ length: 61 }, (_, i) => start + ((end - start) * i) / 60));
  const sourceTime = (time: number) => origin + time - mark.settings.startSeconds;
  const include = (time: number) => {
    if (time >= start && time <= end) times.add(time);
  };
  const keyframes = motion.keyframes.map((point) => sourceTime(point.timeSeconds));
  if (motion.type === "keyframes") keyframes.forEach(include);
  // Include exact corners so sampling never cuts across a turn or a keyframe.
  const step = path ? motion.periodSeconds / (2 * (path.length - 1)) : motion.periodSeconds / 2;
  if (path || motion.type === "ping-pong") {
    for (let i = Math.ceil(sourceStart / step); i <= Math.floor((sourceStart + end - start) / step); i++)
      include(origin + i * step);
  } else if (motion.type === "bounce") {
    for (const axis of ["x", "y"] as const) {
      const direction = axis === "x" ? motion.directionX : motion.directionY;
      const from = motion.from[axis] + (direction * sourceStart) / motion.periodSeconds;
      const to = from + (direction * (end - start)) / motion.periodSeconds;
      for (let i = Math.ceil(Math.min(from, to)); i <= Math.floor(Math.max(from, to)); i++)
        include(origin + ((i - motion.from[axis]) * motion.periodSeconds) / direction);
    }
  }
  const point = (time: number) => ({ time, ...watermarkTrackGeometry(mark, time, width, height) });
  const points = [...times].sort((a, b) => a - b).map(point);
  const anchors = [
    ...new Set([
      start,
      ...(motion.type === "keyframes" ? keyframes.filter((time) => time >= start && time <= end) : []),
      end
    ])
  ].map(point);
  return { points: points.map(({ x, y }) => `${x},${y}`).join(" "), anchors };
}
