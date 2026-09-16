/**
 * 中文模块说明：测试 scripts/cleanup-engine.test.mjs 中的稳定行为、边界条件和回归场景
 */
import { strict as assert } from "node:assert";
import { after, describe, it } from "node:test";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { cleanupDefinitions, executeCleanup, inspectCleanupCategories, removeWithSkips } from "./cleanup-engine.mjs";

const tempDirs = [];

async function makeTempDir() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "cleanup-engine-"));
  tempDirs.push(dir);
  return dir;
}

// 持久锁定用 rmImpl：目标等于被锁文件，或为被锁文件的祖先目录时，模拟操作系统拒绝删除。
// 真实文件被进程锁定时，直接删除该文件会报 EBUSY，递归删除其父目录同样会因未删子项而失败。
function persistentLockRm(lockedPath) {
  return async (target, options) => {
    if (typeof target === "string" && (target === lockedPath || lockedPath.startsWith(`${target}${path.sep}`))) {
      throw Object.assign(new Error("busy"), { code: "EBUSY" });
    }
    return rm(target, options);
  };
}

after(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true }).catch(() => {})));
});

describe("removeWithSkips", () => {
  it("removes nested directories and files when nothing is locked", async () => {
    const dir = await makeTempDir();
    await mkdir(path.join(dir, "a", "b"), { recursive: true });
    await writeFile(path.join(dir, "a", "b", "inner.txt"), "inner");
    await writeFile(path.join(dir, "a", "outer.txt"), "outer");

    const skipped = [];
    await removeWithSkips(dir, skipped, { retryDelayMs: 0 });

    assert.equal(skipped.length, 0);
    await assert.rejects(stat(dir), { code: "ENOENT" });
  });

  it("keeps a persistently locked file, records its size, and preserves its ancestors", async () => {
    const dir = await makeTempDir();
    const sub = path.join(dir, "sub");
    await mkdir(sub, { recursive: true });
    const lockedPath = path.join(sub, "locked.log");
    await writeFile(lockedPath, "locked content");
    await writeFile(path.join(sub, "free.txt"), "free");
    await writeFile(path.join(dir, "root.txt"), "root");
    const lockedSize = (await stat(lockedPath)).size;

    const skipped = [];
    await removeWithSkips(dir, skipped, { rmImpl: persistentLockRm(lockedPath), retryDelayMs: 0 });

    assert.deepEqual(skipped, [{ path: lockedPath, bytes: lockedSize }]);
    assert.equal((await stat(lockedPath)).size, lockedSize);
    await assert.rejects(stat(path.join(sub, "free.txt")), { code: "ENOENT" });
    await assert.rejects(stat(path.join(dir, "root.txt")), { code: "ENOENT" });
    await stat(sub);
    await stat(dir);
  });

  it("deletes a file that is only transiently locked", async () => {
    const dir = await makeTempDir();
    const transientPath = path.join(dir, "transient.log");
    await writeFile(transientPath, "data");
    let calls = 0;
    const rmImpl = async (target, options) => {
      if (typeof target === "string" && target.includes("transient.log")) {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error("busy"), { code: "EBUSY" });
      }
      return rm(target, options);
    };

    const skipped = [];
    await removeWithSkips(transientPath, skipped, { rmImpl, retryDelayMs: 0 });

    assert.equal(skipped.length, 0);
    await assert.rejects(stat(transientPath), { code: "ENOENT" });
  });

  it("rejects non-lock errors instead of skipping", async () => {
    const dir = await makeTempDir();
    await writeFile(path.join(dir, "file.txt"), "x");
    const rmImpl = async () => {
      throw Object.assign(new Error("io"), { code: "EIO" });
    };

    await assert.rejects(removeWithSkips(dir, [], { rmImpl, retryDelayMs: 0 }), { code: "EIO" });
  });
});

