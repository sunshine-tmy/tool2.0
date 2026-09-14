import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { LanFileRecord } from "@toolbox/shared";
import type { AppConfig } from "../config";
import type { ToolboxDatabase } from "./toolbox-database";

type ConsistencyFailure = { target: string; reason: string };

type StorageConsistencyResult = {
  checkedRecords: number;
  quarantinedRecords: number;
  quarantinedFiles: number;
  quarantined: Array<{ target: string; reason: string; location?: string }>;
  failures: ConsistencyFailure[];
};

export async function reconcileLanStorage(
  config: AppConfig,
  database: ToolboxDatabase
): Promise<StorageConsistencyResult> {
  const result: StorageConsistencyResult = {
    checkedRecords: 0,
    quarantinedRecords: 0,
    quarantinedFiles: 0,
    quarantined: [],
    failures: []
  };
  const referenced = new Set<string>();
  const records = database.list("lan-file");

  for (const entity of records) {
    result.checkedRecords += 1;
    const record = entity.payload as Partial<LanFileRecord>;
    const storedName = safeStoredName(record.storedName);
    if (!storedName || !Number.isSafeInteger(record.size) || Number(record.size) < 0) {
      const quarantined = await quarantineRecord(database, entity, "INVALID_METADATA", undefined, result);
      if (!quarantined && storedName) referenced.add(fileNameKey(storedName));
      continue;
    }

    referenced.add(fileNameKey(storedName));
    const filePath = path.join(config.lanTransferFilesDir, storedName);
    const stat = await fsp.lstat(filePath).catch(() => undefined);
    if (!stat?.isFile()) {
      await quarantineRecord(database, entity, "FILE_MISSING", undefined, result);
      referenced.delete(fileNameKey(storedName));
      continue;
    }
    if (stat.size !== record.size) {
      const moved = await quarantineFile(config, filePath, storedName, "SIZE_MISMATCH", result);
      if (!moved) continue;
      if (await quarantineRecord(database, entity, "SIZE_MISMATCH", moved, result)) {
        referenced.delete(fileNameKey(storedName));
      }
    }
  }

  const entries = await fsp.readdir(config.lanTransferFilesDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.isDirectory() || entry.name === ".gitkeep" || referenced.has(fileNameKey(entry.name))) continue;
    await quarantineFile(
      config,
      path.join(config.lanTransferFilesDir, entry.name),
      entry.name,
      "FILE_ORPHANED",
      result
    );
  }

  if (result.quarantinedFiles || result.quarantinedRecords || result.failures.length) {
    database.appendAudit({
      action: "storage.consistency_check",
      outcome: result.failures.length ? "partial" : "success",
      details: result
    });
  }
  return result;
}

async function quarantineRecord(
  database: ToolboxDatabase,
  entity: ReturnType<ToolboxDatabase["list"]>[number],
  reason: string,
  movedFile: { source: string; destination: string; relativeDestination: string } | undefined,
  result: StorageConsistencyResult
) {
  const now = new Date().toISOString();
  try {
    database.transaction(() => {
      database.upsert({
        id: entity.id,
        kind: "quarantined:lan-file-record",
        status: "quarantined",
        payload: {
          reason,
          originalKind: entity.kind,
          quarantinedAt: now,
          quarantinedFile: movedFile?.relativeDestination,
          entity: entity.payload
        },
        createdAt: entity.createdAt,
        updatedAt: now
      });
      if (!database.remove(entity.kind, entity.id)) throw new Error("Record disappeared during quarantine");
    });
    result.quarantinedRecords += 1;
    result.quarantined.push({
      target: `record:${entity.id}`,
      reason,
      location: movedFile?.relativeDestination
    });
    return true;
  } catch (error) {
    if (movedFile && (await restoreMovedFile(movedFile))) {
      result.quarantinedFiles -= 1;
      const eventIndex = result.quarantined.findIndex((event) => event.location === movedFile.relativeDestination);
      if (eventIndex >= 0) result.quarantined.splice(eventIndex, 1);
    }
    result.failures.push({ target: `record:${entity.id}`, reason: errorCode(error) });
    return false;
  }
}

async function quarantineFile(
  config: AppConfig,
  source: string,
  fileName: string,
  reason: string,
  result: StorageConsistencyResult
) {
  const relativeDirectory = path.join(timestamp(), "lan-transfer", "files");
  const destinationDirectory = path.join(config.quarantineDir, relativeDirectory);
  const destinationName = collisionSafeName(fileName);
  const destination = path.join(destinationDirectory, destinationName);
  try {
    await fsp.mkdir(destinationDirectory, { recursive: true });
    await fsp.rename(source, destination);
    result.quarantinedFiles += 1;
    const relativeDestination = path.join(relativeDirectory, destinationName).replaceAll(path.sep, "/");
    result.quarantined.push({ target: `file:${fileName}`, reason, location: relativeDestination });
    return {
      source,
      destination,
      relativeDestination
    };
  } catch (error) {
    result.failures.push({ target: `file:${fileName}`, reason: `${reason}:${errorCode(error)}` });
    return undefined;
  }
}

async function restoreMovedFile(moved: { source: string; destination: string }) {
  if (!fs.existsSync(moved.destination) || fs.existsSync(moved.source)) return false;
  return fsp
    .rename(moved.destination, moved.source)
    .then(() => true)
    .catch(() => false);
}

function safeStoredName(value: unknown) {
  if (typeof value !== "string" || !value || value !== path.basename(value) || /[\r\n]/.test(value)) return undefined;
  return value;
}

function collisionSafeName(fileName: string) {
  const extension = path.extname(fileName);
  const base = path.basename(fileName, extension);
  return `${base}.${crypto.randomBytes(6).toString("hex")}${extension}`;
}

function fileNameKey(fileName: string) {
  return process.platform === "win32" ? fileName.toLocaleLowerCase("en-US") : fileName;
}

function timestamp() {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function errorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return error instanceof Error ? error.name : "UNKNOWN_ERROR";
}
