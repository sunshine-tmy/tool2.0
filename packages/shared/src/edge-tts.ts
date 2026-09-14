import { Type, type Static } from "@sinclair/typebox";

export const EDGE_TTS_MAX_TEXT_LENGTH = 20_000;

export const EDGE_TTS_LANGUAGES = ["ms-MY", "en-US", "en-GB", "pt-BR"] as const;

export const EdgeTtsLanguageSchema = Type.Union([
  Type.Literal("ms-MY"),
  Type.Literal("en-US"),
  Type.Literal("en-GB"),
  Type.Literal("pt-BR")
]);

export const EdgeTtsTaskStatusSchema = Type.Union([
  Type.Literal("queued"),
  Type.Literal("processing"),
  Type.Literal("completed"),
  Type.Literal("failed"),
  Type.Literal("cancelled")
]);

export const EdgeTtsVoiceQuerySchema = Type.Object(
  { language: Type.Optional(Type.String()) },
  { additionalProperties: false }
);

export const EdgeTtsTaskListQuerySchema = Type.Object(
  { page: Type.Optional(Type.String()), pageSize: Type.Optional(Type.String()) },
  { additionalProperties: false }
);

export const EdgeTtsVoiceSchema = Type.Object(
  {
    name: Type.String(),
    shortName: Type.String({ minLength: 1 }),
    locale: Type.String({ minLength: 1 }),
    gender: Type.Union([Type.Literal("Female"), Type.Literal("Male"), Type.Literal("Neutral")]),
    suggested: Type.Boolean()
  },
  { additionalProperties: false }
);

const EdgeTtsCreateTaskProperties = {
  text: Type.String({ minLength: 1, maxLength: EDGE_TTS_MAX_TEXT_LENGTH }),
  language: EdgeTtsLanguageSchema,
  voice: Type.String({ minLength: 1, maxLength: 128 }),
  rate: Type.Integer({ minimum: -50, maximum: 100 }),
  volume: Type.Integer({ minimum: -50, maximum: 50 }),
  pitch: Type.Integer({ minimum: -50, maximum: 50 }),
  includeSubtitles: Type.Boolean(),
  fileName: Type.Optional(Type.String({ maxLength: 255 }))
};

export const EdgeTtsCreateTaskInputSchema = Type.Object(EdgeTtsCreateTaskProperties, {
  additionalProperties: false
});

const EdgeTtsTaskProperties = {
  ...EdgeTtsCreateTaskProperties,
  id: Type.String({ minLength: 6, maxLength: 64, pattern: "^[A-Za-z0-9_-]+$" }),
  status: EdgeTtsTaskStatusSchema,
  progress: Type.Number({ minimum: 0, maximum: 100 }),
  characterCount: Type.Integer({ minimum: 0 }),
  audioBytes: Type.Optional(Type.Integer({ minimum: 0 })),
  error: Type.Optional(Type.String()),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
  expiresAt: Type.String({ format: "date-time" }),
  audioUrl: Type.Optional(Type.String()),
  downloadUrl: Type.Optional(Type.String()),
  subtitleUrl: Type.Optional(Type.String())
};

export const EdgeTtsTaskSchema = Type.Object(EdgeTtsTaskProperties, { additionalProperties: false });

const { text: _text, ...EdgeTtsTaskSummaryProperties } = EdgeTtsTaskProperties;
export const EdgeTtsTaskSummarySchema = Type.Object(
  { ...EdgeTtsTaskSummaryProperties, textPreview: Type.String() },
  { additionalProperties: false }
);

export const EdgeTtsTaskListSchema = Type.Object(
  {
    tasks: Type.Array(EdgeTtsTaskSummarySchema),
    pagination: Type.Object(
      {
        page: Type.Integer({ minimum: 1 }),
        pageSize: Type.Integer({ minimum: 1, maximum: 50 }),
        total: Type.Integer({ minimum: 0 }),
        totalPages: Type.Integer({ minimum: 1 })
      },
      { additionalProperties: false }
    )
  },
  { additionalProperties: false }
);

