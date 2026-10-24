/** 在线自然音色批次契约；参考音频、GPU 和克隆参数不属于在线模式。 */
import { Type, type Static } from "@sinclair/typebox";
import { EdgeTtsCreateTaskInputSchema, EdgeTtsTaskSchema, EdgeTtsTaskListSchema } from "./edge-tts";

export const EDGE_TTS_MAX_BATCH_SEGMENTS = 30;
export const EDGE_TTS_MAX_BATCH_TEXT_LENGTH = 20_000;
export const EDGE_TTS_MAX_TRANSLATION_LENGTH = 2_000;
const options = { additionalProperties: false } as const;
const id = Type.String({ pattern: "^[A-Za-z0-9_-]{6,64}$" });
export const EdgeTtsSegmentSchema = Type.Object(
  {
    text: Type.String({ minLength: 1, maxLength: EDGE_TTS_MAX_BATCH_TEXT_LENGTH }),
    referenceTranslation: Type.Optional(Type.String({ maxLength: EDGE_TTS_MAX_TRANSLATION_LENGTH })),
    fileName: Type.Optional(Type.String({ maxLength: 100 }))
  },
  options
);
const settings = Type.Omit(EdgeTtsCreateTaskInputSchema, ["text", "fileName"]);
export const EdgeTtsBatchCreateSchema = Type.Composite(
  [
    settings,
    Type.Object({
      name: Type.Optional(Type.String({ maxLength: 100 })),
      subtitleMode: Type.Union([Type.Literal("sentences"), Type.Literal("segments")]),
      segments: Type.Array(EdgeTtsSegmentSchema, { minItems: 1, maxItems: EDGE_TTS_MAX_BATCH_SEGMENTS })
    })
  ],
  options
);
export const EdgeTtsBatchItemSchema = Type.Composite(
  [
    EdgeTtsTaskSchema,
    Type.Object({
      order: Type.Integer({ minimum: 1 }),
      attempt: Type.Integer({ minimum: 1 }),
      referenceTranslation: Type.Optional(Type.String()),
      audioDurationSeconds: Type.Optional(Type.Number({ minimum: 0 }))
    })
  ],
  options
);
export const EdgeTtsBatchSchema = Type.Composite(
  [
    Type.Omit(EdgeTtsBatchCreateSchema, ["segments"]),
    Type.Object({
      id,
      items: Type.Array(EdgeTtsBatchItemSchema),
      status: Type.Union([
        Type.Literal("queued"),
        Type.Literal("processing"),
        Type.Literal("completed"),
        Type.Literal("partial_failed"),
        Type.Literal("cancelled")
      ]),
      progress: Type.Number({ minimum: 0, maximum: 100 }),
      completedItems: Type.Integer({ minimum: 0 }),
      failedItems: Type.Integer({ minimum: 0 }),
      totalCharacters: Type.Integer({ minimum: 0 }),
      totalAudioBytes: Type.Integer({ minimum: 0 }),
      totalAudioDurationSeconds: Type.Number({ minimum: 0 }),
      createdAt: Type.String(),
      updatedAt: Type.String(),
      expiresAt: Type.String(),
      archiveUrl: Type.Optional(Type.String()),
      combinedAudioUrl: Type.Optional(Type.String()),
      subtitleUrl: Type.Optional(Type.String()),
      translationSubtitleUrl: Type.Optional(Type.String()),
      bilingualSubtitleUrl: Type.Optional(Type.String())
    })
  ],
  options
);
export const EdgeTtsBatchListSchema = Type.Object(
  {
    batches: Type.Array(EdgeTtsBatchSchema),
    pagination: EdgeTtsTaskListSchema.properties.pagination
  },
  options
);
export const EdgeTtsBatchParamsSchema = Type.Object({ batchId: id }, options);
export const EdgeTtsBatchItemParamsSchema = Type.Object({ batchId: id, itemId: id }, options);
export const EdgeTtsBatchReorderSchema = Type.Object(
  {
    itemIds: Type.Array(id, { minItems: 1, maxItems: EDGE_TTS_MAX_BATCH_SEGMENTS, uniqueItems: true })
  },
  options
);
export const EdgeTtsBatchRegenerateSchema = Type.Composite(
  [EdgeTtsSegmentSchema, Type.Pick(settings, ["rate", "volume", "pitch"])],
  options
);
export type EdgeTtsBatchCreate = Static<typeof EdgeTtsBatchCreateSchema>;
export type EdgeTtsBatch = Static<typeof EdgeTtsBatchSchema>;
export type EdgeTtsBatchItem = Static<typeof EdgeTtsBatchItemSchema>;
export type EdgeTtsBatchList = Static<typeof EdgeTtsBatchListSchema>;
export type EdgeTtsBatchRegenerate = Static<typeof EdgeTtsBatchRegenerateSchema>;
