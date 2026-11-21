/** 归档配乐只描述受控素材 ID 和混音参数，不接受客户端路径或 FFmpeg 表达式。 */
import { Type, type Static } from "@sinclair/typebox";
import { ArchiveWatermarkInputSchema, ArchiveWatermarkSettingsSchema } from "./video-watermark";
import {
  ArchiveStudioSchema,
  ArchiveStudioSourceAssetSchema,
  ArchiveStudioMusicAssetSchema,
  ArchiveTransitionSchema
} from "./video-studio";
const strict = { additionalProperties: false } as const;
const Id = Type.String({ pattern: "^[A-Za-z0-9_-]{6,128}$" });
const ArchiveSlideshowAspectSchema = Type.Union([
  Type.Literal("portrait"),
  Type.Literal("portrait_3_4"),
  Type.Literal("landscape"),
  Type.Literal("square")
]);
export type ArchiveSlideshowAspect = Static<typeof ArchiveSlideshowAspectSchema>;
export const ARCHIVE_SLIDESHOW_DIMENSIONS = {
  portrait: [720, 1280],
  portrait_3_4: [720, 960],
  landscape: [1280, 720],
  square: [1080, 1080]
} as const satisfies Record<ArchiveSlideshowAspect, readonly [number, number]>;

/** 新图集至少播放 15 秒，且每一轮都完整播放所有图片。 */
export function archiveSlideshowCycles(imageCount: number, secondsPerImage: number) {
  if (imageCount <= 0 || !Number.isFinite(secondsPerImage) || secondsPerImage <= 0) return 0;
  return Math.max(1, Math.ceil(15 / (imageCount * secondsPerImage)));
}
export function archiveSlideshowDuration(imageCount: number, secondsPerImage: number) {
  const cycles = archiveSlideshowCycles(imageCount, secondsPerImage);
  return cycles ? imageCount * secondsPerImage * cycles : 0;
}
export const ArchiveEditFileSchema = Type.Object(
  {
    fileName: Type.String({ minLength: 1, maxLength: 255 }),
    mimeType: Type.String(),
    size: Type.Integer({ minimum: 1 }),
    checksum: Type.String({ pattern: "^[a-f0-9]{64}$" })
  },
  strict
);
export const ArchiveAudioSettingsSchema = Type.Object(
  {
    originalVolume: Type.Number({ minimum: 0, maximum: 100 }),
    musicVolume: Type.Number({ minimum: 0, maximum: 100 }),
    musicStartSeconds: Type.Number({ minimum: 0, maximum: 86400 }),
    loop: Type.Boolean(),
    fadeInSeconds: Type.Number({ minimum: 0, maximum: 5 }),
    fadeOutSeconds: Type.Number({ minimum: 0, maximum: 5 })
  },
  strict
);
/** 单源单轨剪辑，时间始终相对于保留的原片；数组顺序即成片顺序。 */
export const ArchiveCutClipSchema = Type.Object(
  {
    id: Id,
    sourceId: Type.Optional(Id),
    at: Type.Optional(Type.Number({ minimum: 0, maximum: 7200 })),
    lane: Type.Optional(Type.Integer({ minimum: 0, maximum: 1999 })),
    transition: Type.Optional(ArchiveTransitionSchema),
    start: Type.Number({ minimum: 0, maximum: 7200 }),
    end: Type.Number({ exclusiveMinimum: 0, maximum: 7200 }),
    speed: Type.Optional(Type.Number({ minimum: 0.25, maximum: 4 })),
    volume: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
    fadeIn: Type.Optional(Type.Number({ minimum: 0, maximum: 5 })),
    fadeOut: Type.Optional(Type.Number({ minimum: 0, maximum: 5 }))
  },
  strict
);
export const ArchiveCutSchema = Type.Array(ArchiveCutClipSchema, { minItems: 1, maxItems: 2000 });
export const ArchiveFrameSchema = Type.Object(
  {
    aspect: Type.Union([
      Type.Literal("source"),
      Type.Literal("9:16"),
      Type.Literal("3:4"),
      Type.Literal("16:9"),
      Type.Literal("1:1")
    ]),
    rotation: Type.Union([Type.Literal(0), Type.Literal(90), Type.Literal(180), Type.Literal(270)]),
    flipX: Type.Boolean(),
    flipY: Type.Boolean(),
    x: Type.Number({ minimum: 0, maximum: 1 }),
    y: Type.Number({ minimum: 0, maximum: 1 })
  },
  strict
);
export type ArchiveFrame = Static<typeof ArchiveFrameSchema>;
export const defaultArchiveFrame = (): ArchiveFrame => ({
  aspect: "source",
  rotation: 0,
  flipX: false,
  flipY: false,
  x: 0.5,
  y: 0.5
});
export function archiveFrameGeometry(width: number, height: number, frame: ArchiveFrame) {
  const rotated = frame.rotation === 90 || frame.rotation === 270;
  const fullWidth = rotated ? height : width,
    fullHeight = rotated ? width : height;
  const ratio =
    frame.aspect === "source"
      ? fullWidth / fullHeight
      : Number(frame.aspect.split(":")[0]) / Number(frame.aspect.split(":")[1]);
  const cropWidth = Math.max(2, Math.floor(Math.min(fullWidth, fullHeight * ratio) / 2) * 2);
  const cropHeight = Math.max(2, Math.floor(Math.min(fullHeight, fullWidth / ratio) / 2) * 2);
  return {
    fullWidth,
    fullHeight,
    width: cropWidth,
    height: cropHeight,
    x: Math.floor((Math.max(0, fullWidth - cropWidth) * frame.x) / 2) * 2,
    y: Math.floor((Math.max(0, fullHeight - cropHeight) * frame.y) / 2) * 2
  };
}
export const archiveClipDuration = (clip: ArchiveCutClip) => (clip.end - clip.start) / (clip.speed ?? 1);
export const ArchiveCutDraftSchema = Type.Object(
  {
    checksum: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    revision: Type.Integer({ minimum: 0 }),
    clips: Type.Array(ArchiveCutClipSchema, { maxItems: 2000 }),
    playhead: Type.Number({ minimum: 0, maximum: 7200 }),
    selected: Type.Array(Id, { maxItems: 4016 }),
    zoom: Type.Number({ minimum: 1, maximum: 64 }),
    frame: Type.Optional(ArchiveFrameSchema),
    studio: Type.Optional(ArchiveStudioSchema)
  },
  strict
);
export const ArchiveCutSourceSchema = Type.Object(
  {
    duration: Type.Number({ exclusiveMinimum: 0 }),
    fps: Type.Number({ exclusiveMinimum: 0 }),
    checksum: Type.String(),
    width: Type.Optional(Type.Number({ minimum: 1 })),
    height: Type.Optional(Type.Number({ minimum: 1 })),
    draft: Type.Optional(ArchiveCutDraftSchema)
  },
  strict
);
export type ArchiveCutClip = Static<typeof ArchiveCutClipSchema>;
export type ArchiveCutDraft = Static<typeof ArchiveCutDraftSchema>;
export function archiveTransitionTarget(clips: ArchiveCutClip[], index: number) {
  if (clips[index]?.at === undefined) return index + 1 < clips.length ? index + 1 : -1;
  const current = clips[index];
  const candidates = clips
    .map((clip, i) => ({ clip, i }))
    .filter(
      ({ clip, i }) => i !== index && (clip.lane ?? 1) === (current.lane ?? 1) && (clip.at ?? 0) > current.at! + 1e-7
    )
    .sort((a, b) => (a.clip.at ?? 0) - (b.clip.at ?? 0));
  return candidates[0]?.i ?? -1;
}
export function archiveTransitionDuration(clips: ArchiveCutClip[], index: number) {
  const target = archiveTransitionTarget(clips, index),
    current = clips[index],
    next = clips[target];
  if (!current?.transition || !next) return 0;
  const overlap = current.at === undefined ? Infinity : current.at + archiveClipDuration(current) - (next.at ?? 0);
  return Math.max(
    0,
    Math.floor(
      Math.min(current.transition.duration, archiveClipDuration(current) / 2, archiveClipDuration(next) / 2, overlap) *
        30
    ) / 30
  );
}
export const archiveCutStarts = (clips: ArchiveCutClip[]) => {
  let position = 0;
  return clips.map((clip, i) => {
    const start = clip.at ?? position;
    position = start + archiveClipDuration(clip) - (clip.at === undefined ? archiveTransitionDuration(clips, i) : 0);
    return start;
  });
};
export const archiveCutDuration = (clips: ArchiveCutClip[]) => {
  const starts = archiveCutStarts(clips);
  return Math.max(0, ...clips.map((clip, i) => starts[i] + archiveClipDuration(clip)));
};
export const archiveProjectDuration = (
  clips: ArchiveCutClip[],
  studio?: { subtitles: { end: number }[]; musicTracks: { end: number }[] }
) =>
  Math.max(
    archiveCutDuration(clips),
    ...(studio?.subtitles.map((cue) => cue.end) ?? []),
    ...(studio?.musicTracks.map((track) => track.end) ?? [])
  );
