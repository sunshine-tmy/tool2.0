import { httpClient, withApiError } from "../../services/http";
import type { ShortVideoRequest, ShortVideoResult } from "./types";

class ShortVideoApi {
  async parse(input: ShortVideoRequest) {
    return withApiError(() => httpClient.post<ShortVideoResult>("/tools/short-video/parse", input), "短视频解析失败");
  }
}

export const shortVideoApi = new ShortVideoApi();
