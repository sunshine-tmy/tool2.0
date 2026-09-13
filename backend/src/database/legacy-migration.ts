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
  }

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
  const files = await walkFiles(backupDir);
  if (!files.length) throw new Error(`Migration backup not found: ${backupId}`);
  for (const source of files) {
    const relative = path.relative(backupDir, source);
    const destination = path.join(config.storageRoot, relative);
    await fsp.mkdir(path.dirname(destination), { recursive: true });
    await fsp.copyFile(source, destination);
  }
  return { restored: files.length, backupId };
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

async function walkFiles(root: string): Promise<string[]> {
  const entries = await fsp.readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const candidate = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(candidate)));
    else if (entry.isFile()) files.push(candidate);
  }
  return files;
}
