import { ApiFailureSchema, type LanFileRecord } from "@toolbox/shared";

export type LanFileListResponse = {
  files: Array<LanFileRecord & { previewUrl: string; downloadUrl: string }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
};

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
  507: ApiFailureSchema
};
