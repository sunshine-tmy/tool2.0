import { FormatRegistry, Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

if (!FormatRegistry.Has("date-time")) {
  FormatRegistry.Set("date-time", (value) => !Number.isNaN(Date.parse(value)));
}

export const ErrorSchema = Type.Object({
  code: Type.String({ minLength: 1 }),
  message: Type.String(),
  details: Type.Optional(Type.Unknown())
});

export const ApiFailureSchema = Type.Object({
  success: Type.Literal(false),
  message: Type.String(),
  error: ErrorSchema,
  requestId: Type.String()
});

export function apiSuccessSchema<T extends ReturnType<typeof Type.Any>>(data: T) {
  return Type.Object({
    success: Type.Literal(true),
    message: Type.String(),
    data,
    requestId: Type.String()
  });
}

export const TaskStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("running"),
  Type.Literal("completed"),
  Type.Literal("failed")
]);

export const TaskSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  toolId: Type.String({ minLength: 1 }),
  status: TaskStatusSchema,
  progress: Type.Number({ minimum: 0, maximum: 100 }),
  outputPath: Type.Optional(Type.String()),
  error: Type.Optional(Type.String()),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" })
});

export const PaginationQuerySchema = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 }))
});

export type TaskDto = Static<typeof TaskSchema>;

export function isTaskDto(value: unknown): value is TaskDto {
  return Value.Check(TaskSchema, value);
}
