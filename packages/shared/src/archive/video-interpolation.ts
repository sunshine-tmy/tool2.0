import { Type, type Static } from "@sinclair/typebox";

export const ARCHIVE_FRAME_RATES = [24, 25, 30, 50, 60, 120] as const;
export const ArchiveFrameRateSchema = Type.Union(ARCHIVE_FRAME_RATES.map((fps) => Type.Literal(fps)));
export const ArchiveInterpolationSchema = Type.Object(
  {
    engine: Type.Union([Type.Literal("flow"), Type.Literal("rife")]),
    quality: Type.Union([Type.Literal("fast"), Type.Literal("balanced"), Type.Literal("high")]),
    sceneProtection: Type.Boolean(),
    allowFallback: Type.Boolean()
  },
  { additionalProperties: false }
);
export type ArchiveInterpolation = Static<typeof ArchiveInterpolationSchema>;
/** 最终成片输出；未提供 interpolation 表示关闭补帧。 */
export const ArchiveVideoOutputSchema = Type.Object(
  {
    fps: Type.Optional(ArchiveFrameRateSchema),
    interpolation: Type.Optional(ArchiveInterpolationSchema)
  },
  { additionalProperties: false }
);
export type ArchiveVideoOutput = Static<typeof ArchiveVideoOutputSchema>;
export const ArchiveFreezeSampleSchema = Type.Object(
  {
    start: Type.Number({ minimum: 0, maximum: 7200 }),
    end: Type.Number({ exclusiveMinimum: 0, maximum: 7200 }),
    speed: Type.Number({ minimum: 0.1, maximum: 100 }),
    reverse: Type.Boolean(),
    interpolation: ArchiveInterpolationSchema,
    time: Type.Number({ minimum: 0, maximum: 7200 }),
    fps: ArchiveFrameRateSchema
  },
  { additionalProperties: false }
);
export const defaultArchiveInterpolation = (): ArchiveInterpolation => ({
  engine: "flow",
  quality: "balanced",
  sceneProtection: true,
  allowFallback: false
});
export const ArchiveInterpolationRuntimeSchema = Type.Object(
  {
    flowReady: Type.Boolean(),
    rifeReady: Type.Boolean(),
    modelVersion: Type.Optional(Type.String()),
    componentId: Type.Literal("video-interpolation"),
    message: Type.String()
  },
  { additionalProperties: false }
);
export type ArchiveInterpolationRuntime = Static<typeof ArchiveInterpolationRuntimeSchema>;
export const archiveOutputFps = (frame?: { fps?: number }) => frame?.fps ?? 30;
export const archiveNeedsSourcePreview = (clip: {
  reverse?: boolean;
  interpolation?: ArchiveInterpolation;
  freezeAt?: number;
  freezeSample?: unknown;
}) => Boolean(clip.freezeSample) || (clip.freezeAt === undefined && Boolean(clip.reverse || clip.interpolation));
