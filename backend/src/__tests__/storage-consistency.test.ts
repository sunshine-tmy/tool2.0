import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getConfig } from "../config";
import { reconcileLanStorage } from "../database/storage-consistency";
import { ToolboxDatabase } from "../database/toolbox-database";

let testRoot: string | undefined;

afterEach(async () => {
  delete process.env.STORAGE_ROOT;
  delete process.env.DATABASE_PATH;
  if (testRoot) await fsp.rm(testRoot, { recursive: true, force: true });
  testRoot = undefined;
});

describe("storage consistency", () => {
  it("keeps valid LAN files and quarantines missing, mismatched and orphaned data", async () => {
    testRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "toolbox-consistency-"));
    process.env.STORAGE_ROOT = testRoot;
    process.env.DATABASE_PATH = path.join(testRoot, "toolbox.db");
    const config = getConfig();
    await fsp.mkdir(config.lanTransferFilesDir, { recursive: true });
    await Promise.all([
      fsp.writeFile(path.join(config.lanTransferFilesDir, "valid.txt"), "valid"),
      fsp.writeFile(path.join(config.lanTransferFilesDir, "mismatch.txt"), "bad"),
      fsp.writeFile(path.join(config.lanTransferFilesDir, "orphan.txt"), "orphan"),
      fsp.writeFile(path.join(config.lanTransferFilesDir, ".gitkeep"), ""),
      fsp.writeFile(path.join(config.lanTransferDir, "outside.txt"), "outside")
    ]);

    const database = new ToolboxDatabase(config.databasePath);
    const now = new Date().toISOString();
    for (const [id, storedName, size] of [
      ["valid", "valid.txt", 5],
      ["missing", "missing.txt", 7],
      ["mismatch", "mismatch.txt", 99],
      ["unsafe", "../outside.txt", 7]
    ] as const) {
      database.upsert({
        id,
        kind: "lan-file",
        payload: { id, storedName, size },
        createdAt: now,
        updatedAt: now
      });
    }

    const result = await reconcileLanStorage(config, database);
    expect(result).toMatchObject({
      checkedRecords: 4,
      quarantinedRecords: 3,
      quarantinedFiles: 2,
      failures: []
    });
    expect(database.list("lan-file").map((entity) => entity.id)).toEqual(["valid"]);
    expect(
      database
        .list("quarantined:lan-file-record")
        .map((entity) => entity.id)
        .sort()
    ).toEqual(["mismatch", "missing", "unsafe"]);
    expect(await fsp.readFile(path.join(config.lanTransferFilesDir, "valid.txt"), "utf8")).toBe("valid");
    await expect(fsp.readFile(path.join(config.lanTransferFilesDir, ".gitkeep"), "utf8")).resolves.toBe("");
    expect(await fsp.readFile(path.join(config.lanTransferDir, "outside.txt"), "utf8")).toBe("outside");
    await expect(fsp.access(path.join(config.lanTransferFilesDir, "mismatch.txt"))).rejects.toThrow();
    await expect(fsp.access(path.join(config.lanTransferFilesDir, "orphan.txt"))).rejects.toThrow();
    const quarantined = await fsp.readdir(config.quarantineDir, { recursive: true });
    expect(quarantined.some((entry) => path.basename(String(entry)).startsWith("mismatch."))).toBe(true);
    expect(quarantined.some((entry) => path.basename(String(entry)).startsWith("orphan."))).toBe(true);
    expect(
      database.connection
        .prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action = 'storage.consistency_check'")
        .get()
    ).toEqual({ count: 1 });

    expect(await reconcileLanStorage(config, database)).toMatchObject({
      checkedRecords: 1,
      quarantinedRecords: 0,
      quarantinedFiles: 0,
      failures: []
    });
    database.close();
  });
});
