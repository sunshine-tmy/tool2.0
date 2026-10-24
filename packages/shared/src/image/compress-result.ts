/** Shared wire contracts only; no execution or data lifecycle changes. */
import { Type, type Static } from "@sinclair/typebox";
import { TaskSchema } from "../common/api-schema";

export const ImageCompressResultSchema = Type.Object(
  {
    task: TaskSchema,
    downloadUrl: Type.String({ pattern: "^/api/v1/" }),
    originalName: Type.String(),
    outputName: Type.String(),
    outputFormat: Type.Union([Type.Literal("jpeg"), Type.Literal("png"), Type.Literal("webp")]),
    originalSize: Type.Integer({ minimum: 0 }),
    outputSize: Type.Integer({ minimum: 0 }),
    savedBytes: Type.Integer(),
    compressionRatio: Type.Number({ minimum: 0 }),
    width: Type.Integer({ minimum: 1 }),
    height: Type.Integer({ minimum: 1 })
  },
  { additionalProperties: false }
);

export type ImageCompressResult = Static<typeof ImageCompressResultSchema>;
