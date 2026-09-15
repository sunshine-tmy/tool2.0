import { Type, type Static } from "@sinclair/typebox";

const XhsEntityIdSchema = Type.String({ minLength: 6, maxLength: 128, pattern: "^[A-Za-z0-9_-]+$" });

export const XhsArchiveIdParamsSchema = Type.Object({ id: XhsEntityIdSchema }, { additionalProperties: false });

export const XhsArchiveMediaParamsSchema = Type.Object(
  { id: XhsEntityIdSchema, mediaId: XhsEntityIdSchema },
  { additionalProperties: false }
);

export const XhsAuthSessionParamsSchema = Type.Object(
  { sessionId: XhsEntityIdSchema },
  { additionalProperties: false }
);

export const XhsArchiveCreateInputSchema = Type.Object(
  { url: Type.String({ minLength: 1, maxLength: 10_000 }) },
  { additionalProperties: false }
);

export const XhsArchiveListQuerySchema = Type.Object(
  {
    keyword: Type.Optional(Type.String({ maxLength: 200 })),
    type: Type.Optional(
      Type.Union([
        Type.Literal("all"),
        Type.Literal("image"),
        Type.Literal("video"),
        Type.Literal("live-photo"),
        Type.Literal("unknown")
      ])
    ),
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 }))
  },
  { additionalProperties: false }
);

export const XhsMediaQuerySchema = Type.Object(
  { download: Type.Optional(Type.Union([Type.Literal("0"), Type.Literal("1")])) },
  { additionalProperties: false }
);

export const XhsTranslationRequestSchema = Type.Object(
  { force: Type.Optional(Type.Boolean()) },
  { additionalProperties: false }
);

export const XhsTranslationBatchInputSchema = Type.Union([
  Type.Object(
    {
      mode: Type.Literal("selected"),
      itemIds: Type.Array(XhsEntityIdSchema, { minItems: 1, maxItems: 100, uniqueItems: true })
    },
    { additionalProperties: false }
  ),
  Type.Object(
    {
      mode: Type.Literal("missing-or-stale"),
      itemIds: Type.Optional(Type.Array(XhsEntityIdSchema, { maxItems: 100, uniqueItems: true }))
    },
    { additionalProperties: false }
  )
]);

const XhsTranslationEditedFieldSchema = Type.Object(
  { edited: Type.String({ maxLength: 100_000 }) },
  { additionalProperties: false }
);

export const XhsTranslationEditInputSchema = Type.Object(
  {
    sourceHash: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    title: Type.Object({ edited: Type.String({ maxLength: 2_000 }) }, { additionalProperties: false }),
    description: Type.Optional(XhsTranslationEditedFieldSchema),
    topics: Type.Array(
      Type.Object(
        {
          topicId: Type.String({ minLength: 1, maxLength: 255 }),
          edited: Type.String({ maxLength: 200 })
        },
        { additionalProperties: false }
      ),
      { maxItems: 100 }
    )
  },
  { additionalProperties: false }
);

export type XhsArchiveIdParams = Static<typeof XhsArchiveIdParamsSchema>;
export type XhsArchiveMediaParams = Static<typeof XhsArchiveMediaParamsSchema>;
export type XhsAuthSessionParams = Static<typeof XhsAuthSessionParamsSchema>;
export type XhsArchiveCreateInput = Static<typeof XhsArchiveCreateInputSchema>;
export type XhsArchiveListQuery = Static<typeof XhsArchiveListQuerySchema>;
export type XhsMediaQuery = Static<typeof XhsMediaQuerySchema>;
export type XhsTranslationRequest = Static<typeof XhsTranslationRequestSchema>;
export type XhsTranslationBatchInput = Static<typeof XhsTranslationBatchInputSchema>;
export type XhsTranslationEditInput = Static<typeof XhsTranslationEditInputSchema>;

const XhsJobStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("running"),
  Type.Literal("completed"),
  Type.Literal("failed")
]);
export const XhsArchiveContentTypeSchema = Type.Union([
  Type.Literal("image"),
  Type.Literal("video"),
  Type.Literal("live-photo"),
  Type.Literal("unknown")
]);
export const XhsArchiveMediaKindSchema = Type.Union([
  Type.Literal("image"),
  Type.Literal("video"),
  Type.Literal("cover"),
  Type.Literal("live-photo")
]);
export const XhsArchiveAuthorSchema = Type.Object(
  { id: Type.Optional(Type.String()), name: Type.Optional(Type.String()), avatarUrl: Type.Optional(Type.String()) },
  { additionalProperties: false }
);
export const XhsArchiveTopicSchema = Type.Object(
  { id: Type.String({ minLength: 1 }), source: Type.String() },
  { additionalProperties: false }
);
export const XhsTranslationFieldSchema = Type.Object(
  {
    source: Type.String(),
    machine: Type.String(),
    edited: Type.Optional(Type.String()),
    editedAt: Type.Optional(Type.String({ format: "date-time" }))
  },
  { additionalProperties: false }
);
export const XhsArchiveTranslationSchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal("queued"),
      Type.Literal("installing"),
      Type.Literal("translating"),
      Type.Literal("ready"),
      Type.Literal("failed"),
      Type.Literal("stale")
    ]),
    sourceHash: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    sourceLanguage: Type.Literal("zh-CN"),
    targetLanguage: Type.Literal("en"),
    provider: Type.Literal("opus-mt"),
    modelId: Type.Literal("Helsinki-NLP/opus-mt-zh-en"),
    modelRevision: Type.String(),
    taskId: Type.Optional(XhsEntityIdSchema),
    title: XhsTranslationFieldSchema,
    description: Type.Optional(XhsTranslationFieldSchema),
    topics: Type.Array(
      Type.Composite([XhsTranslationFieldSchema, Type.Object({ topicId: Type.String() })], {
        additionalProperties: false
      })
    ),
    translatedAt: Type.Optional(Type.String({ format: "date-time" })),
    error: Type.Optional(Type.Object({ code: Type.String(), message: Type.String() }))
  },
  { additionalProperties: false }
);
export const XhsTranslationRuntimeStatusSchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal("not-installed"),
      Type.Literal("installing"),
      Type.Literal("ready"),
      Type.Literal("failed")
    ]),
    version: Type.String(),
    modelId: Type.Literal("Helsinki-NLP/opus-mt-zh-en"),
    modelRevision: Type.String(),
    providerUrl: Type.Optional(Type.String()),
    message: Type.String(),
    installProgress: Type.Number({ minimum: 0, maximum: 100 })
  },
  { additionalProperties: false }
);
export const XhsTranslationTaskStageSchema = Type.Union([
  Type.Literal("queued"),
  Type.Literal("installing-runtime"),
  Type.Literal("downloading-model"),
  Type.Literal("loading-model"),
  Type.Literal("translating-title"),
  Type.Literal("translating-description"),
  Type.Literal("translating-topics"),
  Type.Literal("saving"),
  Type.Literal("completed"),
  Type.Literal("failed")
]);
export const XhsTranslationTaskSchema = Type.Object(
  {
    id: XhsEntityIdSchema,
    itemIds: Type.Array(XhsEntityIdSchema),
    status: XhsJobStatusSchema,
    stage: XhsTranslationTaskStageSchema,
    progress: Type.Number({ minimum: 0, maximum: 100 }),
    completedItems: Type.Integer({ minimum: 0 }),
    totalItems: Type.Integer({ minimum: 0 }),
    currentItemId: Type.Optional(XhsEntityIdSchema),
    message: Type.String(),
    error: Type.Optional(Type.String()),
    errorCode: Type.Optional(Type.String()),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" })
  },
  { additionalProperties: false }
);
export const XhsArchiveMediaSchema = Type.Object(
  {
    id: XhsEntityIdSchema,
    kind: XhsArchiveMediaKindSchema,
    index: Type.Integer({ minimum: 0 }),
    fileName: Type.String(),
    mimeType: Type.String(),
    size: Type.Integer({ minimum: 0 }),
    width: Type.Optional(Type.Integer({ minimum: 1 })),
    height: Type.Optional(Type.Integer({ minimum: 1 })),
    durationMs: Type.Optional(Type.Number({ minimum: 0 })),
    checksum: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    previewUrl: Type.String(),
    downloadUrl: Type.String()
  },
  { additionalProperties: false }
);
export const XhsArchiveItemSchema = Type.Object(
  {
    id: XhsEntityIdSchema,
    noteId: Type.String({ minLength: 1 }),
    sourceUrl: Type.String(),
    canonicalUrl: Type.String(),
    type: XhsArchiveContentTypeSchema,
    title: Type.String(),
    description: Type.Optional(Type.String()),
    topics: Type.Array(XhsArchiveTopicSchema),
    translation: Type.Optional(XhsArchiveTranslationSchema),
    author: Type.Optional(XhsArchiveAuthorSchema),
    publishedAt: Type.Optional(Type.String()),
    fetchedAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
    coverMediaId: Type.Optional(XhsEntityIdSchema),
    media: Type.Array(XhsArchiveMediaSchema),
    status: Type.Union([Type.Literal("ready"), Type.Literal("partial")]),
    warnings: Type.Array(Type.String()),
    totalBytes: Type.Integer({ minimum: 0 })
  },
  { additionalProperties: false }
);
export const XhsArchiveListItemSchema = Type.Composite(
  [
    Type.Omit(XhsArchiveItemSchema, ["media"]),
    Type.Object({
      mediaCount: Type.Integer({ minimum: 0 }),
      coverUrl: Type.Optional(Type.String()),
      coverKind: Type.Optional(XhsArchiveMediaKindSchema)
    })
  ],
  { additionalProperties: false }
);
export const XhsArchiveListResponseSchema = Type.Object(
  {
    items: Type.Array(XhsArchiveListItemSchema),
    total: Type.Integer({ minimum: 0 }),
    page: Type.Integer({ minimum: 1 }),
    pageSize: Type.Integer({ minimum: 1, maximum: 50 }),
    pageCount: Type.Integer({ minimum: 1 })
  },
  { additionalProperties: false }
);
export const XhsArchiveTaskStageSchema = Type.Union([
  Type.Literal("installing"),
  Type.Literal("parsing"),
  Type.Literal("downloading"),
  Type.Literal("archiving"),
  Type.Literal("completed"),
  Type.Literal("failed")
]);
export const XhsArchiveTaskSchema = Type.Object(
  {
    id: XhsEntityIdSchema,
    status: XhsJobStatusSchema,
    stage: XhsArchiveTaskStageSchema,
    progress: Type.Number({ minimum: 0, maximum: 100 }),
    message: Type.String(),
    archiveId: Type.Optional(XhsEntityIdSchema),
    error: Type.Optional(Type.String()),
    errorCode: Type.Optional(Type.String()),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" })
  },
  { additionalProperties: false }
);
export const XhsRuntimeStatusSchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal("not-installed"),
      Type.Literal("installing"),
      Type.Literal("ready"),
      Type.Literal("failed")
    ]),
    version: Type.String(),
    providerUrl: Type.Optional(Type.String()),
    message: Type.String(),
    installProgress: Type.Number({ minimum: 0, maximum: 100 }),
    authenticated: Type.Boolean()
  },
  { additionalProperties: false }
);
export const XhsAuthSessionSchema = Type.Object(
  {
    id: XhsEntityIdSchema,
    status: Type.Union([
      Type.Literal("pending"),
      Type.Literal("waiting"),
      Type.Literal("completed"),
      Type.Literal("failed")
    ]),
    message: Type.String(),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
    error: Type.Optional(Type.String())
  },
  { additionalProperties: false }
);
export const XhsArchiveRemovalSchema = Type.Object(
  {
    removed: Type.Literal(true),
    mediaCount: Type.Integer({ minimum: 0 }),
    releasedBytes: Type.Integer({ minimum: 0 })
  },
  { additionalProperties: false }
);
export const XhsTranslationNoopSchema = Type.Object(
  {
    status: Type.Literal("completed"),
    message: Type.String()
  },
  { additionalProperties: false }
);
export const XhsTranslationSubmissionSchema = Type.Union([XhsTranslationTaskSchema, XhsTranslationNoopSchema]);
export const XhsArchiveTranslationResultSchema = Type.Union([XhsArchiveTranslationSchema, Type.Null()]);

