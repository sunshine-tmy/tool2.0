import { Type, type Static } from "@sinclair/typebox";

const LanEntityIdSchema = Type.String({ minLength: 6, maxLength: 64, pattern: "^[A-Za-z0-9_-]+$" });
const PositiveIntegerQuerySchema = Type.Integer({ minimum: 1 });
const NonNegativeIntegerSchema = Type.Integer({ minimum: 0 });
const LanFileCategorySchema = Type.Union([
  Type.Literal("image"),
  Type.Literal("video"),
  Type.Literal("audio"),
  Type.Literal("text"),
  Type.Literal("pdf"),
  Type.Literal("archive"),
  Type.Literal("document"),
  Type.Literal("other")
]);

export const LanAccessInputSchema = Type.Object(
  { pin: Type.String({ minLength: 1, maxLength: 128 }) },
  { additionalProperties: false }
);

export const LanPaginationQuerySchema = Type.Object(
  {
    page: Type.Optional(PositiveIntegerQuerySchema),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 }))
  },
  { additionalProperties: false }
);

export const LanFileListQuerySchema = Type.Object(
  {
    keyword: Type.Optional(Type.String({ maxLength: 200 })),
    category: Type.Optional(LanFileCategorySchema),
    extension: Type.Optional(Type.String({ maxLength: 20, pattern: "^\\.?[A-Za-z0-9]*$" })),
    sortBy: Type.Optional(
      Type.Union([Type.Literal("createdAt"), Type.Literal("size"), Type.Literal("name"), Type.Literal("downloadCount")])
    ),
    sortOrder: Type.Optional(Type.Union([Type.Literal("asc"), Type.Literal("desc")])),
    page: Type.Optional(PositiveIntegerQuerySchema),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 }))
  },
  { additionalProperties: false }
);

export const LanIdParamsSchema = Type.Object({ id: LanEntityIdSchema }, { additionalProperties: false });

export const LanNoteImageParamsSchema = Type.Object(
  { id: LanEntityIdSchema, imageId: LanEntityIdSchema },
  { additionalProperties: false }
);

export const LanUploadParamsSchema = Type.Object({ uploadId: LanEntityIdSchema }, { additionalProperties: false });

export const LanChunkParamsSchema = Type.Object(
  {
    uploadId: LanEntityIdSchema,
    index: Type.String({ pattern: "^(0|[1-9][0-9]*)$", maxLength: 10 })
  },
  { additionalProperties: false }
);

export const LanExpiryInputSchema = Type.Object(
  { days: Type.Integer({ minimum: 1, maximum: 3650 }) },
  { additionalProperties: false }
);

export const LanIdsInputSchema = Type.Object(
  { ids: Type.Array(LanEntityIdSchema, { maxItems: 100, uniqueItems: true }) },
  { additionalProperties: false }
);

export const LanUploadSessionInputSchema = Type.Object(
  {
    originalName: Type.String({ minLength: 1, maxLength: 255, pattern: "^[^\\r\\n]+$" }),
    mimeType: Type.String({ minLength: 1, maxLength: 255 }),
    size: Type.Integer({ minimum: 0 }),
    chunkSize: Type.Integer({ minimum: 1 }),
    totalChunks: Type.Integer({ minimum: 0 })
  },
  { additionalProperties: false }
);

export const LanPaginationSchema = Type.Object(
  {
    page: PositiveIntegerQuerySchema,
    pageSize: PositiveIntegerQuerySchema,
    total: NonNegativeIntegerSchema,
    pageCount: PositiveIntegerQuerySchema
  },
  { additionalProperties: false }
);

export const LanFileRecordSchema = Type.Object(
  {
    id: LanEntityIdSchema,
    originalName: Type.String(),
    storedName: Type.String(),
    mimeType: Type.String(),
    extension: Type.String(),
    size: NonNegativeIntegerSchema,
    category: LanFileCategorySchema,
    createdAt: Type.String({ format: "date-time" }),
    expiresAt: Type.String({ format: "date-time" }),
    downloadCount: NonNegativeIntegerSchema,
    previewable: Type.Boolean()
  },
  { additionalProperties: false }
);

export const LanFileWithUrlsSchema = Type.Composite([
  LanFileRecordSchema,
  Type.Object({ previewUrl: Type.String(), downloadUrl: Type.String() })
]);
export const LanFileUploadResultSchema = Type.Object({
  file: LanFileRecordSchema,
  previewUrl: Type.String(),
  downloadUrl: Type.String()
});
export const LanFileListSchema = Type.Object({
  files: Type.Array(LanFileWithUrlsSchema),
  pagination: LanPaginationSchema
});

