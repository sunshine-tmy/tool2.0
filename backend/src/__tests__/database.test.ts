import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getConfig } from "../config";
import { migrateLegacyMetadata, rollbackDatabase } from "../database/legacy-migration";
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
    await fsp.mkdir(path.dirname(legacyPath), { recursive: true });
    await fsp.writeFile(legacyPath, JSON.stringify([{ id: "legacy-file" }]));
    const database = new ToolboxDatabase(databasePath);

    const preview = await migrateLegacyMetadata(config, database, true);
    expect(preview).toMatchObject({ migrated: false, sources: [{ kind: "lan-transfer", count: 1 }] });
    const migrated = await migrateLegacyMetadata(config, database);
    expect(migrated.migrated).toBe(true);
    expect((await migrateLegacyMetadata(config, database)).migrated).toBe(false);
    database.close();

    await fsp.writeFile(legacyPath, "[]");
    await rollbackDatabase(config, migrated.backupId!);
    expect(JSON.parse(await fsp.readFile(legacyPath, "utf8"))).toEqual([{ id: "legacy-file" }]);
  });
});

async function prepareDatabasePath() {
  testRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "toolbox-database-"));
  process.env.STORAGE_ROOT = testRoot;
  const databasePath = path.join(testRoot, "toolbox.db");
  process.env.DATABASE_PATH = databasePath;
  return databasePath;
}
