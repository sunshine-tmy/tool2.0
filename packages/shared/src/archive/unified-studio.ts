import { defaultArchiveAudioSettings, type ArchiveVideoEdit, type ArchiveCutClip } from "./video-edit";
import type { ArchiveStudio, ArchiveStudioWatermark } from "./video-studio";
import { archiveWatermarkPosition, archiveWatermarkSize } from "./video-watermark";
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

/** 一次性迁移旧全局配乐/水印；独立快照引用不依赖素材库仍然存在。 */
export function migrateArchiveStudio(
  saved: ArchiveVideoEdit | undefined,
  input: ArchiveStudio,
  duration: number,
  clips?: ArchiveCutClip[]
): ArchiveStudio {
  const studio = clone(input);
  if (studio.unified) return studio;
  studio.unified = true;
  const audio = { ...defaultArchiveAudioSettings(), ...saved?.settings };
  studio.masterVolume = audio.originalVolume;
  studio.watermarks ??= [];
  if (saved?.music) {
    const lane =
      Math.max(
        1,
        ...(clips ?? saved.cut ?? []).map((clip) => clip.lane ?? 1),
        ...studio.subtitles.map((cue) => cue.lane ?? 0),
        ...studio.musicTracks.map((track, index) => track.lane ?? 2 + index),
        ...studio.watermarks.map((mark) => mark.lane ?? 0)
      ) + 1;
    studio.musicTracks.push({
      id: "legacy_music_track",
      snapshotId: "legacy_music",
      libraryItemId: saved.music.libraryItemId ?? "legacy_music",
      libraryRevision: saved.music.libraryRevision ?? 1,
      title: saved.music.title,
      start: 0,
      end: duration,
      sourceStart: audio.musicStartSeconds,
      volume: audio.musicVolume,
      loop: audio.loop,
      fadeIn: audio.fadeInSeconds,
      fadeOut: audio.fadeOutSeconds,
      lane
    });
  }
  if (saved?.watermark) {
    const mark = saved.watermark,
      settings = clone(mark.settings),
      origin = settings.startSeconds;
    settings.startSeconds = 0;
    settings.endSeconds = settings.endSeconds === null ? null : settings.endSeconds - origin;
    settings.motion.keyframes = settings.motion.keyframes.map((point) => ({
      ...point,
      timeSeconds: point.timeSeconds - origin
    }));
    for (const entry of studio.subtitles) entry.lane = (entry.lane ?? 0) + 1;
    for (const [index, entry] of studio.musicTracks.entries()) entry.lane = (entry.lane ?? 2 + index) + 1;
    studio.watermarks.push({
      id: "legacy_watermark_track",
      title: "已保存水印",
      start: origin,
      end: Math.max(origin + 0.01, mark.settings.endSeconds ?? duration),
      followEnd: mark.settings.endSeconds === null,
      sourceStart: 0,
      lane: 0,
      settings,
      asset: {
        kind: "saved",
        id: "legacy_watermark",
        width: mark.width,
        height: mark.height,
        checksum: mark.file.checksum
      }
    });
  }
  return studio;
}