export function archiveVisibleClip(clips: ArchiveCutClip[], time: number) {
  const starts = archiveCutStarts(clips);
  let visible = -1;
  for (const [i, clip] of clips.entries()) {
    if (time < starts[i] - 1e-7 || time >= starts[i] + archiveClipDuration(clip) - 1e-7) continue;
    if (visible < 0 || (clip.lane ?? 1) <= (clips[visible].lane ?? 1)) visible = i;
  }
  return visible;
}
// 按轨道层级裁去被上方视频遮挡的字幕时间段，供导出使用。
export function archiveVisibleSubtitles<T extends { start: number; end: number; lane?: number }>(
  cues: T[],
  clips: ArchiveCutClip[]
) {
  const starts = archiveCutStarts(clips);
  const edges = [...new Set(clips.flatMap((clip, i) => [starts[i], starts[i] + archiveClipDuration(clip)]))].sort(
    (a, b) => a - b
  );
  const spans: { start: number; end: number; lane: number }[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const index = archiveVisibleClip(clips, (edges[i] + edges[i + 1]) / 2),
      lane = index < 0 ? Infinity : (clips[index].lane ?? 1);
    const previous = spans[spans.length - 1];
    if (previous && previous.lane === lane) previous.end = edges[i + 1];
    else spans.push({ start: edges[i], end: edges[i + 1], lane });
  }
  return cues
    .flatMap((cue) => {
      const result: T[] = [];
      let start = cue.start;
      for (const span of spans) {
        if (span.lane >= (cue.lane ?? 0) || span.end <= start || span.start >= cue.end) continue;
        if (span.start > start) result.push({ ...cue, start, end: Math.min(cue.end, span.start) });
        start = Math.max(start, span.end);
      }
      if (start < cue.end) result.push({ ...cue, start, end: cue.end });
      return result;
    })
    .sort((a, b) => (b.lane ?? 0) - (a.lane ?? 0));
}

