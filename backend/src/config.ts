import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));

export type AppConfig = {
  host: string;
  port: number;
  corsOrigins: string[];
  storageRoot: string;
  uploadDir: string;
  outputDir: string;
  tempDir: string;
  lanTransferDir: string;
  lanTransferFilesDir: string;
  lanTransferIndexPath: string;
  lanTransferMaxFileBytes: number;
  lanTransferRetentionDays: number;
  videoTextUploadsDir: string;
  videoTextAudioDir: string;
  videoTextResultsDir: string;
  videoTextAudioExtractCommand: string;
  videoTextTranscribeCommand?: string;
  shortVideoParseApiUrl: string;
  shortVideoParseTimeoutMs: number;
  remoteFetchTimeoutMs: number;
  remoteMediaMaxBytes: number;
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
  const storageRoot = resolveProjectPath(getEnv("STORAGE_ROOT", fileEnv) ?? "storage");

  const imageAiDir = path.join(storageRoot, "image-ai");
  const configuredUsage = getEnv("DEPLOYMENT_USAGE", fileEnv)?.trim();

  return {
    host: getEnv("API_HOST", fileEnv)?.trim() || "127.0.0.1",
    port: readInteger("API_PORT", getEnv("API_PORT", fileEnv), 3100, 1, 65535),
    corsOrigins: readCorsOrigins(fileEnv),
    storageRoot,
    uploadDir: path.join(storageRoot, "uploads"),
    outputDir: path.join(storageRoot, "outputs"),
    tempDir: path.join(storageRoot, "temp"),
    lanTransferDir: path.join(storageRoot, "lan-transfer"),
    lanTransferFilesDir: path.join(storageRoot, "lan-transfer", "files"),
    lanTransferIndexPath: path.join(storageRoot, "lan-transfer", "index.json"),
    lanTransferMaxFileBytes: readInteger(
      "LAN_TRANSFER_MAX_FILE_BYTES",
      getEnv("LAN_TRANSFER_MAX_FILE_BYTES", fileEnv),
      20 * 1024 * 1024 * 1024,
      1
    ),
    lanTransferRetentionDays: readInteger(
      "LAN_TRANSFER_RETENTION_DAYS",
      getEnv("LAN_TRANSFER_RETENTION_DAYS", fileEnv),
      7,
      1,
      3650
    ),
    videoTextUploadsDir: path.join(storageRoot, "video-text", "uploads"),
    videoTextAudioDir: path.join(storageRoot, "video-text", "audio"),
    videoTextResultsDir: path.join(storageRoot, "video-text", "results"),
    videoTextAudioExtractCommand:
      getEnv("VIDEO_TEXT_AUDIO_EXTRACT_COMMAND", fileEnv)?.trim() ||
      "ffmpeg -y -i {input} -vn -acodec pcm_s16le -ar 16000 -ac 1 {output}",
    videoTextTranscribeCommand: getEnv("VIDEO_TEXT_TRANSCRIBE_COMMAND", fileEnv)?.trim() || undefined,
    shortVideoParseApiUrl:
      getEnv("SHORT_VIDEO_PARSE_API_URL", fileEnv)?.trim() || "https://api.bugpk.com/api/short_videos",
    shortVideoParseTimeoutMs: readInteger(
      "SHORT_VIDEO_PARSE_TIMEOUT_MS",
      getEnv("SHORT_VIDEO_PARSE_TIMEOUT_MS", fileEnv),
      20000,
      1000,
      120000
    ),
    remoteFetchTimeoutMs: readInteger(
      "REMOTE_FETCH_TIMEOUT_MS",
      getEnv("REMOTE_FETCH_TIMEOUT_MS", fileEnv),
      120000,
      1000,
      30 * 60 * 1000
    ),
    remoteMediaMaxBytes: readInteger(
      "REMOTE_MEDIA_MAX_BYTES",
      getEnv("REMOTE_MEDIA_MAX_BYTES", fileEnv),
      2 * 1024 * 1024 * 1024,
      1
    ),
    imageAiDir,
    imageAiInputsDir: path.join(imageAiDir, "inputs"),
    imageAiOutputsDir: path.join(imageAiDir, "outputs"),
    imageAiTasksDir: path.join(imageAiDir, "tasks"),
    imageAiWorkerUrl: getEnv("IMAGE_AI_WORKER_URL", fileEnv)?.trim() || "http://127.0.0.1:3210",
    imageAiWorkerTimeoutMs: readInteger(
      "IMAGE_AI_WORKER_TIMEOUT_MS",
      getEnv("IMAGE_AI_WORKER_TIMEOUT_MS", fileEnv),
      5 * 60 * 1000,
      1000
    ),
    imageAiRetentionHours: readInteger(
      "IMAGE_AI_RETENTION_HOURS",
      getEnv("IMAGE_AI_RETENTION_HOURS", fileEnv),
      24,
      1,
      8760
    ),
    imageAiQueueLimit: readInteger("IMAGE_AI_QUEUE_LIMIT", getEnv("IMAGE_AI_QUEUE_LIMIT", fileEnv), 20, 1, 1000),
    deploymentUsage: configuredUsage === "internal-noncommercial" ? "internal-noncommercial" : "commercial"
  };
}

function getEnv(name: string, fileEnv: Record<string, string>) {
  return process.env[name] ?? fileEnv[name];
}

function loadDotEnv() {
  const candidates = [path.join(projectRoot, ".env"), path.resolve(process.cwd(), ".env")];
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

function resolveProjectPath(value: string) {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(projectRoot, value);
}

function readInteger(
  name: string,
  value: string | undefined,
  fallback: number,
  min: number,
  max = Number.MAX_SAFE_INTEGER
) {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function readCorsOrigins(fileEnv: Record<string, string>) {
  const configured = getEnv("CORS_ORIGINS", fileEnv)
    ?.split(",")
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));
  if (configured?.length) return [...new Set(configured)];

  const defaults = ["http://127.0.0.1:5173", "http://localhost:5173"];
  const legacyApiUrl = getEnv("VITE_API_BASE", fileEnv) || getEnv("LAN_PUBLIC_BASE_URL", fileEnv);
  if (legacyApiUrl) {
    try {
      const url = new URL(legacyApiUrl);
      defaults.push(`${url.protocol}//${url.hostname}:5173`);
    } catch {
      // Invalid frontend URLs are ignored here; Vite validates its own configuration.
    }
  }
  return [...new Set(defaults)];
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value.trim()).origin;
  } catch {
    return "";
  }
}

function unquoteEnvValue(value: string) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
