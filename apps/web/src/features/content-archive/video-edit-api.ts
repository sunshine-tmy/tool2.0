import { Type } from "@sinclair/typebox";
import { ArchiveVideoEditJobSchema, type ArchiveVideoEditInput } from "@toolbox/shared/archive";
import { httpClient, withApiError } from "../../shared/http/http";
const root = "/tools/media-archive";
const mediaPath = (itemId: string, mediaId: string) =>
  `${root}/items/${encodeURIComponent(itemId)}/media/${encodeURIComponent(mediaId)}/audio-edits`;
export const videoEditApi = {
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