export const LanNoteImageSchema = Type.Object({
  id: LanEntityIdSchema,
  originalName: Type.String(),
  storedName: Type.String(),
  mimeType: Type.String(),
  extension: Type.String(),
  size: NonNegativeIntegerSchema,
  previewUrl: Type.String(),
  downloadUrl: Type.String()
});
export const LanNoteSchema = Type.Object({
  id: LanEntityIdSchema,
  title: Type.Optional(Type.String()),
  content: Type.String(),
  images: Type.Array(LanNoteImageSchema),
  createdAt: Type.String({ format: "date-time" }),
  expiresAt: Type.String({ format: "date-time" })
});
export const LanNoteListSchema = Type.Object({ notes: Type.Array(LanNoteSchema), pagination: LanPaginationSchema });

export const LanAccessResultSchema = Type.Object({ authenticated: Type.Boolean() });
export const LanTransferInfoSchema = Type.Object({
  lanUrls: Type.Array(Type.String()),
  retentionDays: PositiveIntegerQuerySchema,
  maxFileBytes: PositiveIntegerQuerySchema,
  maxStorageBytes: PositiveIntegerQuerySchema,
  usedBytes: NonNegativeIntegerSchema,
  noteCount: NonNegativeIntegerSchema,
  reservedUploadBytes: NonNegativeIntegerSchema,
  pinRequired: Type.Boolean(),
  guestMode: Type.Union([
    Type.Literal("full"),
    Type.Literal("upload-only"),
    Type.Literal("download-only"),
    Type.Literal("disabled")
  ]),
  authenticated: Type.Boolean()
});
export const LanBatchRemovalSchema = Type.Object({
  removed: Type.Array(LanEntityIdSchema),
  missing: Type.Array(LanEntityIdSchema)
});
export const LanRemovalSchema = Type.Object({ removed: Type.Boolean() });
export const LanCleanupResultSchema = Type.Object({
  removed: NonNegativeIntegerSchema,
  filesRemoved: NonNegativeIntegerSchema,
  notesRemoved: NonNegativeIntegerSchema
});
export const LanUploadStatusSchema = Type.Object({
  uploadId: LanEntityIdSchema,
  originalName: Type.String(),
  mimeType: Type.String(),
  size: NonNegativeIntegerSchema,
  chunkSize: PositiveIntegerQuerySchema,
  totalChunks: NonNegativeIntegerSchema,
  uploadedChunks: Type.Array(NonNegativeIntegerSchema),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
  uploadedBytes: NonNegativeIntegerSchema
});

export type LanAccessInput = Static<typeof LanAccessInputSchema>;
export type LanPaginationQuery = Static<typeof LanPaginationQuerySchema>;
export type LanFileListQuery = Static<typeof LanFileListQuerySchema>;
export type LanIdParams = Static<typeof LanIdParamsSchema>;
export type LanNoteImageParams = Static<typeof LanNoteImageParamsSchema>;
export type LanUploadParams = Static<typeof LanUploadParamsSchema>;
export type LanChunkParams = Static<typeof LanChunkParamsSchema>;
export type LanExpiryInput = Static<typeof LanExpiryInputSchema>;
export type LanIdsInput = Static<typeof LanIdsInputSchema>;
export type LanUploadSessionInput = Static<typeof LanUploadSessionInputSchema>;
export type LanPagination = Static<typeof LanPaginationSchema>;
export type LanFileRecordDto = Static<typeof LanFileRecordSchema>;
export type LanFileWithUrls = Static<typeof LanFileWithUrlsSchema>;
export type LanFileUploadResult = Static<typeof LanFileUploadResultSchema>;
export type LanFileList = Static<typeof LanFileListSchema>;
export type LanNoteImage = Static<typeof LanNoteImageSchema>;
export type LanNote = Static<typeof LanNoteSchema>;
export type LanNoteList = Static<typeof LanNoteListSchema>;
export type LanAccessResult = Static<typeof LanAccessResultSchema>;
export type LanTransferInfo = Static<typeof LanTransferInfoSchema>;
export type LanBatchRemoval = Static<typeof LanBatchRemovalSchema>;
export type LanRemoval = Static<typeof LanRemovalSchema>;
export type LanCleanupResult = Static<typeof LanCleanupResultSchema>;
export type LanUploadStatus = Static<typeof LanUploadStatusSchema>;
