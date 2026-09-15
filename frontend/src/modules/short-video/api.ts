/**
 * 中文模块说明：短视频前端模块，负责链接解析、下载和历史操作
 */
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
