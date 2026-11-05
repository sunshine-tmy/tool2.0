/**
 * 中文模块说明：测试 apps/api/src/__tests__/file-consistency.test.ts 中的稳定行为、边界条件和回归场景
 */
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "../config";
import { reconcileFileMetadataStorage } from "../database/file-consistency";
import { ToolboxDatabase } from "../database/toolbox-database";

let root: string | undefined;
let database: ToolboxDatabase | undefined;

afterEach(async () => {
  vi.restoreAllMocks();
  database?.close();
  database = undefined;
  delete process.env.STORAGE_ROOT;
  delete process.env.DATABASE_PATH;
  if (root) await fsp.rm(root, { recursive: true, force: true });
  root = undefined;
});

async function createEnv() {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), "toolbox-file-consistency-"));
  process.env.STORAGE_ROOT = root;
  process.env.DATABASE_PATH = path.join(root, "toolbox.db");
  const config = getConfig();
  database = new ToolboxDatabase(config.databasePath);
  await fsp.mkdir(config.outputDir, { recursive: true });
  return { config, database };
}

function register(
  database: ToolboxDatabase,
  id: string,
  relativePath: string,
  content: Buffer | string,
  createdAt = "2026-11-04T00:00:00.000Z"
) {
  const metadata = {
    id,
    relativePath,
    entityKind: "image-compress",
    entityId: id,
    byteSize: Buffer.byteLength(content),
    sha256: crypto.createHash("sha256").update(content).digest("hex"),
    createdAt
  };
  database.upsertFile(metadata);
  return metadata;
}

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

  it("fully rechecks content on every startup, including same-size changes with the original mtime", async () => {
    const { config, database } = await createEnv();
    const content = Buffer.alloc(2 * 1024 * 1024 + 7, 42);
    const target = path.join(config.outputDir, "kept.bin");
    await fsp.writeFile(target, content);
    register(database, "kept", "outputs/kept.bin", content);
    expect(await reconcileFileMetadataStorage(config, database)).toEqual({
      checked: 1,
      quarantined: 0,
      removedMetadata: 0,
      failures: []
    });
    const before = await fsp.stat(target);
    content[content.length - 1] = 43;
    await fsp.writeFile(target, content);
    await fsp.utimes(target, before.atime, before.mtime);
    expect(await reconcileFileMetadataStorage(config, database)).toEqual({
      checked: 1,
      quarantined: 1,
      removedMetadata: 1,
      failures: []
    });
    expect(database.listFiles()).toHaveLength(0);
  });

  it("bounds simultaneous full-file reads and closes every stream before a quarantine move", async () => {
    const { config, database } = await createEnv();
    const content = Buffer.alloc(2 * 1024 * 1024, 42);
    for (let index = 0; index < 5; index++) {
      await fsp.writeFile(path.join(config.outputDir, `${index}.bin`), content);
      const metadata = register(database, `file-${index}`, `outputs/${index}.bin`, content);
      if (index === 4) database.upsertFile({ ...metadata, sha256: "0".repeat(64) });
    }
    let active = 0,
      peak = 0;
    const read = fs.createReadStream.bind(fs),
      streams: fs.ReadStream[] = [];
    vi.spyOn(fs, "createReadStream").mockImplementation((...args) => {
      const stream = read(...args);
      streams.push(stream);
      active++;
      peak = Math.max(peak, active);
      stream.once("close", () => active--);
      return stream;
    });
    const rename = fsp.rename.bind(fsp);
    vi.spyOn(fsp, "rename").mockImplementation(async (...args) => {
      expect(active).toBe(0);
      expect(streams.every((stream) => stream.closed)).toBe(true);
      await rename(...args);
    });
    expect(await reconcileFileMetadataStorage(config, database)).toEqual({
      checked: 5,
      quarantined: 1,
      removedMetadata: 1,
      failures: []
    });
    expect(peak).toBe(2);
    expect(active).toBe(0);
    expect(streams).toHaveLength(5);
    expect(database.listFiles()).toHaveLength(4);
  });

  it("does not read an entire file already known to have the wrong size", async () => {
    const { config, database } = await createEnv();
    await fsp.writeFile(path.join(config.outputDir, "short.bin"), "short");
    register(database, "wrong-size", "outputs/short.bin", "longer expected content");
    const read = vi.spyOn(fs, "createReadStream");
    expect(await reconcileFileMetadataStorage(config, database)).toEqual({
      checked: 1,
      quarantined: 1,
      removedMetadata: 1,
      failures: []
    });
    expect(read).not.toHaveBeenCalled();
  });

  it("rechecks a prefetched alias after its earlier metadata row quarantines the shared file", async () => {
    const { config, database } = await createEnv();
    await fsp.writeFile(path.join(config.outputDir, "alias.bin"), "valid");
    register(database, "first", "outputs/alias.bin", "wrong size", "2026-11-04T01:00:00.000Z");
    register(database, "second", "outputs/./alias.bin", "valid");
    expect(await reconcileFileMetadataStorage(config, database)).toEqual({
      checked: 2,
      quarantined: 1,
      removedMetadata: 2,
      failures: [{ relativePath: "outputs/./alias.bin", reason: "FILE_MISSING" }]
    });
    expect(database.listFiles()).toHaveLength(0);
  });

  it("retains a readable file if quarantine fails and reports the existing failure reason", async () => {
    const { config, database } = await createEnv();
    const target = path.join(config.outputDir, "busy.bin");
    await fsp.writeFile(target, "changed");
    register(database, "busy", "outputs/busy.bin", "initial");
    vi.spyOn(fsp, "rename").mockRejectedValue(new Error("file in use"));
    expect(await reconcileFileMetadataStorage(config, database)).toEqual({
      checked: 1,
      quarantined: 0,
      removedMetadata: 1,
      failures: [{ relativePath: "outputs/busy.bin", reason: "SHA256_MISMATCH:QUARANTINE_FAILED" }]
    });
    expect(await fsp.readFile(target, "utf8")).toBe("changed");
  });

  it.each(["audio-library-item", "audio-convert-job", "audio-extract-job"])(
    "preserves %s files under their domain-owned rules",
    async (entityKind) => {
      const { config, database } = await createEnv();
      const target = path.join(config.outputDir, "audio.bin");
      await fsp.writeFile(target, "changed");
      const metadata = register(database, "audio", "outputs/audio.bin", "expected");
      database.upsertFile({ ...metadata, entityKind });
      expect(await reconcileFileMetadataStorage(config, database)).toEqual({
        checked: 0,
        quarantined: 0,
        removedMetadata: 0,
        failures: []
      });
      expect(database.getFile("audio")).toBeDefined();
      expect(await fsp.readFile(target, "utf8")).toBe("changed");
    }
  );
});
