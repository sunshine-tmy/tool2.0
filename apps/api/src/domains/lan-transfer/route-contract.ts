/**
 * 中文模块说明：局域网文件与图文传输领域，负责上传、分片、预览、下载和清理
 */
import { ApiFailureSchema } from "@toolbox/shared/common";
import type { LanFileList } from "@toolbox/shared/lan";

export type LanFileListResponse = LanFileList;

export const lanFailureResponses = {
  400: ApiFailureSchema,
  401: ApiFailureSchema,
  403: ApiFailureSchema,
  404: ApiFailureSchema,
  409: ApiFailureSchema,
  413: ApiFailureSchema,
  415: ApiFailureSchema,
  429: ApiFailureSchema,
  500: ApiFailureSchema,
  503: ApiFailureSchema,
  507: ApiFailureSchema
};
