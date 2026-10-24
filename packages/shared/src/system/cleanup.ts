/** Shared wire contracts only; no execution or data lifecycle changes. */
import { Type, type Static } from "@sinclair/typebox";

export const CleanupCategorySchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    label: Type.String({ minLength: 1 }),
    risk: Type.Union([Type.Literal("low"), Type.Literal("medium"), Type.Literal("high")]),
    requiresStop: Type.Boolean(),
    defaults: Type.Boolean(),
    files: Type.Integer({ minimum: 0 }),
    bytes: Type.Integer({ minimum: 0 })
  },
  { additionalProperties: false }
);

export const CleanupInspectionSchema = Type.Array(CleanupCategorySchema);

export const CleanupResultSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    label: Type.String({ minLength: 1 }),
    files: Type.Integer({ minimum: 0 }),
    bytes: Type.Integer({ minimum: 0 }),
    skippedFiles: Type.Optional(Type.Integer({ minimum: 1 })),
    skippedBytes: Type.Optional(Type.Integer({ minimum: 0 }))
  },
  { additionalProperties: false }
);

export const CleanupResultsSchema = Type.Array(CleanupResultSchema);

export type CleanupCategory = Static<typeof CleanupCategorySchema>;

export type CleanupInspection = Static<typeof CleanupInspectionSchema>;

export type CleanupResult = Static<typeof CleanupResultSchema>;
