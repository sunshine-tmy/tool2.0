import { ShortVideoParseResultSchema } from "@toolbox/shared";
import { httpClient, withApiError } from "../../services/http";
import type { ShortVideoRequest } from "./types";

class ShortVideoApi {
  async parse(input: ShortVideoRequest) {
    return withApiError(
      () => httpClient.post("/tools/short-video/parse", ShortVideoParseResultSchema, input),
      "短视频解析失败"
    );
  }
}

export const shortVideoApi = new ShortVideoApi();
