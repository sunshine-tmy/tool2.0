/**
 * 中文模块说明：测试 backend/src/__tests__/domain-consistency.test.ts 中的稳定行为、边界条件和回归场景
 */
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getConfig } from "../config";
import { reconcileDomainRecords } from "../database/domain-consistency";
import { FileMetadataRepository } from "../database/file-metadata";
import { ToolboxDatabase } from "../database/toolbox-database";
import { XhsArchiveStore } from "../modules/xhs-archive/store";

let testRoot: string | undefined;
const openDatabases: ToolboxDatabase[] = [];

afterEach(async () => {
  delete process.env.STORAGE_ROOT;
  delete process.env.DATABASE_PATH;
  // 先统一关闭连接再删除临时目录，避免 WAL/SHM 文件被占用导致清理失败。
  for (const database of openDatabases) database.close();
  openDatabases.length = 0;
  if (testRoot) await fsp.rm(testRoot, { recursive: true, force: true }).catch(() => undefined);
  testRoot = undefined;
});

async function createEnv() {
  testRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "toolbox-domain-consistency-"));
  process.env.STORAGE_ROOT = testRoot;
  process.env.DATABASE_PATH = path.join(testRoot, "toolbox.db");
  const config = getConfig();
  const database = new ToolboxDatabase(config.databasePath);
  openDatabases.push(database);
  return { config, database };
}

function upsert(database: ToolboxDatabase, kind: string, id: string, payload: unknown, status?: string) {
  const now = new Date().toISOString();
  database.upsert({ id, kind, ...(status === undefined ? {} : { status }), payload, createdAt: now, updatedAt: now });
}

