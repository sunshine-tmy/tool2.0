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
};

export function getConfig(): AppConfig {
  const storageRoot = path.resolve(process.env.STORAGE_ROOT ?? "storage");

  return {
    host: process.env.API_HOST ?? "0.0.0.0",
    port: Number(process.env.API_PORT ?? 3100),
    storageRoot,
    uploadDir: path.join(storageRoot, "uploads"),
    outputDir: path.join(storageRoot, "outputs"),
    tempDir: path.join(storageRoot, "temp"),
    lanTransferDir: path.join(storageRoot, "lan-transfer"),
    lanTransferFilesDir: path.join(storageRoot, "lan-transfer", "files"),
    lanTransferIndexPath: path.join(storageRoot, "lan-transfer", "index.json"),
    lanTransferMaxFileBytes: Number(process.env.LAN_TRANSFER_MAX_FILE_BYTES ?? 20 * 1024 * 1024 * 1024),
    lanTransferRetentionDays: Number(process.env.LAN_TRANSFER_RETENTION_DAYS ?? 7),
    lanPublicBaseUrl: process.env.LAN_PUBLIC_BASE_URL ?? "http://192.168.1.241:3100"
  };
}
