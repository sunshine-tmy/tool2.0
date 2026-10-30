import { Type } from "@sinclair/typebox";
import {
  ArchiveVideoEditJobSchema,
  ArchiveWatermarkDraftSchema,
  ArchiveWatermarkPresetSchema,
  ArchiveWatermarkLibraryItemSchema,
  type ArchiveWatermarkPresetInput,
  type ArchiveVideoEditInput
} from "@toolbox/shared/archive";
import { httpClient, withApiError } from "../../shared/http/http";
const root = "/tools/media-archive";
const mediaPath = (itemId: string, mediaId: string) =>
  `${root}/items/${encodeURIComponent(itemId)}/media/${encodeURIComponent(mediaId)}/audio-edits`;
export const videoEditApi = {
  watermarkLibrary: (signal?: AbortSignal) =>
    withApiError(() =>
      httpClient.get(`${root}/watermark-library`, Type.Array(ArchiveWatermarkLibraryItemSchema), { signal })
    ),
  uploadLibraryWatermark: (file: File, signal?: AbortSignal) => {
    const form = new FormData();
    form.append("file", file);
    return withApiError(() =>
      httpClient.post(`${root}/watermark-library`, ArchiveWatermarkLibraryItemSchema, form, { signal })
    );
  },
  removeLibraryWatermark: (id: string, revision: number, signal?: AbortSignal) =>
    withApiError(() =>
      httpClient.delete(
        `${root}/watermark-library/${encodeURIComponent(id)}?revision=${revision}`,
        Type.Object({ id: Type.String() }),
        { signal }
      )
    ),
  selectLibraryWatermark: (itemId: string, mediaId: string, libraryId: string, signal?: AbortSignal) =>
    withApiError(() =>
      httpClient.post(
        `${root}/items/${encodeURIComponent(itemId)}/media/${encodeURIComponent(mediaId)}/watermarks/from-library`,
        ArchiveWatermarkDraftSchema,
        { libraryId },
        { signal }
      )
    ),
  watermarkPresets: (signal?: AbortSignal) =>
    withApiError(() =>
      httpClient.get(`${root}/watermark-presets`, Type.Array(ArchiveWatermarkPresetSchema), { signal })
    ),
  saveWatermarkPreset: (input: ArchiveWatermarkPresetInput, signal?: AbortSignal) =>
    withApiError(() => httpClient.post(`${root}/watermark-presets`, ArchiveWatermarkPresetSchema, input, { signal })),
  removeWatermarkPreset: (id: string, revision: number, signal?: AbortSignal) =>
    withApiError(() =>
      httpClient.delete(
        `${root}/watermark-presets/${encodeURIComponent(id)}?revision=${revision}`,
        Type.Object({ id: Type.String() }),
        { signal }
      )
    ),
  uploadWatermark: (itemId: string, mediaId: string, file: File, signal?: AbortSignal) => {
    const form = new FormData();
    form.append("file", file);
    return withApiError(() =>
      httpClient.post(
        `${root}/items/${encodeURIComponent(itemId)}/media/${encodeURIComponent(mediaId)}/watermarks`,
        ArchiveWatermarkDraftSchema,
        form,
        { signal }
      )
    );
  },
  runtime: (signal?: AbortSignal) =>
    withApiError(() =>
      httpClient.get(`${root}/video-edit-runtime`, Type.Object({ ready: Type.Boolean() }), { signal })
    ),
  list: (itemId: string, mediaId: string, signal?: AbortSignal) =>
    withApiError(() => httpClient.get(mediaPath(itemId, mediaId), Type.Array(ArchiveVideoEditJobSchema), { signal })),
  create: (itemId: string, mediaId: string, input: ArchiveVideoEditInput, signal?: AbortSignal) =>
    withApiError(() => httpClient.post(mediaPath(itemId, mediaId), ArchiveVideoEditJobSchema, input, { signal })),
  get: (id: string, signal?: AbortSignal) =>
    withApiError(() =>
      httpClient.get(`${root}/video-edits/${encodeURIComponent(id)}`, ArchiveVideoEditJobSchema, { signal })
    ),
  cancel: (id: string, signal?: AbortSignal) =>
    withApiError(() =>
      httpClient.delete(`${root}/video-edits/${encodeURIComponent(id)}`, ArchiveVideoEditJobSchema, { signal })
    )
};
