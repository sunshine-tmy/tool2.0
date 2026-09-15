import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { getConfig } from "../config";
import {
  inspectLegacyMetadata,
  migrateLegacyMetadata,
  openToolboxDatabase,
  rollbackDatabase,
  verifyMigrationBackup
} from "../database/legacy-migration";
import { ToolboxDatabase } from "../database/toolbox-database";
import { FileMetadataRepository } from "../database/file-metadata";

let testRoot: string | undefined;

afterEach(async () => {
  delete process.env.STORAGE_ROOT;
  delete process.env.DATABASE_PATH;
  if (testRoot) await fsp.rm(testRoot, { recursive: true, force: true });
  testRoot = undefined;
});

describe("toolbox database", () => {
  it("upgrades the legacy entities table without losing existing metadata", async () => {
    const databasePath = await prepareDatabasePath();
    const legacy = new Database(databasePath);
    legacy.exec(`
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      INSERT INTO schema_migrations(version, applied_at) VALUES (1, '2026-01-01T00:00:00.000Z');
      CREATE TABLE entities (
        id TEXT NOT NULL PRIMARY KEY,
        status TEXT,
        payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) WITHOUT ROWID;
      CREATE INDEX entities_status_created_idx ON entities(status, created_at DESC);
    `);
    const createdAt = "2026-01-01T00:00:00.000Z";
    const insert = legacy.prepare(
      "INSERT INTO entities(id, status, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    );
    insert.run(
      "legacy-lan",
      null,
      JSON.stringify({ source: "lan-transfer\\index.json", value: [{ id: "file-1" }] }),
      createdAt,
      createdAt
    );
    insert.run(
      "legacy-xhs",
      null,
      JSON.stringify({ source: "xhs-archive/index.json", value: { version: 2, items: [{ id: "note-1" }] } }),
      createdAt,
      createdAt
    );
    legacy.close();

    const upgraded = new ToolboxDatabase(databasePath);
    expect(upgraded.get("legacy:lan-transfer", "legacy-lan")?.payload).toEqual({
      source: "lan-transfer\\index.json",
      value: [{ id: "file-1" }]
    });
    expect(upgraded.get("legacy:xhs-archive", "legacy-xhs")?.payload).toEqual({
      source: "xhs-archive/index.json",
      value: { version: 2, items: [{ id: "note-1" }] }
    });
    expect(upgraded.verify()).toMatchObject({ integrity: "ok", foreignKeys: [], schemaVersion: 5 });
    expect(upgraded.connection.pragma("table_info(entities)")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "kind", pk: 1 }),
        expect.objectContaining({ name: "id", pk: 2 })
      ])
    );
    upgraded.close();

    const restarted = new ToolboxDatabase(databasePath);
    expect(restarted.list("legacy:lan-transfer")).toHaveLength(1);
    expect(restarted.list("legacy:xhs-archive")).toHaveLength(1);
    restarted.close();
  });

  it("persists records and marks interrupted work failed after restart", async () => {
    const databasePath = await prepareDatabasePath();
    const now = new Date().toISOString();
    const first = new ToolboxDatabase(databasePath);
    first.upsert({
      id: "task-1",
      kind: "task",
      status: "running",
      payload: { id: "task-1", status: "running", createdAt: now, updatedAt: now },
      createdAt: now,
      updatedAt: now
    });
    for (const [kind, id, status] of [
      ["edge-tts-task", "edge-1", "queued"],
      ["image-ai-task", "image-1", "pending"],
      ["chatterbox-task", "voice-1", "processing"],
      ["chatterbox-item", "item-1", "queued"]
    ] as const) {
      first.upsert({
        id,
        kind,
        status,
        payload: { id, status, createdAt: now, updatedAt: now },
        createdAt: now,
        updatedAt: now
      });
    }
    expect(first.verify()).toMatchObject({ integrity: "ok", foreignKeys: [] });
    first.close();

    const restarted = new ToolboxDatabase(databasePath);
    const recovered = new Map(
      [
        ["task", "task-1"],
        ["edge-tts-task", "edge-1"],
        ["image-ai-task", "image-1"],
        ["chatterbox-task", "voice-1"],
        ["chatterbox-item", "item-1"]
      ].map(([kind, id]) => [`${kind}:${id}`, restarted.get(kind, id)?.payload])
    );
    restarted.close();
    expect(recovered.get("task:task-1")).toMatchObject({
      status: "failed",
      error: "INTERRUPTED"
    });
    for (const [kind, id] of [
      ["edge-tts-task", "edge-1"],
      ["image-ai-task", "image-1"],
      ["chatterbox-task", "voice-1"],
      ["chatterbox-item", "item-1"]
    ] as const) {
      expect(recovered.get(`${kind}:${id}`)).toMatchObject({ status: "failed", error: "INTERRUPTED" });
    }
  });

  it("backs up legacy metadata, imports once, and can restore a selected backup", async () => {
    const databasePath = await prepareDatabasePath();
    const config = getConfig();
    const legacyPath = path.join(config.storageRoot, "lan-transfer", "index.json");
    const notePath = path.join(config.storageRoot, "lan-transfer", "notes", "index.json");
    await fsp.mkdir(path.dirname(notePath), { recursive: true });
    await fsp.writeFile(legacyPath, JSON.stringify([{ id: "legacy-file" }]));
    await fsp.writeFile(notePath, JSON.stringify([{ id: "legacy-note" }]));
    const database = new ToolboxDatabase(databasePath);

    const preview = await migrateLegacyMetadata(config, database, true);
    expect(preview).toMatchObject({
      migrated: false,
      sources: [
        { kind: "lan-transfer", count: 1 },
        { kind: "lan-notes", count: 1 }
      ]
    });
    const migrated = await migrateLegacyMetadata(config, database);
    expect(migrated.migrated).toBe(true);
    const manifestPath = path.join(config.migrationBackupDir, migrated.backupId!, "migration-manifest.json");
    const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf8"));
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      backupId: migrated.backupId,
      sourceCount: 2,
      recordCount: 2,
      files: [
        { relativePath: "lan-transfer/index.json", count: 1 },
        { relativePath: "lan-transfer/notes/index.json", count: 1 }
      ]
    });
    expect(await verifyMigrationBackup(config, migrated.backupId!)).toMatchObject({ sources: 2, records: 2 });
    delete manifest.sourceCount;
    delete manifest.recordCount;
    delete manifest.totalBytes;
    await fsp.writeFile(manifestPath, JSON.stringify(manifest), "utf8");
    expect(await verifyMigrationBackup(config, migrated.backupId!)).toMatchObject({ sources: 2, records: 2 });
    expect((await migrateLegacyMetadata(config, database)).migrated).toBe(false);
    database.close();

    await fsp.writeFile(legacyPath, "[]");
    await fsp.writeFile(notePath, "[]");
    await rollbackDatabase(config, migrated.backupId!);
    expect(JSON.parse(await fsp.readFile(legacyPath, "utf8"))).toEqual([{ id: "legacy-file" }]);
    expect(JSON.parse(await fsp.readFile(notePath, "utf8"))).toEqual([{ id: "legacy-note" }]);

    await fsp.writeFile(legacyPath, JSON.stringify([{ id: "current-file" }]));
    await fsp.writeFile(notePath, JSON.stringify([{ id: "current-note" }]));
    const backupFile = path.join(config.migrationBackupDir, migrated.backupId!, "lan-transfer", "notes", "index.json");
    await fsp.writeFile(backupFile, "[]", "utf8");
    await expect(rollbackDatabase(config, migrated.backupId!)).rejects.toThrow("checksum mismatch");
    expect(JSON.parse(await fsp.readFile(legacyPath, "utf8"))).toEqual([{ id: "current-file" }]);
    expect(JSON.parse(await fsp.readFile(notePath, "utf8"))).toEqual([{ id: "current-note" }]);
  });

  it("builds and verifies the first migrated database before switching it into place", async () => {
    const databasePath = await prepareDatabasePath();
    const config = getConfig();
    const fileIndex = path.join(config.storageRoot, "lan-transfer", "index.json");
    const noteIndex = path.join(config.storageRoot, "lan-transfer", "notes", "index.json");
    await fsp.mkdir(path.dirname(noteIndex), { recursive: true });
    await fsp.writeFile(fileIndex, JSON.stringify([{ id: "legacy-file" }]));
    await fsp.writeFile(noteIndex, JSON.stringify([{ id: "legacy-note" }, { id: "legacy-note-2" }]));

    const preview = await inspectLegacyMetadata(config);
    expect(preview).toMatchObject({ migrated: false, sources: [{ kind: "lan-transfer" }, { kind: "lan-notes" }] });
    expect(await exists(databasePath)).toBe(false);

    const { database, migration } = await openToolboxDatabase(config);
    expect(migration).toMatchObject({ migrated: true, atomicSwitch: true });
    expect(database.hasCompletedLegacyMigration()).toBe(true);
    expect(database.verify()).toMatchObject({ integrity: "ok", foreignKeys: [], schemaVersion: 5 });
    database.close();

    expect(await exists(databasePath)).toBe(true);
    expect((await fsp.readdir(config.storageRoot)).some((name) => name.includes(".migrating-"))).toBe(false);
    expect(await verifyMigrationBackup(config, migration.backupId!)).toMatchObject({ sources: 2, records: 3 });
  });

  it("leaves no database or backup when legacy metadata cannot be parsed", async () => {
    const databasePath = await prepareDatabasePath();
    const config = getConfig();
    const legacyPath = path.join(config.storageRoot, "lan-transfer", "index.json");
    await fsp.mkdir(path.dirname(legacyPath), { recursive: true });
    await fsp.writeFile(legacyPath, "{broken-json", "utf8");

    await expect(openToolboxDatabase(config)).rejects.toThrow();
    expect(await exists(databasePath)).toBe(false);
    expect(await fsp.readdir(config.migrationBackupDir).catch(() => [])).toEqual([]);
  });

  it("refuses to start with a corrupt existing database", async () => {
    const databasePath = await prepareDatabasePath();
    const corruptContents = Buffer.from("this is not a sqlite database");
    await fsp.writeFile(databasePath, corruptContents);

    await expect(openToolboxDatabase(getConfig())).rejects.toThrow();
    expect(await fsp.readFile(databasePath)).toEqual(corruptContents);
  });

  it("creates v4 domain relationships and cascades child metadata safely", async () => {
    const databasePath = await prepareDatabasePath();
    const database = new ToolboxDatabase(databasePath);
    const now = new Date().toISOString();
    database.upsert({
      id: "batch-1",
      kind: "chatterbox-batch",
      status: "queued",
      payload: { id: "batch-1", status: "queued", createdAt: now, updatedAt: now },
      createdAt: now,
      updatedAt: now
    });
    database.upsert({
      id: "item-1",
      kind: "chatterbox-item",
      status: "queued",
      payload: { id: "item-1", batchId: "batch-1", order: 1, status: "queued" },
      createdAt: now,
      updatedAt: now
    });

    expect(database.verify()).toMatchObject({ integrity: "ok", foreignKeys: [], schemaVersion: 5 });
    expect(database.connection.pragma("table_info(chatterbox_items)")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "batch_id" }),
        expect.objectContaining({ name: "item_order" })
      ])
    );
    expect(database.connection.pragma("foreign_key_list(chatterbox_items)")).toEqual(
      expect.arrayContaining([expect.objectContaining({ table: "chatterbox_batches", from: "batch_id" })])
    );
    database.remove("chatterbox-batch", "batch-1");
    expect(database.get("chatterbox-item", "item-1")).toBeUndefined();
    database.close();
  });

  it("registers streamed file metadata with stable identity and safe relative paths", async () => {
    const databasePath = await prepareDatabasePath();
    const database = new ToolboxDatabase(databasePath);
    const filePath = path.join(testRoot!, "outputs", "image-1.webp");
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, "metadata-test");
    const repository = new FileMetadataRepository(database, testRoot!);

    const first = await repository.register({
      entityKind: "image-compress",
      entityId: "task-1",
      filePath,
      mediaType: "image/webp",
      owner: "local"
    });
    const second = await repository.register({
      entityKind: "image-compress",
      entityId: "task-1",
      filePath,
      mediaType: "image/webp",
      owner: "local"
    });

    expect(second.id).toBe(first.id);
    expect(first).toMatchObject({
      entityKind: "image-compress",
      entityId: "task-1",
      relativePath: "outputs/image-1.webp",
      byteSize: 13,
      mediaType: "image/webp",
      owner: "local"
    });
    expect(first.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(repository.list("image-compress", "task-1")).toHaveLength(1);
    expect(() => database.upsertFile({ ...first, relativePath: "../outside" })).toThrow("Invalid relative file path");
    expect(repository.remove(first.id)).toBe(true);
    expect(repository.list("image-compress", "task-1")).toHaveLength(0);
    database.close();
  });

  it("upgrades v4 file metadata in place and remains idempotent after restart", async () => {
    const databasePath = await prepareDatabasePath();
    const legacy = new Database(databasePath);
    legacy.exec(`
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      INSERT INTO schema_migrations(version, applied_at) VALUES (4, '2026-01-01T00:00:00.000Z');
      CREATE TABLE files (
        id TEXT PRIMARY KEY,
        entity_kind TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        relative_path TEXT NOT NULL UNIQUE,
        byte_size INTEGER NOT NULL CHECK(byte_size >= 0),
        sha256 TEXT,
        media_type TEXT,
        created_at TEXT NOT NULL
      );
    `);
    legacy
      .prepare(
        "INSERT INTO files(id, entity_kind, entity_id, relative_path, byte_size, sha256, media_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        "legacy-file",
        "video-text-result",
        "task-1",
        "video-text/results/task-1.json",
        2,
        "aa",
        "application/json",
        "2026-01-01"
      );
    legacy.close();

    const upgraded = new ToolboxDatabase(databasePath);
    expect(upgraded.verify()).toMatchObject({ integrity: "ok", foreignKeys: [], schemaVersion: 5 });
    expect(upgraded.connection.pragma("table_info(files)")).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "owner" })])
    );
    expect(upgraded.getFile("legacy-file")).toMatchObject({ relativePath: "video-text/results/task-1.json" });
    upgraded.close();

    const restarted = new ToolboxDatabase(databasePath);
    expect(restarted.listFiles()).toHaveLength(1);
    expect(restarted.verify()).toMatchObject({ integrity: "ok", foreignKeys: [], schemaVersion: 5 });
    restarted.close();
  });

  it("rolls back a metadata transaction without leaving partial rows", async () => {
    const databasePath = await prepareDatabasePath();
    const database = new ToolboxDatabase(databasePath);
    const now = new Date().toISOString();
    expect(() =>
      database.transaction(() => {
        database.upsertFile({
          id: "transaction-file",
          entityKind: "image-ai-result",
          entityId: "task-transaction",
          relativePath: "image-ai/task-transaction/result.png",
          byteSize: 1,
          createdAt: now
        });
        throw new Error("simulated interruption");
      })
    ).toThrow("simulated interruption");
    expect(database.getFile("transaction-file")).toBeUndefined();
    expect(database.verify()).toMatchObject({ integrity: "ok", foreignKeys: [] });
    database.close();
  });
});

async function prepareDatabasePath() {
  testRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "toolbox-database-"));
  process.env.STORAGE_ROOT = testRoot;
  const databasePath = path.join(testRoot, "toolbox.db");
  process.env.DATABASE_PATH = databasePath;
  return databasePath;
}

async function exists(filePath: string) {
  return fsp
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}
