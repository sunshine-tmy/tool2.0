import type { LanFileCategory, LanFileRecord, LanFileSortBy, LanFileSortOrder } from "@toolbox/shared";

export type LanFileView = LanFileRecord & {
  previewUrl: string;
  downloadUrl: string;
};

export type LanFileListParams = {
  keyword?: string;
  category?: LanFileCategory;
  extension?: string;
  sortBy?: LanFileSortBy;
  sortOrder?: LanFileSortOrder;
  page?: number;
  pageSize?: number;
};

export type LanFilePagination = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

export type LanUploadResponse = {
  file: LanFileRecord;
  previewUrl: string;
  downloadUrl: string;
};

export type LanUploadStatus = {
  uploadId: string;
  originalName: string;
  mimeType: string;
  size: number;
  chunkSize: number;
  totalChunks: number;
  uploadedChunks: number[];
  uploadedBytes: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateLanUploadSessionInput = {
  originalName: string;
  mimeType: string;
  size: number;
  chunkSize: number;
  totalChunks: number;
};

export type UploadItem = {
  name: string;
  progress: number;
  status: "uploading" | "paused" | "done" | "failed" | "canceled";
  uploader?: {
    pause: () => void;
    resume: () => Promise<void>;
    cancel: () => Promise<void>;
  };
};
