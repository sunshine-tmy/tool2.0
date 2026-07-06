import { ApiRequest, httpClient } from "../../services/http";
import type { ImageToolResponse } from "../image-compress/api";

class FormatConvertApi {
  @ApiRequest("格式转换失败")
  async upload(form: FormData) {
    return httpClient.post<ImageToolResponse>("/tools/format-convert", form);
  }
}

export const formatConvertApi = new FormatConvertApi();
