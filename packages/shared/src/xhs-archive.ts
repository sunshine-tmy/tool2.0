export type XhsArchiveContentType = "image" | "video" | "live-photo" | "unknown";

export type XhsArchiveMediaKind = "image" | "video" | "cover" | "live-photo";

export type XhsArchiveAuthor = {
  id?: string;
  name?: string;
  avatarUrl?: string;
};

export type XhsArchiveTopic = {
  id: string;
  source: string;
};

export type XhsTranslationField = {
  source: string;
  machine: string;
  edited?: string;
  editedAt?: string;
};

export type XhsArchiveTranslation = {
  status: "queued" | "installing" | "translating" | "ready" | "failed" | "stale";
  sourceHash: string;
  sourceLanguage: "zh-CN";
  targetLanguage: "en";
  provider: "opus-mt";
  modelId: "Helsinki-NLP/opus-mt-zh-en";
  modelRevision: string;
  taskId?: string;
  title: XhsTranslationField;
  description?: XhsTranslationField;
  topics: Array<XhsTranslationField & { topicId: string }>;
  translatedAt?: string;
  error?: { code: string; message: string };
};

export type XhsTranslationRuntimeStatus = {
  status: "not-installed" | "installing" | "ready" | "failed";
  version: string;
  modelId: XhsArchiveTranslation["modelId"];
  modelRevision: string;
  providerUrl?: string;
  message: string;
  installProgress: number;
};

export type XhsTranslationTaskStage =
  | "queued"
  | "installing-runtime"
  | "downloading-model"
  | "loading-model"
  | "translating-title"
  | "translating-description"
  | "translating-topics"
  | "saving"
  | "completed"
  | "failed";

export type XhsTranslationTask = {
  id: string;
  itemIds: string[];
  status: "pending" | "running" | "completed" | "failed";
  stage: XhsTranslationTaskStage;
  progress: number;
  completedItems: number;
  totalItems: number;
  currentItemId?: string;
  message: string;
  error?: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
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
  topics: XhsArchiveTopic[];
  translation?: XhsArchiveTranslation;
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
