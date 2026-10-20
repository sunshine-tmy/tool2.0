/** 直播音频库契约：永久素材与客户端播放状态分离，文件路径仅保存安全相对路径。 */
import { Type, type Static } from "@sinclair/typebox";

export const AUDIO_LIBRARY_MAX_FILE_BYTES = 100 * 1024 * 1024;
export const AUDIO_LIBRARY_DEFAULT_STORAGE_BYTES = 10 * 1024 ** 3;
const options = { additionalProperties: false } as const;
const Id = Type.String({ pattern: "^[A-Za-z0-9_-]{1,80}$" });
const Text = Type.String({ maxLength: 20000 });
export const AudioLibraryPresetInputSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 80 }),
    itemIds: Type.Array(Id, { minItems: 1, maxItems: 200 }),
    mode: Type.Union([Type.Literal("sequence"), Type.Literal("list"), Type.Literal("single")]),
    gap: Type.Number({ minimum: 0, maximum: 300 }),
    revision: Type.Optional(Type.Integer({ minimum: 1 }))
  },
  options
);
export const AudioLibraryPresetSchema = Type.Composite([
  Type.Omit(AudioLibraryPresetInputSchema, ["revision"]),
  Type.Object({ id: Id, revision: Type.Integer({ minimum: 1 }), createdAt: Type.String(), updatedAt: Type.String() })
]);
export const AudioLibraryGroupSchema = Type.Object(
  {
    id: Id,
    name: Type.String({ minLength: 1, maxLength: 60 }),
    parentId: Type.Union([Id, Type.Null()])
  },
  options
);
export const AudioLibrarySourceSchema = Type.Object(
  {
    kind: Type.Union([
      Type.Literal("chatterbox"),
      Type.Literal("edge-tts"),
      Type.Literal("upload"),
      Type.Literal("clip")
    ]),
    originalItemId: Type.Optional(Id),
    originalRevision: Type.Optional(Type.Integer({ minimum: 1 })),
    startSeconds: Type.Optional(Type.Number({ minimum: 0 })),
    endSeconds: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
    batchId: Type.Optional(Id),
    itemId: Type.Optional(Id),
    attempt: Type.Optional(Type.Integer({ minimum: 1 })),
    originalName: Type.Optional(Type.String({ maxLength: 255 })),
    originalText: Type.Optional(Text),
    originalTranslation: Type.Optional(Text)
  },
  options
);
export const AudioLibraryItemSchema = Type.Object(
  {
    id: Id,
    revision: Type.Integer({ minimum: 1 }),
    title: Type.String({ minLength: 1, maxLength: 120 }),
    language: Type.String({ minLength: 1, maxLength: 50 }),
    foreignText: Text,
    chineseText: Text,
    note: Type.String({ maxLength: 2000 }),
    groupId: Type.Union([Id, Type.Null()]),
    fileName: Type.String({ pattern: "^audio\\.(mp3|wav|m4a|flac)$" }),
    mimeType: Type.String(),
    bytes: Type.Integer({ minimum: 1 }),
    duration: Type.Number({ exclusiveMinimum: 0 }),
    sha256: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    source: AudioLibrarySourceSchema,
    createdAt: Type.String(),
    updatedAt: Type.String(),
    deletedAt: Type.Optional(Type.String())
  },
  options
);
export const AudioLibraryItemViewSchema = Type.Composite([
  AudioLibraryItemSchema,
  Type.Object({
    audioUrl: Type.String(),
    available: Type.Boolean()
  })
]);
export const AudioLibraryCatalogSchema = Type.Object(
  {
    version: Type.Literal(1),
    libraryId: Id,
    revision: Type.Integer({ minimum: 0 }),
    groups: Type.Array(AudioLibraryGroupSchema),
    // 兼容首版没有预设队列的永久清单和备份。
    presets: Type.Optional(Type.Array(AudioLibraryPresetSchema, { maxItems: 200 })),
    items: Type.Array(AudioLibraryItemSchema),
    pendingDeletes: Type.Array(Type.Object({ id: Id, bytes: Type.Integer({ minimum: 0 }) }, options))
  },
  options
);
export const AudioLibraryListSchema = Type.Object(
  {
    libraryId: Id,
    revision: Type.Integer(),
    groups: Type.Array(AudioLibraryGroupSchema),
    items: Type.Array(AudioLibraryItemViewSchema),
    total: Type.Integer(),
    page: Type.Integer(),
    pageSize: Type.Integer(),
    usedBytes: Type.Integer(),
    reservedBytes: Type.Integer(),
    maxBytes: Type.Integer(),
    totalItems: Type.Integer()
  },
  options
);
export const AudioLibraryEditSchema = Type.Partial(
  Type.Pick(AudioLibraryItemSchema, ["title", "language", "foreignText", "chineseText", "note", "groupId", "revision"])
);
export const AudioLibraryImportSchema = Type.Object(
  {
    batchId: Id,
    itemIds: Type.Array(Id, { minItems: 1, maxItems: 100, uniqueItems: true }),
    attempts: Type.Optional(Type.Record(Type.String(), Type.Integer({ minimum: 1 }))),
    groupId: Type.Optional(Type.Union([Id, Type.Null()]))
  },
  options
);
export const AudioLibraryImportResultSchema = Type.Object(
  {
    results: Type.Array(
      Type.Object(
        {
          sourceId: Type.String(),
          status: Type.Union([
            Type.Literal("added"),
            Type.Literal("existing"),
            Type.Literal("skipped"),
            Type.Literal("failed")
          ]),
          item: Type.Optional(AudioLibraryItemViewSchema),
          message: Type.Optional(Type.String())
        },
        options
      )
    )
  },
  options
);
export const AudioLibraryMutationSchema = Type.Object(
  {
    ok: Type.Literal(true),
    undoToken: Type.Optional(Type.String())
  },
  options
);
export type AudioLibraryItem = Static<typeof AudioLibraryItemSchema>;
export type AudioLibraryItemView = Static<typeof AudioLibraryItemViewSchema>;
export type AudioLibraryGroup = Static<typeof AudioLibraryGroupSchema>;
export type AudioLibraryCatalog = Static<typeof AudioLibraryCatalogSchema>;
export type AudioLibraryList = Static<typeof AudioLibraryListSchema>;
export type AudioLibraryEdit = Static<typeof AudioLibraryEditSchema>;
export type AudioLibrarySource = Static<typeof AudioLibrarySourceSchema>;
export type AudioLibraryImport = Static<typeof AudioLibraryImportSchema>;
export type AudioLibraryImportResult = Static<typeof AudioLibraryImportResultSchema>;
export type AudioLibraryPreset = Static<typeof AudioLibraryPresetSchema>;
export type AudioLibraryPresetInput = Static<typeof AudioLibraryPresetInputSchema>;
export const AudioLibraryPresetLoadSchema = Type.Object(
  {
    preset: AudioLibraryPresetSchema,
    items: Type.Array(AudioLibraryItemViewSchema),
    unavailableCount: Type.Integer({ minimum: 0 })
  },
  options
);
