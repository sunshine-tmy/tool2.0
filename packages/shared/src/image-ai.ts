/**
 * 中文模块说明：共享契约层，负责跨前后端复用的类型、Schema、响应和领域常量
 */
import { Type, type Static } from "@sinclair/typebox";
import { ImageWorkerHealthSchema, ImageWorkerSuggestionSchema } from "./worker-protocol";
import { ProductImageRecipeSchema } from "./product-image";

export const imageAiOperations = ["watermark_remove", "enhance", "background_remove", "product_image"] as const;

export const ImageAiOperationSchema = Type.Union([
  Type.Literal("watermark_remove"),
  Type.Literal("enhance"),
  Type.Literal("background_remove"),
  Type.Literal("product_image")
]);

export const ImageAiTaskStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("running"),
  Type.Literal("completed"),
  Type.Literal("failed"),
  Type.Literal("canceled")
]);

export const ImageAiProviderSchema = Type.Union([
  Type.Literal("lama"),
  Type.Literal("real-esrgan"),
  Type.Literal("bria-rmbg-2.0"),
  Type.Literal("birefnet-general"),
  Type.Literal("sharp")
]);

export const ImageAiResultSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    originalName: Type.String({ minLength: 1 }),
    outputName: Type.String({ minLength: 1 }),
    downloadUrl: Type.String({ minLength: 1 }),
    width: Type.Integer({ minimum: 1 }),
    height: Type.Integer({ minimum: 1 }),
    provider: ImageAiProviderSchema,
    model: Type.String({ minLength: 1 }),
    warnings: Type.Array(Type.String())
  },
  { additionalProperties: false }
);

export const ImageAiTaskSchema = Type.Object(
  {
    id: Type.String({ minLength: 6, maxLength: 64, pattern: "^[A-Za-z0-9_-]+$" }),
    operation: ImageAiOperationSchema,
    status: ImageAiTaskStatusSchema,
    progress: Type.Number({ minimum: 0, maximum: 100 }),
    queuePosition: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    scale: Type.Optional(Type.Union([Type.Literal(2), Type.Literal(4)])),
    recipe: Type.Optional(ProductImageRecipeSchema),
    phase: Type.Optional(Type.String()),
    source: Type.Optional(
      Type.Object({ taskId: Type.String(), resultId: Type.String() }, { additionalProperties: false })
    ),
    results: Type.Array(ImageAiResultSchema),
    inputs: Type.Optional(
      Type.Array(
        Type.Object(
          {
            originalName: Type.String(),
            mimetype: Type.String(),
            size: Type.Integer({ minimum: 0 }),
            width: Type.Integer({ minimum: 1 }),
            height: Type.Integer({ minimum: 1 })
          },
          { additionalProperties: false }
        )
      )
    ),
    warnings: Type.Array(Type.String()),
    error: Type.Optional(Type.String()),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
    // null means successful/partial results are retained until explicitly deleted.
    expiresAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()])
  },
  { additionalProperties: false }
);

export const ImageAiHistoryQuerySchema = Type.Object(
  {
    page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
    operation: Type.Optional(ImageAiOperationSchema),
    status: Type.Optional(ImageAiTaskStatusSchema),
    keyword: Type.Optional(Type.String({ maxLength: 100 }))
  },
  { additionalProperties: false }
);

export const ImageAiHistorySchema = Type.Object(
  {
    items: Type.Array(ImageAiTaskSchema),
    total: Type.Integer({ minimum: 0 }),
    page: Type.Integer({ minimum: 1 }),
    pageSize: Type.Integer({ minimum: 1, maximum: 50 })
  },
  { additionalProperties: false }
);

export const ImageAiHistoryDeleteSchema = Type.Object(
  {
    id: Type.String(),
    deleted: Type.Literal(true)
  },
  { additionalProperties: false }
);

export const ImageAiInputParamsSchema = Type.Object(
  {
    taskId: Type.String({ minLength: 6, maxLength: 64, pattern: "^[A-Za-z0-9_-]+$" }),
    inputIndex: Type.Integer({ minimum: 1, maximum: 10 })
  },
  { additionalProperties: false }
);

export const ImageAiResultParamsSchema = Type.Object(
  {
    taskId: Type.String({ minLength: 6, maxLength: 64, pattern: "^[A-Za-z0-9_-]+$" }),
    resultId: Type.String({ minLength: 1, maxLength: 128, pattern: "^[A-Za-z0-9_-]+$" })
  },
  { additionalProperties: false }
);

export const ImageAiFileQuerySchema = Type.Object(
  {
    download: Type.Optional(Type.Union([Type.Literal("0"), Type.Literal("1")])),
    format: Type.Optional(Type.Union([Type.Literal("png"), Type.Literal("jpeg"), Type.Literal("webp")])),
    flatten: Type.Optional(Type.Literal("white"))
  },
  { additionalProperties: false }
);

export const ImageAiHealthSchema = ImageWorkerHealthSchema;
export const WatermarkSuggestionResponseSchema = ImageWorkerSuggestionSchema;

export type ImageAiOperation = Static<typeof ImageAiOperationSchema>;
export type ImageAiTaskStatus = Static<typeof ImageAiTaskStatusSchema>;
export type ImageAiProvider = Static<typeof ImageAiProviderSchema>;
export type ImageAiResult = Static<typeof ImageAiResultSchema>;
export type ImageAiTask = Static<typeof ImageAiTaskSchema>;
export type ImageAiHistoryQuery = Static<typeof ImageAiHistoryQuerySchema>;
export type ImageAiHistory = Static<typeof ImageAiHistorySchema>;
export type ImageAiInputParams = Static<typeof ImageAiInputParamsSchema>;
export type ImageAiResultParams = Static<typeof ImageAiResultParamsSchema>;
export type ImageAiFileQuery = Static<typeof ImageAiFileQuerySchema>;
export type WatermarkSuggestion = Static<typeof ImageWorkerSuggestionSchema>["suggestions"][number];
export type WatermarkSuggestionResponse = Static<typeof WatermarkSuggestionResponseSchema>;
export type ImageAiModelHealth = Static<typeof ImageWorkerHealthSchema>["models"][number];
export type ImageAiHealth = Static<typeof ImageAiHealthSchema>;

export function isImageAiOperation(value: unknown): value is ImageAiOperation {
  return typeof value === "string" && imageAiOperations.includes(value as ImageAiOperation);
}
