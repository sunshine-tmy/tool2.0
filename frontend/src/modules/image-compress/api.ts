import type { AxiosProgressEvent } from "axios";
import { httpClient, withApiError } from "../../services/http";
import type { ToolTask } from "../../types";

export type ImageToolResponse = {
  task: ToolTask;
  downloadUrl: string;
  originalName: string;
  outputName: string;
  outputFormat: "jpeg" | "png" | "webp";
  originalSize: number;
  outputSize: number;
  savedBytes: number;
  compressionRatio: number;
  width?: number;
  height?: number;
};

class ImageCompressApi {
  async upload(form: FormData, onUploadProgress?: (event: AxiosProgressEvent) => void) {
    return withApiError(
      () => httpClient.post<ImageToolResponse>("/tools/image-compress", form, { onUploadProgress }),
      "图片压缩失败"
    );
  }

  async downloadAll(files: Array<{ taskId: string; fileName: string }>) {
    return withApiError(() => httpClient.postBlob("/tools/image-compress/download.zip", { files }), "批量下载失败");
  }
}

export const imageCompressApi = new ImageCompressApi();
