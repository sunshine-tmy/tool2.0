import { ApiRequest, httpClient } from "../../services/http";
import type { ToolTask } from "../../types";

export type ImageToolResponse = {
  task: ToolTask;
  downloadUrl: string;
};

class ImageCompressApi {
  @ApiRequest("图片压缩失败")
  async upload(form: FormData) {
    return httpClient.post<ImageToolResponse>("/tools/image-compress", form);
  }
}

export const imageCompressApi = new ImageCompressApi();
