export const EDGE_TTS_MAX_TEXT_LENGTH = 20_000;

export const EDGE_TTS_LANGUAGES = ["ms-MY", "en-US", "en-GB", "pt-BR"] as const;

export type EdgeTtsLanguage = (typeof EDGE_TTS_LANGUAGES)[number];

export type EdgeTtsTaskStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export type EdgeTtsVoice = {
  name: string;
  shortName: string;
  locale: string;
  gender: "Female" | "Male" | "Neutral";
  suggested: boolean;
};

export type EdgeTtsCreateTaskInput = {
  text: string;
  language: EdgeTtsLanguage;
  voice: string;
  rate: number;
  volume: number;
  pitch: number;
  includeSubtitles: boolean;
  fileName?: string;
};

export type EdgeTtsTask = EdgeTtsCreateTaskInput & {
  id: string;
  status: EdgeTtsTaskStatus;
  progress: number;
  characterCount: number;
  audioBytes?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  audioUrl?: string;
  downloadUrl?: string;
  subtitleUrl?: string;
};

export type EdgeTtsTaskSummary = Omit<EdgeTtsTask, "text"> & {
  textPreview: string;
};

export type EdgeTtsTaskList = {
  tasks: EdgeTtsTaskSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type EdgeTtsHealth = {
  available: boolean;
  version?: string;
  message: string;
  queue: {
    active: number;
    queued: number;
    concurrency: number;
    limit: number;
  };
  retentionDays: number;
  maxTextLength: number;
  onlineService: true;
};

export const EDGE_TTS_RECOMMENDED_VOICES: EdgeTtsVoice[] = [
  {
    name: "Microsoft Yasmin Online (Natural) - Malay (Malaysia)",
    shortName: "ms-MY-YasminNeural",
    locale: "ms-MY",
    gender: "Female",
    suggested: true
  },
  {
    name: "Microsoft Osman Online (Natural) - Malay (Malaysia)",
    shortName: "ms-MY-OsmanNeural",
    locale: "ms-MY",
    gender: "Male",
    suggested: true
  },
  {
    name: "Microsoft Jenny Online (Natural) - English (United States)",
    shortName: "en-US-JennyNeural",
    locale: "en-US",
    gender: "Female",
    suggested: true
  },
  {
    name: "Microsoft Guy Online (Natural) - English (United States)",
    shortName: "en-US-GuyNeural",
    locale: "en-US",
    gender: "Male",
    suggested: true
  },
  {
    name: "Microsoft Sonia Online (Natural) - English (United Kingdom)",
    shortName: "en-GB-SoniaNeural",
    locale: "en-GB",
    gender: "Female",
    suggested: true
  },
  {
    name: "Microsoft Ryan Online (Natural) - English (United Kingdom)",
    shortName: "en-GB-RyanNeural",
    locale: "en-GB",
    gender: "Male",
    suggested: true
  },
  {
    name: "Microsoft Francisca Online (Natural) - Portuguese (Brazil)",
    shortName: "pt-BR-FranciscaNeural",
    locale: "pt-BR",
    gender: "Female",
    suggested: true
  },
  {
    name: "Microsoft Antonio Online (Natural) - Portuguese (Brazil)",
    shortName: "pt-BR-AntonioNeural",
    locale: "pt-BR",
    gender: "Male",
    suggested: true
  }
];
