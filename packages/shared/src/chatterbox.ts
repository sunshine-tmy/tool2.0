/**
 * 中文模块说明：共享契约层，负责跨前后端复用的类型、Schema、响应和领域常量
 */
import { Type, type Static } from "@sinclair/typebox";

export const CHATTERBOX_MAX_TEXT_LENGTH = 1_200;
export const CHATTERBOX_MAX_BATCH_SEGMENTS = 30;
export const CHATTERBOX_MAX_BATCH_TEXT_LENGTH = 20_000;
export const CHATTERBOX_MAX_REFERENCE_TRANSLATION_LENGTH = 2_000;
export const CHATTERBOX_MAX_REFERENCE_BYTES = 20 * 1024 * 1024;
export const CHATTERBOX_MIN_REFERENCE_SECONDS = 5;
export const CHATTERBOX_MAX_REFERENCE_SECONDS = 30;

export const CHATTERBOX_LANGUAGES = ["ms", "en", "pt-BR"] as const;
export type ChatterboxLanguage = (typeof CHATTERBOX_LANGUAGES)[number];

const ChatterboxIdSchema = Type.String({ minLength: 6, maxLength: 64, pattern: "^[A-Za-z0-9_-]+$" });

export const ChatterboxListQuerySchema = Type.Object(
  {
    page: Type.Optional(Type.String({ pattern: "^[1-9][0-9]*$" })),
    pageSize: Type.Optional(Type.String({ pattern: "^[1-9][0-9]*$" }))
  },
  { additionalProperties: false }
);

export const ChatterboxTaskIdParamsSchema = Type.Object(
  { taskId: ChatterboxIdSchema },
  { additionalProperties: false }
);
export const ChatterboxBatchIdParamsSchema = Type.Object(
  { batchId: ChatterboxIdSchema },
  { additionalProperties: false }
);
export const ChatterboxVoiceIdParamsSchema = Type.Object(
  { voiceId: ChatterboxIdSchema },
  { additionalProperties: false }
);
export const ChatterboxBatchItemParamsSchema = Type.Object(
  { batchId: ChatterboxIdSchema, itemId: ChatterboxIdSchema },
  { additionalProperties: false }
);
export const ChatterboxBatchOrderSchema = Type.Object(
  { itemIds: Type.Array(ChatterboxIdSchema, { minItems: 1, maxItems: CHATTERBOX_MAX_BATCH_SEGMENTS }) },
  { additionalProperties: false }
);

const ChatterboxLanguageSchema = Type.Union(CHATTERBOX_LANGUAGES.map((language) => Type.Literal(language)));
export const ChatterboxAuthorizationSchema = Type.Union([Type.Literal("self"), Type.Literal("authorized")]);
export const ChatterboxTaskStatusSchema = Type.Union([
  Type.Literal("queued"),
  Type.Literal("processing"),
  Type.Literal("completed"),
  Type.Literal("failed"),
  Type.Literal("cancelled")
]);
export const ChatterboxBatchStatusSchema = Type.Union([
  Type.Literal("queued"),
  Type.Literal("processing"),
  Type.Literal("partial_failed"),
  Type.Literal("completed"),
  Type.Literal("cancelled")
]);
export const ChatterboxSubtitleModeSchema = Type.Union([Type.Literal("sentences"), Type.Literal("segments")]);
const ChatterboxPaginationSchema = Type.Object(
  {
    page: Type.Integer({ minimum: 1 }),
    pageSize: Type.Integer({ minimum: 1, maximum: 50 }),
    total: Type.Integer({ minimum: 0 }),
    totalPages: Type.Integer({ minimum: 1 })
  },
  { additionalProperties: false }
);

export const ChatterboxTaskSchema = Type.Object(
  {
    id: ChatterboxIdSchema,
    engine: Type.Literal("chatterbox-multilingual-v3"),
    status: ChatterboxTaskStatusSchema,
    progress: Type.Number({ minimum: 0, maximum: 100 }),
    text: Type.String(),
    language: ChatterboxLanguageSchema,
    referenceFileName: Type.String(),
    referenceDurationSeconds: Type.Number({ minimum: 0 }),
    authorization: ChatterboxAuthorizationSchema,
    consentConfirmed: Type.Literal(true),
    exaggeration: Type.Number(),
    cfgWeight: Type.Number(),
    temperature: Type.Number(),
    seed: Type.Integer(),
    includeSubtitles: Type.Boolean(),
    fileName: Type.Optional(Type.String()),
    characterCount: Type.Integer({ minimum: 0 }),
    audioBytes: Type.Optional(Type.Integer({ minimum: 0 })),
    audioDurationSeconds: Type.Optional(Type.Number({ minimum: 0 })),
    error: Type.Optional(Type.String()),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
    expiresAt: Type.String({ format: "date-time" }),
    audioUrl: Type.Optional(Type.String()),
    downloadUrl: Type.Optional(Type.String()),
    subtitleUrl: Type.Optional(Type.String())
  },
  { additionalProperties: false }
);

