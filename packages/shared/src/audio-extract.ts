/** Video audio extraction contracts. Source paths and temporary uploads are never portable records. */
import { Type, type Static } from "@sinclair/typebox";
import { registerSharedSchemaFormats } from "./common/schema-formats";
registerSharedSchemaFormats();
export const AUDIO_EXTRACT_MAX_FILES = 1000;
export const AUDIO_EXTRACT_MAX_BYTES = 2 * 1024 ** 3;
export const AUDIO_EXTRACT_MAX_SECONDS = 6 * 3600;
export const AUDIO_EXTRACT_QUOTA = 20 * 1024 ** 3;
const id = Type.String({ pattern: "^[A-Za-z0-9_-]{21}$" });
const hash = Type.String({ pattern: "^[a-f0-9]{64}$" });
export const AudioExtractFormatSchema = Type.Union([Type.Literal("mp3"), Type.Literal("original")]);
export const AudioExtractBitrateSchema = Type.Union(([128, 192, 256, 320] as const).map((v) => Type.Literal(v)));
export const AudioExtractTrackSchema = Type.Object(
  {
    index: Type.Integer({ minimum: 0, maximum: 1023 }),
    codec: Type.String({ minLength: 1, maxLength: 60 }),
    language: Type.String({ maxLength: 80 }),
    title: Type.String({ maxLength: 160 }),
    channels: Type.Integer({ minimum: 1, maximum: 64 }),
    sampleRate: Type.Integer({ minimum: 1, maximum: 768000 }),
    duration: Type.Number({ exclusiveMinimum: 0, maximum: AUDIO_EXTRACT_MAX_SECONDS }),
    default: Type.Boolean()
  },
  { additionalProperties: false }
);
export const AudioExtractSourceSchema = Type.Object(
  {
    id,
    name: Type.String({ minLength: 1, maxLength: 255 }),
    sha256: hash,
    bytes: Type.Integer({ minimum: 1, maximum: AUDIO_EXTRACT_MAX_BYTES }),
    tracks: Type.Array(AudioExtractTrackSchema, { minItems: 1, maxItems: 32 }),
    expiresAt: Type.String({ format: "date-time" })
  },
  { additionalProperties: false }
);
export const AudioExtractInputSchema = Type.Object(
  {
    sourceId: id,
    trackIndices: Type.Array(Type.Integer({ minimum: 0, maximum: 1023 }), {
      minItems: 1,
      maxItems: 32,
      uniqueItems: true
    }),
    format: AudioExtractFormatSchema,
    bitrate: AudioExtractBitrateSchema
  },
  { additionalProperties: false }
);
export const AudioExtractJobSchema = Type.Object(
  {
    id: Type.String({ pattern: "^[A-Za-z0-9_-]{1,80}$" }),
    name: Type.String({ minLength: 1, maxLength: 255 }),
    sourceSha256: hash,
    sourceBytes: Type.Integer({ minimum: 1, maximum: AUDIO_EXTRACT_MAX_BYTES }),
    track: AudioExtractTrackSchema,
    format: AudioExtractFormatSchema,
    bitrate: AudioExtractBitrateSchema,
    status: Type.Union(
      (["pending", "running", "completed", "failed", "canceled"] as const).map((s) => Type.Literal(s))
    ),
    phase: Type.String({ maxLength: 80 }),
    progress: Type.Number({ minimum: 0, maximum: 100 }),
    extension: Type.Union((["mp3", "m4a", "flac", "ogg", "wav", "mka"] as const).map((s) => Type.Literal(s))),
    mimeType: Type.String({ maxLength: 80 }),
    bytes: Type.Optional(Type.Integer({ minimum: 1, maximum: AUDIO_EXTRACT_MAX_BYTES })),
    sha256: Type.Optional(hash),
    duration: Type.Optional(Type.Number({ exclusiveMinimum: 0, maximum: AUDIO_EXTRACT_MAX_SECONDS + 1 })),
    error: Type.Optional(Type.String({ maxLength: 1000 })),
    errorCode: Type.Optional(Type.String({ maxLength: 100 })),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" })
  },
  { additionalProperties: false }
);
export const AudioExtractListSchema = Type.Object({
  items: Type.Array(AudioExtractJobSchema),
  total: Type.Integer({ minimum: 0 })
});
export const AudioExtractSelectionSchema = Type.Object({
  ids: Type.Array(Type.String({ pattern: "^[A-Za-z0-9_-]{1,80}$" }), { maxItems: 1000, uniqueItems: true }),
  total: Type.Integer({ minimum: 0 })
});
export type AudioExtractJob = Static<typeof AudioExtractJobSchema>;
export type AudioExtractSource = Static<typeof AudioExtractSourceSchema>;
export type AudioExtractTrack = Static<typeof AudioExtractTrackSchema>;
export type AudioExtractInput = Static<typeof AudioExtractInputSchema>;
