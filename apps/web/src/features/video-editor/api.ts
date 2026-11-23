import { Type } from "@sinclair/typebox";
import {
  VideoEditorProjectSchema,
  VideoEditorProjectDetailSchema,
  VideoEditorLocalAudioSchema,
  LocalArchiveUploadResultSchema
} from "@toolbox/shared/archive";
import { httpClient, withApiError } from "../../shared/http/http";
const root = "/tools/video-editor/projects";
export const editorProjectsApi = {
  importAudio: (itemId: string, mediaId: string, id: string, revision: number, signal?: AbortSignal) =>
    withApiError(() =>
      httpClient.post(
        `/tools/video-editor/materials/${encodeURIComponent(itemId)}/${encodeURIComponent(mediaId)}/audio/import`,
        VideoEditorLocalAudioSchema,
        { id, revision },
        { signal, timeout: 30 * 60 * 1000 }
      )
    ),
  localAudio: (itemId: string, mediaId: string, signal?: AbortSignal) =>
    withApiError(() =>
      httpClient.get(
        `/tools/video-editor/materials/${encodeURIComponent(itemId)}/${encodeURIComponent(mediaId)}/audio`,
        Type.Array(VideoEditorLocalAudioSchema),
        { signal }
      )
    ),
  uploadMaterialAudio: (
    file: File,
    itemId: string,
    mediaId: string,
    signal: AbortSignal,
    progress: (percent: number) => void
  ) => {
    const form = new FormData();
    form.append("file", file);
    return withApiError(() =>
      httpClient.post(
        `/tools/video-editor/materials/${encodeURIComponent(itemId)}/${encodeURIComponent(mediaId)}/audio`,
        VideoEditorLocalAudioSchema,
        form,
        {
          signal,
          timeout: 30 * 60 * 1000,
          onUploadProgress: (event) => {
            if (event.total) progress(Math.min(100, Math.round((event.loaded * 100) / event.total)));
          }
        }
      )
    );
  },
  list: (signal?: AbortSignal) =>
    withApiError(() => httpClient.get(root, Type.Array(VideoEditorProjectSchema), { signal })),
  detail: (id: string, signal?: AbortSignal) =>
    withApiError(() => httpClient.get(`${root}/${encodeURIComponent(id)}`, VideoEditorProjectDetailSchema, { signal })),
  create: (itemId: string, mediaId: string, signal?: AbortSignal) =>
    withApiError(() => httpClient.post(root, VideoEditorProjectSchema, { itemId, mediaId }, { signal })),
  rename: (id: string, name: string) =>
    withApiError(() => httpClient.put(`${root}/${encodeURIComponent(id)}`, VideoEditorProjectSchema, { name })),
  copy: (id: string) =>
    withApiError(() => httpClient.post(`${root}/${encodeURIComponent(id)}/copy`, VideoEditorProjectSchema)),
  remove: (id: string) =>
    withApiError(() => httpClient.delete(`${root}/${encodeURIComponent(id)}`, Type.Object({ id: Type.String() }))),
  sync: (id: string, revision: number) =>
    withApiError(() =>
      httpClient.post(
        `${root}/${encodeURIComponent(id)}/sync`,
        VideoEditorProjectSchema,
        { revision },
        { timeout: 30 * 60 * 1000 }
      )
    ),
  uploadMaterialVideo: (file: File, ownerId: string, signal: AbortSignal, progress: (percent: number) => void) => {
    const form = new FormData();
    form.append("title", file.name.replace(/\.[^.]+$/, ""));
    form.append("file", file);
    return withApiError(() =>
      httpClient.post(
        `/tools/video-editor/materials/local-videos?ownerId=${encodeURIComponent(ownerId)}`,
        LocalArchiveUploadResultSchema,
        form,
        {
          signal,
          timeout: 30 * 60 * 1000,
          onUploadProgress: (event) => {
            if (event.total) progress(Math.min(100, Math.round((event.loaded * 100) / event.total)));
          }
        }
      )
    );
  },
  upload: (file: File, signal: AbortSignal, progress: (percent: number) => void) => {
    const form = new FormData();
    form.append("title", file.name.replace(/\.[^.]+$/, ""));
    form.append("file", file);
    return withApiError(() =>
      httpClient.post("/tools/video-editor/local-videos", LocalArchiveUploadResultSchema, form, {
        signal,
        timeout: 30 * 60 * 1000,
        onUploadProgress: (event) => {
          if (event.total) progress(Math.round((event.loaded * 100) / event.total));
        }
      })
    );
  }
};
