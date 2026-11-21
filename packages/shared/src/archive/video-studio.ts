import { Type, type Static } from "@sinclair/typebox";
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
    start: Type.Number({ minimum: 0, maximum: 7200 }),
    end: Type.Number({ exclusiveMinimum: 0, maximum: 7200 }),
    text: Type.String({ minLength: 1, maxLength: 2000 }),
    fontSize: Type.Number({ minimum: 16, maximum: 96 }),
    color: Type.String({ pattern: "^#[a-fA-F0-9]{6}$" }),
    position: Type.Union([Type.Literal("top"), Type.Literal("center"), Type.Literal("bottom")])
  },
  strict
);
export const ArchiveStudioMusicSchema = Type.Object(
  {
    id,
    lane: Type.Optional(Type.Integer({ minimum: 0, maximum: 1999 })),
    libraryItemId: id,
    libraryRevision: Type.Integer({ minimum: 1 }),
    title: Type.String({ maxLength: 500 }),
    start: Type.Number({ minimum: 0, maximum: 7200 }),
    end: Type.Number({ exclusiveMinimum: 0, maximum: 7200 }),
    sourceStart: Type.Number({ minimum: 0, maximum: 86400 }),
    volume: Type.Number({ minimum: 0, maximum: 100 }),
    loop: Type.Boolean(),
    fadeIn: Type.Number({ minimum: 0, maximum: 5 }),
    fadeOut: Type.Number({ minimum: 0, maximum: 5 })
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
export const ArchiveStudioSchema = Type.Object(
  {
    lanes: Type.Optional(Type.Integer({ minimum: 1, maximum: 2000 })),
    sources: Type.Array(ArchiveStudioSourceSchema, { maxItems: 100 }),
    subtitles: Type.Array(ArchiveSubtitleSchema, { maxItems: 2000 }),
    musicTracks: Type.Array(ArchiveStudioMusicSchema, { maxItems: 16 })
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
export const ArchiveAnalysisInputSchema = Type.Object(
  {
    kind: Type.Union([Type.Literal("scenes"), Type.Literal("silence")]),
    start: Type.Number({ minimum: 0, maximum: 7200 }),
    end: Type.Number({ exclusiveMinimum: 0, maximum: 7200 }),
    sceneThreshold: Type.Number({ minimum: 0.05, maximum: 0.9 }),
    silenceDb: Type.Number({ minimum: -80, maximum: -10 }),
    minSilence: Type.Number({ minimum: 0.1, maximum: 10 }),
    source: Type.Optional(ArchiveStudioSourceSchema)
  },
  strict
);
export const ArchiveAnalysisJobSchema = Type.Object(
  {
    id,
    kind: ArchiveAnalysisInputSchema.properties.kind,
    status: Type.Union([
      Type.Literal("pending"),
      Type.Literal("running"),
      Type.Literal("completed"),
      Type.Literal("failed"),
      Type.Literal("cancelled")
    ]),
    progress: Type.Number({ minimum: 0, maximum: 100 }),
    message: Type.String(),
    scenes: Type.Array(Type.Number({ minimum: 0, maximum: 7200 }), { maxItems: 5000 }),
    silence: Type.Array(Type.Object({ start: Type.Number({ minimum: 0 }), end: Type.Number({ minimum: 0 }) }, strict), {
      maxItems: 5000
    })
  },
  strict
);
export type ArchiveStudio = Static<typeof ArchiveStudioSchema>;
export type ArchiveStudioSource = Static<typeof ArchiveStudioSourceSchema>;
export type ArchiveSubtitle = Static<typeof ArchiveSubtitleSchema>;
export type ArchiveStudioMusic = Static<typeof ArchiveStudioMusicSchema>;
export type ArchiveAnalysisInput = Static<typeof ArchiveAnalysisInputSchema>;
export type ArchiveAnalysisJob = Static<typeof ArchiveAnalysisJobSchema>;
export const defaultArchiveStudio = (): ArchiveStudio => ({ sources: [], subtitles: [], musicTracks: [] });