describe("executeCleanup", () => {
  it("registers database and recovery artifacts as a high-risk full-cleanup category", () => {
    const metadata = cleanupDefinitions.find((definition) => definition.id === "metadata");
    assert.deepEqual(metadata?.targets, [
      "storage/toolbox.db",
      "storage/toolbox.db-wal",
      "storage/toolbox.db-shm",
      "storage/migration-backups",
      "storage/quarantine"
    ]);
    assert.equal(metadata?.risk, "high");
    assert.equal(metadata?.requiresStop, true);
  });

  it("keeps the permanent Chatterbox voice library out of full cleanup", () => {
    const voice = cleanupDefinitions.find((definition) => definition.id === "voice");
    assert.deepEqual(voice?.targets, ["storage/edge-tts", "storage/chatterbox/tasks", "storage/chatterbox/batches"]);
    assert.equal(voice?.targets.includes("storage/chatterbox/voices"), false);
  });

  it("removes every registered runtime category from an isolated full-cleanup root", async () => {
    const tmpRoot = await makeTempDir();
    const cleanableFixtures = [
      "backend/dist/app.js",
      ".tmp/cache.bin",
      ".logs/backend.log",
      ".package/standalone/archive.zip",
      "storage/uploads/image.jpg",
      "storage/image-ai/tasks/job.json",
      "storage/lan-transfer/files/shared.txt",
      "storage/video-text/results/task.json",
      "storage/edge-tts/tasks/task.json",
      "storage/chatterbox/batches/batch/meta.json",
      "storage/chatterbox/tasks/task/meta.json",
      "storage/short-video/cache.json",
      "storage/toolbox.db",
      "storage/migration-backups/backup.db",
      "storage/quarantine/recoverable.bin",
      "storage/xhs-archive/staging/job/manifest.json",
      "storage/xhs-archive/items/archive/manifest.json",
      "storage/xhs-archive/index.json"
    ];
    const permanentVoiceFixtures = [
      "storage/chatterbox/voices/voice-kept/meta.json",
      "storage/chatterbox/voices/voice-kept/reference.wav"
    ];
    for (const relative of [...cleanableFixtures, ...permanentVoiceFixtures]) {
      const target = path.join(tmpRoot, relative);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, "runtime-data");
    }

    const results = await executeCleanup(
      cleanupDefinitions.map((definition) => definition.id),
      { root: tmpRoot, retryDelayMs: 0 }
    );

    assert.equal(results.length, cleanupDefinitions.length);
    for (const relative of cleanableFixtures)
      await assert.rejects(stat(path.join(tmpRoot, relative)), { code: "ENOENT" });
    for (const relative of permanentVoiceFixtures) await stat(path.join(tmpRoot, relative));
    // 即使运行数据全清，也恢复版本库需要保留的空目录占位文件。
    await stat(path.join(tmpRoot, "storage/uploads/.gitkeep"));
    await stat(path.join(tmpRoot, "storage/outputs/.gitkeep"));
    await stat(path.join(tmpRoot, "storage/lan-transfer/files/.gitkeep"));
  });

  it("reports deleted and skipped files within a sandbox root", async () => {
    const tmpRoot = await makeTempDir();
    const tempDir = path.join(tmpRoot, "storage", "temp");
    await mkdir(tempDir, { recursive: true });
    await writeFile(path.join(tempDir, "free1.txt"), "aaaa");
    await writeFile(path.join(tempDir, "free2.txt"), "bbbb");
    const lockedPath = path.join(tempDir, "locked.log");
    await writeFile(lockedPath, "cccc");
    const free1Size = (await stat(path.join(tempDir, "free1.txt"))).size;
    const free2Size = (await stat(path.join(tempDir, "free2.txt"))).size;
    const lockedSize = (await stat(lockedPath)).size;

    const results = await executeCleanup(["temp"], {
      root: tmpRoot,
      rmImpl: persistentLockRm(lockedPath),
      retryDelayMs: 0
    });

    assert.equal(results.length, 1);
    const [result] = results;
    assert.equal(result.files, 2);
    assert.equal(result.bytes, free1Size + free2Size);
    assert.equal(result.skippedFiles, 1);
    assert.equal(result.skippedBytes, lockedSize);

    assert.equal((await stat(lockedPath)).size, lockedSize);
    await stat(tempDir);

    const inspection = await inspectCleanupCategories(["temp"], tmpRoot);
    assert.equal(inspection.length, 1);
    assert.equal(inspection[0].files, 1);
  });
});
