/**
 * 中文模块说明：共享契约层，负责跨前后端复用的类型、Schema、响应和领域常量
 */
import { Type, type Static } from "@sinclair/typebox";
import { TaskSchema } from "./api-schema";

export const ImageCompressResultSchema = Type.Object(
  {
    task: TaskSchema,
    downloadUrl: Type.String({ pattern: "^/api/v1/" }),
    originalName: Type.String(),
    outputName: Type.String(),
    outputFormat: Type.Union([Type.Literal("jpeg"), Type.Literal("png"), Type.Literal("webp")]),
    originalSize: Type.Integer({ minimum: 0 }),
    outputSize: Type.Integer({ minimum: 0 }),
    savedBytes: Type.Integer(),
    compressionRatio: Type.Number({ minimum: 0 }),
    width: Type.Integer({ minimum: 1 }),
    height: Type.Integer({ minimum: 1 })
  },
  { additionalProperties: false }
);

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

export type ImageCompressResult = Static<typeof ImageCompressResultSchema>;
export type CleanupCategory = Static<typeof CleanupCategorySchema>;
export type CleanupInspection = Static<typeof CleanupInspectionSchema>;
export type CleanupResult = Static<typeof CleanupResultSchema>;