export const ChatterboxTaskSummarySchema = Type.Composite(
  [Type.Omit(ChatterboxTaskSchema, ["text"]), Type.Object({ textPreview: Type.String() })],
  { additionalProperties: false }
);
export const ChatterboxTaskListSchema = Type.Object(
  { tasks: Type.Array(ChatterboxTaskSummarySchema), pagination: ChatterboxPaginationSchema },
  { additionalProperties: false }
);
export const ChatterboxHealthSchema = Type.Object(
  {
    protocolVersion: Type.Integer({ minimum: 1 }),
    available: Type.Boolean(),
    workerAvailable: Type.Boolean(),
    packageVersion: Type.Optional(Type.String()),
    model: Type.Literal("multilingual-v3"),
    modelLoaded: Type.Boolean(),
    device: Type.Optional(Type.Union([Type.Literal("cuda"), Type.Literal("cpu")])),
    gpuName: Type.Optional(Type.String()),
    message: Type.String(),
    reference: Type.Object(
      {
        maxBytes: Type.Integer({ minimum: 1 }),
        minSeconds: Type.Number({ minimum: 0 }),
        maxSeconds: Type.Number({ minimum: 0 })
      },
      { additionalProperties: false }
    ),
    maxTextLength: Type.Integer({ minimum: 1 }),
    retentionDays: Type.Integer({ minimum: 1 }),
    queue: Type.Object(
      {
        active: Type.Integer({ minimum: 0 }),
        queued: Type.Integer({ minimum: 0 }),
        concurrency: Type.Literal(1),
        limit: Type.Integer({ minimum: 1 })
      },
      { additionalProperties: false }
    ),
    watermarked: Type.Literal(true)
  },
  { additionalProperties: false }
);
export const ChatterboxRemovalSchema = Type.Object({ removed: Type.Literal(true) }, { additionalProperties: false });
export const ChatterboxSavedVoiceSchema = Type.Object(
  {
    id: ChatterboxIdSchema,
    name: Type.String(),
    language: ChatterboxLanguageSchema,
    originalFileName: Type.String(),
    durationSeconds: Type.Number({ minimum: 0 }),
    audioBytes: Type.Integer({ minimum: 0 }),
    authorization: ChatterboxAuthorizationSchema,
    consentConfirmed: Type.Literal(true),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
    audioUrl: Type.String()
  },
  { additionalProperties: false }
);
export const ChatterboxSavedVoiceListSchema = Type.Object(
  { voices: Type.Array(ChatterboxSavedVoiceSchema) },
  { additionalProperties: false }
);
export const ChatterboxBatchItemSchema = Type.Object(
  {
    id: ChatterboxIdSchema,
    order: Type.Integer({ minimum: 1 }),
    text: Type.String(),
    referenceTranslation: Type.Optional(Type.String()),
    fileName: Type.Optional(Type.String()),
    status: ChatterboxTaskStatusSchema,
    progress: Type.Number({ minimum: 0, maximum: 100 }),
    attempt: Type.Integer({ minimum: 1 }),
    seed: Type.Optional(Type.Integer()),
    exaggeration: Type.Optional(Type.Number()),
    cfgWeight: Type.Optional(Type.Number()),
    temperature: Type.Optional(Type.Number()),
    characterCount: Type.Integer({ minimum: 0 }),
    audioBytes: Type.Optional(Type.Integer({ minimum: 0 })),
    audioDurationSeconds: Type.Optional(Type.Number({ minimum: 0 })),
    error: Type.Optional(Type.String()),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
    audioUrl: Type.Optional(Type.String()),
    downloadUrl: Type.Optional(Type.String())
  },
  { additionalProperties: false }
);
export const ChatterboxBatchSchema = Type.Object(
  {
    id: ChatterboxIdSchema,
    engine: Type.Literal("chatterbox-multilingual-v3"),
    status: ChatterboxBatchStatusSchema,
    progress: Type.Number({ minimum: 0, maximum: 100 }),
    name: Type.Optional(Type.String()),
    language: ChatterboxLanguageSchema,
    referenceFileName: Type.String(),
    referenceDurationSeconds: Type.Number({ minimum: 0 }),
    referenceRetained: Type.Boolean(),
    referenceAvailable: Type.Boolean(),
    authorization: ChatterboxAuthorizationSchema,
    consentConfirmed: Type.Literal(true),
    exaggeration: Type.Number(),
    cfgWeight: Type.Number(),
    temperature: Type.Number(),
    seed: Type.Integer(),
    includeSubtitles: Type.Boolean(),
    subtitleMode: ChatterboxSubtitleModeSchema,
    items: Type.Array(ChatterboxBatchItemSchema),
    totalCharacters: Type.Integer({ minimum: 0 }),
    totalAudioBytes: Type.Optional(Type.Integer({ minimum: 0 })),
    totalAudioDurationSeconds: Type.Optional(Type.Number({ minimum: 0 })),
    completedItems: Type.Integer({ minimum: 0 }),
    failedItems: Type.Integer({ minimum: 0 }),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
    expiresAt: Type.String({ format: "date-time" }),
    combinedAudioUrl: Type.Optional(Type.String()),
    subtitleUrl: Type.Optional(Type.String()),
    translationSubtitleUrl: Type.Optional(Type.String()),
    bilingualSubtitleUrl: Type.Optional(Type.String()),
    archiveUrl: Type.Optional(Type.String())
  },
  { additionalProperties: false }
);
export const ChatterboxBatchItemSummarySchema = Type.Composite(
  [Type.Omit(ChatterboxBatchItemSchema, ["text", "referenceTranslation"]), Type.Object({ textPreview: Type.String() })],
  { additionalProperties: false }
);
export const ChatterboxBatchSummarySchema = Type.Composite(
  [
    Type.Omit(ChatterboxBatchSchema, ["items"]),
    Type.Object({ itemPreviews: Type.Array(ChatterboxBatchItemSummarySchema) })
  ],
  { additionalProperties: false }
);
export const ChatterboxBatchListSchema = Type.Object(
  { batches: Type.Array(ChatterboxBatchSummarySchema), pagination: ChatterboxPaginationSchema },
  { additionalProperties: false }
);
export const ChatterboxBatchItemRemovalSchema = Type.Object(
  { removed: Type.Literal(true), batch: Type.Optional(ChatterboxBatchSchema) },
  { additionalProperties: false }
);

