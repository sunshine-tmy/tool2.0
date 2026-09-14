import { Type, type Static } from "@sinclair/typebox";

const LanEntityIdSchema = Type.String({ minLength: 6, maxLength: 64, pattern: "^[A-Za-z0-9_-]+$" });
const PositiveIntegerQuerySchema = Type.Integer({ minimum: 1 });

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
    category: Type.Optional(
      Type.Union([
        Type.Literal("image"),
        Type.Literal("video"),
        Type.Literal("audio"),
        Type.Literal("text"),
        Type.Literal("pdf"),
        Type.Literal("archive"),
        Type.Literal("document"),
        Type.Literal("other")
      ])
    ),
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
