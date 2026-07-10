import fs from "node:fs";
import path from "node:path";

export type AppConfig = {
  host: string;
  port: number;
  storageRoot: string;
  uploadDir: string;
  outputDir: string;
  tempDir: string;
  lanTransferDir: string;
  lanTransferFilesDir: string;
  lanTransferIndexPath: string;
  lanTransferMaxFileBytes: number;
  lanTransferRetentionDays: number;
  lanPublicBaseUrl: string;
  videoTextDir: string;
  videoTextUploadsDir: string;
  videoTextAudioDir: string;
  videoTextResultsDir: string;
  videoTextAudioExtractCommand: string;
  videoTextTranscribeCommand?: string;
  shortVideoParseApiUrl: string;
  shortVideoParseTimeoutMs: number;
  imageAiDir: string;
  imageAiInputsDir: string;
  imageAiOutputsDir: string;
  imageAiTasksDir: string;
  imageAiWorkerUrl: string;
  imageAiWorkerTimeoutMs: number;
  imageAiRetentionHours: number;
  imageAiQueueLimit: number;
  deploymentUsage: "internal-noncommercial" | "commercial";
};

export function getConfig(): AppConfig {
  const fileEnv = loadDotEnv();
  const storageRoot = path.resolve(getEnv("STORAGE_ROOT", fileEnv) ?? "storage");

  const imageAiDir = path.join(storageRoot, "image-ai");
  const configuredUsage = getEnv("DEPLOYMENT_USAGE", fileEnv)?.trim();

  return {
    host: getEnv("API_HOST", fileEnv) ?? "0.0.0.0",
    port: Number(getEnv("API_PORT", fileEnv) ?? 3100),
    storageRoot,
    uploadDir: path.join(storageRoot, "uploads"),
    outputDir: path.join(storageRoot, "outputs"),
    tempDir: path.join(storageRoot, "temp"),
    lanTransferDir: path.join(storageRoot, "lan-transfer"),
    lanTransferFilesDir: path.join(storageRoot, "lan-transfer", "files"),
    lanTransferIndexPath: path.join(storageRoot, "lan-transfer", "index.json"),
    lanTransferMaxFileBytes: Number(getEnv("LAN_TRANSFER_MAX_FILE_BYTES", fileEnv) ?? 20 * 1024 * 1024 * 1024),
    lanTransferRetentionDays: Number(getEnv("LAN_TRANSFER_RETENTION_DAYS", fileEnv) ?? 7),
    lanPublicBaseUrl: getEnv("LAN_PUBLIC_BASE_URL", fileEnv) ?? "http://192.168.1.241:3100",
    videoTextDir: path.join(storageRoot, "video-text"),
    videoTextUploadsDir: path.join(storageRoot, "video-text", "uploads"),
    videoTextAudioDir: path.join(storageRoot, "video-text", "audio"),
    videoTextResultsDir: path.join(storageRoot, "video-text", "results"),
    videoTextAudioExtractCommand:
      getEnv("VIDEO_TEXT_AUDIO_EXTRACT_COMMAND", fileEnv)?.trim() ||
      "ffmpeg -y -i {input} -vn -acodec pcm_s16le -ar 16000 -ac 1 {output}",
    videoTextTranscribeCommand: getEnv("VIDEO_TEXT_TRANSCRIBE_COMMAND", fileEnv)?.trim() || undefined,
    shortVideoParseApiUrl:
      getEnv("SHORT_VIDEO_PARSE_API_URL", fileEnv)?.trim() || "https://api.bugpk.com/api/short_videos",
    shortVideoParseTimeoutMs: Number(getEnv("SHORT_VIDEO_PARSE_TIMEOUT_MS", fileEnv) ?? 20000),
    imageAiDir,
    imageAiInputsDir: path.join(imageAiDir, "inputs"),
    imageAiOutputsDir: path.join(imageAiDir, "outputs"),
    imageAiTasksDir: path.join(imageAiDir, "tasks"),
    imageAiWorkerUrl: getEnv("IMAGE_AI_WORKER_URL", fileEnv)?.trim() || "http://127.0.0.1:3210",
    imageAiWorkerTimeoutMs: Number(getEnv("IMAGE_AI_WORKER_TIMEOUT_MS", fileEnv) ?? 5 * 60 * 1000),
    imageAiRetentionHours: Number(getEnv("IMAGE_AI_RETENTION_HOURS", fileEnv) ?? 24),
    imageAiQueueLimit: Number(getEnv("IMAGE_AI_QUEUE_LIMIT", fileEnv) ?? 20),
    deploymentUsage: configuredUsage === "internal-noncommercial" ? "internal-noncommercial" : "commercial"
  };
}

function getEnv(name: string, fileEnv: Record<string, string>) {
  return process.env[name] ?? fileEnv[name];
}

function loadDotEnv() {
  const candidates = [path.resolve(process.cwd(), ".env"), path.resolve(process.cwd(), "..", ".env")];
  const env: Record<string, string> = {};

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const content = fs.readFileSync(candidate, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator <= 0) continue;
      const key = trimmed.slice(0, separator).trim();
      const rawValue = trimmed.slice(separator + 1).trim();
      env[key] = unquoteEnvValue(rawValue);
    }
    break;
  }

  return env;
}

function unquoteEnvValue(value: string) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
