/**
 * 中文模块说明：后端数据库层，负责 旧元数据迁移、备份、回滚和故障恢复
 */
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../config";
import { ToolboxDatabase } from "./toolbox-database";

const LEGACY_SOURCES = [
  { kind: "lan-transfer", relativePath: "lan-transfer/index.json" },
  { kind: "lan-notes", relativePath: "lan-transfer/notes/index.json" },
  { kind: "lan-uploads", relativePath: "lan-transfer/uploads/index.json" },
  { kind: "xhs-archive", relativePath: "xhs-archive/index.json" }
] as const;
const MIGRATION_MANIFEST = "migration-manifest.json";

type DiscoveredSource = {
  kind: string;
  relativePath: string;
  source: string;
  count: number;
  bytes: number;
  sha256: string;
  value: unknown;
};

type BackupManifest = {
  schemaVersion: 1;
  backupId: string;
  createdAt: string;
  sourceCount: number;
  recordCount: number;
  totalBytes: number;
  files: Array<{ relativePath: string; bytes: number; sha256: string; count: number; kind: string }>;
};

type LegacyMigrationResult = {
  migrated: boolean;
  backupId: string | null;
  atomicSwitch: boolean;
  sources: Array<{ kind: string; source: string; count: number; bytes: number }>;
};

export async function openToolboxDatabase(config: AppConfig) {
  if (config.databasePath === ":memory:") {
    const database = new ToolboxDatabase(config.databasePath);
    assertDatabaseHealthy(database);
    return { database, migration: emptyResult() };
  }

  if (fs.existsSync(config.databasePath)) {
    const database = new ToolboxDatabase(config.databasePath);
    try {
      assertDatabaseHealthy(database);
      const migration = await migrateLegacyMetadata(config, database);
      return { database, migration };
    } catch (error) {
      database.close();
      throw error;
    }
  }

  const discovered = await discoverLegacyMetadata(config);
  if (!discovered.length) {
    return {
      database: new ToolboxDatabase(config.databasePath),
      migration: emptyResult()
    };
  }

  await fsp.mkdir(path.dirname(config.databasePath), { recursive: true });
  const temporaryPath = `${config.databasePath}.migrating-${process.pid}-${crypto.randomBytes(6).toString("hex")}`;
  let temporaryDatabase: ToolboxDatabase | undefined;
  let migration: LegacyMigrationResult;
  try {
    temporaryDatabase = new ToolboxDatabase(temporaryPath);
    migration = await migrateDiscoveredMetadata(config, temporaryDatabase, discovered, false, true);
    const verification = temporaryDatabase.verify();
    if (verification.integrity !== "ok" || verification.foreignKeys.length) {
      throw new Error("Temporary database verification failed");
    }
    const checkpoint = temporaryDatabase.checkpoint();
    if (checkpoint.some((entry) => entry.busy !== 0)) throw new Error("Temporary database checkpoint is busy");
    temporaryDatabase.close();
    temporaryDatabase = undefined;
    await rejectNonEmptySidecars(temporaryPath);
    await fsyncFile(temporaryPath);
    if (fs.existsSync(config.databasePath)) throw new Error("Database appeared while migration was running");
    await fsp.rename(temporaryPath, config.databasePath);
    await fsyncDirectory(path.dirname(config.databasePath));
  } catch (error) {
    temporaryDatabase?.close();
    await removeDatabaseFiles(temporaryPath);
    throw error;
  }

  const database = new ToolboxDatabase(config.databasePath);
  try {
    assertDatabaseHealthy(database);
    return { database, migration };
  } catch (error) {
    database.close();
    throw error;
  }
}

export async function inspectLegacyMetadata(config: AppConfig): Promise<LegacyMigrationResult> {
  const discovered = await discoverLegacyMetadata(config);
  return discovered.length
    ? {
        migrated: false,
        backupId: backupTimestamp(),
        atomicSwitch: false,
        sources: summarizeSources(discovered)
      }
    : emptyResult();
}

