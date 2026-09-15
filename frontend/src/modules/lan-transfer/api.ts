import type { AxiosProgressEvent } from "axios";
import {
  LanAccessResultSchema,
  LanBatchRemovalSchema,
  LanFileListSchema,
  LanFileUploadResultSchema,
  LanFileWithUrlsSchema,
  LanNoteListSchema,
  LanNoteSchema,
  LanRemovalSchema,
  LanTransferInfoSchema,
  LanUploadStatusSchema
} from "@toolbox/shared";
import { httpClient, withApiError } from "../../services/http";
import type { CreateLanUploadSessionInput, LanFileListParams } from "./types";

class LanTransferApi {
  async getInfo() {
    return withApiError(
      () => httpClient.get("/tools/lan-transfer/info", LanTransferInfoSchema),
      "获取传输服务信息失败"
    );
  }

  async unlock(pin: string) {
    return withApiError(
      () => httpClient.post("/tools/lan-transfer/access", LanAccessResultSchema, { pin }),
      "访问 PIN 不正确"
    );
  }
  async uploadFile(file: File, onUploadProgress?: (event: AxiosProgressEvent) => void) {
    const form = new FormData();
    form.append("file", file);

    return withApiError(
      () => httpClient.post("/tools/lan-transfer/files", LanFileUploadResultSchema, form, { onUploadProgress }),
      "上传文件失败"
    );
  }

  async createUploadSession(input: CreateLanUploadSessionInput, signal?: AbortSignal) {
    return withApiError(
      () => httpClient.post("/tools/lan-transfer/uploads", LanUploadStatusSchema, input, { signal }),
      "创建上传会话失败"
    );
  }

  async getUploadStatus(uploadId: string, signal?: AbortSignal) {
    return withApiError(
      () => httpClient.get(`/tools/lan-transfer/uploads/${uploadId}`, LanUploadStatusSchema, { signal }),
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
        httpClient.put(`/tools/lan-transfer/uploads/${uploadId}/chunks/${index}`, LanUploadStatusSchema, form, {
          onUploadProgress,
          signal
        }),
      "上传分片失败"
    );
  }

  async completeUpload(uploadId: string, signal?: AbortSignal) {
    return withApiError(
      () =>
        httpClient.post(`/tools/lan-transfer/uploads/${uploadId}/complete`, LanFileUploadResultSchema, undefined, {
          signal
        }),
      "合并文件失败"
    );
  }

  async cancelUpload(uploadId: string, signal?: AbortSignal) {
    return withApiError(
      () => httpClient.delete(`/tools/lan-transfer/uploads/${uploadId}`, LanRemovalSchema, { signal }),
      "取消上传失败"
    );
  }

  async listFiles(params: LanFileListParams) {
    return withApiError(
      () =>
        httpClient.get("/tools/lan-transfer/files", LanFileListSchema, {
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
    return withApiError(() => httpClient.post("/tools/lan-transfer/notes", LanNoteSchema, form), "发布图文失败");
  }

  async listNotes(page = 1, pageSize = 20) {
    return withApiError(
      () =>
        httpClient.get("/tools/lan-transfer/notes", LanNoteListSchema, {
          params: { page, pageSize }
        }),
      "获取图文列表失败"
    );
  }

  async deleteNote(id: string) {
    return withApiError(() => httpClient.delete(`/tools/lan-transfer/notes/${id}`, LanRemovalSchema), "删除图文失败");
  }

  async deleteNotes(ids: string[]) {
    return withApiError(
      () => httpClient.post("/tools/lan-transfer/notes/batch-delete", LanBatchRemovalSchema, { ids }),
      "批量删除图文失败"
    );
  }

  async updateNoteExpiry(id: string, days: number) {
    return withApiError(
      () => httpClient.patch(`/tools/lan-transfer/notes/${id}/expiry`, LanNoteSchema, { days }),
      "更新图文有效期失败"
    );
  }

  async getTextPreview(previewUrl: string) {
    return withApiError(() => httpClient.getText(previewUrl), "获取预览失败");
  }

  async deleteFile(id: string) {
    return withApiError(() => httpClient.delete(`/tools/lan-transfer/files/${id}`, LanRemovalSchema), "删除文件失败");
  }

  async deleteFiles(ids: string[]) {
    return withApiError(
      () => httpClient.post("/tools/lan-transfer/files/batch-delete", LanBatchRemovalSchema, { ids }),
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
      () => httpClient.patch(`/tools/lan-transfer/files/${id}/expiry`, LanFileWithUrlsSchema, { days }),
      "更新文件有效期失败"
    );
  }
}

export const lanTransferApi = new LanTransferApi();