export type ChatterboxListQuery = Static<typeof ChatterboxListQuerySchema>;
export type ChatterboxTaskIdParams = Static<typeof ChatterboxTaskIdParamsSchema>;
export type ChatterboxBatchIdParams = Static<typeof ChatterboxBatchIdParamsSchema>;
export type ChatterboxVoiceIdParams = Static<typeof ChatterboxVoiceIdParamsSchema>;
export type ChatterboxBatchItemParams = Static<typeof ChatterboxBatchItemParamsSchema>;
export type ChatterboxBatchOrder = Static<typeof ChatterboxBatchOrderSchema>;

export type ChatterboxVoiceAuthorization = Static<typeof ChatterboxAuthorizationSchema>;
export type ChatterboxSubtitleMode = Static<typeof ChatterboxSubtitleModeSchema>;
export type ChatterboxTaskStatus = Static<typeof ChatterboxTaskStatusSchema>;
export type ChatterboxBatchStatus = Static<typeof ChatterboxBatchStatusSchema>;
export type ChatterboxTask = Static<typeof ChatterboxTaskSchema>;
export type ChatterboxTaskSummary = Static<typeof ChatterboxTaskSummarySchema>;
export type ChatterboxTaskList = Static<typeof ChatterboxTaskListSchema>;
export type ChatterboxHealth = Static<typeof ChatterboxHealthSchema>;
export type ChatterboxBatchItem = Static<typeof ChatterboxBatchItemSchema>;
export type ChatterboxSavedVoice = Static<typeof ChatterboxSavedVoiceSchema>;
export type ChatterboxSavedVoiceList = Static<typeof ChatterboxSavedVoiceListSchema>;
export type ChatterboxBatchItemSummary = Static<typeof ChatterboxBatchItemSummarySchema>;
export type ChatterboxBatch = Static<typeof ChatterboxBatchSchema>;
export type ChatterboxBatchSummary = Static<typeof ChatterboxBatchSummarySchema>;
export type ChatterboxBatchList = Static<typeof ChatterboxBatchListSchema>;
