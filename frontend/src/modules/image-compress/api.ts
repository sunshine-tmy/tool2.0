import type { AxiosProgressEvent } from "axios";
import { ApiRequest, httpClient } from "../../services/http";
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
  @ApiRequest("图片压缩失败")
  async upload(form: FormData, onUploadProgress?: (event: AxiosProgressEvent) => void) {
    return httpClient.post<ImageToolResponse>("/tools/image-compress", form, {
      onUploadProgress
    });
  }
}

export const imageCompressApi = new ImageCompressApi();
