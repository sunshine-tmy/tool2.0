/**
 * 中文模块说明：后端数据库层，负责 启动一致性检查、孤立文件隔离和审计记录
 */
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../config";
import type { ToolboxDatabase } from "./toolbox-database";

type FileConsistencyResult = {
  checked: number;
  quarantined: number;
  removedMetadata: number;
  failures: Array<{ relativePath: string; reason: string }>;
};

/**
 * Verifies metadata-managed files at startup. Only files that are known to
 * the metadata table (or clearly temporary staging artifacts) are moved;
 * unregistered legacy media is left untouched for a later adoption pass.
 */
export async function reconcileFileMetadataStorage(
  config: AppConfig,
  database: ToolboxDatabase
): Promise<FileConsistencyResult> {
  const result: FileConsistencyResult = { checked: 0, quarantined: 0, removedMetadata: 0, failures: [] };
  for (const metadata of database.listFiles()) {
    result.checked += 1;
    const target = resolveStoragePath(config.storageRoot, metadata.relativePath);
    if (!target) {
      database.removeFile(metadata.id);
      result.removedMetadata += 1;
      result.failures.push({ relativePath: metadata.relativePath, reason: "INVALID_RELATIVE_PATH" });
      continue;
    }
    const stat = await fsp.stat(target).catch(() => undefined);
    if (!stat?.isFile()) {
      database.removeFile(metadata.id);
      result.removedMetadata += 1;
      result.failures.push({ relativePath: metadata.relativePath, reason: "FILE_MISSING" });
      continue;
    }
    const digest = await sha256(target).catch(() => undefined);
    const reason =
      stat.size !== metadata.byteSize ? "SIZE_MISMATCH" : digest !== metadata.sha256 ? "SHA256_MISMATCH" : undefined;
    if (!reason) continue;
    const location = await quarantineFile(config, target, metadata.relativePath, reason);
    database.removeFile(metadata.id);
    result.removedMetadata += 1;
    if (location) result.quarantined += 1;
    else result.failures.push({ relativePath: metadata.relativePath, reason: `${reason}:QUARANTINE_FAILED` });
  }

  const registeredPaths = new Set(database.listFiles().map((entry) => entry.relativePath));
  for (const directory of managedDirectories(config)) {
    for (const filePath of await listFiles(directory)) {
      if (!isTemporaryArtifact(filePath)) continue;
      const relativePath = path.relative(config.storageRoot, filePath).replaceAll(path.sep, "/");
      if (registeredPaths.has(relativePath)) continue;
      const location = await quarantineFile(config, filePath, relativePath, "STALE_STAGING");
      if (location) result.quarantined += 1;
      else result.failures.push({ relativePath, reason: "STALE_STAGING:QUARANTINE_FAILED" });
    }
  }

  if (result.quarantined || result.removedMetadata || result.failures.length) {
    database.appendAudit({
      action: "storage.file_metadata_consistency",
      outcome: result.failures.length ? "partial" : "success",
      details: result
    });
  }
  return result;
}

function managedDirectories(config: AppConfig) {
  return [
    config.outputDir,
    config.uploadDir,
    config.lanTransferFilesDir,
    path.join(config.lanTransferDir, "notes", "images"),
    config.videoTextUploadsDir,
    config.videoTextAudioDir,
    config.videoTextResultsDir,
    config.imageAiInputsDir,
    config.imageAiOutputsDir,
    config.imageAiTasksDir,
    config.edgeTtsTasksDir,
    config.chatterboxTasksDir,
    path.join(config.chatterboxDir, "batches"),
    path.join(config.chatterboxDir, "voices"),
    config.xhsArchiveItemsDir
  ];
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await fsp.readdir(directory, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === ".gitkeep") continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(target)));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

async function quarantineFile(config: AppConfig, source: string, relativePath: string, reason: string) {
  const safeRelative = relativePath
    .replaceAll("/", "_")
    .replaceAll("\\", "_")
    .replace(/[^\w.\u4e00-\u9fff-]/g, "_");
  const destinationDirectory = path.join(config.quarantineDir, "files", timestamp());
  const destination = path.join(destinationDirectory, `${reason}-${safeRelative}`.slice(0, 240));
  try {
    await fsp.mkdir(destinationDirectory, { recursive: true });
    await fsp.rename(source, destination);
    return path.relative(config.quarantineDir, destination).replaceAll(path.sep, "/");
  } catch {
    return undefined;
  }
}

function resolveStoragePath(storageRoot: string, relativePath: string) {
  const root = path.resolve(storageRoot);
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return undefined;
  return target;
}

function isTemporaryArtifact(filePath: string) {
  const name = path.basename(filePath);
  return name.includes(".staging-") || name.includes(".partial-") || name.endsWith(".tmp") || name.includes(".tmp.");
}

async function sha256(filePath: string) {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

function timestamp() {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}
