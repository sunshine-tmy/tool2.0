/** SQLite 升级前的一致性快照与整库回滚。不会读取、移动或删除任何媒体和旧 JSON。 */
import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import Database from "better-sqlite3";
import { CURRENT_SCHEMA_VERSION, inspectArchiveIdentity } from "./archive-identity";

const MANIFEST = "schema-backup.json";
const BACKUP_ID = /^schema-v6-\d{8}T\d{6}Z-[a-f0-9]{12}$/;

export function databaseSchemaVersion(connection: Database.Database) {
  const exists = connection
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
    .get();
  return exists
    ? (
        connection.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations").get() as {
          version: number;
        }
      ).version
    : 0;
}

/** dry-run 只用只读连接，不构造 ToolboxDatabase，避免检查本身触发迁移或中断任务恢复。 */
export function inspectSchemaMigration(databasePath: string) {
  if (databasePath === ":memory:" || !fs.existsSync(databasePath)) {
    return { fromVersion: 0, toVersion: CURRENT_SCHEMA_VERSION, archiveCount: 0, required: true };
  }
  const connection = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    assertHealthy(connection);
    const fromVersion = databaseSchemaVersion(connection);
    if (fromVersion > CURRENT_SCHEMA_VERSION) throw new Error("DATABASE_VERSION_UNSUPPORTED");
    const identities = inspectArchiveIdentity(connection);
    return {
      fromVersion,
      toVersion: CURRENT_SCHEMA_VERSION,
      archiveCount: identities.length,
      required: fromVersion < CURRENT_SCHEMA_VERSION
    };
  } finally {
    connection.close();
  }
}

/** 运维校验只读现有库，不能因为执行 verify 就触发升级或任务恢复。 */
export function inspectDatabaseIntegrity(databasePath: string) {
  if (databasePath === ":memory:") throw new Error("DATABASE_VERIFY_REQUIRES_FILE");
  const connection = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const integrity = connection.pragma("integrity_check", { simple: true }) as string;
    const foreignKeys = connection.pragma("foreign_key_check") as unknown[];
    const tables = connection
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as Array<{ name: string }>;
    const counts = tables.map(({ name }) => ({
      kind: name,
      count: (
        connection.prepare(`SELECT COUNT(*) AS count FROM "${name.replaceAll('"', '""')}"`).get() as { count: number }
      ).count
    }));
    return { integrity, foreignKeys, counts, schemaVersion: databaseSchemaVersion(connection) };
  } finally {
    connection.close();
  }
}

export function backupBeforeSchemaMigration(connection: Database.Database, databasePath: string) {
  const fromVersion = databaseSchemaVersion(connection);
  if (fromVersion > CURRENT_SCHEMA_VERSION) throw new Error("DATABASE_VERSION_UNSUPPORTED");
  if (fromVersion === CURRENT_SCHEMA_VERSION) return undefined;
  // 先拒绝损坏、缺少身份或重复作品；失败不会改表、改载荷或清理用户数据。
  assertHealthy(connection);
  inspectArchiveIdentity(connection);
  if (databasePath === ":memory:") return undefined;
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const backupId = `schema-v6-${timestamp}-${randomBytes(6).toString("hex")}`;
  const directory = backupDirectory(databasePath, backupId, true);
  fs.mkdirSync(directory, { mode: 0o700 });
  // serialize 消费连接的一致性快照，包含已提交 WAL；不能只复制主文件丢失最近写入。
  const snapshot = connection.serialize();
  const target = path.join(directory, "toolbox.db");
  writeSynced(target, snapshot);
  const verification = new Database(target, { readonly: true, fileMustExist: true });
  try {
    assertHealthy(verification);
  } finally {
    verification.close();
  }
  writeSynced(
    path.join(directory, MANIFEST),
    Buffer.from(
      JSON.stringify(
        {
          formatVersion: 1,
          backupId,
          fromVersion,
          toVersion: CURRENT_SCHEMA_VERSION,
          createdAt: new Date().toISOString(),
          bytes: snapshot.length,
          sha256: digest(snapshot)
        },
        null,
        2
      ) + "\n"
    )
  );
  syncDirectory(directory);
  // 同时持久化父目录中的备份目录项，避免断电后快照文件已落盘但目录入口丢失。
  syncDirectory(path.dirname(directory));
  syncDirectory(path.dirname(path.dirname(directory)));
  return backupId;
}

