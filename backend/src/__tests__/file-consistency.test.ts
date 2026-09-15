import crypto from "node:crypto";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getConfig } from "../config";
import { reconcileFileMetadataStorage } from "../database/file-consistency";
import { ToolboxDatabase } from "../database/toolbox-database";

let root: string | undefined;
let database: ToolboxDatabase | undefined;

afterEach(async () => {
  database?.close();
  database = undefined;
  delete process.env.STORAGE_ROOT;
  delete process.env.DATABASE_PATH;
  if (root) await fsp.rm(root, { recursive: true, force: true });
  root = undefined;
});

describe("file metadata consistency", () => {
  it("quarantines mismatched files, removes stale metadata, and preserves recoverable copies", async () => {
    root = await fsp.mkdtemp(path.join(os.tmpdir(), "toolbox-file-consistency-"));
    process.env.STORAGE_ROOT = root;
    process.env.DATABASE_PATH = path.join(root, "toolbox.db");
    const config = getConfig();
    database = new ToolboxDatabase(config.databasePath);
    const outputPath = path.join(config.outputDir, "result.webp");
    await fsp.mkdir(config.outputDir, { recursive: true });
    await fsp.writeFile(outputPath, "changed");
    const stale = path.join(config.outputDir, ".result.webp.staging-old");
    await fsp.writeFile(stale, "partial");
    database.upsertFile({
      id: "metadata-1",
      entityKind: "image-compress",
      entityId: "task-1",
      relativePath: "outputs/result.webp",
      byteSize: 999,
      sha256: crypto.createHash("sha256").update("original").digest("hex"),
      mediaType: "image/webp",
      owner: "local",
      createdAt: new Date().toISOString()
    });
    database.upsertFile({
      id: "metadata-2",
      entityKind: "image-compress",
      entityId: "task-2",
      relativePath: "outputs/missing.webp",
      byteSize: 1,
      createdAt: new Date().toISOString()
    });

    const result = await reconcileFileMetadataStorage(config, database);
    expect(result).toMatchObject({
      checked: 2,
      quarantined: 2,
      removedMetadata: 2,
      failures: [{ relativePath: "outputs/missing.webp", reason: "FILE_MISSING" }]
    });
    expect(await fsp.stat(outputPath).catch(() => undefined)).toBeUndefined();
    expect(await fsp.stat(stale).catch(() => undefined)).toBeUndefined();
    expect(database.listFiles()).toHaveLength(0);
    expect(database.connection.prepare("SELECT COUNT(*) AS count FROM audit_events").get()).toEqual({ count: 1 });
  });
});
