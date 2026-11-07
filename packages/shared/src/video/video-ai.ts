/**
 * 中文模块说明：共享契约层，负责跨前后端复用的类型、Schema、响应和领域常量
 */
import { Type, type Static } from "@sinclair/typebox";

export const videoAiModes = ["fast", "balanced", "extreme", "delogo"] as const;

export const VideoAiModeSchema = Type.Union([
  Type.Literal("fast"),
  Type.Literal("balanced"),
  Type.Literal("extreme"),
  Type.Literal("delogo")
]);

export const VideoAiTaskStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("running"),
  Type.Literal("completed"),
  Type.Literal("failed"),
  Type.Literal("canceled")
]);

/** Normalized subtitle rectangle (0..1 of frame width/height). */
export const VideoAiRectSchema = Type.Object(
  {
    x: Type.Number({ minimum: 0, maximum: 1 }),
    y: Type.Number({ minimum: 0, maximum: 1 }),
    width: Type.Number({ minimum: 0, maximum: 1 }),
    height: Type.Number({ minimum: 0, maximum: 1 })
  },
  { additionalProperties: false }
);

export const VideoAiSegmentSchema = Type.Object(
  {
    rect: VideoAiRectSchema,
    startFrame: Type.Integer({ minimum: 0 }),
    endFrame: Type.Integer({ minimum: 0 })
  },
  { additionalProperties: false }
);

export const VideoAiDetectionSchema = Type.Object(
  {
    width: Type.Integer({ minimum: 1 }),
    height: Type.Integer({ minimum: 1 }),
    fps: Type.Number({ minimum: 0 }),
    frameCount: Type.Integer({ minimum: 1 }),
    hasAudio: Type.Boolean(),
    segments: Type.Array(
      Type.Object(
        {
          rect: VideoAiRectSchema,
          startFrame: Type.Integer({ minimum: 0 }),
          endFrame: Type.Integer({ minimum: 0 }),
          confidence: Type.Number({ minimum: 0, maximum: 1 })
        },
        { additionalProperties: false }
      )
    ),
    warnings: Type.Array(Type.String())
  },
  { additionalProperties: false }
);

export const VideoAiOutputSchema = Type.Object(
  {
    downloadUrl: Type.String({ minLength: 1 }),
    bytes: Type.Integer({ minimum: 0 }),
    width: Type.Integer({ minimum: 1 }),
    height: Type.Integer({ minimum: 1 }),
    durationMs: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])
  },
  { additionalProperties: false }
);

export const VideoAiTaskSchema = Type.Object(
  {
    id: Type.String({ minLength: 6, maxLength: 64, pattern: "^[A-Za-z0-9_-]+$" }),
    mode: VideoAiModeSchema,
    status: VideoAiTaskStatusSchema,
    progress: Type.Number({ minimum: 0, maximum: 100 }),
    processedFrames: Type.Optional(Type.Integer({ minimum: 0 })),
    totalFrames: Type.Optional(Type.Integer({ minimum: 1 })),
    queuePosition: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    phase: Type.Optional(Type.String()),
    inputName: Type.String({ minLength: 1 }),
    inputBytes: Type.Integer({ minimum: 0 }),
    segments: Type.Array(VideoAiSegmentSchema),
    warnings: Type.Array(Type.String()),
    output: Type.Union([VideoAiOutputSchema, Type.Null()]),
    error: Type.Optional(Type.String()),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
    // null means a completed output is retained until explicitly deleted.
    expiresAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()])
  },
  { additionalProperties: false }
);

export const VideoAiHistoryQuerySchema = Type.Object(
  {
    page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
    status: Type.Optional(VideoAiTaskStatusSchema)
  },
  { additionalProperties: false }
);

export const VideoAiHistorySchema = Type.Object(
  {
    items: Type.Array(VideoAiTaskSchema),
    total: Type.Integer({ minimum: 0 }),
    page: Type.Integer({ minimum: 1 }),
    pageSize: Type.Integer({ minimum: 1, maximum: 50 })
  },
  { additionalProperties: false }
);

export const VideoAiDeleteSchema = Type.Object(
  { id: Type.String(), deleted: Type.Literal(true) },
  { additionalProperties: false }
);

export const VideoAiEngineSchema = Type.Object(
  {
    provider: Type.String({ minLength: 1 }),
    model: Type.Optional(Type.String()),
    license: Type.String(),
    available: Type.Boolean(),
    reason: Type.Union([Type.String(), Type.Null()])
  },
  { additionalProperties: false }
);

export const VideoAiHealthSchema = Type.Object(
  {
    protocolVersion: Type.Integer({ minimum: 1 }),
    available: Type.Boolean(),
    device: Type.Union([Type.String(), Type.Null()]),
    vramTotalMb: Type.Union([Type.Integer({ minimum: 0 }), Type.Null()]),
    engines: Type.Array(VideoAiEngineSchema)
  },
  { additionalProperties: false }
);

export const VideoAiTaskParamsSchema = Type.Object(
  { taskId: Type.String({ minLength: 6, maxLength: 64, pattern: "^[A-Za-z0-9_-]+$" }) },
  { additionalProperties: false }
);

export const VIDEO_AI_MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
export const VIDEO_AI_MAX_STORAGE_BYTES = 20 * 1024 * 1024 * 1024;
export const VIDEO_AI_ALLOWED_EXTENSIONS = [".mp4", ".mkv", ".avi", ".mov", ".webm"] as const;

export function isVideoAiMode(value: unknown): value is VideoAiMode {
  return typeof value === "string" && (videoAiModes as readonly string[]).includes(value);
}

export type VideoAiMode = Static<typeof VideoAiModeSchema>;
export type VideoAiTaskStatus = Static<typeof VideoAiTaskStatusSchema>;
export type VideoAiRect = Static<typeof VideoAiRectSchema>;
export type VideoAiSegment = Static<typeof VideoAiSegmentSchema>;
export type VideoAiTimedRegion = { start: number; end: number; rects: VideoAiRect[] };
export type VideoAiDetection = Static<typeof VideoAiDetectionSchema>;
export type VideoAiOutput = Static<typeof VideoAiOutputSchema>;
export type VideoAiTask = Static<typeof VideoAiTaskSchema>;
export type VideoAiHistoryQuery = Static<typeof VideoAiHistoryQuerySchema>;
export type VideoAiHistory = Static<typeof VideoAiHistorySchema>;
export type VideoAiEngine = Static<typeof VideoAiEngineSchema>;
export type VideoAiHealth = Static<typeof VideoAiHealthSchema>;
export type VideoAiTaskParams = Static<typeof VideoAiTaskParamsSchema>;
