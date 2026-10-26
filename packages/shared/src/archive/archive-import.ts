/** Spreadsheet imports coordinate existing archive tasks; stored archives retain their original lifecycle. */
import { Type, type Static } from "@sinclair/typebox";
import { ArchivePlatformSchema } from "./content-archive";
import { ArchiveGroupIdSchema } from "./archive-groups";

export const ARCHIVE_IMPORT_MAX_ROWS = 100;
export const ARCHIVE_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const id = Type.String({ pattern: "^[A-Za-z0-9_-]{6,128}$" });
export const ArchiveImportInputRowSchema = Type.Object(
  {
    rowNumber: Type.Integer({ minimum: 1, maximum: 1_048_576 }),
    inputUrl: Type.String({ maxLength: 10_000 }),
    inputPlatform: Type.String({ maxLength: 10_000 })
  },
  { additionalProperties: false }
);
export const ArchiveImportRowSchema = Type.Composite(
  [
    ArchiveImportInputRowSchema,
    Type.Object({
      status: Type.Union(
        (
          [
            "ready",
            "invalid",
            "duplicate",
            "existing",
            "waiting",
            "running",
            "completed",
            "failed",
            "skipped",
            "cancelled"
          ] as const
        ).map((v) => Type.Literal(v))
      ),
      platform: Type.Optional(ArchivePlatformSchema),
      url: Type.Optional(Type.String({ maxLength: 10_000 })),
      archiveId: Type.Optional(id),
      taskId: Type.Optional(id),
      progress: Type.Number({ minimum: 0, maximum: 100 }),
      message: Type.String({ maxLength: 2000 }),
      errorCode: Type.Optional(Type.String({ maxLength: 100 }))
    })
  ],
  { additionalProperties: false }
);
export const ArchiveImportPreviewSchema = Type.Object(
  {
    sourceName: Type.String({ minLength: 1, maxLength: 180 }),
    sheetName: Type.Optional(Type.String({ maxLength: 128 })),
    rows: Type.Array(ArchiveImportRowSchema, { minItems: 1, maxItems: ARCHIVE_IMPORT_MAX_ROWS })
  },
  { additionalProperties: false }
);
export const ArchiveImportCreateSchema = Type.Object(
  {
    sourceName: Type.String({ minLength: 1, maxLength: 180 }),
    sheetName: Type.Optional(Type.String({ maxLength: 128 })),
    existing: Type.Union([Type.Literal("skip"), Type.Literal("refresh")]),
    groupId: Type.Optional(ArchiveGroupIdSchema),
    rows: Type.Array(ArchiveImportInputRowSchema, { minItems: 1, maxItems: ARCHIVE_IMPORT_MAX_ROWS })
  },
  { additionalProperties: false }
);
export const ArchiveImportBatchSchema = Type.Composite(
  [
    ArchiveImportPreviewSchema,
    Type.Object({
      id,
      existing: ArchiveImportCreateSchema.properties.existing,
      groupId: Type.Optional(ArchiveGroupIdSchema),
      status: Type.Union([
        Type.Literal("running"),
        Type.Literal("stopping"),
        Type.Literal("completed"),
        Type.Literal("cancelled"),
        Type.Literal("interrupted")
      ]),
      createdAt: Type.String({ format: "date-time" }),
      updatedAt: Type.String({ format: "date-time" })
    })
  ],
  { additionalProperties: false }
);
export const ArchiveImportSummarySchema = Type.Omit(ArchiveImportBatchSchema, ["rows"]);
export const ArchiveImportListSchema = Type.Array(ArchiveImportSummarySchema, { maxItems: 100 });
export type ArchiveImportInputRow = Static<typeof ArchiveImportInputRowSchema>;
export type ArchiveImportRow = Static<typeof ArchiveImportRowSchema>;
export type ArchiveImportPreview = Static<typeof ArchiveImportPreviewSchema>;
export type ArchiveImportCreate = Static<typeof ArchiveImportCreateSchema>;
export type ArchiveImportBatch = Static<typeof ArchiveImportBatchSchema>;
export type ArchiveImportSummary = Static<typeof ArchiveImportSummarySchema>;
export const ARCHIVE_IMPORT_ROW_LABELS: Record<ArchiveImportRow["status"], string> = {
  ready: "可以归档",
  invalid: "无效",
  duplicate: "表内重复",
  existing: "已归档",
  waiting: "等待",
  running: "处理中",
  completed: "成功",
  failed: "失败",
  skipped: "已跳过",
  cancelled: "已取消"
};
