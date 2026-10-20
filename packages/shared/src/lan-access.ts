import { Type, type Static } from "@sinclair/typebox";

export const LanApplicationAccessSchema = Type.Object({
  status: Type.Union([Type.Literal("ready"), Type.Literal("no-network"), Type.Literal("unavailable")]),
  urls: Type.Array(Type.String()),
  port: Type.Integer({ minimum: 0, maximum: 65535 }),
  toolCount: Type.Integer({ minimum: 0 }),
  message: Type.String()
});
export type LanApplicationAccess = Static<typeof LanApplicationAccessSchema>;
