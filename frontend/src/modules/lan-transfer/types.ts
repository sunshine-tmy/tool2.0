import type {
  LanFileListQuery,
  LanFileUploadResult,
  LanFileWithUrls,
  LanNote,
  LanTransferInfo as SharedLanTransferInfo,
  LanUploadSessionInput,
  LanUploadStatus as SharedLanUploadStatus
} from "@toolbox/shared";

export type LanFileView = LanFileWithUrls;
export type LanNoteView = LanNote;

export type LanFileListParams = Pick<
  LanFileListQuery,
  "keyword" | "category" | "extension" | "sortBy" | "sortOrder" | "page" | "pageSize"
>;
export type LanUploadResponse = LanFileUploadResult;
export type LanUploadStatus = SharedLanUploadStatus;
export type CreateLanUploadSessionInput = LanUploadSessionInput;

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

export type LanTransferInfo = SharedLanTransferInfo;

export type PendingLanUpload = {
  uploadId: string;
  fingerprint: string;
  originalName: string;
  mimeType: string;
  size: number;
  lastModified: number;
  updatedAt: string;
};
