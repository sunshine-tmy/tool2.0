import { archiveClipDuration, type ArchiveCutClip } from "./video-edit";

/** 将项目片段内的时间映射到原素材；end 是源范围的排他终点。 */
export function archiveClipSourceTime(clip: ArchiveCutClip, elapsed: number, fps = 30) {
  if (clip.freezeAt !== undefined) return clip.freezeAt;
  const step = 1 / fps;
  const offset = Math.max(0, Math.min(clip.end - clip.start - step, elapsed * (clip.speed ?? 1)));
  return Math.max(clip.start, clip.reverse ? clip.end - step - offset : clip.start + offset);
}

/** 按播放顺序取片段，倒放时同时交换需收缩的源边界。 */
export function archiveSliceClip(clip: ArchiveCutClip, from: number, to = archiveClipDuration(clip)): ArchiveCutClip {
  const speed = clip.speed ?? 1;
  return clip.reverse && clip.freezeAt === undefined
    ? { ...clip, start: clip.end - to * speed, end: clip.end - from * speed }
    : { ...clip, start: clip.start + from * speed, end: clip.start + to * speed };
}

export function archiveClipRangeValid(clip: ArchiveCutClip, sourceDuration: number) {
  const sample = clip.freezeSample;
  if (
    sample &&
    (clip.freezeAt === undefined ||
      sample.start < 0 ||
      sample.end <= sample.start ||
      sample.end > sourceDuration + 0.001 ||
      sample.time >= (sample.end - sample.start) / sample.speed)
  )
    return false;
  return (
    clip.start >= 0 &&
    clip.end > clip.start &&
    (clip.freezeAt !== undefined
      ? clip.freezeAt >= 0 && clip.freezeAt < sourceDuration && clip.end <= 7200
      : clip.end <= sourceDuration + 0.001)
  );
}
export function archivePreviewClip(clip: ArchiveCutClip): ArchiveCutClip {
  const sample = clip.freezeSample;
  return sample
    ? {
        ...clip,
        start: sample.start,
        end: sample.end,
        speed: sample.speed,
        reverse: sample.reverse,
        interpolation: sample.interpolation,
        freezeAt: undefined,
        freezeSample: undefined
      }
    : clip;
}