export async function migrateLegacyMetadata(
  config: AppConfig,
  database: ToolboxDatabase,
  dryRun = false
): Promise<LegacyMigrationResult> {
  const discovered = await discoverLegacyMetadata(config);
  return migrateDiscoveredMetadata(config, database, discovered, dryRun, false);
}

async function migrateDiscoveredMetadata(
  config: AppConfig,
  database: ToolboxDatabase,
  discovered: DiscoveredSource[],
  dryRun: boolean,
  atomicSwitch: boolean
): Promise<LegacyMigrationResult> {
  if (!discovered.length) return emptyResult();
  if (database.hasCompletedLegacyMigration()) {
    return { migrated: false, backupId: null, atomicSwitch: false, sources: summarizeSources(discovered) };
  }

  const backupId = backupTimestamp();
  if (dryRun) {
    return { migrated: false, backupId, atomicSwitch: false, sources: summarizeSources(discovered) };
  }
  const manifest = await createVerifiedBackup(config, backupId, discovered);
  const now = new Date().toISOString();

  database.transaction(() => {
    for (const source of discovered) {
      const id = crypto.createHash("sha256").update(source.relativePath).digest("hex").slice(0, 24);
      database.upsert({
        id,
        kind: `legacy:${source.kind}`,
        payload: { source: source.relativePath, value: source.value },
        createdAt: now,
        updatedAt: now
      });
      const stored = database.get(`legacy:${source.kind}`, id);
      if (!stored || (stored.payload as { source?: unknown }).source !== source.relativePath) {
        throw new Error(`Migration import verification failed: ${source.relativePath}`);
      }
    }
    database.recordLegacyMigration({
      backupId,
      sourceCount: manifest.sourceCount,
      recordCount: manifest.recordCount,
      totalBytes: manifest.totalBytes
    });
    database.appendAudit({
      action: "database.legacy_migration",
      outcome: "success",
      details: {
        backupId,
        sourceCount: manifest.sourceCount,
        recordCount: manifest.recordCount,
        totalBytes: manifest.totalBytes,
        atomicSwitch
      }
    });
  });

  return { migrated: true, backupId, atomicSwitch, sources: summarizeSources(discovered) };
}

export async function rollbackDatabase(config: AppConfig, backupId: string) {
  const { manifest, backupDir } = await readVerifiedBackup(config, backupId);
  const restoreId = crypto.randomBytes(6).toString("hex");
  const staged: Array<{
    temporary: string;
    destination: string;
    previous: string;
    previousMoved: boolean;
    replacementMoved: boolean;
  }> = [];
  try {
    for (const entry of manifest.files) {
      const source = path.join(backupDir, entry.relativePath);
      const destination = safeStoragePath(config.storageRoot, entry.relativePath);
      const temporary = `${destination}.restore-${restoreId}`;
      await fsp.mkdir(path.dirname(destination), { recursive: true });
      await fsp.copyFile(source, temporary);
      await fsyncFile(temporary);
      staged.push({
        temporary,
        destination,
        previous: `${destination}.before-restore-${restoreId}`,
        previousMoved: false,
        replacementMoved: false
      });
    }
    for (const entry of staged) {
      if (fs.existsSync(entry.destination)) {
        await fsp.rename(entry.destination, entry.previous);
        entry.previousMoved = true;
      }
      await fsp.rename(entry.temporary, entry.destination);
      entry.replacementMoved = true;
    }
    await fsyncDirectory(config.storageRoot);
  } catch (error) {
    for (const entry of [...staged].reverse()) {
      if (entry.replacementMoved) await fsp.rm(entry.destination, { force: true });
      if (entry.previousMoved && fs.existsSync(entry.previous)) await fsp.rename(entry.previous, entry.destination);
      await fsp.rm(entry.temporary, { force: true });
    }
    throw error;
  }
  await Promise.all(staged.map((entry) => fsp.rm(entry.previous, { force: true }).catch(() => undefined)));
  return { restored: manifest.files.length, backupId };
}

