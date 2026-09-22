/**
 * 中文模块说明：能力包管理的公共 API 契约；不向 renderer 暴露归档地址、命令或签名材料。
 */
import { Type, type Static } from "@sinclair/typebox";

export const ComponentIdParamsSchema = Type.Object(
  {
    componentId: Type.String({ minLength: 1, maxLength: 80, pattern: "^[a-z0-9][a-z0-9-]*$" })
  },
  { additionalProperties: false }
);

export const ComponentPackageStatusSchema = Type.Object(
  {
    id: Type.String({ minLength: 1, maxLength: 80 }),
    displayName: Type.String({ minLength: 1, maxLength: 120 }),
    version: Type.String({ minLength: 1, maxLength: 80 }),
    platform: Type.Literal("win32-x64"),
    installed: Type.Boolean(),
    installedVersion: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
    previousVersion: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
    installedAt: Type.Optional(Type.String({ format: "date-time" })),
    licenseName: Type.String({ minLength: 1, maxLength: 160 })
  },
  { additionalProperties: false }
);

export const ComponentPackageListSchema = Type.Array(ComponentPackageStatusSchema);

export type ComponentIdParams = Static<typeof ComponentIdParamsSchema>;
export type ComponentPackageStatus = Static<typeof ComponentPackageStatusSchema>;