describe("domain record consistency", () => {
  it("removes xhs archives whose manifest is missing and keeps artifacts-backed records", async () => {
    const { config, database } = await createEnv();
    await fsp.mkdir(path.join(config.xhsArchiveItemsDir, "kept"), { recursive: true });
    await fsp.writeFile(path.join(config.xhsArchiveItemsDir, "kept", "manifest.json"), "{}");
    await fsp.writeFile(path.join(config.xhsArchiveItemsDir, "kept", "b.jpg"), "media");
    upsert(database, "xhs-archive", "kept", { id: "kept", noteId: "n1", media: [] }, "ready");
    upsert(database, "xhs-archive", "gone", { id: "gone", noteId: "n2", media: [] }, "ready");
    upsert(database, "xhs-media", "media-of-gone", { archiveId: "gone", fileName: "a.jpg" });
    upsert(database, "xhs-media", "media-of-kept", { archiveId: "kept", fileName: "b.jpg" });

    const result = await reconcileDomainRecords(config, database);

    expect(result.removed).toBe(2);
    expect(database.get("xhs-archive", "kept")).toBeDefined();
    expect(database.get("xhs-archive", "gone")).toBeUndefined();
    expect(database.get("xhs-media", "media-of-gone")).toBeUndefined();
    expect(database.get("xhs-media", "media-of-kept")).toBeDefined();
  });

  it("removes chatterbox batches without meta.json, cascading items and unified tasks", async () => {
    const { config, database } = await createEnv();
    await fsp.mkdir(path.join(config.chatterboxDir, "batches", "kept", "items", "item-of-kept"), { recursive: true });
    await fsp.writeFile(path.join(config.chatterboxDir, "batches", "kept", "meta.json"), "{}");
    upsert(database, "chatterbox-batch", "kept", { id: "kept" }, "completed");
    upsert(database, "chatterbox-batch", "gone", { id: "gone" }, "completed");
    upsert(database, "chatterbox-item", "item-of-gone", { batchId: "gone" }, "completed");
    upsert(database, "chatterbox-item", "item-of-kept", { batchId: "kept" }, "completed");
    upsert(database, "task", "gone", { toolId: "edge-tts" }, "completed");

    const result = await reconcileDomainRecords(config, database);

    expect(database.get("chatterbox-batch", "kept")).toBeDefined();
    expect(database.get("chatterbox-batch", "gone")).toBeUndefined();
    expect(database.get("chatterbox-item", "item-of-gone")).toBeUndefined();
    expect(database.get("chatterbox-item", "item-of-kept")).toBeDefined();
    expect(database.get("task", "gone")).toBeUndefined();
    expect(result.removed).toBe(2);
  });

  it("keeps chatterbox voices and edge-tts tasks that still have artifacts or are running", async () => {
    const { config, database } = await createEnv();
    await fsp.mkdir(path.join(config.chatterboxDir, "voices", "voice-kept"), { recursive: true });
    await fsp.writeFile(path.join(config.chatterboxDir, "voices", "voice-kept", "meta.json"), "{}");
    upsert(database, "chatterbox-voice", "voice-kept", { id: "voice-kept" }, "ready");
    upsert(database, "chatterbox-voice", "voice-gone", { id: "voice-gone" }, "ready");

    await fsp.mkdir(path.join(config.edgeTtsTasksDir, "task-kept"), { recursive: true });
    await fsp.writeFile(path.join(config.edgeTtsTasksDir, "task-kept", "meta.json"), "{}");
    upsert(database, "edge-tts-task", "task-kept", { id: "task-kept" }, "completed");
    upsert(database, "edge-tts-task", "task-gone", { id: "task-gone" }, "completed");
    upsert(database, "edge-tts-task", "task-running", { id: "task-running" }, "processing");

    const result = await reconcileDomainRecords(config, database);

    expect(database.get("chatterbox-voice", "voice-kept")).toBeDefined();
    expect(database.get("chatterbox-voice", "voice-gone")).toBeUndefined();
    expect(database.get("edge-tts-task", "task-kept")).toBeDefined();
    expect(database.get("edge-tts-task", "task-gone")).toBeUndefined();
    expect(database.get("edge-tts-task", "task-running")).toBeDefined();
    expect(result.failures).toHaveLength(0);
  });

  it("only removes image-ai tasks when inputs, outputs and manifest are all missing", async () => {
    const { config, database } = await createEnv();
    await fsp.mkdir(config.imageAiTasksDir, { recursive: true });
    await fsp.mkdir(path.join(config.imageAiInputsDir, "has-inputs"), { recursive: true });
    await fsp.mkdir(path.join(config.imageAiOutputsDir, "has-outputs"), { recursive: true });
    await fsp.writeFile(path.join(config.imageAiTasksDir, "has-manifest.json"), "{}");
    upsert(database, "image-ai-task", "has-inputs", { id: "has-inputs" }, "completed");
    upsert(database, "image-ai-task", "has-outputs", { id: "has-outputs" }, "completed");
    upsert(database, "image-ai-task", "has-manifest", { id: "has-manifest" }, "completed");
    upsert(database, "image-ai-task", "none", { id: "none" }, "completed");
    upsert(database, "image-ai-task", "pending-none", { id: "pending-none" }, "pending");

    const result = await reconcileDomainRecords(config, database);

    expect(database.get("image-ai-task", "has-inputs")).toBeDefined();
    expect(database.get("image-ai-task", "has-outputs")).toBeDefined();
    expect(database.get("image-ai-task", "has-manifest")).toBeDefined();
    expect(database.get("image-ai-task", "none")).toBeUndefined();
    expect(database.get("image-ai-task", "pending-none")).toBeDefined();
    expect(result.removed).toBe(1);
  });

  it("skips a domain entirely when its storage root is missing", async () => {
    const { config, database } = await createEnv();
    upsert(database, "xhs-archive", "survivor", { id: "survivor", noteId: "n", media: [] }, "ready");
    await fsp.rm(config.xhsArchiveDir, { recursive: true, force: true });

    const result = await reconcileDomainRecords(config, database);

    expect(database.get("xhs-archive", "survivor")).toBeDefined();
    expect(result.checked).toBe(0);
    expect(result.removed).toBe(0);
  });

  it("records an audit event when orphaned records are removed", async () => {
    const { config, database } = await createEnv();
    await fsp.mkdir(config.xhsArchiveItemsDir, { recursive: true });
    upsert(database, "xhs-archive", "gone", { id: "gone", noteId: "n", media: [] }, "ready");

    await reconcileDomainRecords(config, database);

    expect(
      database.connection
        .prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action = 'storage.domain_record_consistency'")
        .get()
    ).toEqual({ count: 1 });
  });
});

describe("xhs archive store purgeAll", () => {
  it("removes in-memory items, database rows and item directories", async () => {
    const { config, database } = await createEnv();
    const fileMetadata = new FileMetadataRepository(database, config.storageRoot);
    const store = new XhsArchiveStore(config, database, fileMetadata);
    const item = {
      id: "arch1",
      noteId: "note1",
      type: "image",
      status: "ready",
      title: "t",
      description: "",
      sourceUrl: "",
      canonicalUrl: "",
      publishedAt: "",
      fetchedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      warnings: [],
      topics: [],
      media: [],
      totalBytes: 0
    };
    await fsp.mkdir(path.join(config.xhsArchiveItemsDir, "arch1"), { recursive: true });
    await fsp.writeFile(path.join(config.xhsArchiveItemsDir, "arch1", "manifest.json"), JSON.stringify(item));

    // 首次 list 触发 initialize：DB 无记录时从各条目 manifest 重建内存状态。
    expect((await store.list()).items).toHaveLength(1);
    expect(database.list("xhs-archive")).toHaveLength(1);

    const removed = await store.purgeAll();

    expect(removed).toBe(1);
    expect((await store.list()).items).toHaveLength(0);
    expect(database.list("xhs-archive")).toHaveLength(0);
    await expect(fsp.stat(path.join(config.xhsArchiveItemsDir, "arch1"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
