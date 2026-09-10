export type XhsArchiveContentType = "image" | "video" | "live-photo" | "unknown";

export type XhsArchiveMediaKind = "image" | "video" | "cover" | "live-photo";

export type XhsArchiveAuthor = {
  id?: string;
  name?: string;
  avatarUrl?: string;
};

export type XhsArchiveMedia = {
  id: string;
  kind: XhsArchiveMediaKind;
  index: number;
  fileName: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  durationMs?: number;
  checksum: string;
  previewUrl: string;
  downloadUrl: string;
};

export type XhsArchiveItem = {
  id: string;
  noteId: string;
  sourceUrl: string;
  canonicalUrl: string;
  type: XhsArchiveContentType;
  title: string;
  description?: string;
  author?: XhsArchiveAuthor;
  publishedAt?: string;
  fetchedAt: string;
  updatedAt: string;
  coverMediaId?: string;
  media: XhsArchiveMedia[];
  status: "ready" | "partial";
  warnings: string[];
  totalBytes: number;
};

export type XhsArchiveListItem = Omit<XhsArchiveItem, "media"> & {
  mediaCount: number;
  coverUrl?: string;
  coverKind?: XhsArchiveMediaKind;
};

export type XhsArchiveListResponse = {
  items: XhsArchiveListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type XhsArchiveTaskStage = "installing" | "parsing" | "downloading" | "archiving" | "completed" | "failed";

export type XhsArchiveTask = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  stage: XhsArchiveTaskStage;
  progress: number;
  message: string;
  archiveId?: string;
  error?: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
};

export type XhsRuntimeStatus = {
  status: "not-installed" | "installing" | "ready" | "failed";
  version: string;
  providerUrl?: string;
  message: string;
  installProgress: number;
  authenticated: boolean;
};

export type XhsAuthSession = {
  id: string;
  status: "pending" | "waiting" | "completed" | "failed";
  message: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
};
