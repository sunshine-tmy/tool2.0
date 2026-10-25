import { Type, type Static } from "@sinclair/typebox";

/** Parser readiness only; a local status check never contacts TikTok or claims network acceptance. */
export const TikTokRuntimeStatusSchema = Type.Object(
  {
    platform: Type.Literal("tiktok"),
    mode: Type.Literal("anonymous"),
    available: Type.Boolean(),
    state: Type.Union([Type.Literal("ready"), Type.Literal("busy"), Type.Literal("stopped")]),
    message: Type.String({ minLength: 1, maxLength: 240 })
  },
  { additionalProperties: false }
);
export type TikTokRuntimeStatus = Static<typeof TikTokRuntimeStatusSchema>;
