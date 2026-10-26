/** User-owned archive organization; membership never changes stored media or archive manifests. */
import { Type, type Static } from "@sinclair/typebox";

export const ArchiveGroupIdSchema = Type.String({ pattern: "^[A-Za-z0-9_-]{6,128}$" });
export const ArchiveGroupInputSchema = Type.Object(
  { name: Type.String({ minLength: 1, maxLength: 80, pattern: "^[^\\x00-\\x1f\\x7f]+$" }) },
  { additionalProperties: false }
);
export const ArchiveGroupSchema = Type.Object(
  {
    id: ArchiveGroupIdSchema,
    name: ArchiveGroupInputSchema.properties.name,
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" })
  },
  { additionalProperties: false }
);
export const ArchiveGroupListSchema = Type.Array(ArchiveGroupSchema, { maxItems: 200 });
export const ArchiveGroupAssignmentSchema = Type.Object(
  {
    groupId: Type.Union([ArchiveGroupIdSchema, Type.Null()]),
    itemIds: Type.Array(ArchiveGroupIdSchema, { minItems: 1, maxItems: 100, uniqueItems: true })
  },
  { additionalProperties: false }
);
export const ArchiveGroupAssignmentResultSchema = Type.Object(
  { updated: Type.Integer({ minimum: 0, maximum: 100 }) },
  { additionalProperties: false }
);
export type ArchiveGroup = Static<typeof ArchiveGroupSchema>;
export type ArchiveGroupAssignment = Static<typeof ArchiveGroupAssignmentSchema>;
