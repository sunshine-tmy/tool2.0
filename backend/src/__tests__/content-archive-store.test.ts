/** 多平台存储回归只使用临时 storage：身份隔离、事务/文件失败、刷新、配额与兼容接口不依赖平台网络。 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toXhsArchive, type ContentArchiveItem } from "@toolbox/shared";
import { getConfig, type AppConfig } from "../config";
import { ToolboxDatabase } from "../database/toolbox-database";
import { FileMetadataRepository } from "../database/file-metadata";
import { ContentArchiveStore } from "../modules/media-archive/store";
import { XhsArchiveStore } from "../modules/xhs-archive/store";
import { archiveTranslationSourceHash } from "../modules/media-archive/text";
import { translationSourceHash } from "../modules/xhs-archive/translation-service";

let root: string;
let config: AppConfig;
let database: ToolboxDatabase;
let legacy: XhsArchiveStore;
let store: ContentArchiveStore;
const bytes = Buffer.from("isolated media bytes");
const hash = (value: Buffer) => createHash("sha256").update(value).digest("hex");
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-content-store-"));
  config = getConfig({
    dotenvPath: false,
    environment: { NODE_ENV: "test", STORAGE_ROOT: root, DEPLOYMENT_MODE: "local" }
  });
  database = new ToolboxDatabase(":memory:");
  legacy = new XhsArchiveStore(config, database);
  store = legacy.content;
  await store.initialize();
});
afterEach(async () => {
  vi.restoreAllMocks();
  database.close();
  if (
    !path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) ||
    !path.basename(root).startsWith("toolbox-content-store-")
  )
    throw new Error("测试清理目录越界");
  await fs.rm(root, { recursive: true, force: true });
});
function item(
  id = "archive_123456",
  platform: ContentArchiveItem["platform"] = "douyin",
  mediaBytes = bytes
): ContentArchiveItem {
  const url = "/api/v1/tools/media-archive/items/" + id + "/media/video_123456";
  return {
    id,
    platform,
    contentId: "123456789",
    sourceUrl: "https://www.douyin.com/video/123456789",
    canonicalUrl: "https://www.douyin.com/video/123456789",
    type: "video",
    title: "测试",
    description: "原文 #话题",
    rawText: platform === "douyin" ? "原文 #话题" : undefined,
    topics: [],
    media: [
      {
        id: "video_123456",
        kind: "video",
        index: 0,
        fileName: "original.mp4",
        size: mediaBytes.length,
        checksum: hash(mediaBytes),
        mimeType: "video/mp4",
        previewUrl: url,
        downloadUrl: url + "?download=1"
      }
    ],
    fetchedAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    warnings: [],
    status: "ready",
    totalBytes: mediaBytes.length
  };
}
async function staging(value: ContentArchiveItem, contents = bytes) {
  const directory = await store.createStaging("stage_" + Math.random().toString(36).slice(2));
  for (const media of value.media) await fs.writeFile(path.join(directory, media.fileName), contents);
  return directory;
}
const target = (id = "archive_123456") => path.join(config.xhsArchiveItemsDir, id);

describe("多媒体共享存储与小红书过滤视图", () => {
  it("跨平台同作品 ID 独立保存，旧视图拒绝读取、删除、截帧和翻译抖音", async () => {
    const xhs = item("xhs_123456", "xiaohongshu");
    xhs.media[0].id = "xhs_media123";
    await legacy.commit(toXhsArchive(xhs), await staging(xhs));
    const douyin = item();
    await store.commit(douyin, await staging(douyin));
    expect((await store.list()).total).toBe(2);
    expect(
      (await store.list({ platform: "douyin", keyword: "话题", type: "video", pageSize: 1 })).items[0].platform
    ).toBe("douyin");
    expect((await store.list({ keyword: "missing" })).total).toBe(0);
    expect((await legacy.list()).total).toBe(1);
    expect((await legacy.get(xhs.id))?.noteId).toBe(xhs.contentId);
    expect((await store.findBySource("xiaohongshu", xhs.contentId))?.id).toBe(xhs.id);
    expect((await store.findBySource("douyin", douyin.contentId))?.id).toBe(douyin.id);
    expect(await legacy.get(douyin.id)).toBeUndefined();
    expect(await legacy.mediaPath(douyin.id, douyin.media[0].id)).toBeUndefined();
    expect(await legacy.remove(douyin.id)).toBe(false);
    expect(await legacy.updateTranslation(douyin.id, (value) => value)).toBeUndefined();
    await expect(
      legacy.addVideoFrame(douyin.id, {
        png: bytes,
        sourceMediaId: "video_123456",
        timestampMs: 1,
        width: 1,
        height: 1
      })
    ).rejects.toMatchObject({ code: "XHS_ARCHIVE_NOT_FOUND" });
    expect(await fs.readFile(path.join(target(douyin.id), "original.mp4"))).toEqual(bytes);
    expect(await legacy.totalBytes()).toBe(bytes.length * 2);
  });

  it("重启读取两平台，无缺字段的旧载荷和旧 manifest 不被重写", async () => {
    const old = toXhsArchive(item("old_123456", "xiaohongshu"));
    const { topics: _topics, warnings: _warnings, ...v1 } = old;
    database.upsert({
      id: old.id,
      kind: "xhs-archive",
      payload: v1,
      createdAt: old.fetchedAt,
      updatedAt: old.updatedAt
    });
    const before = database.get("xhs-archive", old.id)!.payload;
    const restarted = new XhsArchiveStore(config, database);
    expect((await restarted.get(old.id))?.topics.length).toBeGreaterThan(0);
    expect(database.get("xhs-archive", old.id)!.payload).toEqual(before);
    const value = item();
    await store.commit(value, await staging(value));
    const manifest = await fs.readFile(path.join(target(), "manifest.json"));
    const afterRestart = new XhsArchiveStore(config, database);
    expect((await afterRestart.content.list()).total).toBe(2);
    expect(await afterRestart.get(value.id)).toBeUndefined();
    expect((await afterRestart.content.get(value.id))?.rawText).toBe(value.rawText);
    expect(await fs.readFile(path.join(target(), "manifest.json"))).toEqual(manifest);
  });

  it("同平台重复身份和更改平台/作品 ID 在替换文件前拒绝", async () => {
    const current = item();
    await store.commit(current, await staging(current));
    const duplicate = item("duplicate_123456");
    await expect(store.commit(duplicate, await staging(duplicate))).rejects.toThrow("ARCHIVE_IDENTITY_CONFLICT");
    for (const change of [{ platform: "xiaohongshu" as const }, { contentId: "987654321" }]) {
      const candidate = { ...current, ...change };
      await expect(store.commit(candidate, await staging(candidate))).rejects.toThrow("ARCHIVE_IDENTITY_IMMUTABLE");
    }
    expect((await store.get(current.id))?.platform).toBe("douyin");
    expect(await fs.readFile(path.join(target(), "original.mp4"))).toEqual(bytes);
  });

  it.each(["size", "digest", "missing"] as const)("媒体 %s 异常不覆盖旧文件、数据库或文件索引", async (failure) => {
    const old = item();
    await store.commit(old, await staging(old));
    const rows = database.listFiles();
    const candidate = { ...old, title: "新标题", media: old.media.map((media) => ({ ...media })) };
    const staged = await staging(candidate);
    if (failure === "size") candidate.media[0].size++;
    if (failure === "digest") candidate.media[0].checksum = "0".repeat(64);
    if (failure === "missing") await fs.unlink(path.join(staged, candidate.media[0].fileName));
    await expect(store.commit(candidate, staged)).rejects.toThrow();
    expect((await store.get(old.id))?.title).toBe(old.title);
    expect(database.listFiles()).toEqual(rows);
    expect((database.get("xhs-archive", old.id)!.payload as ContentArchiveItem).title).toBe(old.title);
    expect(await fs.readFile(path.join(target(), "original.mp4"))).toEqual(bytes);
  });

  it.each(["record", "index"] as const)("事务 %s 写入失败同时恢复旧目录、记录与文件索引", async (failure) => {
    const old = item();
    await store.commit(old, await staging(old));
    const index = database.listFiles();
    const candidate = { ...old, title: "新标题" };
    const staged = await staging(candidate);
    if (failure === "record")
      vi.spyOn(database, "upsert").mockImplementationOnce(() => {
        throw new Error("disk failure");
      });
    else
      vi.spyOn(database, "upsertFile").mockImplementationOnce(() => {
        throw new Error("index failure");
      });
    await expect(store.commit(candidate, staged)).rejects.toThrow(/failure/);
    expect((await store.get(old.id))?.title).toBe(old.title);
    expect((database.get("xhs-archive", old.id)!.payload as ContentArchiveItem).title).toBe(old.title);
    expect(database.listFiles()).toEqual(index);
    expect(await fs.readFile(path.join(target(), "original.mp4"))).toEqual(bytes);
    expect(await fs.stat(target() + ".previous").catch(() => undefined)).toBeUndefined();
  });

  it("新归档事务失败不留下工件或半条元数据", async () => {
    const value = item();
    const staged = await staging(value);
    vi.spyOn(database, "upsertFile").mockImplementationOnce(() => {
      throw new Error("index failed");
    });
    await expect(store.commit(value, staged)).rejects.toThrow("index failed");
    expect(await store.get(value.id)).toBeUndefined();
    expect(database.get("xhs-archive", value.id)).toBeUndefined();
    expect(database.listFiles()).toHaveLength(0);
    expect(await fs.stat(target()).catch(() => undefined)).toBeUndefined();
  });

  it("旧目录无法移动时绝不清理它，第二次移动失败时原目录完整恢复", async () => {
    const value = item();
    await store.commit(value, await staging(value));
    const rename = fs.rename.bind(fs);
    const mock = vi.spyOn(fs, "rename");
    for (const failedMove of ["old", "new"]) {
      const staged = await staging(value);
      mock.mockImplementation(async (from, to) => {
        if ((failedMove === "old" && String(from) === target()) || (failedMove === "new" && String(from) === staged))
          throw new Error("locked file");
        return rename(from, to);
      });
      await expect(store.commit(value, staged)).rejects.toThrow("locked file");
      expect(await fs.readFile(path.join(target(), "original.mp4"))).toEqual(bytes);
      expect((await store.get(value.id))?.title).toBe(value.title);
      mock.mockReset();
    }
  });

  it("旧恢复备份不被覆盖或永久删除", async () => {
    const value = item();
    await store.commit(value, await staging(value));
    await fs.mkdir(target() + ".previous");
    await fs.writeFile(path.join(target() + ".previous", "sentinel"), "recovery data");
    await expect(store.commit(value, await staging(value))).rejects.toThrow("ARCHIVE_RECOVERY_REQUIRED");
    expect(await fs.readFile(path.join(target() + ".previous", "sentinel"), "utf8")).toBe("recovery data");
    expect(await fs.readFile(path.join(target(), "original.mp4"))).toEqual(bytes);
  });

  it("提交成功后备份清理失败不回滚新数据库或媒体", async () => {
    const old = item();
    await store.commit(old, await staging(old));
    const remove = fs.rm.bind(fs);
    vi.spyOn(fs, "rm").mockImplementation(async (file, options) => {
      if (String(file) === target() + ".previous") throw new Error("cleanup locked");
      return remove(file, options);
    });
    const next = { ...old, title: "新的正文" };
    expect((await store.commit(next, await staging(next))).title).toBe(next.title);
    expect((database.get("xhs-archive", old.id)!.payload as ContentArchiveItem).title).toBe(next.title);
    expect(await fs.stat(target() + ".previous")).toBeDefined();
  });

  it("并发提交按共享总配额串行复核，且保留已成功的另一平台记录", async () => {
    config.xhsArchiveMaxStorageBytes = bytes.length;
    const first = item();
    const second = item("second_123456", "xiaohongshu");
    second.media[0].id = "second_media123";
    const stages = await Promise.all([staging(first), staging(second)]);
    const results = await Promise.allSettled([store.commit(first, stages[0]), store.commit(second, stages[1])]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await store.list()).total).toBe(1);
    expect(database.list("xhs-archive")).toHaveLength(1);
    expect(await store.totalBytes()).toBe(bytes.length);
  });

  it("刷新保留截帧和锁内最新手工译文，源文变化只标记过期", async () => {
    const old = item();
    old.translation = {
      status: "ready",
      sourceHash: archiveTranslationSourceHash(old),
      sourceLanguage: "zh-CN",
      targetLanguage: "en",
      provider: "opus-mt",
      modelId: "Helsinki-NLP/opus-mt-zh-en",
      modelRevision: "fixed",
      title: { source: old.title, machine: "Test", edited: "Original edit" },
      topics: []
    };
    await store.commit(old, await staging(old));
    const frame = await store.addVideoFrame(old.id, {
      sourceMediaId: old.media[0].id,
      timestampMs: 1234,
      png: bytes,
      width: 1,
      height: 1
    });
    const captured = frame.media[1];
    await store.updateTranslation(old.id, (value) => ({
      ...value,
      translation: { ...value.translation!, title: { ...value.translation!.title, edited: "Latest edit" } }
    }));
    const updated = await store.commit(old, await staging(old));
    expect(updated.media[1]).toEqual(captured);
    expect(updated.translation?.title.edited).toBe("Latest edit");
    expect(updated.translation?.status).toBe("ready");
    const changed = { ...old, description: "新的原文" };
    const refreshed = await store.commit(changed, await staging(changed));
    expect(refreshed.translation).toMatchObject({ status: "stale", title: { edited: "Latest edit" } });
    expect(refreshed.totalBytes).toBe(bytes.length * 2);
    expect(await fs.readFile(path.join(target(), captured.fileName))).toEqual(bytes);
    expect(database.listFiles({ entityKind: "xhs-media" })).toHaveLength(2);
    const restarted = new ContentArchiveStore(config, database);
    expect((await restarted.get(old.id))?.media).toHaveLength(2);
  });

  it("删除事务失败还原工件和索引，重试成功移除该归档", async () => {
    const value = item();
    await store.commit(value, await staging(value));
    const files = database.listFiles();
    vi.spyOn(database, "remove").mockImplementationOnce(() => {
      throw new Error("database failure");
    });
    await expect(store.remove(value.id)).rejects.toThrow("database failure");
    expect(await fs.readFile(path.join(target(), "original.mp4"))).toEqual(bytes);
    expect(database.listFiles()).toEqual(files);
    expect(await store.remove(value.id)).toBe(true);
    expect(await store.get(value.id)).toBeUndefined();
    expect(database.get("xhs-archive", value.id)).toBeUndefined();
    expect(database.listFiles()).toHaveLength(0);
    expect(await store.remove(value.id)).toBe(false);
  });

  it("准备 staging 元数据不提前写入数据库，并拒绝根目录外读取", async () => {
    const repository = new FileMetadataRepository(database, root);
    const file = path.join(root, "staged.png");
    await fs.writeFile(file, bytes);
    const metadata = await repository.inspect(
      { entityKind: "xhs-media", entityId: "image_123456", filePath: path.join(root, "final.png") },
      file
    );
    expect(metadata.relativePath).toBe("final.png");
    expect(metadata.sha256).toBe(hash(bytes));
    expect(database.listFiles()).toHaveLength(0);
    await expect(
      repository.inspect(
        { entityKind: "xhs-media", entityId: "image_123456", filePath: path.join(root, "final.png") },
        path.dirname(root)
      )
    ).rejects.toThrow("escapes");
  });

  it.each(["../escape.mp4", "..\\escape.mp4", "stream:video", ".", ".."])(
    "危险媒体文件名 %s 在移动任何旧文件前拒绝",
    async (fileName) => {
      const value = item();
      await store.commit(value, await staging(value));
      const staged = await staging(value);
      const candidate = structuredClone(value);
      candidate.media[0].fileName = fileName;
      await expect(store.commit(candidate, staged)).rejects.toThrow("ARCHIVE_MEDIA_PATH_INVALID");
      expect(await fs.readFile(path.join(target(), "original.mp4"))).toEqual(bytes);
    }
  );

  it("拒绝 staging 根目录及外部目录，且不写入外部清单", async () => {
    const value = item();
    await expect(store.commit(value, config.xhsArchiveStagingDir)).rejects.toThrow("ARCHIVE_STAGING_PATH_INVALID");
    const outside = path.join(root, "not-staging");
    await fs.mkdir(outside);
    await expect(store.commit(value, outside)).rejects.toThrow("ARCHIVE_STAGING_PATH_INVALID");
    expect(await fs.stat(path.join(outside, "manifest.json")).catch(() => undefined)).toBeUndefined();
  });

  it("媒体 ID 和文件名不能重复，也不能覆盖另一归档的索引", async () => {
    const value = item();
    await store.commit(value, await staging(value));
    const other = item("other_123456", "xiaohongshu");
    await expect(store.commit(other, await staging(other))).rejects.toThrow("ARCHIVE_MEDIA_IDENTITY_CONFLICT");
    for (const duplicate of [value.media[0], { ...value.media[0], id: "other_media123" }]) {
      const candidate = { ...value, media: [...value.media, duplicate] };
      await expect(store.commit(candidate, await staging(candidate))).rejects.toThrow(
        "ARCHIVE_MEDIA_IDENTITY_CONFLICT"
      );
    }
    expect(database.listFiles({ entityKind: "xhs-media" })).toHaveLength(1);
  });

  it.each(["frame", "translation"] as const)("%s 索引事务失败恢复旧清单与记录，不残留新帧", async (operation) => {
    const value = item();
    await store.commit(value, await staging(value));
    const original = await fs.readFile(path.join(target(), "manifest.json"));
    const index = database.listFiles();
    vi.spyOn(database, "upsertFile").mockImplementationOnce(() => {
      throw new Error("index failed");
    });
    const pending =
      operation === "frame"
        ? store.addVideoFrame(value.id, {
            sourceMediaId: value.media[0].id,
            timestampMs: 20,
            png: bytes,
            width: 1,
            height: 1
          })
        : store.updateTranslation(value.id, (current) => ({ ...current, title: "新标题" }));
    await expect(pending).rejects.toThrow("index failed");
    expect(await store.get(value.id)).toEqual(value);
    expect(database.get("xhs-archive", value.id)!.payload).toEqual(value);
    expect(database.listFiles()).toEqual(index);
    expect(await fs.readFile(path.join(target(), "manifest.json"))).toEqual(original);
    expect((await fs.readdir(target())).sort()).toEqual(["manifest.json", "original.mp4"]);
  });

  it.each(["copy", "replace"] as const)("清单 %s 失败保持旧文件且清理当次临时文件", async (operation) => {
    const value = item();
    await store.commit(value, await staging(value));
    const original = await fs.readFile(path.join(target(), "manifest.json"));
    if (operation === "copy") vi.spyOn(fs, "copyFile").mockRejectedValueOnce(new Error("copy locked"));
    else vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("replace locked"));
    await expect(store.updateTranslation(value.id, (current) => ({ ...current, title: "新标题" }))).rejects.toThrow(
      "locked"
    );
    expect(await fs.readFile(path.join(target(), "manifest.json"))).toEqual(original);
    expect((await fs.readdir(target())).sort()).toEqual(["manifest.json", "original.mp4"]);
  });

  it("译文回调不能改变归档身份，未知条目、错误来源与配额有明确边界", async () => {
    const value = item();
    await store.commit(value, await staging(value));
    await expect(
      store.updateTranslation(value.id, (current) => ({ ...current, contentId: "different" }))
    ).rejects.toThrow("ARCHIVE_IDENTITY_IMMUTABLE");
    expect(await store.updateTranslation("missing_123456", (current) => current)).toBeUndefined();
    await expect(
      store.addVideoFrame("missing_123456", {
        sourceMediaId: "video_123456",
        timestampMs: 0,
        png: bytes,
        width: 1,
        height: 1
      })
    ).rejects.toMatchObject({ code: "XHS_ARCHIVE_NOT_FOUND" });
    await expect(
      store.addVideoFrame(value.id, {
        sourceMediaId: "missing_123456",
        timestampMs: 0,
        png: bytes,
        width: 1,
        height: 1
      })
    ).rejects.toMatchObject({ code: "XHS_FRAME_SOURCE_INVALID" });
    config.xhsArchiveMaxStorageBytes = bytes.length;
    await expect(
      store.addVideoFrame(value.id, { sourceMediaId: "video_123456", timestampMs: 0, png: bytes, width: 1, height: 1 })
    ).rejects.toMatchObject({ code: "XHS_STORAGE_QUOTA_EXCEEDED" });
  });

  it("兼容译文更新返回旧媒体 URL，清理覆盖共享物理类别而不是只清理一个平台", async () => {
    const value = item("xhs_123456", "xiaohongshu");
    value.media[0].id = "xhs_media123";
    await legacy.commit(toXhsArchive(value), await staging(value));
    const updated = await legacy.updateTranslation(value.id, (current) => ({ ...current, title: "译文元数据更新" }));
    expect(updated?.media[0].previewUrl).toContain("/tools/xhs-archive/");
    expect((await legacy.mediaPath(value.id, value.media[0].id))?.item.noteId).toBe(value.contentId);
    await store.commit(item(), await staging(item()));
    expect(await legacy.purgeAll()).toBe(2);
    expect((await store.list()).total).toBe(0);
    expect(database.list("xhs-archive")).toHaveLength(0);
  });

  it("两平台文本边界保持小红书 hash 兼容，抖音不应用小红书正文清洗", () => {
    const xhs = item("xhs_123456", "xiaohongshu");
    xhs.description = "正文[微笑R] #测试[话题]#";
    expect(archiveTranslationSourceHash(xhs)).toBe(translationSourceHash(toXhsArchive(xhs)));
    expect(archiveTranslationSourceHash({ ...xhs, platform: "douyin" })).not.toBe(archiveTranslationSourceHash(xhs));
    expect(
      archiveTranslationSourceHash({ ...xhs, description: undefined, topics: [{ id: "topic_test", source: " 测试 " }] })
    ).toHaveLength(64);
  });

  it("空库从混合清单重建，损坏清单与历史恢复目录保留且不误导入", async () => {
    const xhs = item("xhs_123456", "xiaohongshu");
    const douyin = item();
    for (const value of [xhs, douyin]) {
      await fs.mkdir(target(value.id));
      await fs.writeFile(path.join(target(value.id), "manifest.json"), JSON.stringify(value));
    }
    const broken = path.join(config.xhsArchiveItemsDir, "broken_123456");
    await fs.mkdir(broken);
    await fs.writeFile(path.join(broken, "manifest.json"), "broken");
    await fs.mkdir(target() + ".previous");
    await fs.writeFile(path.join(target() + ".previous", "manifest.json"), JSON.stringify(douyin));
    const recovered = new ContentArchiveStore(config, database);
    expect((await recovered.list({ page: 0, pageSize: 100, platform: "all" })).total).toBe(2);
    expect((await recovered.list({ page: 0, pageSize: 100 })).pageSize).toBe(50);
    expect((await recovered.list({ pageSize: -1 })).pageSize).toBe(12);
    expect(await fs.readFile(path.join(broken, "manifest.json"), "utf8")).toBe("broken");
    const clone = await recovered.get(douyin.id);
    clone!.media.length = 0;
    expect((await recovered.get(douyin.id))?.media).toHaveLength(1);
  });

  it("主清单损坏时读取备份，单条保存不删除初始化后加入的另一平台记录", async () => {
    const external = item("external_123456", "xiaohongshu");
    external.media[0].id = "external_media123";
    await fs.mkdir(path.dirname(config.xhsArchiveIndexPath), { recursive: true });
    await fs.writeFile(config.xhsArchiveIndexPath, "broken");
    await fs.writeFile(
      config.xhsArchiveIndexPath + ".bak",
      JSON.stringify({ version: 1, items: [toXhsArchive(external)] })
    );
    const recovered = new ContentArchiveStore(config, database);
    expect((await recovered.list()).total).toBe(1);
    const value = item();
    await store.commit(value, await staging(value));
    expect(database.get("xhs-archive", external.id)).toBeDefined();
    expect((await new ContentArchiveStore(config, database).list()).total).toBe(2);
  });

  it("数据库载荷身份与真实列不符时拒绝启动，不改写原载荷", async () => {
    const value = item();
    await store.commit(value, await staging(value));
    database.connection
      .prepare("UPDATE xhs_archives SET payload_json = ? WHERE id = ?")
      .run(JSON.stringify({ ...value, contentId: "other" }), value.id);
    await expect(new ContentArchiveStore(config, database).initialize()).rejects.toThrow("ARCHIVE_IDENTITY_MISMATCH");
    expect(await fs.readFile(path.join(target(), "original.mp4"))).toEqual(bytes);
  });
});
