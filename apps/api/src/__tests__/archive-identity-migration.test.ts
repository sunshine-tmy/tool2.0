/** MA03 迁移回归：使用隔离的 v5 数据库，包含真实外键/文件索引和 WAL，禁止读取生产 storage。 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToolboxDatabase } from "../database/toolbox-database";
import { archiveIdentity } from "../database/archive-identity";
import {
  databaseSchemaVersion,
  inspectSchemaMigration,
  restoreSchemaBackup,
  inspectDatabaseIntegrity
} from "../database/schema-backup";

let root: string;
let databasePath: string;
const connections: Database.Database[] = [];
const payload = {
  id: "archive_123456",
  noteId: "123456789",
  title: "旧标题",
  media: [{ id: "frame_123456", frameSourceMediaId: "video_123456", frameTimestampMs: 1230 }],
  translation: { title: { edited: "手工译文" } }
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "toolbox-ma03-"));
  databasePath = path.join(root, "toolbox.db");
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const connection of connections.splice(0)) if (connection.open) connection.close();
  if (
    !path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) ||
    !path.basename(root).startsWith("toolbox-ma03-")
  )
    throw new Error("Unsafe test cleanup");
  fs.rmSync(root, { recursive: true, force: true });
});

function v5(rows: Array<{ id: string; payload: unknown }> = [{ id: payload.id, payload }]) {
  const legacy = new Database(databasePath);
  connections.push(legacy);
  legacy.pragma("journal_mode = WAL");
  legacy.pragma("wal_autocheckpoint = 0");
  legacy.exec(`
    CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    INSERT INTO schema_migrations VALUES (5, '2026-09-30');
    CREATE TABLE xhs_archives(id TEXT PRIMARY KEY, status TEXT, payload_json TEXT NOT NULL CHECK(json_valid(payload_json)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE xhs_media(id TEXT PRIMARY KEY, archive_id TEXT REFERENCES xhs_archives(id) ON DELETE CASCADE, media_index INTEGER, status TEXT, payload_json TEXT NOT NULL CHECK(json_valid(payload_json)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE translations(id TEXT PRIMARY KEY, archive_id TEXT REFERENCES xhs_archives(id) ON DELETE CASCADE, status TEXT, payload_json TEXT NOT NULL CHECK(json_valid(payload_json)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE files(id TEXT PRIMARY KEY, entity_kind TEXT NOT NULL, entity_id TEXT NOT NULL, relative_path TEXT NOT NULL UNIQUE, byte_size INTEGER NOT NULL, sha256 TEXT, media_type TEXT, owner TEXT, created_at TEXT NOT NULL);
  `);
  const insert = legacy.prepare("INSERT INTO xhs_archives VALUES (?, 'ready', ?, '2026-09-30', '2026-09-30')");
  for (const row of rows) insert.run(row.id, JSON.stringify(row.payload));
  if (rows.some((row) => row.id === payload.id)) {
    legacy
      .prepare("INSERT INTO xhs_media VALUES ('frame_123456', ?, 0, 'ready', ?, '2026-09-30', '2026-09-30')")
      .run(payload.id, JSON.stringify({ archiveId: payload.id, fileName: "frame.png" }));
    legacy
      .prepare("INSERT INTO translations VALUES ('translation_123', ?, 'ready', ?, '2026-09-30', '2026-09-30')")
      .run(payload.id, JSON.stringify(payload.translation));
    legacy.exec(
      "INSERT INTO files VALUES ('file_123456', 'xhs-media', 'frame_123456', 'xhs-archive/items/archive_123456/frame.png', 10, 'aabb', 'image/png', 'local', '2026-09-30')"
    );
  }
  return legacy;
}

function open() {
  const database = new ToolboxDatabase(databasePath);
  connections.push(database.connection);
  return database;
}

function raw() {
  const connection = new Database(databasePath, { readonly: true, fileMustExist: true });
  connections.push(connection);
  return connection;
}

describe("archive identity migration", () => {
  it("backfills identity without rewriting payload, frame data, foreign keys or file paths", () => {
    v5().close();
    const before = fs.readFileSync(databasePath);
    expect(inspectSchemaMigration(databasePath)).toEqual({
      fromVersion: 5,
      toVersion: 6,
      archiveCount: 1,
      required: true
    });
    expect(fs.readFileSync(databasePath).equals(before)).toBe(true);
    expect(fs.existsSync(path.join(root, "migration-backups"))).toBe(false);
    const database = open();
    expect(database.schemaBackupId).toMatch(/^schema-v6-/);
    expect(database.verify()).toMatchObject({ integrity: "ok", foreignKeys: [], schemaVersion: 6 });
    expect(database.get("xhs-archive", payload.id)?.payload).toEqual(payload);
    expect(database.connection.prepare("SELECT platform, content_id FROM xhs_archives").get()).toEqual({
      platform: "xiaohongshu",
      content_id: payload.noteId
    });
    expect(database.list("xhs-media")).toHaveLength(1);
    expect(database.list("translation")[0].payload).toEqual(payload.translation);
    expect(database.getFile("file_123456")?.relativePath).toBe("xhs-archive/items/archive_123456/frame.png");
    const backup = new Database(path.join(root, "migration-backups", database.schemaBackupId!, "toolbox.db"), {
      readonly: true
    });
    connections.push(backup);
    expect(databaseSchemaVersion(backup)).toBe(5);
    expect(backup.prepare("SELECT payload_json FROM xhs_archives").get()).toEqual({
      payload_json: JSON.stringify(payload)
    });
    database.close();
    const restarted = open();
    expect(restarted.schemaBackupId).toBeUndefined();
    expect(fs.readdirSync(path.join(root, "migration-backups"))).toHaveLength(1);
    expect(inspectSchemaMigration(databasePath).required).toBe(false);
  });

  it("captures committed WAL rows in the backup, not only the main database", () => {
    const writer = v5();
    expect(fs.statSync(`${databasePath}-wal`).size).toBeGreaterThan(0);
    const database = open();
    writer.close();
    const backup = new Database(path.join(root, "migration-backups", database.schemaBackupId!, "toolbox.db"), {
      readonly: true
    });
    connections.push(backup);
    expect(backup.prepare("SELECT COUNT(*) AS count FROM xhs_archives").get()).toEqual({ count: 1 });
    expect(backup.prepare("SELECT COUNT(*) AS count FROM xhs_media").get()).toEqual({ count: 1 });
  });

  it("rejects same-platform duplicate identities before modifying schema or writing backup", () => {
    v5([
      { id: "one", payload: { noteId: "same" } },
      { id: "two", payload: { noteId: "same" } }
    ]).close();
    expect(() => inspectSchemaMigration(databasePath)).toThrow("ARCHIVE_IDENTITY_CONFLICT");
    expect(() => open()).toThrow("ARCHIVE_IDENTITY_CONFLICT");
    expect(databaseSchemaVersion(raw())).toBe(5);
    expect(raw().pragma("table_info(xhs_archives)")).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "platform" })])
    );
    expect(raw().prepare("SELECT COUNT(*) AS count FROM xhs_archives").get()).toEqual({ count: 2 });
    expect(fs.existsSync(path.join(root, "migration-backups"))).toBe(false);
  });

  it("permits equal cross-platform IDs and enforces unique/nonnull identity on future writes", () => {
    v5([
      { id: "xhs_123456", payload: { noteId: "same" } },
      { id: "douyin_123456", payload: { platform: "douyin", contentId: "same" } }
    ]).close();
    const database = open();
    const insert = database.connection.prepare(
      "INSERT INTO xhs_archives(id, platform, content_id, payload_json, created_at, updated_at) VALUES (?, ?, ?, '{}', 'now', 'now')"
    );
    expect(() => insert.run("duplicate", "douyin", "same")).toThrow("UNIQUE");
    expect(() => insert.run("empty", "douyin", "")).toThrow("ARCHIVE_IDENTITY_INVALID");
    expect(() => insert.run("blank", "douyin", " bad ")).toThrow("ARCHIVE_IDENTITY_INVALID");
    expect(() => insert.run("null", "douyin", null)).toThrow("NOT NULL");
    expect(() => insert.run("wrong", "tiktok", "new")).toThrow("CHECK");
    expect(() =>
      database.connection.prepare("UPDATE xhs_archives SET content_id = '' WHERE id = 'xhs_123456'").run()
    ).toThrow("ARCHIVE_IDENTITY_INVALID");
    expect(database.list("xhs-archive")).toHaveLength(2);
  });

  it.each([
    {},
    { platform: "douyin", noteId: "wrong" },
    { platform: "tiktok", contentId: "123" },
    { noteId: " bad " },
    { noteId: "a\nb" },
    { noteId: "a", contentId: "b" }
  ])("rejects malformed identity without dropping recoverable rows: %j", (invalid) => {
    v5([{ id: "recoverable", payload: invalid }]).close();
    expect(() => open()).toThrow("ARCHIVE_IDENTITY_INVALID");
    expect(databaseSchemaVersion(raw())).toBe(5);
    expect(raw().prepare("SELECT payload_json FROM xhs_archives").get()).toEqual({
      payload_json: JSON.stringify(invalid)
    });
  });

  it("rolls back all DDL and version writes after an interrupted migration", () => {
    v5().close();
    const original = Database.prototype.exec;
    const fault = vi.spyOn(Database.prototype, "exec").mockImplementation(function (
      this: Database.Database,
      sql: string
    ) {
      if (sql.includes("CREATE UNIQUE INDEX IF NOT EXISTS archives_platform_content_idx"))
        throw new Error("simulated interruption");
      return original.call(this, sql);
    });
    expect(() => open()).toThrow("simulated interruption");
    fault.mockRestore();
    expect(databaseSchemaVersion(raw())).toBe(5);
    expect(raw().pragma("table_info(xhs_archives)")).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "platform" })])
    );
    expect(raw().prepare("SELECT payload_json FROM xhs_archives").get()).toEqual({
      payload_json: JSON.stringify(payload)
    });
    expect(fs.readdirSync(path.join(root, "migration-backups"))).toHaveLength(1);
    expect(open().verify().integrity).toBe("ok");
  });

  it("does not migrate when the backup cannot be durably written", () => {
    v5().close();
    vi.spyOn(fs, "fsyncSync").mockImplementationOnce(() => {
      throw new Error("disk full");
    });
    expect(() => open()).toThrow("disk full");
    expect(databaseSchemaVersion(raw())).toBe(5);
    expect(raw().prepare("SELECT payload_json FROM xhs_archives").get()).toEqual({
      payload_json: JSON.stringify(payload)
    });
  });

  it("restores the verified complete v5 snapshot and retains the upgraded database", () => {
    v5().close();
    const database = open();
    const backupId = database.schemaBackupId!;
    database.upsert({
      id: "douyin_123456",
      kind: "xhs-archive",
      payload: { platform: "douyin", contentId: "new" },
      createdAt: "now",
      updatedAt: "now"
    });
    database.close();
    const result = restoreSchemaBackup(databasePath, backupId);
    expect(result.restoredSchemaVersion).toBe(5);
    expect(databaseSchemaVersion(raw())).toBe(5);
    expect(raw().prepare("SELECT COUNT(*) AS count FROM xhs_archives").get()).toEqual({ count: 1 });
    expect(raw().prepare("SELECT COUNT(*) AS count FROM translations").get()).toEqual({ count: 1 });
    const retained = new Database(result.retainedCurrentDatabase!, { readonly: true });
    connections.push(retained);
    expect(databaseSchemaVersion(retained)).toBe(6);
    expect(retained.prepare("SELECT COUNT(*) AS count FROM xhs_archives").get()).toEqual({ count: 2 });
    expect(fs.existsSync(path.join(root, "migration-backups", backupId, "toolbox.db"))).toBe(true);
  });

  it("rejects tampered backups and unsafe backup IDs before touching the current database", () => {
    v5().close();
    const database = open();
    const backupId = database.schemaBackupId!;
    database.close();
    const backupFile = path.join(root, "migration-backups", backupId, "toolbox.db");
    fs.appendFileSync(backupFile, "tampered");
    expect(() => restoreSchemaBackup(databasePath, backupId)).toThrow("SCHEMA_BACKUP_INVALID");
    expect(() => restoreSchemaBackup(databasePath, "../toolbox.db")).toThrow("SCHEMA_BACKUP_ID_INVALID");
    expect(databaseSchemaVersion(raw())).toBe(6);
  });

  it("compensates a failed file switch without leaving a partial restored database", () => {
    v5().close();
    const database = open();
    const backupId = database.schemaBackupId!;
    database.close();
    const original = fs.renameSync;
    vi.spyOn(fs, "renameSync").mockImplementation((source, target) => {
      if (String(source).includes(".schema-restore-") && String(target) === databasePath)
        throw new Error("switch failed");
      original(source, target);
    });
    expect(() => restoreSchemaBackup(databasePath, backupId)).toThrow("switch failed");
    expect(databaseSchemaVersion(raw())).toBe(6);
    expect(fs.readdirSync(root).some((name) => name.includes(".schema-restore-"))).toBe(false);
  });

  it("refuses a future schema without modifying its database", () => {
    const legacy = v5();
    legacy.exec("INSERT INTO schema_migrations VALUES (99, 'future')");
    legacy.close();
    expect(() => open()).toThrow("DATABASE_VERSION_UNSUPPORTED");
    expect(() => inspectSchemaMigration(databasePath)).toThrow("DATABASE_VERSION_UNSUPPORTED");
    expect(databaseSchemaVersion(raw())).toBe(99);
  });

  it("dry-runs a fresh database without creating a file and validates in-memory identities", () => {
    expect(inspectSchemaMigration(databasePath)).toMatchObject({
      fromVersion: 0,
      toVersion: 6,
      archiveCount: 0,
      required: true
    });
    expect(fs.existsSync(databasePath)).toBe(false);
    expect(inspectSchemaMigration(":memory:").required).toBe(true);
    expect(() => archiveIdentity(null)).toThrow("ARCHIVE_IDENTITY_INVALID");
    expect(() => archiveIdentity({ noteId: "x".repeat(257) })).toThrow("ARCHIVE_IDENTITY_INVALID");
  });

  it("verifies an existing v5 database read-only without silently upgrading it", () => {
    v5().close();
    const before = fs.readFileSync(databasePath);
    expect(inspectDatabaseIntegrity(databasePath)).toMatchObject({
      integrity: "ok",
      foreignKeys: [],
      schemaVersion: 5,
      counts: expect.arrayContaining([{ kind: "xhs_archives", count: 1 }])
    });
    expect(fs.readFileSync(databasePath).equals(before)).toBe(true);
    expect(fs.existsSync(path.join(root, "migration-backups"))).toBe(false);
    expect(() => inspectDatabaseIntegrity(":memory:")).toThrow("DATABASE_VERIFY_REQUIRES_FILE");
  });

  it("reports foreign-key failures and refuses migration without deleting orphan evidence", () => {
    const legacy = v5();
    // 仅在隔离故障夹具中关闭外键，模拟历史坏库；生产连接始终启用外键。
    legacy.pragma("foreign_keys = OFF");
    legacy.exec("UPDATE xhs_media SET archive_id = 'missing'");
    legacy.close();
    expect(inspectDatabaseIntegrity(databasePath).foreignKeys).toHaveLength(1);
    expect(() => open()).toThrow("DATABASE_INTEGRITY_FAILED");
    expect(databaseSchemaVersion(raw())).toBe(5);
  });

  it("refuses payload/column drift on restart rather than overwriting identity evidence", () => {
    v5().close();
    const database = open();
    database.connection.prepare("UPDATE xhs_archives SET content_id = 'changed' WHERE id = ?").run(payload.id);
    database.close();
    expect(() => open()).toThrow("ARCHIVE_IDENTITY_MISMATCH");
    expect(raw().prepare("SELECT content_id FROM xhs_archives").get()).toEqual({ content_id: "changed" });
  });

  it("keeps the current database when another connection holds a write transaction", () => {
    v5().close();
    const database = open();
    const backupId = database.schemaBackupId!;
    database.close();
    const writer = new Database(databasePath);
    connections.push(writer);
    writer.exec("BEGIN IMMEDIATE");
    try {
      expect(() => restoreSchemaBackup(databasePath, backupId)).toThrow("locked");
      expect(databaseSchemaVersion(writer)).toBe(6);
    } finally {
      writer.exec("ROLLBACK");
    }
  });

  it("rejects a backup directory link and oversized manifest without touching metadata", () => {
    v5().close();
    const database = open();
    const backupId = database.schemaBackupId!;
    database.close();
    const directory = path.join(root, "migration-backups", backupId);
    const original = directory + "-original";
    fs.renameSync(directory, original);
    fs.symlinkSync(original, directory, process.platform === "win32" ? "junction" : "dir");
    expect(() => restoreSchemaBackup(databasePath, backupId)).toThrow("SCHEMA_BACKUP_PATH_INVALID");
    fs.unlinkSync(directory);
    fs.renameSync(original, directory);
    fs.writeFileSync(path.join(directory, "schema-backup.json"), " ".repeat(4097));
    expect(() => restoreSchemaBackup(databasePath, backupId)).toThrow("SCHEMA_BACKUP_INVALID");
    expect(databaseSchemaVersion(raw())).toBe(6);
  });
});