export const EdgeTtsHealthSchema = Type.Object(
  {
    available: Type.Boolean(),
    version: Type.Optional(Type.String()),
    message: Type.String(),
    queue: Type.Object(
      {
        active: Type.Integer({ minimum: 0 }),
        queued: Type.Integer({ minimum: 0 }),
        concurrency: Type.Integer({ minimum: 1 }),
        limit: Type.Integer({ minimum: 1 })
      },
      { additionalProperties: false }
    ),
    retentionDays: Type.Integer({ minimum: 1 }),
    maxTextLength: Type.Integer({ minimum: 1 }),
    onlineService: Type.Literal(true)
  },
  { additionalProperties: false }
);

export const EdgeTtsVoicesSchema = Type.Object(
  {
    voices: Type.Array(EdgeTtsVoiceSchema),
    source: Type.Union([Type.Literal("live"), Type.Literal("fallback")])
  },
  { additionalProperties: false }
);

export const EdgeTtsRemovalSchema = Type.Object({ removed: Type.Literal(true) }, { additionalProperties: false });

export type EdgeTtsLanguage = Static<typeof EdgeTtsLanguageSchema>;
export type EdgeTtsTaskStatus = Static<typeof EdgeTtsTaskStatusSchema>;
export type EdgeTtsVoiceQuery = Static<typeof EdgeTtsVoiceQuerySchema>;
export type EdgeTtsTaskListQuery = Static<typeof EdgeTtsTaskListQuerySchema>;
export type EdgeTtsVoice = Static<typeof EdgeTtsVoiceSchema>;
export type EdgeTtsCreateTaskInput = Static<typeof EdgeTtsCreateTaskInputSchema>;
export type EdgeTtsTask = Static<typeof EdgeTtsTaskSchema>;
export type EdgeTtsTaskSummary = Static<typeof EdgeTtsTaskSummarySchema>;
export type EdgeTtsTaskList = Static<typeof EdgeTtsTaskListSchema>;
export type EdgeTtsHealth = Static<typeof EdgeTtsHealthSchema>;

export const EDGE_TTS_RECOMMENDED_VOICES: EdgeTtsVoice[] = [
  {
    name: "Microsoft Yasmin Online (Natural) - Malay (Malaysia)",
    shortName: "ms-MY-YasminNeural",
    locale: "ms-MY",
    gender: "Female",
    suggested: true
  },
  {
    name: "Microsoft Osman Online (Natural) - Malay (Malaysia)",
    shortName: "ms-MY-OsmanNeural",
    locale: "ms-MY",
    gender: "Male",
    suggested: true
  },
  {
    name: "Microsoft Jenny Online (Natural) - English (United States)",
    shortName: "en-US-JennyNeural",
    locale: "en-US",
    gender: "Female",
    suggested: true
  },
  {
    name: "Microsoft Guy Online (Natural) - English (United States)",
    shortName: "en-US-GuyNeural",
    locale: "en-US",
    gender: "Male",
    suggested: true
  },
  {
    name: "Microsoft Sonia Online (Natural) - English (United Kingdom)",
    shortName: "en-GB-SoniaNeural",
    locale: "en-GB",
    gender: "Female",
    suggested: true
  },
  {
    name: "Microsoft Ryan Online (Natural) - English (United Kingdom)",
    shortName: "en-GB-RyanNeural",
    locale: "en-GB",
    gender: "Male",
    suggested: true
  },
  {
    name: "Microsoft Francisca Online (Natural) - Portuguese (Brazil)",
    shortName: "pt-BR-FranciscaNeural",
    locale: "pt-BR",
    gender: "Female",
    suggested: true
  },
  {
    name: "Microsoft Antonio Online (Natural) - Portuguese (Brazil)",
    shortName: "pt-BR-AntonioNeural",
    locale: "pt-BR",
    gender: "Male",
    suggested: true
  }
];
