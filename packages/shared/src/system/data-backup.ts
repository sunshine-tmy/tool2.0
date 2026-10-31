import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { backupModules, type BackupSelection } from "./data-backup-contract";
export * from "./data-backup-contract";
export const BackupSelectionSchema = Type.Object(
  {
    modules: Type.Array(Type.Union(backupModules.map(({ id }) => Type.Literal(id))), {
      minItems: 1,
      maxItems: 6,
      uniqueItems: true
    }),
    preferences: Type.Optional(Type.Record(Type.String(), Type.String({ maxLength: 500_000 }), { maxProperties: 20 })),
    clientPreferences: Type.Optional(
      Type.Record(Type.String(), Type.String({ maxLength: 500000 }), { maxProperties: 20 })
    )
  },
  { additionalProperties: false }
);
export const BackupPreviewRequestSchema = Type.Object(
  {
    selectionId: Type.String({ pattern: "^[a-f0-9-]{36}$" }),
    modules: BackupSelectionSchema.properties.modules,
    mode: Type.Union([Type.Literal("merge"), Type.Literal("replace")])
  },
  { additionalProperties: false }
);
export const isBackupSelection = (value: unknown): value is BackupSelection =>
  Value.Check(BackupSelectionSchema, value);
export const isBackupPreviewRequest = (value: unknown): value is Static<typeof BackupPreviewRequestSchema> =>
  Value.Check(BackupPreviewRequestSchema, value);
