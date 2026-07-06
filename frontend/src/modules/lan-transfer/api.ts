import type { AxiosProgressEvent } from "axios";
import { ApiRequest, httpClient } from "../../services/http";
import type {
  CreateLanUploadSessionInput,
  LanFileListParams,
  LanFilePagination,
  LanFileView,
  LanUploadResponse,
  LanUploadStatus
} from "./types";

class LanTransferApi {
  @ApiRequest("上传文件失败")
  async uploadFile(file: File, onUploadProgress?: (event: AxiosProgressEvent) => void) {
    const form = new FormData();
    form.append("file", file);

    return httpClient.post<LanUploadResponse>("/tools/lan-transfer/files", form, {
      onUploadProgress
    });
  }

  @ApiRequest("创建上传会话失败")
  async createUploadSession(input: CreateLanUploadSessionInput) {
    return httpClient.post<LanUploadStatus>("/tools/lan-transfer/uploads", input);
  }

  @ApiRequest("获取上传状态失败")
  async getUploadStatus(uploadId: string) {
    return httpClient.get<LanUploadStatus>(`/tools/lan-transfer/uploads/${uploadId}`);
  }

  @ApiRequest("上传分片失败")
  async uploadChunk(
    uploadId: string,
    index: number,
    chunk: Blob,
    onUploadProgress?: (event: { loaded: number; total?: number }) => void
  ) {
    const form = new FormData();
    form.append("chunk", chunk, `chunk-${index}`);

    return httpClient.put<LanUploadStatus>(`/tools/lan-transfer/uploads/${uploadId}/chunks/${index}`, form, {
      onUploadProgress
    });
  }

  @ApiRequest("合并文件失败")
  async completeUpload(uploadId: string) {
    return httpClient.post<LanUploadResponse>(`/tools/lan-transfer/uploads/${uploadId}/complete`);
  }

  @ApiRequest("取消上传失败")
  async cancelUpload(uploadId: string) {
    return httpClient.delete<{ removed: boolean }>(`/tools/lan-transfer/uploads/${uploadId}`);
  }

  @ApiRequest("获取文件列表失败")
  async listFiles(params: LanFileListParams) {
    return httpClient.get<{ files: LanFileView[]; pagination: LanFilePagination }>("/tools/lan-transfer/files", {
      params
    });
  }

  @ApiRequest("获取预览失败")
  async getTextPreview(previewUrl: string) {
    return httpClient.get<string>(previewUrl, {
      responseType: "text"
    });
  }

  @ApiRequest("删除文件失败")
  async deleteFile(id: string) {
    return httpClient.delete<{ removed: boolean }>(`/tools/lan-transfer/files/${id}`);
  }
}

export const lanTransferApi = new LanTransferApi();
