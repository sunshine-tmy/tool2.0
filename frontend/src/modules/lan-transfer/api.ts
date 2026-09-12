import type { AxiosProgressEvent } from "axios";
import { httpClient, withApiError } from "../../services/http";
import type {
  CreateLanUploadSessionInput,
  LanFileListParams,
  LanFilePagination,
  LanFileView,
  LanNoteView,
  LanTransferInfo,
  LanUploadResponse,
  LanUploadStatus
} from "./types";

class LanTransferApi {
  async getInfo() {
    return withApiError(() => httpClient.get<LanTransferInfo>("/tools/lan-transfer/info"), "获取传输服务信息失败");
  }

  async unlock(pin: string) {
    return withApiError(
      () => httpClient.post<{ authenticated: boolean }>("/tools/lan-transfer/access", { pin }),
      "访问 PIN 不正确"
    );
  }
  async uploadFile(file: File, onUploadProgress?: (event: AxiosProgressEvent) => void) {
    const form = new FormData();
    form.append("file", file);

    return withApiError(
      () => httpClient.post<LanUploadResponse>("/tools/lan-transfer/files", form, { onUploadProgress }),
      "上传文件失败"
    );
  }

  async createUploadSession(input: CreateLanUploadSessionInput) {
    return withApiError(
      () => httpClient.post<LanUploadStatus>("/tools/lan-transfer/uploads", input),
      "创建上传会话失败"
    );
  }

  async getUploadStatus(uploadId: string) {
    return withApiError(
      () => httpClient.get<LanUploadStatus>(`/tools/lan-transfer/uploads/${uploadId}`),
      "获取上传状态失败"
    );
  }

  async uploadChunk(
    uploadId: string,
    index: number,
    chunk: Blob,
    onUploadProgress?: (event: { loaded: number; total?: number }) => void,
    signal?: AbortSignal
  ) {
    const form = new FormData();
    form.append("chunk", chunk, `chunk-${index}`);

    return withApiError(
      () =>
        httpClient.put<LanUploadStatus>(`/tools/lan-transfer/uploads/${uploadId}/chunks/${index}`, form, {
          onUploadProgress,
          signal
        }),
      "上传分片失败"
    );
  }

  async completeUpload(uploadId: string) {
    return withApiError(
      () => httpClient.post<LanUploadResponse>(`/tools/lan-transfer/uploads/${uploadId}/complete`),
      "合并文件失败"
    );
  }

  async cancelUpload(uploadId: string) {
    return withApiError(
      () => httpClient.delete<{ removed: boolean }>(`/tools/lan-transfer/uploads/${uploadId}`),
      "取消上传失败"
    );
  }

  async listFiles(params: LanFileListParams) {
    return withApiError(
      () =>
        httpClient.get<{ files: LanFileView[]; pagination: LanFilePagination }>("/tools/lan-transfer/files", {
          params
        }),
      "获取文件列表失败"
    );
  }

  async createNote(input: { title: string; content: string; images: File[] }) {
    const form = new FormData();
    form.append("title", input.title);
    form.append("content", input.content);
    input.images.forEach((image) => form.append("images", image, image.name));
    return withApiError(() => httpClient.post<LanNoteView>("/tools/lan-transfer/notes", form), "发布图文失败");
  }

  async listNotes(page = 1, pageSize = 20) {
    return withApiError(
      () =>
        httpClient.get<{ notes: LanNoteView[]; pagination: LanFilePagination }>("/tools/lan-transfer/notes", {
          params: { page, pageSize }
        }),
      "获取图文列表失败"
    );
  }

  async deleteNote(id: string) {
    return withApiError(
      () => httpClient.delete<{ removed: boolean }>(`/tools/lan-transfer/notes/${id}`),
      "删除图文失败"
    );
  }

  async deleteNotes(ids: string[]) {
    return withApiError(
      () =>
        httpClient.post<{ removed: string[]; missing: string[] }>("/tools/lan-transfer/notes/batch-delete", { ids }),
      "批量删除图文失败"
    );
  }

  async updateNoteExpiry(id: string, days: number) {
    return withApiError(
      () => httpClient.patch<LanNoteView>(`/tools/lan-transfer/notes/${id}/expiry`, { days }),
      "更新图文有效期失败"
    );
  }

  async getTextPreview(previewUrl: string) {
    return withApiError(() => httpClient.get<string>(previewUrl, { responseType: "text" }), "获取预览失败");
  }

  async deleteFile(id: string) {
    return withApiError(
      () => httpClient.delete<{ removed: boolean }>(`/tools/lan-transfer/files/${id}`),
      "删除文件失败"
    );
  }

  async deleteFiles(ids: string[]) {
    return withApiError(
      () =>
        httpClient.post<{ removed: string[]; missing: string[] }>("/tools/lan-transfer/files/batch-delete", { ids }),
      "批量删除文件失败"
    );
  }

  async downloadFiles(ids: string[]) {
    return withApiError(
      () => httpClient.postBlob("/tools/lan-transfer/files/batch-download", { ids }),
      "批量下载文件失败"
    );
  }

  async updateExpiry(id: string, days: number) {
    return withApiError(
      () => httpClient.patch<LanFileView>(`/tools/lan-transfer/files/${id}/expiry`, { days }),
      "更新文件有效期失败"
    );
  }
}

export const lanTransferApi = new LanTransferApi();
