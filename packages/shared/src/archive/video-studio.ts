import { Type, type Static } from "@sinclair/typebox";
import { archiveFancyTextStyles } from "./fancy-text";
import { ArchiveWatermarkSettingsSchema } from "./video-watermark";
const strict = { additionalProperties: false } as const;
const id = Type.String({ pattern: "^[A-Za-z0-9_-]{6,128}$" });
const checksum = Type.String({ pattern: "^[a-f0-9]{64}$" });
export const ArchiveStudioSourceSchema = Type.Object(
  {
    id,
    itemId: id,
    mediaId: id,
    checksum,
    title: Type.String({ maxLength: 500 }),
    fileName: Type.Optional(Type.String({ maxLength: 255 })),
    hasAudio: Type.Optional(Type.Boolean()),
    duration: Type.Number({ exclusiveMinimum: 0, maximum: 7200 }),
    width: Type.Number({ minimum: 1, maximum: 32768 }),
    height: Type.Number({ minimum: 1, maximum: 32768 }),
    fps: Type.Number({ exclusiveMinimum: 0, maximum: 1000 })
  },
  strict
);
export const ArchiveSubtitleSchema = Type.Object(
  {
    id,
    lane: Type.Optional(Type.Integer({ minimum: 0, maximum: 1999 })),
    locked: Type.Optional(Type.Boolean()),
    hidden: Type.Optional(Type.Boolean()),
    muted: Type.Optional(Type.Boolean()),
    start: Type.Number({ minimum: 0, maximum: 7200 }),
    end: Type.Number({ exclusiveMinimum: 0, maximum: 7200 }),
    text: Type.String({ minLength: 1, maxLength: 2000 }),
    fontSize: Type.Number({ minimum: 1, maximum: 200 }),
    fontFamily: Type.Optional(
      Type.Union([
        Type.Literal("Arial"),
        Type.Literal("Microsoft YaHei"),
        Type.Literal("PingFang SC"),
        Type.Literal("SimHei"),
        Type.Literal("SimSun"),
        Type.Literal("Songti SC"),
        Type.Literal("Times New Roman"),
        Type.Literal("Courier New")
      ])
    ),
    bold: Type.Optional(Type.Boolean()),
    italic: Type.Optional(Type.Boolean()),
    underline: Type.Optional(Type.Boolean()),
    decoration: Type.Optional(
      Type.Union([Type.Literal("none"), ...archiveFancyTextStyles.map((style) => Type.Literal(style.id))])
    ),
    outlineColor: Type.Optional(Type.String({ pattern: "^#[a-fA-F0-9]{6}$" })),
    outlineWidth: Type.Optional(Type.Number({ minimum: 0, maximum: 20 })),
    shadowColor: Type.Optional(Type.String({ pattern: "^#[a-fA-F0-9]{6}$" })),
    shadowOpacity: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
    shadowX: Type.Optional(Type.Number({ minimum: -20, maximum: 20 })),
    shadowY: Type.Optional(Type.Number({ minimum: -20, maximum: 20 })),
    backgroundColor: Type.Optional(Type.String({ pattern: "^#[a-fA-F0-9]{6}$" })),
    backgroundOpacity: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
    backgroundPadding: Type.Optional(Type.Number({ minimum: 0, maximum: 40 })),
    letterSpacing: Type.Optional(Type.Number({ minimum: -10, maximum: 50 })),
    lineSpacing: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
    textAlign: Type.Optional(
      Type.Union([
        Type.Literal("left"),
        Type.Literal("center"),
        Type.Literal("right"),
        Type.Literal("vertical-top"),
        Type.Literal("vertical-center"),
        Type.Literal("vertical-bottom")
      ])
    ),
    opacity: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
    linkedScale: Type.Optional(Type.Boolean()),
    // Logical 720px-high layout measured by the editing client for exact multiline export placement.
    textLayout: Type.Optional(
      Type.Object(
        {
          width: Type.Number({ minimum: 1, maximum: 12000000 }),
          lines: Type.Array(
            Type.Object(
              { text: Type.String({ maxLength: 2000 }), width: Type.Number({ minimum: 0, maximum: 1000000 }) },
              strict
            ),
            { minItems: 1, maxItems: 2000 }
          )
        },
        strict
      )
    ),
    color: Type.String({ pattern: "^#[a-fA-F0-9]{6}$" }),
    position: Type.Union([Type.Literal("top"), Type.Literal("center"), Type.Literal("bottom")]),
    x: Type.Optional(Type.Number({ minimum: -10, maximum: 11 })),
    y: Type.Optional(Type.Number({ minimum: -10, maximum: 11 })),
    rotation: Type.Optional(Type.Number({ minimum: -360, maximum: 360 })),
    scale: Type.Optional(Type.Number({ minimum: 0.1, maximum: 10 })),
    scaleX: Type.Optional(Type.Number({ minimum: 0.01, maximum: 5 })),
    scaleY: Type.Optional(Type.Number({ minimum: 0.01, maximum: 5 }))
  },
  strict
);
export const ArchiveStudioMusicSchema = Type.Object(
  {
    snapshotId: Type.Optional(id),
    id,
    lane: Type.Optional(Type.Integer({ minimum: 0, maximum: 1999 })),
    locked: Type.Optional(Type.Boolean()),
    hidden: Type.Optional(Type.Boolean()),
    muted: Type.Optional(Type.Boolean()),
    libraryItemId: id,
    libraryRevision: Type.Integer({ minimum: 1 }),
    title: Type.String({ maxLength: 500 }),
    start: Type.Number({ minimum: 0, maximum: 7200 }),
    end: Type.Number({ exclusiveMinimum: 0, maximum: 7200 }),
    speed: Type.Optional(Type.Number({ minimum: 0.1, maximum: 100 })),
    sourceStart: Type.Number({ minimum: 0, maximum: 86400 }),
    volume: Type.Number({ minimum: 0, maximum: 1000 }),
    loop: Type.Boolean(),
    fadeIn: Type.Number({ minimum: 0, maximum: 10 }),
    fadeOut: Type.Number({ minimum: 0, maximum: 10 })
  },
  strict
);
export const ArchiveTransitionSchema = Type.Object(
  {
    type: Type.Union([
      Type.Literal("fade"),
      Type.Literal("dissolve"),
      Type.Literal("slideleft"),
      Type.Literal("slideright")
    ]),
    duration: Type.Number({ minimum: 0.1, maximum: 2 })
  },
  strict
);
export const ArchiveStudioWatermarkSchema = Type.Object(
  {
    id,
    title: Type.String({ maxLength: 500 }),
    start: Type.Number({ minimum: 0, maximum: 7200 }),
    end: Type.Number({ exclusiveMinimum: 0, maximum: 7200 }),
    sourceStart: Type.Number({ minimum: 0, maximum: 7200 }),
    lane: Type.Optional(Type.Integer({ minimum: 0, maximum: 1999 })),
    locked: Type.Optional(Type.Boolean()),
    hidden: Type.Optional(Type.Boolean()),
    muted: Type.Optional(Type.Boolean()),
    followEnd: Type.Optional(Type.Boolean()),
    // 相对于源运动时钟的偏移；拖动时从当前指针位置重新锚定运动起点。
    motionOffsetSeconds: Type.Optional(Type.Number({ minimum: -14400, maximum: 14400 })),
    offsetX: Type.Optional(Type.Number({ minimum: -10, maximum: 10 })),
    offsetY: Type.Optional(Type.Number({ minimum: -10, maximum: 10 })),
    angle: Type.Optional(Type.Number({ minimum: -180, maximum: 180 })),
    scaleX: Type.Optional(Type.Number({ minimum: 0.01, maximum: 5 })),
    scaleY: Type.Optional(Type.Number({ minimum: 0.01, maximum: 5 })),
    asset: Type.Object(
      {
        id,
        kind: Type.Union([Type.Literal("draft"), Type.Literal("saved")]),
        width: Type.Integer({ minimum: 1, maximum: 8192 }),
        height: Type.Integer({ minimum: 1, maximum: 8192 }),
        checksum: Type.Optional(checksum)
      },
      strict
    ),
    settings: ArchiveWatermarkSettingsSchema
  },
  strict
);
export const ArchiveStudioSchema = Type.Object(
  {
    unified: Type.Optional(Type.Boolean()),
    masterVolume: Type.Optional(Type.Number({ minimum: 0, maximum: 1000 })),
    watermarks: Type.Optional(Type.Array(ArchiveStudioWatermarkSchema, { maxItems: 2000 })),
    lanes: Type.Optional(Type.Integer({ minimum: 1, maximum: 2000 })),
    sources: Type.Array(ArchiveStudioSourceSchema, { maxItems: 100 }),
    subtitles: Type.Array(ArchiveSubtitleSchema, { maxItems: 2000 }),
    musicTracks: Type.Array(ArchiveStudioMusicSchema, { maxItems: 32 })
  },
  strict
);
const file = Type.Object(
  {
    fileName: Type.String({ minLength: 1, maxLength: 255 }),
    mimeType: Type.String(),
    size: Type.Integer({ minimum: 1 }),
    checksum
  },
  strict
);
export const ArchiveStudioSourceAssetSchema = Type.Object(
  { sourceId: id, ref: ArchiveStudioSourceSchema, file },
  strict
);
export const ArchiveStudioMusicAssetSchema = Type.Object(
  { trackId: id, libraryItemId: id, libraryRevision: Type.Integer({ minimum: 1 }), file },
  strict
);
export const ArchiveStudioWatermarkAssetSchema = Type.Object(
  {
    assetId: id,
    file,
    width: Type.Integer({ minimum: 1, maximum: 8192 }),
    height: Type.Integer({ minimum: 1, maximum: 8192 })
  },
  strict
);
export type ArchiveStudioWatermark = Static<typeof ArchiveStudioWatermarkSchema>;
export type ArchiveStudio = Static<typeof ArchiveStudioSchema>;
export type ArchiveStudioSource = Static<typeof ArchiveStudioSourceSchema>;
export type ArchiveSubtitle = Static<typeof ArchiveSubtitleSchema>;
export type ArchiveStudioMusic = Static<typeof ArchiveStudioMusicSchema>;
export const defaultArchiveStudio = (): ArchiveStudio => ({ sources: [], subtitles: [], musicTracks: [] });

export const ArchiveVideoWaveformInputSchema = Type.Object(
  { source: Type.Optional(ArchiveStudioSourceSchema) },
  strict
);
export const ArchiveVideoWaveformSchema = Type.Object(
  {
    duration: Type.Number({ exclusiveMinimum: 0, maximum: 7200 }),
    hasAudio: Type.Boolean(),
    peaks: Type.Array(Type.Number({ minimum: 0, maximum: 1 }), { maxItems: 1201 })
  },
  strict
);
export type ArchiveVideoWaveformInput = Static<typeof ArchiveVideoWaveformInputSchema>;
