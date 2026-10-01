/** 抖音匿名归档运行时契约：能力包只登记固定适配器，执行代码随应用发布，浏览器资产共享而会话隔离。 */
import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

export const DouyinAdapterManifestSchema = Type.Object(
  {
    protocolVersion: Type.Literal(1),
    platform: Type.Literal("douyin"),
    mode: Type.Literal("anonymous"),
    parser: Type.Literal("normal-browser"),
    browserComponentId: Type.Literal("xhs-browser"),
    playwrightVersion: Type.Literal("1.63.0"),
    chromiumRevision: Type.Literal("1243"),
    chromiumVersion: Type.Literal("153.0.8010.12"),
    sourceRevision: Type.Literal("27468deae565fcb3d5a074063703d9df88449aed")
  },
  { additionalProperties: false }
);

export const DouyinRuntimeStatusSchema = Type.Object(
  {
    platform: Type.Literal("douyin"),
    mode: Type.Literal("anonymous"),
    available: Type.Boolean(),
    state: Type.Union([
      Type.Literal("not-installed"),
      Type.Literal("ready"),
      Type.Literal("busy"),
      Type.Literal("unavailable"),
      Type.Literal("stopped")
    ]),
    message: Type.String({ minLength: 1, maxLength: 240 }),
    errorCode: Type.Optional(Type.String({ minLength: 1, maxLength: 80 }))
  },
  { additionalProperties: false }
);
export type DouyinRuntimeStatus = Static<typeof DouyinRuntimeStatusSchema>;

export function isDouyinAdapterManifest(value: unknown): value is Static<typeof DouyinAdapterManifestSchema> {
  return Value.Check(DouyinAdapterManifestSchema, value);
}
