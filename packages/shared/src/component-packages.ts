/** 中文模块说明：能力目录、生命周期健康度与后台安装作业的跨端契约。 */
import { Type, type Static } from "@sinclair/typebox";

const COMPONENT_TIMESTAMP_PATTERN = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})$";

export const ComponentIdParamsSchema = Type.Object(
  {
    componentId: Type.String({ minLength: 1, maxLength: 80, pattern: "^[a-z0-9][a-z0-9-]*$" })
  },
  { additionalProperties: false }
);

export const ComponentGroupSchema = Type.Union([
  Type.Literal("shared"),
  Type.Literal("media"),
  Type.Literal("audio"),
  Type.Literal("image"),
  Type.Literal("archive"),
  Type.Literal("translation")
]);

export const ComponentLifecycleSchema = Type.Union([
  Type.Literal("not-installed"),
  Type.Literal("downloading"),
  Type.Literal("installing"),
  Type.Literal("ready"),
  Type.Literal("failed"),
  Type.Literal("blocked")
]);

export const ComponentHealthSchema = Type.Union([
  Type.Literal("unknown"),
  Type.Literal("healthy"),
  Type.Literal("unhealthy")
]);

export const ComponentPackageStatusSchema = Type.Object(
  {
    id: Type.String({ minLength: 1, maxLength: 80 }),
    moduleId: Type.String({ minLength: 1, maxLength: 80 }),
    displayName: Type.String({ minLength: 1, maxLength: 120 }),
    groupId: ComponentGroupSchema,
    purpose: Type.String({ minLength: 1, maxLength: 500 }),
    taskToolIds: Type.Array(Type.String({ minLength: 1, maxLength: 80 })),
    dependencyIds: Type.Array(Type.String({ minLength: 1, maxLength: 80 })),
    dependentIds: Type.Array(Type.String({ minLength: 1, maxLength: 80 })),
    installConditions: Type.Array(Type.String({ minLength: 1, maxLength: 300 })),
    version: Type.String({ minLength: 1, maxLength: 80 }),
    platform: Type.Literal("win32-x64"),
    downloadBytes: Type.Integer({ minimum: 1 }),
    installedBytes: Type.Integer({ minimum: 0 }),
    installed: Type.Boolean(),
    state: ComponentLifecycleSchema,
    health: ComponentHealthSchema,
    activeJobId: Type.Optional(
      Type.String({
        minLength: 36,
        maxLength: 36,
        pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
      })
    ),
    installedVersion: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
    previousVersion: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
    installedAt: Type.Optional(Type.String({ pattern: COMPONENT_TIMESTAMP_PATTERN })),
    licenseName: Type.String({ minLength: 1, maxLength: 160 }),
    licenseUrl: Type.String({ pattern: "^https://[^\\s]+$" }),
    failureReason: Type.Optional(Type.String({ maxLength: 240 })),
    blockedReason: Type.Optional(Type.String({ maxLength: 300 }))
  },
  { additionalProperties: false }
);

export const ComponentPackageListSchema = Type.Array(ComponentPackageStatusSchema);

export const ComponentJobOperationSchema = Type.Union([
  Type.Literal("install"),
  Type.Literal("reinstall"),
  Type.Literal("uninstall")
]);

export const ComponentJobStateSchema = Type.Union([
  Type.Literal("queued"),
  Type.Literal("running"),
  Type.Literal("completed"),
  Type.Literal("failed"),
  Type.Literal("cancelled")
]);

export const ComponentJobPhaseSchema = Type.Union([
  Type.Literal("queued"),
  Type.Literal("downloading"),
  Type.Literal("verifying"),
  Type.Literal("extracting"),
  Type.Literal("building-python"),
  Type.Literal("self-test"),
  Type.Literal("switching"),
  Type.Literal("uninstalling"),
  Type.Literal("complete")
]);

export const ComponentJobProgressSchema = Type.Object(
  {
    downloadedBytes: Type.Integer({ minimum: 0 }),
    totalDownloadBytes: Type.Integer({ minimum: 0 }),
    processedFiles: Type.Integer({ minimum: 0 }),
    totalFiles: Type.Integer({ minimum: 0 }),
    percentage: Type.Integer({ minimum: 0, maximum: 100 })
  },
  { additionalProperties: false }
);

export const ComponentJobSchema = Type.Object(
  {
    id: Type.String({ minLength: 36, maxLength: 36 }),
    componentId: Type.String({ minLength: 1, maxLength: 80 }),
    operation: ComponentJobOperationSchema,
    state: ComponentJobStateSchema,
    phase: ComponentJobPhaseSchema,
    progress: ComponentJobProgressSchema,
    createdAt: Type.String({ pattern: COMPONENT_TIMESTAMP_PATTERN }),
    updatedAt: Type.String({ pattern: COMPONENT_TIMESTAMP_PATTERN }),
    errorCode: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
    errorMessage: Type.Optional(Type.String({ maxLength: 240 }))
  },
  { additionalProperties: false }
);

export const ComponentJobIdParamsSchema = Type.Object(
  {
    jobId: Type.String({
      minLength: 36,
      maxLength: 36,
      pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    })
  },
  { additionalProperties: false }
);

export type ComponentIdParams = Static<typeof ComponentIdParamsSchema>;
export type ComponentGroup = Static<typeof ComponentGroupSchema>;
export type ComponentLifecycle = Static<typeof ComponentLifecycleSchema>;
export type ComponentHealth = Static<typeof ComponentHealthSchema>;
export type ComponentPackageStatus = Static<typeof ComponentPackageStatusSchema>;
export type ComponentJobOperation = Static<typeof ComponentJobOperationSchema>;
export type ComponentJobState = Static<typeof ComponentJobStateSchema>;
export type ComponentJobPhase = Static<typeof ComponentJobPhaseSchema>;
export type ComponentJobProgress = Static<typeof ComponentJobProgressSchema>;
export type ComponentJob = Static<typeof ComponentJobSchema>;
export type ComponentJobIdParams = Static<typeof ComponentJobIdParamsSchema>;
