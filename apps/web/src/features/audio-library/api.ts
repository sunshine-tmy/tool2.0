/** 直播音频库客户端：使用共享 Schema 解码，媒体地址沿用统一后端基地址。 */
import { Type } from "@sinclair/typebox";
import {
  AudioLibraryItemViewSchema,
  AudioLibraryListSchema,
  AudioLibraryMutationSchema,
  AudioLibraryGroupSchema,
  AudioLibraryImportResultSchema,
  AudioLibraryPresetSchema,
  AudioLibraryPresetLoadSchema,
  type AudioLibraryPresetInput,
  type AudioLibraryEdit,
  type AudioLibraryImport
} from "@toolbox/shared/audio-library";
import { httpClient, withApiError } from "../../shared/http/http";
import { resolveBackendUrl } from "../../shared/config/runtime";
const root = "/tools/audio-library";
export const audioLibraryApi = {
  presets() {
    return withApiError(() => httpClient.get(`${root}/presets`, Type.Array(AudioLibraryPresetSchema)));
  },
  savePreset(input: AudioLibraryPresetInput, id?: string) {
    return withApiError(() =>
      id
        ? httpClient.patch(`${root}/presets/${id}`, AudioLibraryPresetSchema, input)
        : httpClient.post(`${root}/presets`, AudioLibraryPresetSchema, input)
    );
  },
  deletePreset(id: string, revision: number) {
    return withApiError(() =>
      httpClient.delete(`${root}/presets/${id}`, AudioLibraryMutationSchema, { data: { revision } })
    );
  },
  loadPreset(id: string) {
    return withApiError(() => httpClient.get(`${root}/presets/${id}/load`, AudioLibraryPresetLoadSchema));
  },
  list(params: Record<string, unknown> = {}, signal?: AbortSignal) {
    return withApiError(() =>
      httpClient.get(`${root}/items`, AudioLibraryListSchema, { params, ...(signal ? { signal } : {}) })
    );
  },
  item(id: string) {
    return withApiError(() => httpClient.get(`${root}/items/${id}`, AudioLibraryItemViewSchema));
  },
  resolve(ids: string[]) {
    return withApiError(() =>
      httpClient.post(`${root}/items/resolve`, Type.Array(AudioLibraryItemViewSchema), { ids })
    );
  },
  edit(id: string, body: AudioLibraryEdit) {
    return withApiError(() => httpClient.patch(`${root}/items/${id}`, AudioLibraryItemViewSchema, body));
  },
  group(name: string, parentId: string | null, id?: string) {
    return withApiError(() =>
      id
        ? httpClient.patch(`${root}/groups/${id}`, AudioLibraryGroupSchema, { name, parentId })
        : httpClient.post(`${root}/groups`, AudioLibraryGroupSchema, { name, parentId })
    );
  },
  removeGroup(id: string) {
    return withApiError(() => httpClient.delete(`${root}/groups/${id}`, AudioLibraryMutationSchema));
  },
  move(ids: string[], groupId: string | null) {
    return withApiError(() =>
      httpClient.post(`${root}/items/batch-move`, AudioLibraryMutationSchema, { ids, groupId })
    );
  },
  undo(token: string) {
    return withApiError(() => httpClient.post(`${root}/undo/${token}`, AudioLibraryMutationSchema));
  },
  trash(ids: string[], restore = false) {
    return withApiError(() =>
      httpClient.post(`${root}/items/batch-trash`, AudioLibraryMutationSchema, { ids, restore })
    );
  },
  purge(id: string) {
    return withApiError(() => httpClient.delete(`${root}/trash/${id}`, AudioLibraryMutationSchema));
  },
  importChatterbox(input: AudioLibraryImport) {
    return withApiError(() => httpClient.post(`${root}/imports/chatterbox`, AudioLibraryImportResultSchema, input));
  },
  importEdgeTts(input: AudioLibraryImport) {
    return withApiError(() => httpClient.post(`${root}/imports/edge-tts`, AudioLibraryImportResultSchema, input));
  },
  clip(id: string, file: Blob, startSeconds: number, endSeconds: number, revision: number, signal?: AbortSignal) {
    const form = new FormData();
    form.append("startSeconds", String(startSeconds));
    form.append("endSeconds", String(endSeconds));
    form.append("revision", String(revision));
    form.append("file", file, "clip.wav");
    return withApiError(() =>
      httpClient.post(
        `${root}/items/${id}/clips`,
        Type.Object({ item: AudioLibraryItemViewSchema, existing: Type.Boolean() }),
        form,
        { timeout: 0, signal }
      )
    );
  },
  upload(file: File, fields: Record<string, string>, onProgress?: (percent: number) => void, signal?: AbortSignal) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    form.append("file", file, file.name);
    return withApiError(() =>
      httpClient.post(
        `${root}/uploads`,
        Type.Object({ item: AudioLibraryItemViewSchema, existing: Type.Boolean() }),
        form,
        {
          timeout: 0,
          ...(signal ? { signal } : {}),
          onUploadProgress: (event) =>
            onProgress?.(Math.min(100, Math.round((event.loaded / (event.total || file.size)) * 100)))
        }
      )
    );
  },
  restore(file: File) {
    const form = new FormData();
    form.append("file", file);
    return withApiError(() =>
      httpClient.post(`${root}/backup/restore`, Type.Object({ added: Type.Integer(), skipped: Type.Integer() }), form, {
        timeout: 0
      })
    );
  },
  exportUrl(ids?: string[]) {
    return resolveBackendUrl(
      `/api/v1/tools/audio-library/${ids ? `exports?ids=${encodeURIComponent(ids.join(","))}` : "backup"}`
    );
  }
};
