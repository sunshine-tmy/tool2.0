/** 归档配乐只描述受控素材 ID 和混音参数，不接受客户端路径或 FFmpeg 表达式。 */
import { Type, type Static } from "@sinclair/typebox";
import { ArchiveWatermarkInputSchema, ArchiveWatermarkSettingsSchema } from "./video-watermark";
import {
  ArchiveFrameRateSchema,
  ArchiveInterpolationSchema,
  ArchiveFreezeSampleSchema,
  ArchiveVideoOutputSchema
} from "./video-interpolation";
import {
  ArchiveStudioSchema,
  ArchiveStudioSourceAssetSchema,
  ArchiveStudioMusicAssetSchema,
  ArchiveStudioWatermarkAssetSchema,
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
/** 片段独立的空间变换，坐标相对于项目成片画布。 */
export const ArchiveClipTransformSchema = Type.Object(
  {
    scaleX: Type.Optional(Type.Number({ minimum: 0.01, maximum: 5 })),
    scaleY: Type.Optional(Type.Number({ minimum: 0.01, maximum: 5 })),
    linkedScale: Type.Optional(Type.Boolean()),
    flipX: Type.Optional(Type.Boolean()),
    offsetX: Type.Optional(Type.Number({ minimum: -10, maximum: 10 })),
    offsetY: Type.Optional(Type.Number({ minimum: -10, maximum: 10 })),
    angle: Type.Optional(Type.Number({ minimum: -180, maximum: 180 })),
    cornerRadius: Type.Optional(Type.Number({ minimum: 0, maximum: 0.5 }))
  },
  strict
);
export const ArchiveCutClipSchema = Type.Object(
  {
    id: Id,
    sourceId: Type.Optional(Id),
    transform: Type.Optional(ArchiveClipTransformSchema),
    at: Type.Optional(Type.Number({ minimum: 0, maximum: 7200 })),
    lane: Type.Optional(Type.Integer({ minimum: 0, maximum: 1999 })),
    locked: Type.Optional(Type.Boolean()),
    hidden: Type.Optional(Type.Boolean()),
    muted: Type.Optional(Type.Boolean()),
    transition: Type.Optional(ArchiveTransitionSchema),
    start: Type.Number({ minimum: 0, maximum: 7200 }),
    end: Type.Number({ exclusiveMinimum: 0, maximum: 7200 }),
    speed: Type.Optional(Type.Number({ minimum: 0.1, maximum: 100 })),
    reverse: Type.Optional(Type.Boolean()),
    interpolation: Type.Optional(ArchiveInterpolationSchema),
    // 静帧保留源取帧位置；start/end 描述可裁剪、可拆分的静帧时长。
    freezeAt: Type.Optional(Type.Number({ minimum: 0, maximum: 7200 })),
    freezeSample: Type.Optional(ArchiveFreezeSampleSchema),
    volume: Type.Optional(Type.Number({ minimum: 0, maximum: 1000 })),
    fadeIn: Type.Optional(Type.Number({ minimum: 0, maximum: 10 })),
    fadeOut: Type.Optional(Type.Number({ minimum: 0, maximum: 10 }))
  },
  strict
);
export const ArchiveCutSchema = Type.Array(ArchiveCutClipSchema, { minItems: 1, maxItems: 2000 });
export const ArchiveFrameSchema = Type.Object(
  {
    fps: Type.Optional(ArchiveFrameRateSchema),
    fit: Type.Optional(Type.Literal("contain")),
    scaleX: Type.Optional(Type.Number({ minimum: 0.01, maximum: 5 })),
    scaleY: Type.Optional(Type.Number({ minimum: 0.01, maximum: 5 })),
    linkedScale: Type.Optional(Type.Boolean()),
    offsetX: Type.Optional(Type.Number({ minimum: -10, maximum: 10 })),
    offsetY: Type.Optional(Type.Number({ minimum: -10, maximum: 10 })),
    angle: Type.Optional(Type.Number({ minimum: -180, maximum: 180 })),
    cornerRadius: Type.Optional(Type.Number({ minimum: 0, maximum: 0.5 })),
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
  fit: "contain",
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
  if (frame.fit === "contain") {
    const longest = Math.max(fullWidth, fullHeight);
    const canvasWidth = frame.aspect === "source" ? fullWidth : ratio >= 1 ? longest : longest * ratio;
    const canvasHeight = frame.aspect === "source" ? fullHeight : ratio >= 1 ? longest / ratio : longest;
    const w = Math.max(2, Math.floor(canvasWidth / 2) * 2),
      h = Math.max(2, Math.floor(canvasHeight / 2) * 2);
    const fit = Math.min(w / fullWidth, h / fullHeight);
    return {
      fullWidth,
      fullHeight,
      width: w,
      height: h,
      x: 0,
      y: 0,
      contentWidth: Math.max(2, Math.floor((fullWidth * fit) / 2) * 2),
      contentHeight: Math.max(2, Math.floor((fullHeight * fit) / 2) * 2)
    };
  }
  const cropWidth = Math.max(2, Math.floor(Math.min(fullWidth, fullHeight * ratio) / 2) * 2);
  const cropHeight = Math.max(2, Math.floor(Math.min(fullHeight, fullWidth / ratio) / 2) * 2);
  return {
    fullWidth,
    fullHeight,
    width: cropWidth,
    height: cropHeight,
    contentWidth: cropWidth,
    contentHeight: cropHeight,
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
    fileName: Type.Optional(Type.String({ maxLength: 255 })),
    hasAudio: Type.Optional(Type.Boolean()),
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
  studio?: {
    subtitles: { end: number }[];
    musicTracks: { end: number }[];
    watermarks?: { end: number; followEnd?: boolean }[];
  }
) =>
  Math.max(
    archiveCutDuration(clips),
    ...(studio?.subtitles.map((cue) => cue.end) ?? []),
    ...(studio?.musicTracks.map((track) => track.end) ?? []),
    ...(studio?.watermarks?.filter((mark) => !mark.followEnd).map((mark) => mark.end) ?? [])
  );
export function archiveVisibleClip(clips: ArchiveCutClip[], time: number) {
  const starts = archiveCutStarts(clips);
  let visible = -1;
  for (const [i, clip] of clips.entries()) {
    if (clip.hidden) continue;
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
      if ((cue as T & { hidden?: boolean }).hidden) return [];
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
    outputSettings: Type.Optional(ArchiveVideoOutputSchema),
    revision: Type.Integer({ minimum: 1 }),
    original: ArchiveEditFileSchema,
    originalDurationMs: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
    originalWidth: Type.Optional(Type.Number({ minimum: 1 })),
    originalHeight: Type.Optional(Type.Number({ minimum: 1 })),
    frame: Type.Optional(ArchiveFrameSchema),
    studio: Type.Optional(ArchiveStudioSchema),
    studioSources: Type.Optional(Type.Array(ArchiveStudioSourceAssetSchema, { maxItems: 100 })),
    studioMusic: Type.Optional(Type.Array(ArchiveStudioMusicAssetSchema, { maxItems: 32 })),
    studioWatermarks: Type.Optional(Type.Array(ArchiveStudioWatermarkAssetSchema, { maxItems: 2000 })),
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
    outputSettings: Type.Optional(ArchiveVideoOutputSchema),
    mode: Type.Union([Type.Literal("save"), Type.Literal("preview"), Type.Literal("restore")]),
    purpose: Type.Optional(Type.Union([Type.Literal("reverse-source"), Type.Literal("interpolation-source")])),
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
    purpose: Type.Optional(Type.Union([Type.Literal("reverse-source"), Type.Literal("interpolation-source")])),
    status: Type.Union([
      Type.Literal("pending"),
      Type.Literal("running"),
      Type.Literal("completed"),
      Type.Literal("failed"),
      Type.Literal("cancelled")
    ]),
    stage: Type.String(),
    progress: Type.Number({ minimum: 0, maximum: 100 }),
    warnings: Type.Optional(Type.Array(Type.String({ maxLength: 300 }), { maxItems: 8 })),
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
