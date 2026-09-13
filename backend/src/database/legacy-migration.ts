import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../config";
import { ToolboxDatabase } from "./toolbox-database";

const LEGACY_SOURCES = [
  { kind: "lan-transfer", relativePath: "lan-transfer/index.json" },
  { kind: "xhs-archive", relativePath: "xhs-archive/index.json" }
] as const;
const MIGRATION_MANIFEST = "migration-manifest.json";

type BackupManifest = {
  schemaVersion: 1;
  backupId: string;
  createdAt: string;
  files: Array<{ relativePath: string; bytes: number; sha256: string; count: number; kind: string }>;
};

export async function migrateLegacyMetadata(config: AppConfig, database: ToolboxDatabase, dryRun = false) {
  const discovered = [] as Array<{ kind: string; source: string; count: number; bytes: number; value: unknown }>;
  for (const source of LEGACY_SOURCES) {
    const sourcePath = path.join(config.storageRoot, source.relativePath);
    if (!fs.existsSync(sourcePath)) continue;
    const contents = await fsp.readFile(sourcePath, "utf8");
    const value = JSON.parse(contents) as unknown;
    const count = Array.isArray(value) ? value.length : countObjectRecords(value);
    discovered.push({ kind: source.kind, source: sourcePath, count, bytes: Buffer.byteLength(contents), value });
  }

  if (!discovered.length) return { migrated: false, backupId: null, sources: [] };
  const alreadyMigrated = database.connection.prepare("SELECT COUNT(*) AS count FROM entities").get() as {
    count: number;
  };
  if (alreadyMigrated.count > 0) return { migrated: false, backupId: null, sources: discovered };

  const backupId = backupTimestamp();
  if (dryRun) return { migrated: false, backupId, sources: discovered };
  const backupDir = path.join(config.migrationBackupDir, backupId);
  await fsp.mkdir(backupDir, { recursive: true });

  for (const source of discovered) {
    const relative = path.relative(config.storageRoot, source.source);
    const destination = path.join(backupDir, relative);
    await fsp.mkdir(path.dirname(destination), { recursive: true });
    await fsp.copyFile(source.source, destination);
    if ((await sha256File(destination)) !== (await sha256File(source.source))) {
      throw new Error(`Migration backup verification failed: ${relative}`);
    }
  }

  const manifest: BackupManifest = {
    schemaVersion: 1,
    backupId,
    createdAt: new Date().toISOString(),
    files: await Promise.all(
      discovered.map(async (source) => ({
        relativePath: path.relative(config.storageRoot, source.source),
        bytes: source.bytes,
        sha256: await sha256File(source.source),
        count: source.count,
        kind: source.kind
      }))
    )
  };
  await fsp.writeFile(path.join(backupDir, MIGRATION_MANIFEST), JSON.stringify(manifest, null, 2), "utf8");

  const now = new Date().toISOString();
  database.transaction(() => {
    for (const source of discovered) {
      const id = crypto.createHash("sha256").update(source.source).digest("hex").slice(0, 24);
      database.upsert({
        id,
        kind: `legacy:${source.kind}`,
        payload: { source: path.relative(config.storageRoot, source.source), value: source.value },
        createdAt: now,
        updatedAt: now
      });
    }
    database.appendAudit({ action: "database.legacy_migration", outcome: "success", details: { backupId } });
  });
  return { migrated: true, backupId, sources: discovered };
}

export async function rollbackDatabase(config: AppConfig, backupId: string) {
  if (!/^[0-9]{8}T[0-9]{6}Z$/.test(backupId)) throw new Error("Invalid backup id");
  const backupDir = path.join(config.migrationBackupDir, backupId);
  const resolvedRoot = path.resolve(config.migrationBackupDir) + path.sep;
  const resolvedBackup = path.resolve(backupDir);
  if (!resolvedBackup.startsWith(resolvedRoot)) throw new Error("Unsafe backup path");
  const manifestPath = path.join(backupDir, MIGRATION_MANIFEST);
  const manifest = await readManifest(manifestPath, backupId);
  if (!manifest.files.length) throw new Error(`Migration backup is empty: ${backupId}`);
  const resolvedStorageRoot = path.resolve(config.storageRoot) + path.sep;
  for (const entry of manifest.files) {
    const source = path.resolve(backupDir, entry.relativePath);
    if (!source.startsWith(resolvedBackup + path.sep)) throw new Error("Unsafe migration backup entry");
    const destination = path.resolve(config.storageRoot, entry.relativePath);
    if (!destination.startsWith(resolvedStorageRoot)) throw new Error("Unsafe migration restore target");
    const stat = await fsp.stat(source).catch(() => undefined);
    if (!stat?.isFile() || stat.size !== entry.bytes || (await sha256File(source)) !== entry.sha256) {
      throw new Error(`Migration backup checksum mismatch: ${entry.relativePath}`);
    }
    await fsp.mkdir(path.dirname(destination), { recursive: true });
    await fsp.copyFile(source, destination);
  }
  return { restored: manifest.files.length, backupId };
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

async function sha256File(filePath: string) {
  const hash = crypto.createHash("sha256");
  hash.update(await fsp.readFile(filePath));
  return hash.digest("hex");
}

async function readManifest(manifestPath: string, backupId: string): Promise<BackupManifest> {
  const value = JSON.parse(await fsp.readFile(manifestPath, "utf8")) as BackupManifest;
  if (value.schemaVersion !== 1 || value.backupId !== backupId || !Array.isArray(value.files)) {
    throw new Error("Invalid migration backup manifest");
  }
  return value;
}
