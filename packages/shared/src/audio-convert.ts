/** Audio conversion wire/storage contract. Keys and temporary source paths are never persisted. */
import { Type, type Static } from "@sinclair/typebox";
export const AUDIO_CONVERT_MAX_FILES = 1000;
export const AUDIO_CONVERT_MAX_BYTES = 100 * 1024 * 1024;
export const AudioConvertBitrateSchema = Type.Union(([128, 192, 256, 320] as const).map((n) => Type.Literal(n)));
export const AudioConvertJobSchema = Type.Object(
  {
    id: Type.String({ pattern: "^[A-Za-z0-9_-]{1,80}$" }),
    name: Type.String({ minLength: 1, maxLength: 255 }),
    bitrate: AudioConvertBitrateSchema,
    status: Type.Union(
      (["pending", "running", "completed", "failed", "canceled"] as const).map((s) => Type.Literal(s))
    ),
    progress: Type.Number({ minimum: 0, maximum: 100 }),
    format: Type.Optional(Type.String({ maxLength: 40 })),
    duration: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
    bytes: Type.Optional(Type.Integer({ minimum: 1 })),
    sha256: Type.Optional(Type.String({ pattern: "^[a-f0-9]{64}$" })),
    sourceSha256: Type.Optional(Type.String({ pattern: "^[a-f0-9]{64}$" })),
    errorCode: Type.Optional(Type.String()),
    error: Type.Optional(Type.String()),
    createdAt: Type.String(),
    updatedAt: Type.String()
  },
  { additionalProperties: false }
);
export const AudioConvertListSchema = Type.Object({
  items: Type.Array(AudioConvertJobSchema),
  total: Type.Integer({ minimum: 0 })
});
export const AudioConvertSelectionSchema = Type.Object(
  {
    ids: Type.Array(Type.String({ pattern: "^[A-Za-z0-9_-]{1,80}$" }), {
      maxItems: AUDIO_CONVERT_MAX_FILES,
      uniqueItems: true
    }),
    total: Type.Integer({ minimum: 0 })
  },
  { additionalProperties: false }
);
export type AudioConvertJob = Static<typeof AudioConvertJobSchema>;