/** 反弹的手动位移只调整起点，不平移整个画布内的碰边路线。 */
export function watermarkTrackMotionSettings(mark: ArchiveStudioWatermark, width: number, height: number) {
  const settings = clone(mark.settings);
  if (settings.motion.type !== "bounce") return settings;
  const size = archiveWatermarkSize(settings, mark.asset, { width, height });
  const w = size.width * (mark.scaleX ?? 1),
    h = size.height * (mark.scaleY ?? 1);
  const radians = ((mark.angle ?? 0) * Math.PI) / 180;
  const spanX = width - Math.abs(w * Math.cos(radians)) - Math.abs(h * Math.sin(radians));
  const spanY = height - Math.abs(w * Math.sin(radians)) - Math.abs(h * Math.cos(radians));
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  settings.motion.from = {
    x: clamp(settings.motion.from.x + (spanX > 0 ? ((mark.offsetX ?? 0) * width) / spanX : 0)),
    y: clamp(settings.motion.from.y + (spanY > 0 ? ((mark.offsetY ?? 0) * height) / spanY : 0))
  };
  return settings;
}
export function watermarkTrackSettings(
  mark: ArchiveStudioWatermark,
  duration: number,
  width?: number,
  height?: number
) {
  const source = width && height ? watermarkTrackMotionSettings(mark, width, height) : mark.settings;
  const anchor = mark.start - mark.sourceStart - (mark.motionOffsetSeconds ?? 0);
  return {
    ...clone(source),
    startSeconds: anchor,
    endSeconds: mark.followEnd ? duration : mark.end,
    motion: {
      ...clone(source.motion),
      keyframes: source.motion.keyframes.map((point) => ({
        ...point,
        timeSeconds: point.timeSeconds - mark.settings.startSeconds + anchor
      }))
    }
  };
}
export function watermarkTrackGeometry(mark: ArchiveStudioWatermark, time: number, width: number, height: number) {
  const size = archiveWatermarkSize(mark.settings, mark.asset, { width, height });
  const w = size.width * (mark.scaleX ?? 1),
    h = size.height * (mark.scaleY ?? 1);
  const settings = watermarkTrackMotionSettings(mark, width, height);
  const point = archiveWatermarkPosition(
    settings,
    time - mark.start + mark.sourceStart + (mark.motionOffsetSeconds ?? 0) + mark.settings.startSeconds
  );
  const rotation = mark.angle ?? 0;
  // 手动平移不能把后续运动带出画布；按旋转后的外接矩形约束中心点。
  // 固定水印保留自由定位；大于画布的素材在该轴居中，避免反向边界。
  const radians = (rotation * Math.PI) / 180;
  const bounded = (center: number, extent: number, total: number) =>
    extent * 2 >= total ? total / 2 : Math.max(extent, Math.min(total - extent, center));
  const x = (width - w) * point.x + w / 2 + (mark.offsetX ?? 0) * width;
  const y = (height - h) * point.y + h / 2 + (mark.offsetY ?? 0) * height;
  const moving = mark.settings.motion.type !== "fixed";
  const extentX = (Math.abs(w * Math.cos(radians)) + Math.abs(h * Math.sin(radians))) / 2;
  const extentY = (Math.abs(w * Math.sin(radians)) + Math.abs(h * Math.cos(radians))) / 2;
  const bounce = settings.motion.type === "bounce";
  return {
    width: w,
    height: h,
    x: bounce
      ? bounded(extentX + Math.max(0, width - 2 * extentX) * point.x, extentX, width)
      : moving
        ? bounded(x, extentX, width)
        : x,
    y: bounce
      ? bounded(extentY + Math.max(0, height - 2 * extentY) * point.y, extentY, height)
      : moving
        ? bounded(y, extentY, height)
        : y,
    rotation
  };
}
/** 拖动的目标是当前画面的水印，不是仅在第一段有效的整条轨迹位移。 */
export function positionWatermarkTrack(
  mark: ArchiveStudioWatermark,
  time: number,
  x: number,
  y: number,
  width: number,
  height: number
): Partial<ArchiveStudioWatermark> {
  const geometry = watermarkTrackGeometry(mark, time, width, height);
  if (mark.settings.motion.type !== "bounce")
    return {
      offsetX: Math.max(-10, Math.min(10, (mark.offsetX ?? 0) + (x - geometry.x) / width)),
      offsetY: Math.max(-10, Math.min(10, (mark.offsetY ?? 0) + (y - geometry.y) / height))
    };
  const radians = (geometry.rotation * Math.PI) / 180;
  const extentX = (Math.abs(geometry.width * Math.cos(radians)) + Math.abs(geometry.height * Math.sin(radians))) / 2;
  const extentY = (Math.abs(geometry.width * Math.sin(radians)) + Math.abs(geometry.height * Math.cos(radians))) / 2;
  const ratio = (center: number, extent: number, total: number) =>
    total > 2 * extent ? Math.max(0, Math.min(1, (center - extent) / (total - 2 * extent))) : 0.5;
  const settings = watermarkTrackMotionSettings(mark, width, height);
  settings.motion.from = { x: ratio(x, extentX, width), y: ratio(y, extentY, height) };
  return {
    settings,
    offsetX: 0,
    offsetY: 0,
    motionOffsetSeconds: -(Math.max(mark.start, Math.min(mark.end, time)) - mark.start + mark.sourceStart)
  };
}
/** 裁剪后仍允许保留区间外的源关键帧，但关键帧顺序必须有效。 */
export function watermarkTrackError(mark: Pick<ArchiveStudioWatermark, "settings">): string | undefined {
  const settings = mark.settings,
    points = settings.motion.keyframes;
  if (settings.endSeconds !== null && settings.endSeconds <= settings.startSeconds) return "水印运动时间无效";
  if (
    settings.motion.type === "keyframes" &&
    (points.length < 2 ||
      points.some((point, index) => index > 0 && point.timeSeconds <= points[index - 1].timeSeconds))
  )
    return "水印关键帧须至少两个，并按时间递增";
}
