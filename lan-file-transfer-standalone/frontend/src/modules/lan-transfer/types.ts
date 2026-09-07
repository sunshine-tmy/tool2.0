import type {
  LanFileCategory,
  LanFileRecord,
  LanFileSortBy,
  LanFileSortOrder,
  LanNoteImageRecord,
  LanNoteRecord
} from "@toolbox/shared";

export type LanFileView = LanFileRecord & {
  previewUrl: string;
  downloadUrl: string;
};

export type LanNoteImageView = LanNoteImageRecord & {
  previewUrl: string;
  downloadUrl: string;
};

export type LanNoteView = Omit<LanNoteRecord, "images"> & {
  images: LanNoteImageView[];
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
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "paused" | "done" | "failed" | "canceled";
  uploader?: {
    pause: () => void;
    resume: () => Promise<void>;
    cancel: () => Promise<void>;
  };
};

export type LanTransferInfo = {
  lanUrls: string[];
  retentionDays: number;
  maxFileBytes: number;
  maxStorageBytes: number;
  usedBytes: number;
  noteCount: number;
  reservedUploadBytes: number;
  pinRequired: boolean;
  guestMode: "full" | "upload-only" | "download-only" | "disabled";
  authenticated: boolean;
};

export type PendingLanUpload = {
  uploadId: string;
  fingerprint: string;
  originalName: string;
  mimeType: string;
  size: number;
  lastModified: number;
  updatedAt: string;
};
