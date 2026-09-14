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
const ChatterboxAuthorizationSchema = Type.Union([Type.Literal("self"), Type.Literal("authorized")]);
const ChatterboxTaskStatusSchema = Type.Union([
  Type.Literal("queued"),
  Type.Literal("processing"),
  Type.Literal("completed"),
  Type.Literal("failed"),
  Type.Literal("cancelled")
]);
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

export type ChatterboxListQuery = Static<typeof ChatterboxListQuerySchema>;
export type ChatterboxTaskIdParams = Static<typeof ChatterboxTaskIdParamsSchema>;
export type ChatterboxBatchIdParams = Static<typeof ChatterboxBatchIdParamsSchema>;
export type ChatterboxVoiceIdParams = Static<typeof ChatterboxVoiceIdParamsSchema>;
export type ChatterboxBatchItemParams = Static<typeof ChatterboxBatchItemParamsSchema>;
export type ChatterboxBatchOrder = Static<typeof ChatterboxBatchOrderSchema>;

export type ChatterboxVoiceAuthorization = "self" | "authorized";
export type ChatterboxSubtitleMode = "sentences" | "segments";
export type ChatterboxTaskStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";
export type ChatterboxBatchStatus = "queued" | "processing" | "partial_failed" | "completed" | "cancelled";

export type ChatterboxTask = {
  id: string;
  engine: "chatterbox-multilingual-v3";
  status: ChatterboxTaskStatus;
  progress: number;
  text: string;
  language: ChatterboxLanguage;
  referenceFileName: string;
  referenceDurationSeconds: number;
  authorization: ChatterboxVoiceAuthorization;
  consentConfirmed: true;
  exaggeration: number;
  cfgWeight: number;
  temperature: number;
  seed: number;
  includeSubtitles: boolean;
  fileName?: string;
  characterCount: number;
  audioBytes?: number;
  audioDurationSeconds?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  audioUrl?: string;
  downloadUrl?: string;
  subtitleUrl?: string;
};

export type ChatterboxTaskSummary = Omit<ChatterboxTask, "text"> & {
  textPreview: string;
};

export type ChatterboxTaskList = {
  tasks: ChatterboxTaskSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type ChatterboxHealth = {
  protocolVersion: number;
  available: boolean;
  workerAvailable: boolean;
  packageVersion?: string;
  model: "multilingual-v3";
  modelLoaded: boolean;
  device?: "cuda" | "cpu";
  gpuName?: string;
  message: string;
  reference: {
    maxBytes: number;
    minSeconds: number;
    maxSeconds: number;
  };
  maxTextLength: number;
  retentionDays: number;
  queue: {
    active: number;
    queued: number;
    concurrency: 1;
    limit: number;
  };
  watermarked: true;
};

export type ChatterboxBatchItem = {
  id: string;
  order: number;
  text: string;
  referenceTranslation?: string;
  fileName?: string;
  status: ChatterboxTaskStatus;
  progress: number;
  attempt: number;
  seed?: number;
  exaggeration?: number;
  cfgWeight?: number;
  temperature?: number;
  characterCount: number;
  audioBytes?: number;
  audioDurationSeconds?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
  audioUrl?: string;
  downloadUrl?: string;
};

export type ChatterboxSavedVoice = {
  id: string;
  name: string;
  language: ChatterboxLanguage;
  originalFileName: string;
  durationSeconds: number;
  audioBytes: number;
  authorization: ChatterboxVoiceAuthorization;
  consentConfirmed: true;
  createdAt: string;
  updatedAt: string;
  audioUrl: string;
};

export type ChatterboxSavedVoiceList = {
  voices: ChatterboxSavedVoice[];
};

export type ChatterboxBatchItemSummary = Omit<ChatterboxBatchItem, "text" | "referenceTranslation"> & {
  textPreview: string;
};

export type ChatterboxBatch = {
  id: string;
  engine: "chatterbox-multilingual-v3";
  status: ChatterboxBatchStatus;
  progress: number;
  name?: string;
  language: ChatterboxLanguage;
  referenceFileName: string;
  referenceDurationSeconds: number;
  referenceRetained: boolean;
  referenceAvailable: boolean;
  authorization: ChatterboxVoiceAuthorization;
  consentConfirmed: true;
  exaggeration: number;
  cfgWeight: number;
  temperature: number;
  seed: number;
  includeSubtitles: boolean;
  subtitleMode: ChatterboxSubtitleMode;
  items: ChatterboxBatchItem[];
  totalCharacters: number;
  totalAudioBytes?: number;
  totalAudioDurationSeconds?: number;
  completedItems: number;
  failedItems: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  combinedAudioUrl?: string;
  subtitleUrl?: string;
  translationSubtitleUrl?: string;
  bilingualSubtitleUrl?: string;
  archiveUrl?: string;
};

export type ChatterboxBatchSummary = Omit<ChatterboxBatch, "items"> & {
  itemPreviews: ChatterboxBatchItemSummary[];
};

export type ChatterboxBatchList = {
  batches: ChatterboxBatchSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
