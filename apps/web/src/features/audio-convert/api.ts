import { Type } from "@sinclair/typebox";
import { AudioConvertJobSchema, AudioConvertListSchema } from "@toolbox/shared/audio-convert";
import { AudioLibraryItemViewSchema } from "@toolbox/shared/audio-library";
import { httpClient, withApiError } from "../../shared/http/http";
import { resolveBackendUrl } from "../../shared/config/runtime";
const root = "/tools/audio-convert";
export const audioConvertApi = {
  list(page: number, signal?: AbortSignal) {
    return withApiError(() =>
      httpClient.get(`${root}/jobs`, AudioConvertListSchema, { params: { page, pageSize: 50 }, signal })
    );
  },
  job(id: string, signal?: AbortSignal) {
    return withApiError(() => httpClient.get(`${root}/jobs/${id}`, AudioConvertJobSchema, { signal }));
  },
  upload(file: File, bitrate: number, ekey: string, signal: AbortSignal) {
    const form = new FormData();
    form.append("bitrate", String(bitrate));
    if (ekey.trim()) form.append("ekey", ekey.trim());
    form.append("file", file, file.name);
    return withApiError(() => httpClient.post(`${root}/uploads`, AudioConvertJobSchema, form, { signal, timeout: 0 }));
  },
  cancel(id: string) {
    return withApiError(() => httpClient.post(`${root}/jobs/${id}/cancel`, AudioConvertJobSchema));
  },
  remove(id: string) {
    return withApiError(() => httpClient.delete(`${root}/jobs/${id}`, Type.Object({ ok: Type.Boolean() })));
  },
  add(id: string, groupId: string | null, purpose: string) {
    return withApiError(() =>
      httpClient.post(
        `${root}/jobs/${id}/library`,
        Type.Object({ item: AudioLibraryItemViewSchema, existing: Type.Boolean() }),
        { groupId, purpose }
      )
    );
  },
  download(id: string) {
    return resolveBackendUrl(`/api/v1${root}/jobs/${id}/audio`);
  },
  zip(ids: string[]) {
    return withApiError(() => httpClient.post(`${root}/downloads`, Type.Object({ url: Type.String() }), { ids }));
  }
};
