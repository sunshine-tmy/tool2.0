/** 归档配乐只描述受控素材 ID 和混音参数，不接受客户端路径或 FFmpeg 表达式。 */
import { Type, type Static } from "@sinclair/typebox";
import { ArchiveWatermarkInputSchema, ArchiveWatermarkSettingsSchema } from "./video-watermark";
const strict = { additionalProperties: false } as const;
const Id = Type.String({ pattern: "^[A-Za-z0-9_-]{6,128}$" });
export const ArchiveEditFileSchema = Type.Object(
  {
    fileName: Type.String({ minLength: 1, maxLength: 255 }),
    mimeType: Type.String(),
    size: Type.Integer({ minimum: 1 }),
    checksum: Type.String({ pattern: "^[a-f0-9]{64}$" })
  },
  strict
);
export const ArchiveAudioSettingsSchema = Type.Object(
  {
    originalVolume: Type.Number({ minimum: 0, maximum: 100 }),
    musicVolume: Type.Number({ minimum: 0, maximum: 100 }),
    musicStartSeconds: Type.Number({ minimum: 0, maximum: 86400 }),
    loop: Type.Boolean(),
    fadeInSeconds: Type.Number({ minimum: 0, maximum: 5 }),
    fadeOutSeconds: Type.Number({ minimum: 0, maximum: 5 })
  },
  strict
);
export const ArchiveVideoEditSchema = Type.Object(
  {
    revision: Type.Integer({ minimum: 1 }),
    original: ArchiveEditFileSchema,
    music: Type.Optional(
      Type.Composite(
        [
          ArchiveEditFileSchema,
          Type.Object({
            title: Type.String(),
            libraryItemId: Type.Optional(Type.String()),
            libraryRevision: Type.Optional(Type.Integer({ minimum: 1 }))
          })
        ],
        strict
      )
    ),
    settings: ArchiveAudioSettingsSchema,
    watermark: Type.Optional(
      Type.Object(
        {
          file: ArchiveEditFileSchema,
          width: Type.Integer({ minimum: 1 }),
          height: Type.Integer({ minimum: 1 }),
          settings: ArchiveWatermarkSettingsSchema
        },
        strict
      )
    ),
    updatedAt: Type.String(),
    // 仅用于旧成品在播放/下载结束前的延后清理，仍计入归档配额。
    pendingFiles: Type.Optional(Type.Array(ArchiveEditFileSchema))
  },
  strict
);
export const ArchiveVideoEditInputSchema = Type.Object(
  {
    mode: Type.Union([Type.Literal("save"), Type.Literal("preview"), Type.Literal("restore")]),
    revision: Type.Integer({ minimum: 0 }),
    checksum: Type.String({ pattern: "^[a-f0-9]{64}$" }),
    musicId: Type.Optional(Type.String({ pattern: "^[A-Za-z0-9_-]{1,80}$" })),
    musicRevision: Type.Optional(Type.Integer({ minimum: 1 })),
    useSavedMusic: Type.Boolean(),
    settings: ArchiveAudioSettingsSchema,
    // 省略保留当前水印；null 明确移除；对象配置当前水印或上传的草稿。
    watermark: Type.Optional(Type.Union([ArchiveWatermarkInputSchema, Type.Null()])),
    previewStartSeconds: Type.Optional(Type.Number({ minimum: 0, maximum: 86400 })),
    slideshow: Type.Optional(
      Type.Object(
        {
          images: Type.Array(Type.Object({ id: Id, checksum: Type.String({ pattern: "^[a-f0-9]{64}$" }) }, strict), {
            minItems: 1,
            maxItems: 100
          }),
          secondsPerImage: Type.Number({ minimum: 0.5, maximum: 30 }),
          aspect: Type.Union([Type.Literal("portrait"), Type.Literal("landscape"), Type.Literal("square")])
        },
        strict
      )
    )
  },
  strict
);
export const ArchiveVideoEditJobSchema = Type.Object(
  {
    id: Id,
    itemId: Id,
    mediaId: Id,
    mode: ArchiveVideoEditInputSchema.properties.mode,
    status: Type.Union([
      Type.Literal("pending"),
      Type.Literal("running"),
      Type.Literal("completed"),
      Type.Literal("failed"),
      Type.Literal("cancelled")
    ]),
    stage: Type.String(),
    progress: Type.Number({ minimum: 0, maximum: 100 }),
    message: Type.String(),
    errorCode: Type.Optional(Type.String()),
    previewUrl: Type.Optional(Type.String()),
    resultMediaId: Type.Optional(Id),
    createdAt: Type.String(),
    updatedAt: Type.String()
  },
  strict
);
export type ArchiveEditFile = Static<typeof ArchiveEditFileSchema>;
export type ArchiveAudioSettings = Static<typeof ArchiveAudioSettingsSchema>;
export type ArchiveVideoEdit = Static<typeof ArchiveVideoEditSchema>;
export type ArchiveVideoEditInput = Static<typeof ArchiveVideoEditInputSchema>;
export type ArchiveVideoEditJob = Static<typeof ArchiveVideoEditJobSchema>;
export const defaultArchiveAudioSettings = (): ArchiveAudioSettings => ({
  originalVolume: 100,
  musicVolume: 20,
  musicStartSeconds: 0,
  loop: true,
  fadeInSeconds: 0.5,
  fadeOutSeconds: 1
});
