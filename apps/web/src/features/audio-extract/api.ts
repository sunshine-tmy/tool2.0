import { Type } from "@sinclair/typebox";
import {
  AudioExtractSourceSchema,
  AudioExtractListSchema,
  AudioExtractJobSchema,
  type AudioExtractInput
} from "@toolbox/shared/audio-extract";
import { AudioLibraryItemViewSchema } from "@toolbox/shared/audio-library";
import { httpClient, withApiError } from "../../shared/http/http";
import { resolveBackendUrl } from "../../shared/config/runtime";
const root = "/tools/audio-extract";
export const audioExtractApi = {
  upload(file: File, signal: AbortSignal, onProgress: (n: number) => void) {
    const data = new FormData();
    data.append("file", file, file.name);
    return withApiError(() =>
      httpClient.post(`${root}/sources`, AudioExtractSourceSchema, data, {
        signal,
        timeout: 0,
        onUploadProgress: (e) => onProgress(Math.min(100, Math.round((e.progress ?? 0) * 100)))
      })
    );
  },
  discard(id: string) {
    return withApiError(() => httpClient.delete(`${root}/sources/${id}`, Type.Object({ ok: Type.Boolean() })));
  },
  create(input: AudioExtractInput, signal: AbortSignal) {
    return withApiError(() => httpClient.post(`${root}/jobs`, AudioExtractListSchema, input, { signal }));
  },
  list(page: number, signal: AbortSignal) {
    return withApiError(() =>
      httpClient.get(`${root}/jobs`, AudioExtractListSchema, { params: { page, pageSize: 50 }, signal })
    );
  },
  job(id: string, signal: AbortSignal) {
    return withApiError(() => httpClient.get(`${root}/jobs/${id}`, AudioExtractJobSchema, { signal }));
  },
  cancel(id: string) {
    return withApiError(() => httpClient.post(`${root}/jobs/${id}/cancel`, AudioExtractJobSchema));
  },
  remove(id: string) {
    return withApiError(() => httpClient.delete(`${root}/jobs/${id}`, Type.Object({ ok: Type.Boolean() })));
  },
  media(id: string, download = false) {
    return resolveBackendUrl(`/api/v1${root}/jobs/${id}/audio${download ? "?download=1" : ""}`);
  },
  zip(ids: string[]) {
    return withApiError(() => httpClient.post(`${root}/downloads`, Type.Object({ url: Type.String() }), { ids }));
  },
  library(id: string, groupId: string | null, purpose: "music" | "speech" | "general", mp3: boolean) {
    return withApiError(() =>
      httpClient.post(
        `${root}/jobs/${id}/library`,
        Type.Object({ item: AudioLibraryItemViewSchema, existing: Type.Boolean() }),
        { groupId, purpose, mp3 },
        { timeout: 0 }
      )
    );
  }
};