export async function verifyMigrationBackup(config: AppConfig, backupId: string) {
  const { manifest } = await readVerifiedBackup(config, backupId);
  return {
    backupId,
    sources: manifest.sourceCount,
    records: manifest.recordCount,
    bytes: manifest.totalBytes
  };
}

async function discoverLegacyMetadata(config: AppConfig) {
  const discovered: DiscoveredSource[] = [];
  for (const source of LEGACY_SOURCES) {
    const sourcePath = safeStoragePath(config.storageRoot, source.relativePath);
    if (!fs.existsSync(sourcePath)) continue;
    const contents = await fsp.readFile(sourcePath, "utf8");
    const value = JSON.parse(contents) as unknown;
    discovered.push({
      kind: source.kind,
      relativePath: source.relativePath,
      source: sourcePath,
      count: Array.isArray(value) ? value.length : countObjectRecords(value),
      bytes: Buffer.byteLength(contents),
      sha256: sha256(contents),
      value
    });
  }
  return discovered;
}

async function createVerifiedBackup(config: AppConfig, backupId: string, discovered: DiscoveredSource[]) {
  const backupDir = safeBackupDirectory(config.migrationBackupDir, backupId);
  await fsp.mkdir(config.migrationBackupDir, { recursive: true });
  await fsp.mkdir(backupDir, { recursive: false });
  try {
    for (const source of discovered) {
      const destination = safeChildPath(backupDir, source.relativePath, "Unsafe migration backup target");
      await fsp.mkdir(path.dirname(destination), { recursive: true });
      await fsp.copyFile(source.source, destination);
      const stat = await fsp.stat(destination);
      if (stat.size !== source.bytes || (await sha256File(destination)) !== source.sha256) {
        throw new Error(`Migration backup verification failed: ${source.relativePath}`);
      }
    }

    const manifest: BackupManifest = {
      schemaVersion: 1,
      backupId,
      createdAt: new Date().toISOString(),
      sourceCount: discovered.length,
      recordCount: discovered.reduce((total, source) => total + source.count, 0),
      totalBytes: discovered.reduce((total, source) => total + source.bytes, 0),
      files: discovered.map((source) => ({
        relativePath: source.relativePath,
        bytes: source.bytes,
        sha256: source.sha256,
        count: source.count,
        kind: source.kind
      }))
    };
    const manifestPath = path.join(backupDir, MIGRATION_MANIFEST);
    await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2), { encoding: "utf8", flag: "wx" });
    await fsyncFile(manifestPath);
    return manifest;
  } catch (error) {
    await fsp.rm(backupDir, { recursive: true, force: true });
    throw error;
  }
}

async function readVerifiedBackup(config: AppConfig, backupId: string) {
  const backupDir = safeBackupDirectory(config.migrationBackupDir, backupId);
  const manifest = await readManifest(path.join(backupDir, MIGRATION_MANIFEST), backupId);
  if (!manifest.files.length) throw new Error(`Migration backup is empty: ${backupId}`);
  if (manifest.sourceCount !== manifest.files.length) throw new Error("Migration backup source count mismatch");
  if (manifest.recordCount !== manifest.files.reduce((total, entry) => total + entry.count, 0)) {
    throw new Error("Migration backup record count mismatch");
  }
  if (manifest.totalBytes !== manifest.files.reduce((total, entry) => total + entry.bytes, 0)) {
    throw new Error("Migration backup byte count mismatch");
  }

  const seen = new Set<string>();
  for (const entry of manifest.files) {
    if (seen.has(entry.relativePath)) throw new Error(`Duplicate migration backup entry: ${entry.relativePath}`);
    seen.add(entry.relativePath);
    const source = safeChildPath(backupDir, entry.relativePath, "Unsafe migration backup entry");
    safeStoragePath(config.storageRoot, entry.relativePath);
    const stat = await fsp.stat(source).catch(() => undefined);
    if (!stat?.isFile() || stat.size !== entry.bytes || (await sha256File(source)) !== entry.sha256) {
      throw new Error(`Migration backup checksum mismatch: ${entry.relativePath}`);
    }
  }
  return { manifest, backupDir };
}

