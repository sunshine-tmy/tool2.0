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
} from "@toolbox/shared";
import { httpClient, withApiError } from "../../services/http";
import { resolveBackendUrl, apiBaseUrl } from "../../config/runtime";
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
  list(params: Record<string, unknown> = {}) {
    return withApiError(() => httpClient.get(`${root}/items`, AudioLibraryListSchema, { params }));
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
  upload(file: File, fields: Record<string, string>, onProgress?: (percent: number) => void) {
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
export function storedGroup(key = "last-group"): string | null {
  try {
    return localStorage.getItem(`audio-library:${apiBaseUrl}:${key}`) || null;
  } catch {
    return null;
  }
}
export function rememberGroup(value: string | null, key = "last-group") {
  try {
    if (value) localStorage.setItem(`audio-library:${apiBaseUrl}:${key}`, value);
    else localStorage.removeItem(`audio-library:${apiBaseUrl}:${key}`);
  } catch {
    /* 浏览器禁用存储时仍可正常归档。 */
  }
}
export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return "—";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  return bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GiB` : `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}
export function groupOptions(groups: import("@toolbox/shared").AudioLibraryGroup[]) {
  const result: Array<{ label: string; value: string }> = [];
  const visit = (parentId: string | null, path: string[]) => {
    for (const group of groups
      .filter((x) => x.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))) {
      const names = [...path, group.name];
      result.push({ label: names.join(" / "), value: group.id });
      if (names.length < 3) visit(group.id, names);
    }
  };
  visit(null, []);
  return result;
}
