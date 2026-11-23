import { Type, type Static } from "@sinclair/typebox";
import { ContentArchiveItemSchema } from "./content-archive";
export const VideoEditorProjectSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  itemId: Type.String(),
  mediaId: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  link: Type.Optional(
    Type.Object({ itemId: Type.String(), mediaId: Type.String(), checksum: Type.String(), revision: Type.Number() })
  ),
  durationMs: Type.Optional(Type.Number()),
  bytes: Type.Optional(Type.Number()),
  previewUrl: Type.Optional(Type.String()),
  syncedRevision: Type.Optional(Type.Number())
});
export type VideoEditorProject = Static<typeof VideoEditorProjectSchema>;
import { ArchiveVideoEditSchema, ArchiveEditFileSchema } from "./video-edit";
export const VideoEditorLocalAudioSchema = Type.Object({
  id: Type.String({ pattern: "^local_audio_[A-Za-z0-9_-]+$" }),
  title: Type.String({ maxLength: 500 }),
  duration: Type.Number({ exclusiveMinimum: 0 }),
  source: Type.Optional(
    Type.Object({
      id: Type.String({ minLength: 1, maxLength: 80 }),
      revision: Type.Integer({ minimum: 1 }),
      purpose: Type.Union([Type.Literal("general"), Type.Literal("music"), Type.Literal("speech")])
    })
  ),
  file: ArchiveEditFileSchema
});
export type VideoEditorLocalAudio = Static<typeof VideoEditorLocalAudioSchema>;
export const VideoEditorDraftAssetsSchema = Type.Object({
  studioSources: Type.Optional(ArchiveVideoEditSchema.properties.studioSources),
  studioMusic: Type.Optional(Type.Array(ArchiveVideoEditSchema.properties.studioMusic.items)),
  localAudio: Type.Optional(Type.Array(VideoEditorLocalAudioSchema))
});
export type VideoEditorDraftAssets = Static<typeof VideoEditorDraftAssetsSchema>;
export const VideoEditorProjectDetailSchema = Type.Object({
  project: VideoEditorProjectSchema,
  item: ContentArchiveItemSchema,
  draftAssets: VideoEditorDraftAssetsSchema
});
