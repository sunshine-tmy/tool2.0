/**
 * 中文模块说明：共享契约层，负责跨前后端复用的类型、Schema、响应和领域常量
 */
import { Type, type Static } from "@sinclair/typebox";
import { ImageWorkerHealthSchema, ImageWorkerSuggestionSchema } from "./worker-protocol";

export const imageAiOperations = ["watermark_remove", "enhance", "background_remove"] as const;

export const ImageAiOperationSchema = Type.Union([
  Type.Literal("watermark_remove"),
  Type.Literal("enhance"),
  Type.Literal("background_remove")
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
  Type.Literal("birefnet-general")
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
    results: Type.Array(ImageAiResultSchema),
    warnings: Type.Array(Type.String()),
    error: Type.Optional(Type.String()),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
    expiresAt: Type.String({ format: "date-time" })
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
  { download: Type.Optional(Type.Union([Type.Literal("0"), Type.Literal("1")])) },
  { additionalProperties: false }
);

export const ImageAiHealthSchema = ImageWorkerHealthSchema;
export const WatermarkSuggestionResponseSchema = ImageWorkerSuggestionSchema;

export type ImageAiOperation = Static<typeof ImageAiOperationSchema>;
export type ImageAiTaskStatus = Static<typeof ImageAiTaskStatusSchema>;
export type ImageAiProvider = Static<typeof ImageAiProviderSchema>;
export type ImageAiResult = Static<typeof ImageAiResultSchema>;
export type ImageAiTask = Static<typeof ImageAiTaskSchema>;
export type ImageAiResultParams = Static<typeof ImageAiResultParamsSchema>;
export type ImageAiFileQuery = Static<typeof ImageAiFileQuerySchema>;
export type WatermarkSuggestion = Static<typeof ImageWorkerSuggestionSchema>["suggestions"][number];
export type WatermarkSuggestionResponse = Static<typeof WatermarkSuggestionResponseSchema>;
export type ImageAiModelHealth = Static<typeof ImageWorkerHealthSchema>["models"][number];
export type ImageAiHealth = Static<typeof ImageAiHealthSchema>;

export function isImageAiOperation(value: unknown): value is ImageAiOperation {
  return typeof value === "string" && imageAiOperations.includes(value as ImageAiOperation);
}
