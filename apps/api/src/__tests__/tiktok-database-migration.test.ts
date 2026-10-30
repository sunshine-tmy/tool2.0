import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ToolboxDatabase } from "../database/toolbox-database";
import { migrateArchivePlatforms, CURRENT_SCHEMA_VERSION } from "../database/archive-identity";
import { restoreSchemaBackup, inspectDatabaseIntegrity } from "../database/schema-backup";

let root: string;
let filename: string;
const handles: Array<Database.Database | ToolboxDatabase> = [];
const originalPayload = JSON.stringify({
  id: "old-record",
  noteId: "12345",
  title: "保留旧标题",
  translation: { title: { edited: "Manual English" } },
  media: [{ id: "frame", frameTimestampMs: 1234 }]
});
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "toolbox-tiktok-schema-"));
  filename = path.join(root, "toolbox.db");
});
afterEach(() => {
  for (const handle of handles.splice(0)) handle.close();
  expect(path.dirname(root)).toBe(path.resolve(os.tmpdir()));
  expect(path.basename(root)).toMatch(/^toolbox-tiktok-schema-/);
  fs.rmSync(root, { recursive: true, force: true });
});
function v6() {
  const db = new Database(filename);
  handles.push(db);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.exec(`CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);INSERT INTO schema_migrations VALUES(6,'original');
    CREATE TABLE xhs_archives(id TEXT PRIMARY KEY,status TEXT,payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,platform TEXT NOT NULL DEFAULT 'xiaohongshu' CHECK(platform IN ('xiaohongshu','douyin')),content_id TEXT NOT NULL,extra TEXT DEFAULT 'keep');
    CREATE UNIQUE INDEX archives_platform_content_idx ON xhs_archives(platform,content_id);
    CREATE INDEX custom_archive_extra ON xhs_archives(extra);
    CREATE TABLE xhs_media(id TEXT PRIMARY KEY,status TEXT,payload_json TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,archive_id TEXT REFERENCES xhs_archives(id) ON DELETE CASCADE,media_index INTEGER);
    CREATE TABLE translations(id TEXT PRIMARY KEY,status TEXT,payload_json TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,archive_id TEXT REFERENCES xhs_archives(id) ON DELETE CASCADE);
    CREATE TABLE custom_log(value TEXT);
    CREATE TRIGGER custom_archive_audit AFTER UPDATE OF extra ON xhs_archives BEGIN INSERT INTO custom_log VALUES(NEW.extra); END;`);
  db.prepare(
    "INSERT INTO xhs_archives VALUES('old-record','ready',?,'created','updated','xiaohongshu','12345','original-extra')"
  ).run(originalPayload);
  db.exec(
    "INSERT INTO xhs_media VALUES('media','ready','{}','created','updated','old-record',0);INSERT INTO translations VALUES('translation','ready','{}','created','updated','old-record');"
  );
  return db;
}
function open() {
  const db = new ToolboxDatabase(filename);
  handles.push(db);
  return db;
}
describe("Remote and local archive platform upgrades", () => {
  it("upgrades an existing three-platform v7 database and preserves byte-identical payloads, children and rollback", () => {
    const old = v6();
    old.pragma("foreign_keys=OFF");
    old.transaction(() => {
      migrateArchivePlatforms(old);
    })();
    // Recreate the actual historical CHECK rather than testing only a newly-created v8 database.
    const ddl = (old.prepare("SELECT sql FROM sqlite_master WHERE name='xhs_archives'").get() as { sql: string }).sql;
    const columns = (old.pragma("table_info(xhs_archives)") as Array<{ name: string }>)
      .map((row) => `"${row.name}"`)
      .join(",");
    const dependents = old
      .prepare(
        "SELECT sql FROM sqlite_master WHERE tbl_name='xhs_archives' AND type IN ('index','trigger') AND sql IS NOT NULL"
      )
      .all() as Array<{ sql: string }>;
    old.exec(ddl.replace(/CREATE TABLE\s+"?xhs_archives"?/i, 'CREATE TABLE "v7_seed"').replace(",'local'", ""));
    old.exec(
      `INSERT INTO v7_seed (${columns}) SELECT ${columns} FROM xhs_archives; DROP TABLE xhs_archives; ALTER TABLE v7_seed RENAME TO xhs_archives;`
    );
    for (const dependent of dependents) old.exec(dependent.sql);
    old.exec("UPDATE schema_migrations SET version=7");
    old.close();
    const db = open(),
      backup = db.schemaBackupId!;
    expect(db.verify()).toMatchObject({ schemaVersion: 8, integrity: "ok", foreignKeys: [] });
    expect(db.connection.prepare("SELECT payload_json FROM xhs_archives WHERE id='old-record'").get()).toEqual({
      payload_json: originalPayload
    });
    db.upsert({
      id: "local_record",
      kind: "xhs-archive",
      status: "ready",
      payload: { platform: "local", contentId: "local-content" },
      createdAt: "now",
      updatedAt: "now"
    });
    expect(db.connection.prepare("SELECT platform FROM xhs_archives WHERE id='local_record'").get()).toEqual({
      platform: "local"
    });
    expect(db.connection.prepare("SELECT COUNT(*) AS n FROM xhs_media").get()).toEqual({ n: 1 });
    db.close();
    restoreSchemaBackup(filename, backup);
    expect(inspectDatabaseIntegrity(filename)).toMatchObject({ schemaVersion: 7, integrity: "ok", foreignKeys: [] });
  });
  it("preserves exact old payload, child rows, extra columns, custom indexes/triggers and FK enforcement", () => {
    v6().close();
    const db = open();
    const c = db.connection;
    expect(db.verify()).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, integrity: "ok", foreignKeys: [] });
    expect(c.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(c.prepare("SELECT payload_json,extra FROM xhs_archives WHERE id='old-record'").get()).toEqual({
      payload_json: originalPayload,
      extra: "original-extra"
    });
    expect(c.prepare("SELECT COUNT(*) AS n FROM xhs_media").get()).toEqual({ n: 1 });
    expect(c.prepare("SELECT COUNT(*) AS n FROM translations").get()).toEqual({ n: 1 });
    expect(c.prepare("SELECT name FROM sqlite_master WHERE name='custom_archive_extra'").get()).toBeDefined();
    c.exec("UPDATE xhs_archives SET extra='changed' WHERE id='old-record'");
    expect(c.prepare("SELECT value FROM custom_log").all()).toEqual([{ value: "changed" }]);
    c.prepare(
      "INSERT INTO xhs_archives(id,payload_json,created_at,updated_at,platform,content_id) VALUES('tiktok','{}','now','now','tiktok','12345')"
    ).run();
    expect(() => c.prepare("INSERT INTO xhs_media VALUES('bad','ready','{}','now','now','missing',0)").run()).toThrow(
      "FOREIGN KEY"
    );
    expect(() =>
      c
        .prepare(
          "INSERT INTO xhs_archives(id,payload_json,created_at,updated_at,platform,content_id) VALUES('bad','{}','now','now','instagram','12345')"
        )
        .run()
    ).toThrow("CHECK");
  });
  it("creates a recoverable v6 snapshot and restores original child records after migration", () => {
    v6().close();
    const db = open();
    const backup = db.schemaBackupId!;
    expect(backup).toMatch(/^schema-v8-/);
    db.close();
    restoreSchemaBackup(filename, backup);
    expect(inspectDatabaseIntegrity(filename)).toMatchObject({ schemaVersion: 6, foreignKeys: [], integrity: "ok" });
    const check = new Database(filename);
    handles.push(check);
    expect(check.prepare("SELECT payload_json FROM xhs_archives").get()).toEqual({ payload_json: originalPayload });
    expect(check.prepare("SELECT COUNT(*) AS n FROM xhs_media").get()).toEqual({ n: 1 });
  });
  it("rolls back table rebuilding atomically when the encompassing migration fails", () => {
    const db = v6();
    db.pragma("foreign_keys=OFF");
    expect(() =>
      db.transaction(() => {
        migrateArchivePlatforms(db);
        throw Error("injected failure");
      })()
    ).toThrow("injected failure");
    expect(db.prepare("SELECT payload_json FROM xhs_archives").get()).toEqual({ payload_json: originalPayload });
    expect(db.prepare("SELECT COUNT(*) AS n FROM xhs_media").get()).toEqual({ n: 1 });
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name='xhs_archives_platform_v8'").get()).toBeUndefined();
    expect(() =>
      db
        .prepare(
          "INSERT INTO xhs_archives(id,payload_json,created_at,updated_at,platform,content_id) VALUES('bad','{}','now','now','tiktok','12345')"
        )
        .run()
    ).toThrow("CHECK");
  });
  it.each([6, 7])("continues to accept backups created by the historical v%i migration", (version) => {
    const original = v6();
    original.exec("UPDATE schema_migrations SET version=5");
    const bytes = original.serialize();
    original.close();
    const db = open();
    db.close();
    const id = `schema-v${version}-20261025T000000Z-aaaaaaaaaaaa`;
    const backup = path.join(root, "migration-backups", id);
    fs.mkdirSync(backup, { recursive: true });
    fs.writeFileSync(path.join(backup, "toolbox.db"), bytes);
    fs.writeFileSync(
      path.join(backup, "schema-backup.json"),
      JSON.stringify({
        formatVersion: 1,
        backupId: id,
        fromVersion: 5,
        toVersion: version,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex")
      })
    );
    const manifestPath = path.join(backup, "schema-backup.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, toVersion: String(version) }));
    expect(() => restoreSchemaBackup(filename, id)).toThrow("SCHEMA_BACKUP_INVALID");
    expect(inspectDatabaseIntegrity(filename).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
    restoreSchemaBackup(filename, id);
    expect(inspectDatabaseIntegrity(filename).schemaVersion).toBe(5);
  });
});
