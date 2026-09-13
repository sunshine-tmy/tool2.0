import { Type, type Static } from "@sinclair/typebox";
import { TaskSchema } from "./api-schema";

const OptionalSeconds = Type.Optional(Type.Number({ minimum: 0 }));

export const VideoTextCueSchema = Type.Object(
  {
    index: Type.Integer({ minimum: 0 }),
    startSeconds: OptionalSeconds,
    endSeconds: OptionalSeconds,
    text: Type.String()
  },
  { additionalProperties: false }
);

export const VideoTextRecognitionQualitySchema = Type.Object(
  {
    requestedModel: Type.Optional(Type.String()),
    model: Type.Optional(Type.String()),
    language: Type.Optional(Type.String()),
    detectedLanguage: Type.Optional(Type.String()),
    languageProbability: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
    device: Type.Optional(Type.String()),
    computeType: Type.Optional(Type.String()),
    averageLogProbability: Type.Optional(Type.Number()),
    lowConfidenceSegments: Type.Optional(
      Type.Array(
        Type.Object(
          {
            index: Type.Integer({ minimum: 0 }),
            startSeconds: OptionalSeconds,
            endSeconds: OptionalSeconds,
            text: Type.String(),
            averageLogProbability: Type.Optional(Type.Number()),
            noSpeechProbability: Type.Optional(Type.Number({ minimum: 0, maximum: 1 }))
          },
          { additionalProperties: false }
        )
      )
    )
  },
  { additionalProperties: false }
);

export const VideoTextAnalysisSchema = Type.Object(
  {
    title: Type.String({ minLength: 1 }),
    fullText: Type.String(),
    segments: Type.Array(VideoTextCueSchema),
    timeline: Type.Array(VideoTextCueSchema),
    stats: Type.Object(
      {
        characterCount: Type.Integer({ minimum: 0 }),
        wordCount: Type.Integer({ minimum: 0 }),
        sentenceCount: Type.Integer({ minimum: 0 }),
        cueCount: Type.Integer({ minimum: 0 }),
        estimatedReadingMinutes: Type.Integer({ minimum: 1 })
      },
      { additionalProperties: false }
    ),
    summary: Type.Array(Type.String()),
    chapters: Type.Array(
      Type.Object(
        {
          title: Type.String({ minLength: 1 }),
          startSeconds: OptionalSeconds,
          endSeconds: OptionalSeconds,
          summary: Type.String()
        },
        { additionalProperties: false }
      )
    ),
    recognitionQuality: Type.Optional(VideoTextRecognitionQualitySchema)
  },
  { additionalProperties: false }
);

export const StoredVideoTextResultSchema = Type.Composite(
  [
    VideoTextAnalysisSchema,
    Type.Object({
      id: Type.String({ minLength: 1, maxLength: 64, pattern: "^[A-Za-z0-9_-]+$" }),
      fileName: Type.String({ minLength: 1, maxLength: 255 }),
      fileSize: Type.Integer({ minimum: 0 }),
      mimeType: Type.String({ minLength: 1 }),
      source: Type.Union([Type.Literal("form-text"), Type.Literal("transcriber")]),
      createdAt: Type.String({ format: "date-time" })
    })
  ],
  { additionalProperties: false }
);

export const VideoTextHistoryItemSchema = Type.Object(
  {
    id: Type.String({ minLength: 1, maxLength: 64, pattern: "^[A-Za-z0-9_-]+$" }),
    fileName: Type.String({ minLength: 1, maxLength: 255 }),
    fileSize: Type.Integer({ minimum: 0 }),
    mimeType: Type.String({ minLength: 1 }),
    source: Type.Union([Type.Literal("form-text"), Type.Literal("transcriber")]),
    createdAt: Type.String({ format: "date-time" }),
    summary: Type.Array(Type.String()),
    textPreview: Type.String(),
    characterCount: Type.Integer({ minimum: 0 })
  },
  { additionalProperties: false }
);

export const VideoTextHistorySchema = Type.Object(
  {
    items: Type.Array(VideoTextHistoryItemSchema),
    total: Type.Integer({ minimum: 0 }),
    page: Type.Integer({ minimum: 1 }),
    pageSize: Type.Integer({ minimum: 1, maximum: 50 }),
    pageCount: Type.Integer({ minimum: 1 })
  },
  { additionalProperties: false }
);

export const VideoTextTaskResponseSchema = Type.Object(
  {
    task: TaskSchema,
    result: Type.Union([StoredVideoTextResultSchema, Type.Null()])
  },
  { additionalProperties: false }
);

export const VideoTextFromUrlInputSchema = Type.Object(
  {
    url: Type.String({ minLength: 1, maxLength: 4096 }),
    fileName: Type.Optional(Type.String({ maxLength: 255 }))
  },
  { additionalProperties: false }
);

export const VideoTextTaskParamsSchema = Type.Object(
  { taskId: Type.String({ minLength: 1, maxLength: 4096 }) },
  { additionalProperties: false }
);

export const VideoTextRemoteQuerySchema = Type.Object(
  { url: Type.String({ minLength: 1, maxLength: 4096 }) },
  { additionalProperties: false }
);

export const VideoTextHistoryQuerySchema = Type.Object(
  {
    keyword: Type.Optional(Type.String({ maxLength: 200 })),
    page: Type.Optional(Type.String()),
    pageSize: Type.Optional(Type.String())
  },
  { additionalProperties: false }
);

export const VideoTextExportQuerySchema = Type.Object(
  { format: Type.Optional(Type.Union([Type.Literal("txt"), Type.Literal("srt"), Type.Literal("json")])) },
  { additionalProperties: false }
);

export const VideoTextRemovalSchema = Type.Object({ removed: Type.Literal(true) }, { additionalProperties: false });

export type StoredVideoTextResultDto = Static<typeof StoredVideoTextResultSchema>;
export type VideoTextHistoryItemDto = Static<typeof VideoTextHistoryItemSchema>;
export type VideoTextFromUrlInputDto = Static<typeof VideoTextFromUrlInputSchema>;