function safeBackupDirectory(root: string, backupId: string) {
  if (!/^[0-9]{8}T[0-9]{6}Z$/.test(backupId)) throw new Error("Invalid backup id");
  return safeChildPath(root, backupId, "Unsafe backup path");
}

function safeStoragePath(root: string, relativePath: string) {
  return safeChildPath(root, relativePath, "Unsafe migration storage path");
}

function safeChildPath(root: string, relativePath: string, message: string) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (resolved === resolvedRoot || !resolved.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error(message);
  return resolved;
}

function backupTimestamp() {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function countObjectRecords(value: unknown) {
  if (!value || typeof value !== "object") return 1;
  for (const key of ["items", "files", "records", "notes", "uploads"]) {
    const candidate = (value as Record<string, unknown>)[key];
    if (Array.isArray(candidate)) return candidate.length;
  }
  return 1;
}

function summarizeSources(discovered: DiscoveredSource[]) {
  return discovered.map(({ kind, source, count, bytes }) => ({ kind, source, count, bytes }));
}

function emptyResult(): LegacyMigrationResult {
  return { migrated: false, backupId: null, atomicSwitch: false, sources: [] };
}

function sha256(value: string | Buffer) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function sha256File(filePath: string) {
  return sha256(await fsp.readFile(filePath));
}

async function readManifest(manifestPath: string, backupId: string): Promise<BackupManifest> {
  const value = JSON.parse(await fsp.readFile(manifestPath, "utf8")) as Partial<BackupManifest>;
  if (
    value.schemaVersion !== 1 ||
    value.backupId !== backupId ||
    typeof value.createdAt !== "string" ||
    !Array.isArray(value.files) ||
    value.files.some(
      (entry) =>
        !entry ||
        typeof entry.relativePath !== "string" ||
        typeof entry.kind !== "string" ||
        !Number.isSafeInteger(entry.bytes) ||
        Number(entry.bytes) < 0 ||
        !Number.isSafeInteger(entry.count) ||
        Number(entry.count) < 0 ||
        !/^[a-f0-9]{64}$/.test(entry.sha256)
    )
  ) {
    throw new Error("Invalid migration backup manifest");
  }
  const sourceCount = value.sourceCount ?? value.files.length;
  const recordCount = value.recordCount ?? value.files.reduce((total, entry) => total + entry.count, 0);
  const totalBytes = value.totalBytes ?? value.files.reduce((total, entry) => total + entry.bytes, 0);
  if (
    !Number.isSafeInteger(sourceCount) ||
    Number(sourceCount) < 0 ||
    !Number.isSafeInteger(recordCount) ||
    Number(recordCount) < 0 ||
    !Number.isSafeInteger(totalBytes) ||
    Number(totalBytes) < 0
  ) {
    throw new Error("Invalid migration backup manifest");
  }
  return { ...value, sourceCount, recordCount, totalBytes } as BackupManifest;
}

async function fsyncFile(filePath: string) {
  const handle = await fsp.open(filePath, "r+");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function fsyncDirectory(directory: string) {
  if (process.platform === "win32") return;
  const handle = await fsp.open(directory, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function rejectNonEmptySidecars(databasePath: string) {
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = `${databasePath}${suffix}`;
    const stat = await fsp.stat(sidecar).catch(() => undefined);
    if (stat?.size) throw new Error(`Temporary database sidecar was not checkpointed: ${suffix}`);
    if (stat) await fsp.rm(sidecar, { force: true });
  }
}

async function removeDatabaseFiles(databasePath: string) {
  await Promise.all(["", "-wal", "-shm"].map((suffix) => fsp.rm(`${databasePath}${suffix}`, { force: true })));
}

function assertDatabaseHealthy(database: ToolboxDatabase) {
  const verification = database.verifyQuick();
  if (verification.integrity !== "ok" || verification.foreignKeys.length) {
    throw new Error("Database quick verification failed");
  }
}
