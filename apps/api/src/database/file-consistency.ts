/**
 * 中文模块说明：后端数据库层，负责 启动一致性检查、孤立文件隔离和审计记录
 */
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { AppConfig } from "../config";
import type { ToolboxDatabase } from "./toolbox-database";
import type { FileMetadata } from "./types";

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
  // 永久音频库及转换结果由领域层管理；缺失或损坏由访问检查报告，不移入全局缓存隔离区。
  const files = database
    .listFiles()
    .filter(
      (metadata) => !["audio-library-item", "audio-convert-job", "audio-extract-job"].includes(metadata.entityKind)
    );
  // 只并行两个只读校验，控制磁盘和缓冲区负载；隔离与数据库变更仍按原顺序执行。
  for (let offset = 0; offset < files.length; offset += 2) {
    const inspected = await Promise.all(
      files.slice(offset, offset + 2).map(async (metadata) => ({ metadata, ...(await inspectFile(config, metadata)) }))
    );
    let changed = false;
    for (const entry of inspected) {
      const { metadata } = entry;
      result.checked += 1;
      // 前一项可能通过大小写、点路径等别名移动了同一个文件，不能再使用提前读取的结果。
      const { target, reason } = changed ? await inspectFile(config, metadata) : entry;
      if (!reason) continue;
      if (!target || reason === "FILE_MISSING") {
        database.removeFile(metadata.id);
        result.removedMetadata += 1;
        result.failures.push({ relativePath: metadata.relativePath, reason });
      } else {
        const location = await quarantineFile(config, target, metadata.relativePath, reason);
        database.removeFile(metadata.id);
        result.removedMetadata += 1;
        if (location) result.quarantined += 1;
        else result.failures.push({ relativePath: metadata.relativePath, reason: `${reason}:QUARANTINE_FAILED` });
      }
      changed = true;
    }
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

async function inspectFile(config: AppConfig, metadata: FileMetadata) {
  const target = resolveStoragePath(config.storageRoot, metadata.relativePath);
  if (!target) return { target, reason: "INVALID_RELATIVE_PATH" };
  const stat = await fsp.stat(target).catch(() => undefined);
  if (!stat?.isFile()) return { target, reason: "FILE_MISSING" };
  // 大小已不符时原因仍为 SIZE_MISMATCH，无需再读取整个损坏文件。
  if (stat.size !== metadata.byteSize) return { target, reason: "SIZE_MISMATCH" };
  const digest = await sha256(target).catch(() => undefined);
  return { target, reason: digest !== metadata.sha256 ? "SHA256_MISMATCH" : undefined };
}

function managedDirectories(config: AppConfig) {
  return [
    config.outputDir,
    config.uploadDir,
    config.lanTransferFilesDir,
    path.join(config.lanTransferDir, "notes", "images"),
    config.imageAiInputsDir,
    config.imageAiOutputsDir,
    config.imageAiTasksDir,
    config.edgeTtsTasksDir,
    path.join(path.dirname(config.edgeTtsTasksDir), "batches"),
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
  // 每次仍完整校验摘要。大块读取减少往返；pipeline 等待 close，避免 Windows 隔离移动时句柄仍被占用。
  await pipeline(
    fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 }),
    new Writable({
      write(chunk, _encoding, callback) {
        hash.update(chunk);
        callback();
      }
    })
  );
  return hash.digest("hex");
}

function timestamp() {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}