/** 必须停止应用后执行；保留升级后的主库及 WAL/SHM，回滚不会永久删除新增记录。 */
export function restoreSchemaBackup(databasePath: string, backupId: string) {
  const directory = backupDirectory(databasePath, backupId, false);
  if (path.relative(path.resolve(directory), fs.realpathSync(directory))) throw new Error("SCHEMA_BACKUP_PATH_INVALID");
  const manifestPath = path.join(directory, MANIFEST);
  const source = path.join(directory, "toolbox.db");
  if (
    fs.lstatSync(manifestPath).isSymbolicLink() ||
    fs.lstatSync(source).isSymbolicLink() ||
    fs.statSync(manifestPath).size > 4096
  ) {
    throw new Error("SCHEMA_BACKUP_INVALID");
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  const snapshot = fs.readFileSync(source);
  if (
    manifest.formatVersion !== 1 ||
    manifest.backupId !== backupId ||
    manifest.toVersion !== CURRENT_SCHEMA_VERSION ||
    !Number.isInteger(manifest.fromVersion) ||
    Number(manifest.fromVersion) < 0 ||
    Number(manifest.fromVersion) >= CURRENT_SCHEMA_VERSION ||
    manifest.bytes !== snapshot.length ||
    manifest.sha256 !== digest(snapshot)
  ) {
    throw new Error("SCHEMA_BACKUP_INVALID");
  }
  const check = new Database(source, { readonly: true, fileMustExist: true });
  try {
    assertHealthy(check);
    if (databaseSchemaVersion(check) !== manifest.fromVersion) throw new Error("SCHEMA_BACKUP_VERSION_INVALID");
  } finally {
    check.close();
  }
  // 先试取写锁；活跃写事务存在时拒绝回滚。此检查不替代运维上停止应用的要求。
  if (fs.existsSync(databasePath)) {
    const current = new Database(databasePath, { fileMustExist: true, timeout: 1000 });
    try {
      current.exec("BEGIN EXCLUSIVE; ROLLBACK;");
    } finally {
      current.close();
    }
  }
  const token = randomBytes(6).toString("hex");
  const staged = `${databasePath}.schema-restore-${token}`;
  const previous = `${databasePath}.before-schema-rollback-${token}`;
  const moved: Array<{ source: string; target: string }> = [];
  let installed = false;
  try {
    writeSynced(staged, snapshot);
    for (const suffix of ["", "-wal", "-shm"]) {
      const sourcePath = `${databasePath}${suffix}`;
      if (!fs.existsSync(sourcePath)) continue;
      const target = `${previous}${suffix}`;
      fs.renameSync(sourcePath, target);
      moved.push({ source: sourcePath, target });
    }
    fs.renameSync(staged, databasePath);
    installed = true;
    syncDirectory(path.dirname(databasePath));
  } catch (error) {
    // 失败后仅移回本次已移动文件；staging 属于本操作，可安全清理。
    if (installed) fs.renameSync(databasePath, staged);
    for (const entry of moved.reverse()) fs.renameSync(entry.target, entry.source);
    throw error;
  } finally {
    if (fs.existsSync(staged)) fs.unlinkSync(staged);
  }
  return {
    backupId,
    restoredSchemaVersion: manifest.fromVersion,
    retainedCurrentDatabase: moved.length ? previous : null
  };
}

function backupDirectory(databasePath: string, backupId: string, createRoot: boolean) {
  if (databasePath === ":memory:" || !BACKUP_ID.test(backupId)) throw new Error("SCHEMA_BACKUP_ID_INVALID");
  const root = path.resolve(path.dirname(databasePath), "migration-backups");
  if (createRoot) fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  if (fs.existsSync(root) && path.relative(root, fs.realpathSync(root))) throw new Error("SCHEMA_BACKUP_PATH_INVALID");
  return path.join(root, backupId);
}

function assertHealthy(connection: Database.Database) {
  if (
    connection.pragma("quick_check", { simple: true }) !== "ok" ||
    (connection.pragma("foreign_key_check") as unknown[]).length
  ) {
    throw new Error("DATABASE_INTEGRITY_FAILED");
  }
}

function writeSynced(target: string, contents: Buffer) {
  const descriptor = fs.openSync(target, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, contents);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function syncDirectory(directory: string) {
  if (process.platform === "win32") return;
  const descriptor = fs.openSync(directory, "r");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function digest(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