export const ArchiveVideoEditSchema = Type.Object(
  {
    revision: Type.Integer({ minimum: 1 }),
    original: ArchiveEditFileSchema,
    originalDurationMs: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
    originalWidth: Type.Optional(Type.Number({ minimum: 1 })),
    originalHeight: Type.Optional(Type.Number({ minimum: 1 })),
    frame: Type.Optional(ArchiveFrameSchema),
    studio: Type.Optional(ArchiveStudioSchema),
    studioSources: Type.Optional(Type.Array(ArchiveStudioSourceAssetSchema, { maxItems: 100 })),
    studioMusic: Type.Optional(Type.Array(ArchiveStudioMusicAssetSchema, { maxItems: 16 })),
    cut: Type.Optional(ArchiveCutSchema),
    music: Type.Optional(
      Type.Composite(
        [
          ArchiveEditFileSchema,
          Type.Object({
            title: Type.String(),
            libraryItemId: Type.Optional(Type.String()),
            libraryRevision: Type.Optional(Type.Integer({ minimum: 1 }))
          })
        ],
        strict
      )
    ),
    settings: ArchiveAudioSettingsSchema,
    watermark: Type.Optional(
      Type.Object(
        {
          file: ArchiveEditFileSchema,
          width: Type.Integer({ minimum: 1 }),
          height: Type.Integer({ minimum: 1 }),
          settings: ArchiveWatermarkSettingsSchema
        },
        strict
      )
    ),
    updatedAt: Type.String(),
    // 仅用于旧成品在播放/下载结束前的延后清理，仍计入归档配额。
    pendingFiles: Type.Optional(Type.Array(ArchiveEditFileSchema))
  },
  strict
);
export const ArchiveVideoEditInputSchema = Type.Object(
  {
    mode: Type.Union([Type.Literal("save"), Type.Literal("preview"), Type.Literal("restore")]),
    revision: Type.Integer({ minimum: 0 }),
    checksum: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    musicId: Type.Optional(Type.String({ pattern: "^[A-Za-z0-9_-]{1,80}$" })),
    musicRevision: Type.Optional(Type.Integer({ minimum: 1 })),
    sourceMusicId: Type.Optional(Id),
    sourceMusicChecksum: Type.Optional(Type.String({ pattern: "^[a-f0-9]{64}$" })),
    useSavedMusic: Type.Boolean(),
    // 省略沿用已保存粗剪；null 恢复完整原片。
    cut: Type.Optional(Type.Union([ArchiveCutSchema, Type.Null()])),
    frame: Type.Optional(Type.Union([ArchiveFrameSchema, Type.Null()])),
    studio: Type.Optional(Type.Union([ArchiveStudioSchema, Type.Null()])),
    settings: ArchiveAudioSettingsSchema,
    // 省略保留当前水印；null 明确移除；对象配置当前水印或上传的草稿。
    watermark: Type.Optional(Type.Union([ArchiveWatermarkInputSchema, Type.Null()])),
    previewStartSeconds: Type.Optional(Type.Number({ minimum: 0, maximum: 86400 })),
    // Full-length audition uses the same recipe/timeline as save without replacing the archived video.
    previewFullLength: Type.Optional(Type.Boolean()),
    slideshow: Type.Optional(
      Type.Object(
        {
          images: Type.Array(Type.Object({ id: Id, checksum: Type.String({ pattern: "^[a-f0-9]{64}$" }) }, strict), {
            minItems: 1,
            maxItems: 100
          }),
          secondsPerImage: Type.Number({ minimum: 0.5, maximum: 30 }),
          aspect: ArchiveSlideshowAspectSchema
        },
        strict
      )
    )
  },
  strict
);
export const ArchiveVideoEditJobSchema = Type.Object(
  {
    id: Id,
    itemId: Id,
    mediaId: Id,
    mode: ArchiveVideoEditInputSchema.properties.mode,
    status: Type.Union([
      Type.Literal("pending"),
      Type.Literal("running"),
      Type.Literal("completed"),
      Type.Literal("failed"),
      Type.Literal("cancelled")
    ]),
    stage: Type.String(),
    progress: Type.Number({ minimum: 0, maximum: 100 }),
    message: Type.String(),
    errorCode: Type.Optional(Type.String()),
    previewUrl: Type.Optional(Type.String()),
    resultMediaId: Type.Optional(Id),
    createdAt: Type.String(),
    updatedAt: Type.String()
  },
  strict
);
export type ArchiveEditFile = Static<typeof ArchiveEditFileSchema>;
export type ArchiveAudioSettings = Static<typeof ArchiveAudioSettingsSchema>;
export type ArchiveVideoEdit = Static<typeof ArchiveVideoEditSchema>;
export type ArchiveVideoEditInput = Static<typeof ArchiveVideoEditInputSchema>;
export type ArchiveVideoEditJob = Static<typeof ArchiveVideoEditJobSchema>;
export const defaultArchiveAudioSettings = (): ArchiveAudioSettings => ({
  originalVolume: 100,
  musicVolume: 20,
  musicStartSeconds: 0,
  loop: true,
  fadeInSeconds: 0.5,
  fadeOutSeconds: 1
});
