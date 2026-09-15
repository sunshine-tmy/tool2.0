import { FormatRegistry, Type, type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { ApiFailure, ApiSuccess } from "./api-response";

if (!FormatRegistry.Has("date-time")) {
  FormatRegistry.Set("date-time", (value) => !Number.isNaN(Date.parse(value)));
}

export const ErrorSchema = Type.Object({
  code: Type.String({ minLength: 1 }),
  message: Type.String(),
  details: Type.Optional(Type.Unknown())
});

const ApiFailureObjectSchema = Type.Object({
  success: Type.Literal(false),
  message: Type.String(),
  error: ErrorSchema,
  requestId: Type.String()
});
export const ApiFailureSchema = Type.Unsafe<ApiFailure>(ApiFailureObjectSchema);

export function apiSuccessSchema<T extends TSchema>(data: T) {
  return Type.Unsafe<ApiSuccess<Static<T>>>(
    Type.Object({
      success: Type.Literal(true),
      message: Type.Optional(Type.String()),
      data,
      requestId: Type.String()
    })
  );
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

export const TaskListSchema = Type.Array(TaskSchema);

export const TaskIdParamsSchema = Type.Object(
  {
    taskId: Type.String({ minLength: 1, maxLength: 128, pattern: "^[A-Za-z0-9_-]+$" })
  },
  { additionalProperties: false }
);

export const FileNameParamsSchema = Type.Object(
  {
    fileName: Type.String({ minLength: 1, maxLength: 255, pattern: "^[^\\\\/\\r\\n]+$" })
  },
  { additionalProperties: false }
);

export const AdminLoginInputSchema = Type.Object(
  { pin: Type.String({ minLength: 4, maxLength: 128 }) },
  { additionalProperties: false }
);

export const AdminSessionSchema = Type.Object(
  {
    csrfToken: Type.String({ minLength: 32, maxLength: 128 }),
    expiresInSeconds: Type.Integer({ minimum: 1 })
  },
  { additionalProperties: false }
);

export const EmptyResultSchema = Type.Null();

export const LiveHealthSchema = Type.Object({ status: Type.Literal("ok") });

export const ReadyHealthSchema = Type.Object({
  status: Type.Literal("ready"),
  database: Type.Literal("ok"),
  storage: Type.Literal("ok")
});

export const ApiHealthSchema = Type.Object({
  status: Type.Literal("ok"),
  name: Type.Literal("toolbox-api"),
  deploymentMode: Type.Union([Type.Literal("local"), Type.Literal("lan")]),
  videoText: Type.Object({
    audioExtractorConfigured: Type.Boolean(),
    transcriberConfigured: Type.Boolean()
  }),
  shortVideo: Type.Object({ providerConfigured: Type.Boolean() }),
  xhsArchive: Type.Object({
    providerConfigured: Type.Boolean(),
    translationProviderConfigured: Type.Boolean()
  }),
  imageAi: Type.Object({
    deploymentUsage: Type.Union([Type.Literal("internal-noncommercial"), Type.Literal("commercial")])
  }),
  edgeTts: Type.Object({ retentionDays: Type.Integer({ minimum: 1 }) }),
  chatterbox: Type.Object({ retentionDays: Type.Integer({ minimum: 1 }) })
});

const ToolCategorySchema = Type.Union([
  Type.Literal("file"),
  Type.Literal("image"),
  Type.Literal("video"),
  Type.Literal("audio"),
  Type.Literal("text"),
  Type.Literal("table")
]);

export const ToolDefinitionSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  description: Type.String(),
  category: ToolCategorySchema,
  status: Type.Union([Type.Literal("ready"), Type.Literal("planned")]),
  requiresAuth: Type.Literal(false),
  acceptedTypes: Type.Array(Type.String()),
  routePath: Type.String({ pattern: "^/" }),
  apiNamespace: Type.String({ pattern: "^/api/v1/" })
});

export const ToolListSchema = Type.Array(ToolDefinitionSchema);

export const PaginationQuerySchema = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 }))
});

export type TaskDto = Static<typeof TaskSchema>;
export type TaskIdParams = Static<typeof TaskIdParamsSchema>;
export type FileNameParams = Static<typeof FileNameParamsSchema>;
export type AdminLoginInput = Static<typeof AdminLoginInputSchema>;
export type AdminSession = Static<typeof AdminSessionSchema>;

export function isTaskDto(value: unknown): value is TaskDto {
  return Value.Check(TaskSchema, value);
}
