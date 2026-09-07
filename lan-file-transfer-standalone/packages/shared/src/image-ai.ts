export const imageAiOperations = ["watermark_remove", "enhance", "background_remove"] as const;

export type ImageAiOperation = (typeof imageAiOperations)[number];

export type ImageAiTaskStatus = "pending" | "running" | "completed" | "failed" | "canceled";

export type ImageAiProvider = "lama" | "real-esrgan" | "bria-rmbg-2.0" | "birefnet-general";

export type ImageAiResult = {
  id: string;
  originalName: string;
  outputName: string;
  downloadUrl: string;
  width: number;
  height: number;
  provider: ImageAiProvider;
  model: string;
  warnings: string[];
};

export type ImageAiTask = {
  id: string;
  operation: ImageAiOperation;
  status: ImageAiTaskStatus;
  progress: number;
  queuePosition: number | null;
  scale?: 2 | 4;
  results: ImageAiResult[];
  warnings: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type WatermarkSuggestion = {
  polygon: Array<{ x: number; y: number }>;
  confidence: number;
};

export type WatermarkSuggestionResponse = {
  width: number;
  height: number;
  suggestions: WatermarkSuggestion[];
  provider: "paddleocr";
  model: string;
  warnings: string[];
};

export type ImageAiModelHealth = {
  provider: string;
  model: string;
  version: string;
  license: string;
  sha256?: string;
  device: string;
  available: boolean;
  reason?: string;
};

export type ImageAiInstallationStatus = "not-installed" | "installing" | "installed" | "failed";

export type ImageAiInstallStage =
  | "preparing"
  | "python"
  | "environment"
  | "pytorch"
  | "dependencies"
  | "model-weights"
  | "birefnet"
  | "lama"
  | "ocr"
  | "finalizing"
  | "completed"
  | "failed";

export type ImageAiInstallation = {
  status: ImageAiInstallationStatus;
  pythonInstalled: boolean;
  runtimeInstalled: boolean;
  installerAvailable: boolean;
  platform: "windows" | "macos" | "unsupported";
  message?: string;
  stage?: ImageAiInstallStage;
  progress?: number;
  startedAt?: string;
  activityAt?: string;
  updatedAt?: string;
};

export type ImageAiHealth = {
  available: boolean;
  deploymentUsage: "internal-noncommercial" | "commercial";
  workerUrl: string;
  models: ImageAiModelHealth[];
  installation: ImageAiInstallation;
};

export function isImageAiOperation(value: unknown): value is ImageAiOperation {
  return typeof value === "string" && imageAiOperations.includes(value as ImageAiOperation);
}
