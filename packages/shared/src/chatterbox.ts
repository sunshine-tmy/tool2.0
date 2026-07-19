export const CHATTERBOX_MAX_TEXT_LENGTH = 1_200;
export const CHATTERBOX_MAX_REFERENCE_BYTES = 20 * 1024 * 1024;
export const CHATTERBOX_MIN_REFERENCE_SECONDS = 5;
export const CHATTERBOX_MAX_REFERENCE_SECONDS = 30;

export const CHATTERBOX_LANGUAGES = ["ms", "en"] as const;
export type ChatterboxLanguage = (typeof CHATTERBOX_LANGUAGES)[number];

export type ChatterboxVoiceAuthorization = "self" | "authorized";
export type ChatterboxTaskStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export type ChatterboxTask = {
  id: string;
  engine: "chatterbox-multilingual-v3";
  status: ChatterboxTaskStatus;
  progress: number;
  text: string;
  language: ChatterboxLanguage;
  referenceFileName: string;
  referenceDurationSeconds: number;
  authorization: ChatterboxVoiceAuthorization;
  consentConfirmed: true;
  exaggeration: number;
  cfgWeight: number;
  temperature: number;
  seed: number;
  includeSubtitles: boolean;
  fileName?: string;
  characterCount: number;
  audioBytes?: number;
  audioDurationSeconds?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  audioUrl?: string;
  downloadUrl?: string;
  subtitleUrl?: string;
};

export type ChatterboxTaskSummary = Omit<ChatterboxTask, "text"> & {
  textPreview: string;
};

export type ChatterboxTaskList = {
  tasks: ChatterboxTaskSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type ChatterboxHealth = {
  available: boolean;
  workerAvailable: boolean;
  packageVersion?: string;
  model: "multilingual-v3";
  modelLoaded: boolean;
  device?: "cuda" | "cpu";
  gpuName?: string;
  message: string;
  reference: {
    maxBytes: number;
    minSeconds: number;
    maxSeconds: number;
  };
  maxTextLength: number;
  retentionDays: number;
  queue: {
    active: number;
    queued: number;
    concurrency: 1;
    limit: number;
  };
  watermarked: true;
};
