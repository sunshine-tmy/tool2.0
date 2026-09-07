import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));

export type AppConfig = {
  projectRoot: string;
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
  lanTransferUploadRetentionHours: number;
  lanTransferCleanupIntervalMinutes: number;
  lanTransferMaxStorageBytes: number;
  lanTransferWebPort: number;
  lanTransferPin?: string;
  lanTransferGuestMode: "full" | "upload-only" | "download-only" | "disabled";
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
  const lanTransferDir = path.join(storageRoot, "lan-transfer");
  const imageAiDir = path.join(storageRoot, "image-ai");
  const configuredUsage = getEnv("DEPLOYMENT_USAGE", fileEnv)?.trim();

  return {
    projectRoot,
    host: getEnv("API_HOST", fileEnv)?.trim() || "127.0.0.1",
    port: readInteger("API_PORT", getEnv("API_PORT", fileEnv), 3110, 1, 65535),
    storageRoot,
    uploadDir: path.join(storageRoot, "uploads"),
    outputDir: path.join(storageRoot, "outputs"),
    tempDir: path.join(storageRoot, "temp"),
    lanTransferDir,
    lanTransferFilesDir: path.join(lanTransferDir, "files"),
    lanTransferIndexPath: path.join(lanTransferDir, "index.json"),
    lanTransferMaxFileBytes: readInteger(
      "LAN_TRANSFER_MAX_FILE_BYTES",
      getEnv("LAN_TRANSFER_MAX_FILE_BYTES", fileEnv),
      20 * 1024 * 1024 * 1024,
      1
    ),
    lanTransferRetentionDays: readInteger(
      "LAN_TRANSFER_RETENTION_DAYS",
      getEnv("LAN_TRANSFER_RETENTION_DAYS", fileEnv),
      3,
      1,
      3650
    ),
    lanTransferUploadRetentionHours: readInteger(
      "LAN_TRANSFER_UPLOAD_RETENTION_HOURS",
      getEnv("LAN_TRANSFER_UPLOAD_RETENTION_HOURS", fileEnv),
      24,
      1,
      24 * 30
    ),
    lanTransferCleanupIntervalMinutes: readInteger(
      "LAN_TRANSFER_CLEANUP_INTERVAL_MINUTES",
      getEnv("LAN_TRANSFER_CLEANUP_INTERVAL_MINUTES", fileEnv),
      15,
      1,
      24 * 60
    ),
    lanTransferMaxStorageBytes: readInteger(
      "LAN_TRANSFER_MAX_STORAGE_BYTES",
      getEnv("LAN_TRANSFER_MAX_STORAGE_BYTES", fileEnv),
      100 * 1024 * 1024 * 1024,
      1
    ),
    lanTransferWebPort: readInteger(
      "LAN_TRANSFER_WEB_PORT",
      getEnv("LAN_TRANSFER_WEB_PORT", fileEnv),
      5183,
      1,
      65535
    ),
    lanTransferPin: getEnv("LAN_TRANSFER_PIN", fileEnv)?.trim() || undefined,
    lanTransferGuestMode: readGuestMode(getEnv("LAN_TRANSFER_GUEST_MODE", fileEnv)),
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
    imageAiQueueLimit: readInteger(
      "IMAGE_AI_QUEUE_LIMIT",
      getEnv("IMAGE_AI_QUEUE_LIMIT", fileEnv),
      20,
      1,
      1000
    ),
    deploymentUsage: configuredUsage === "internal-noncommercial" ? "internal-noncommercial" : "commercial"
  };
}

function getEnv(name: string, fileEnv: Record<string, string>) {
  return process.env[name] ?? fileEnv[name];
}

function loadDotEnv() {
  const env: Record<string, string> = {};
  const candidates = [path.join(projectRoot, ".env"), path.resolve(process.cwd(), ".env")];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    for (const line of fs.readFileSync(candidate, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator <= 0) continue;
      const key = trimmed.slice(0, separator).trim();
      const rawValue = trimmed.slice(separator + 1).trim();
      env[key] = unquote(rawValue);
    }
    break;
  }
  return env;
}

function resolveProjectPath(value: string) {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(projectRoot, value);
}

function readInteger(name: string, value: string | undefined, fallback: number, min: number, max = Number.MAX_SAFE_INTEGER) {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function readGuestMode(value: string | undefined): AppConfig["lanTransferGuestMode"] {
  const normalized = value?.trim().toLowerCase() || "full";
  if (["full", "upload-only", "download-only", "disabled"].includes(normalized)) {
    return normalized as AppConfig["lanTransferGuestMode"];
  }
  throw new Error("LAN_TRANSFER_GUEST_MODE must be full, upload-only, download-only, or disabled");
}

function unquote(value: string) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
