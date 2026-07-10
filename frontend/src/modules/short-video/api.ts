import { ApiRequest, httpClient } from "../../services/http";
import type { ShortVideoRequest, ShortVideoResult } from "./types";

class ShortVideoApi {
  @ApiRequest("短视频解析失败")
  async parse(input: ShortVideoRequest) {
    return httpClient.post<ShortVideoResult>("/tools/short-video/parse", input);
  }
}

export const shortVideoApi = new ShortVideoApi();
