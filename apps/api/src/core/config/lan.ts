import type { ConfigContext } from "./context";
import path from "node:path";
import { readInteger } from "@toolbox/runtime-core";
import { readLanTransferGuestMode, getEnv } from "./environment";
export function readLanConfig(context: ConfigContext) {
  const { storageRoot, fileEnv, environment } = context;
  return {
    lanTransferDir: path.join(storageRoot, "lan-transfer"),
    lanTransferFilesDir: path.join(storageRoot, "lan-transfer", "files"),
    lanTransferIndexPath: path.join(storageRoot, "lan-transfer", "index.json"),
    lanTransferMaxFileBytes: readInteger(
      "LAN_TRANSFER_MAX_FILE_BYTES",
      getEnv("LAN_TRANSFER_MAX_FILE_BYTES", fileEnv, environment),
      20 * 1024 * 1024 * 1024,
      1
    ),
    lanTransferRetentionDays: readInteger(
      "LAN_TRANSFER_RETENTION_DAYS",
      getEnv("LAN_TRANSFER_RETENTION_DAYS", fileEnv, environment),
      3,
      1,
      3650
    ),
    lanTransferUploadRetentionHours: readInteger(
      "LAN_TRANSFER_UPLOAD_RETENTION_HOURS",
      getEnv("LAN_TRANSFER_UPLOAD_RETENTION_HOURS", fileEnv, environment),
      24,
      1,
      24 * 30
    ),
    lanTransferCleanupIntervalMinutes: readInteger(
      "LAN_TRANSFER_CLEANUP_INTERVAL_MINUTES",
      getEnv("LAN_TRANSFER_CLEANUP_INTERVAL_MINUTES", fileEnv, environment),
      15,
      1,
      24 * 60
    ),
    lanTransferMaxStorageBytes: readInteger(
      "LAN_TRANSFER_MAX_STORAGE_BYTES",
      getEnv("LAN_TRANSFER_MAX_STORAGE_BYTES", fileEnv, environment),
      100 * 1024 * 1024 * 1024,
      1
    ),
    lanTransferWebPort: readInteger(
      "LAN_TRANSFER_WEB_PORT",
      getEnv("LAN_TRANSFER_WEB_PORT", fileEnv, environment),
      5173,
      1,
      65535
    ),
    lanTransferPin: getEnv("LAN_TRANSFER_PIN", fileEnv, environment)?.trim() || undefined,
    lanTransferGuestMode: readLanTransferGuestMode(getEnv("LAN_TRANSFER_GUEST_MODE", fileEnv, environment))
  };
}
