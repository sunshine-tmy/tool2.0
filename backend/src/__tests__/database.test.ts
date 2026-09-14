import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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

let testRoot: string | undefined;

afterEach(async () => {
  delete process.env.STORAGE_ROOT;
  delete process.env.DATABASE_PATH;
  if (testRoot) await fsp.rm(testRoot, { recursive: true, force: true });
  testRoot = undefined;
});

describe("toolbox database", () => {
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
    expect(database.verify()).toMatchObject({ integrity: "ok", foreignKeys: [], schemaVersion: 2 });
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
