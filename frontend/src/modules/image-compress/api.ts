import type { AxiosProgressEvent } from "axios";
import { ImageCompressResultSchema, type ImageCompressResult } from "@toolbox/shared";
import { httpClient, withApiError } from "../../services/http";

export type ImageToolResponse = ImageCompressResult;

class ImageCompressApi {
  async upload(form: FormData, onUploadProgress?: (event: AxiosProgressEvent) => void) {
    return withApiError(
      () => httpClient.post("/tools/image-compress", ImageCompressResultSchema, form, { onUploadProgress }),
      "图片压缩失败"
    );
  }

  async downloadAll(files: Array<{ taskId: string; fileName: string }>) {
    return withApiError(() => httpClient.postBlob("/tools/image-compress/download.zip", { files }), "批量下载失败");
  }
}

export const imageCompressApi = new ImageCompressApi();
