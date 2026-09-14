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

export type XhsArchiveContentType = "image" | "video" | "live-photo" | "unknown";

export type XhsArchiveMediaKind = "image" | "video" | "cover" | "live-photo";

export type XhsArchiveAuthor = {
  id?: string;
  name?: string;
  avatarUrl?: string;
};

export type XhsArchiveTopic = {
  id: string;
  source: string;
};

export type XhsTranslationField = {
  source: string;
  machine: string;
  edited?: string;
  editedAt?: string;
};

export type XhsArchiveTranslation = {
  status: "queued" | "installing" | "translating" | "ready" | "failed" | "stale";
  sourceHash: string;
  sourceLanguage: "zh-CN";
  targetLanguage: "en";
  provider: "opus-mt";
  modelId: "Helsinki-NLP/opus-mt-zh-en";
  modelRevision: string;
  taskId?: string;
  title: XhsTranslationField;
  description?: XhsTranslationField;
  topics: Array<XhsTranslationField & { topicId: string }>;
  translatedAt?: string;
  error?: { code: string; message: string };
};

export type XhsTranslationRuntimeStatus = {
  status: "not-installed" | "installing" | "ready" | "failed";
  version: string;
  modelId: XhsArchiveTranslation["modelId"];
  modelRevision: string;
  providerUrl?: string;
  message: string;
  installProgress: number;
};

export type XhsTranslationTaskStage =
  | "queued"
  | "installing-runtime"
  | "downloading-model"
  | "loading-model"
  | "translating-title"
  | "translating-description"
  | "translating-topics"
  | "saving"
  | "completed"
  | "failed";

export type XhsTranslationTask = {
  id: string;
  itemIds: string[];
  status: "pending" | "running" | "completed" | "failed";
  stage: XhsTranslationTaskStage;
  progress: number;
  completedItems: number;
  totalItems: number;
  currentItemId?: string;
  message: string;
  error?: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
};

export type XhsArchiveMedia = {
  id: string;
  kind: XhsArchiveMediaKind;
  index: number;
  fileName: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  durationMs?: number;
  checksum: string;
  previewUrl: string;
  downloadUrl: string;
};

export type XhsArchiveItem = {
  id: string;
  noteId: string;
  sourceUrl: string;
  canonicalUrl: string;
  type: XhsArchiveContentType;
  title: string;
  description?: string;
  topics: XhsArchiveTopic[];
  translation?: XhsArchiveTranslation;
  author?: XhsArchiveAuthor;
  publishedAt?: string;
  fetchedAt: string;
  updatedAt: string;
  coverMediaId?: string;
  media: XhsArchiveMedia[];
  status: "ready" | "partial";
  warnings: string[];
  totalBytes: number;
};

export type XhsArchiveListItem = Omit<XhsArchiveItem, "media"> & {
  mediaCount: number;
  coverUrl?: string;
  coverKind?: XhsArchiveMediaKind;
};

export type XhsArchiveListResponse = {
  items: XhsArchiveListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type XhsArchiveTaskStage = "installing" | "parsing" | "downloading" | "archiving" | "completed" | "failed";

export type XhsArchiveTask = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  stage: XhsArchiveTaskStage;
  progress: number;
  message: string;
  archiveId?: string;
  error?: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
};

export type XhsRuntimeStatus = {
  status: "not-installed" | "installing" | "ready" | "failed";
  version: string;
  providerUrl?: string;
  message: string;
  installProgress: number;
  authenticated: boolean;
};

export type XhsAuthSession = {
  id: string;
  status: "pending" | "waiting" | "completed" | "failed";
  message: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
};
