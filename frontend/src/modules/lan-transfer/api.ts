import type { AxiosProgressEvent } from "axios";
import { httpClient, withApiError } from "../../services/http";
import type {
  CreateLanUploadSessionInput,
  LanFileListParams,
  LanFilePagination,
  LanFileView,
  LanUploadResponse,
  LanUploadStatus
} from "./types";

class LanTransferApi {
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
    onUploadProgress?: (event: { loaded: number; total?: number }) => void
  ) {
    const form = new FormData();
    form.append("chunk", chunk, `chunk-${index}`);

    return withApiError(
      () =>
        httpClient.put<LanUploadStatus>(`/tools/lan-transfer/uploads/${uploadId}/chunks/${index}`, form, {
          onUploadProgress
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

  async getTextPreview(previewUrl: string) {
    return withApiError(() => httpClient.get<string>(previewUrl, { responseType: "text" }), "获取预览失败");
  }

  async deleteFile(id: string) {
    return withApiError(
      () => httpClient.delete<{ removed: boolean }>(`/tools/lan-transfer/files/${id}`),
      "删除文件失败"
    );
  }
}

export const lanTransferApi = new LanTransferApi();