export type XhsArchiveContentType = Static<typeof XhsArchiveContentTypeSchema>;
export type XhsArchiveMediaKind = Static<typeof XhsArchiveMediaKindSchema>;
export type XhsArchiveAuthor = Static<typeof XhsArchiveAuthorSchema>;
export type XhsArchiveTopic = Static<typeof XhsArchiveTopicSchema>;
export type XhsTranslationField = Static<typeof XhsTranslationFieldSchema>;
export type XhsArchiveTranslation = Static<typeof XhsArchiveTranslationSchema>;
export type XhsTranslationRuntimeStatus = Static<typeof XhsTranslationRuntimeStatusSchema>;
export type XhsTranslationTaskStage = Static<typeof XhsTranslationTaskStageSchema>;
export type XhsTranslationTask = Static<typeof XhsTranslationTaskSchema>;
export type XhsArchiveMedia = Static<typeof XhsArchiveMediaSchema>;
export type XhsArchiveItem = Static<typeof XhsArchiveItemSchema>;
export type XhsArchiveListItem = Static<typeof XhsArchiveListItemSchema>;
export type XhsArchiveListResponse = Static<typeof XhsArchiveListResponseSchema>;
export type XhsArchiveTaskStage = Static<typeof XhsArchiveTaskStageSchema>;
export type XhsArchiveTask = Static<typeof XhsArchiveTaskSchema>;
export type XhsRuntimeStatus = Static<typeof XhsRuntimeStatusSchema>;
export type XhsAuthSession = Static<typeof XhsAuthSessionSchema>;
export type XhsTranslationSubmission = Static<typeof XhsTranslationSubmissionSchema>;
