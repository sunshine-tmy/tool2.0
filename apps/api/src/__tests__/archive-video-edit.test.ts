import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultArchiveAudioSettings,
  type ArchiveVideoEditInput,
  type AudioLibraryItem,
  type ContentArchiveItem
} from "@toolbox/shared";
import { getConfig } from "../config";
import { ToolboxDatabase } from "../database/toolbox-database";
import { createTaskStore } from "../tasks/task-store";
import { ContentArchiveStore } from "../domains/content-archive/core/store";
import { ArchiveVideoEditService } from "../domains/content-archive/video-edit/service";
import { registerVideoEditRoutes } from "../domains/content-archive/video-edit/routes";
import { registerArchivePreviewRoutes } from "../domains/content-archive/core/media-preview-routes";
import { registerArchiveArtifactRoutes } from "../domains/content-archive/core/artifact-routes";
import { audioMixFilter, type RenderVideoOptions } from "../domains/content-archive/video-edit/renderer";
import { readArchiveZip } from "./helpers/archive-zip";
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const original = Buffer.from("immutable-original-video"),
  musicBytes = Buffer.from("music-one");
let root: string,
  config: ReturnType<typeof getConfig>,
  database: ToolboxDatabase,
  store: ContentArchiveStore,
  service: ArchiveVideoEditService,
  app: FastifyInstance;
let libraryItem: AudioLibraryItem;
const render =
  vi.fn<
    (
      options: RenderVideoOptions
    ) => Promise<{ duration: number; codec: string; hasAudio: boolean; width: number; height: number }>
  >();
const itemId = "archive_music123",
  mediaId = "video_music123";
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-video-edit-"));
  config = getConfig({
    dotenvPath: false,
    environment: { NODE_ENV: "test", DEPLOYMENT_MODE: "local", STORAGE_ROOT: root }
  });
  database = new ToolboxDatabase(":memory:");
  store = new ContentArchiveStore(config, database);
  const url = `/api/v1/tools/media-archive/items/${itemId}/media/${mediaId}`;
  const item: ContentArchiveItem = {
    id: itemId,
    platform: "tiktok",
    contentId: "123456789",
    sourceUrl: "https://www.tiktok.com/@example/video/123456789",
    canonicalUrl: "https://www.tiktok.com/@example/video/123456789",
    type: "video",
    title: "测试视频",
    topics: [],
    media: [
      {
        id: mediaId,
        kind: "video",
        index: 0,
        fileName: "original.mp4",
        mimeType: "video/mp4",
        size: original.length,
        checksum: hash(original),
        durationMs: 2000,
        previewUrl: url,
        downloadUrl: `${url}?download=1`
      }
    ],
    fetchedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    warnings: [],
    status: "ready",
    totalBytes: original.length
  };
  const staging = await store.createStaging("seed_music");
  await fs.writeFile(path.join(staging, "original.mp4"), original);
  await store.commit(item, staging);
  libraryItem = {
    id: "music123",
    revision: 1,
    purpose: "music",
    title: "配乐 A",
    language: "und",
    foreignText: "",
    chineseText: "",
    note: "",
    groupId: null,
    fileName: "audio.mp3",
    mimeType: "audio/mpeg",
    bytes: musicBytes.length,
    duration: 1,
    sha256: hash(musicBytes),
    source: { kind: "upload" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await fs.writeFile(path.join(root, "music.mp3"), musicBytes);
  render.mockReset().mockImplementation(async (options) => {
    const source = await fs.readFile(options.source);
    expect(source).toEqual(original);
    const music = options.music ? await fs.readFile(options.music) : Buffer.alloc(0);
    await fs.writeFile(options.output, Buffer.concat([source, music, Buffer.from(JSON.stringify(options.settings))]));
    options.onProgress(90);
    return { duration: 2, codec: "h264", hasAudio: true, width: 64, height: 64 };
  });
  service = new ArchiveVideoEditService({
    config,
    database,
    store,
    tasks: createTaskStore(1000, database),
    tools: async () => ({ ffmpeg: "test-ffmpeg", ffprobe: "test-ffprobe" }),
    render,
    slideshow: async (options) => {
      await fs.writeFile(options.output, original);
    },
    music: {
      acquire: async (id, revision) => {
        if (libraryItem.deletedAt || id !== libraryItem.id || revision !== libraryItem.revision)
          throw new Error("music unavailable");
        return { item: structuredClone(libraryItem), file: path.join(root, "music.mp3"), release: () => undefined };
      }
    }
  });
  service.initialize();
  app = Fastify();
  registerVideoEditRoutes(app, service, store);
  registerArchivePreviewRoutes(app, store, "media-archive");
  registerArchiveArtifactRoutes(app, store, "media-archive");
  await app.ready();
});
afterEach(async () => {
  await service.close();
  await app.close();
  vi.restoreAllMocks();
  database.close();
  if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith("toolbox-video-edit-"))
    throw new Error("测试清理目录越界");
  await fs.rm(root, { recursive: true, force: true });
});
async function input(overrides: Partial<ArchiveVideoEditInput> = {}): Promise<ArchiveVideoEditInput> {
  const media = (await store.get(itemId))!.media[0];
  return {
    mode: "save",
    revision: media.audioEdit?.revision ?? 0,
    checksum: media.checksum,
    musicId: libraryItem.id,
    musicRevision: libraryItem.revision,
    useSavedMusic: false,
    settings: defaultArchiveAudioSettings(),
    ...overrides
  };
}
async function execute(overrides: Partial<ArchiveVideoEditInput> = {}) {
  const job = await service.create(itemId, mediaId, await input(overrides));
  await vi.waitFor(() => expect(["completed", "failed", "cancelled"]).toContain(service.get(job.id)?.status));
  return service.get(job.id)!;
}
describe("可重复编辑的归档配乐", () => {
  it("图集生成附加视频并保留原图顺序，重新获取不丢失附加视频", async () => {
    const photos = (await store.get(itemId))!;
    photos.type = "image";
    photos.media = [0, 1].map((index) => ({
      ...photos.media[0],
      id: index ? "image_second123" : mediaId,
      kind: "image" as const,
      index,
      fileName: `photo-${index}.png`,
      mimeType: "image/png"
    }));
    const staged = await store.createStaging("seed_photos");
    for (const media of photos.media) await fs.writeFile(path.join(staged, media.fileName), original);
    await store.commit(photos, staged);
    const job = await execute({
      slideshow: {
        images: photos.media.map((media) => ({ id: media.id, checksum: media.checksum })),
        secondsPerImage: 3,
        aspect: "portrait"
      }
    });
    expect(job.status).toBe("completed");
    expect(job.resultMediaId).not.toBe(mediaId);
    const updated = (await store.get(itemId))!;
    expect(updated.media).toHaveLength(3);
    expect(updated.media.slice(0, 2)).toEqual(photos.media);
    expect(updated.media[2].kind).toBe("video");
    expect(updated.media[2].derivedFromImages?.map((image) => image.id)).toEqual(photos.media.map((media) => media.id));
    const refresh = await store.createStaging("photos_refresh");
    for (const media of photos.media) await fs.writeFile(path.join(refresh, media.fileName), original);
    await store.commit(photos, refresh);
    expect((await store.get(itemId))!.media[2].id).toBe(job.resultMediaId);
    for (const media of photos.media)
      expect(await fs.readFile(path.join(config.xhsArchiveItemsDir, itemId, media.fileName))).toEqual(original);
  });
  it("保存最新视频，原片和音乐独立保留，Range 与 ZIP 返回最新成品", async () => {
    const job = await execute();
    expect(job.status).toBe("completed");
    const value = (await store.mediaPath(itemId, mediaId))!;
    expect(value.media.audioEdit).toMatchObject({
      revision: 1,
      original: { checksum: hash(original) },
      music: { title: "配乐 A" }
    });
    const output = await fs.readFile(value.filePath);
    expect((await app.inject({ url: value.media.downloadUrl })).rawPayload).toEqual(output);
    const range = await app.inject({ url: value.media.previewUrl, headers: { range: "bytes=0-4" } });
    expect(range.statusCode).toBe(206);
    expect(range.rawPayload).toEqual(output.subarray(0, 5));
    expect(value.media.previewUrl).toContain(`v=${value.media.checksum}`);
    const source = await app.inject({ url: `/api/v1/tools/media-archive/items/${itemId}/media/${mediaId}/original` });
    expect(source.rawPayload).toEqual(original);
    const zip = await app.inject({ url: `/api/v1/tools/media-archive/items/${itemId}/download.zip` });
    expect(zip.statusCode).toBe(200);
    const files = readArchiveZip(zip.rawPayload);
    expect([...files.values()].some((bytes) => bytes.equals(output))).toBe(true);
    const reloaded = new ContentArchiveStore(config, database);
    expect((await reloaded.get(itemId))!.media[0].audioEdit?.revision).toBe(1);
  });
  it("换音乐始终基于原片，旧成品等待下载释放后清理，库中删除不影响快照再编辑", async () => {
    await execute();
    const first = (await store.mediaPath(itemId, mediaId))!;
    const release = store.pinMedia(first.filePath);
    libraryItem.deletedAt = new Date().toISOString();
    await fs.rm(path.join(root, "music.mp3"));
    const second = await execute({
      musicId: undefined,
      musicRevision: undefined,
      useSavedMusic: true,
      settings: { ...defaultArchiveAudioSettings(), originalVolume: 30 }
    });
    expect(second.status).toBe("completed");
    expect(await fs.readFile(first.filePath)).toBeDefined();
    expect((await store.get(itemId))!.media[0].audioEdit?.revision).toBe(2);
    release();
    await vi.waitFor(async () => expect(await fs.stat(first.filePath).catch(() => undefined)).toBeUndefined());
    const nextMusic = Buffer.from("music-two");
    await fs.writeFile(path.join(root, "music.mp3"), nextMusic);
    libraryItem = {
      ...libraryItem,
      deletedAt: undefined,
      title: "配乐 B",
      bytes: nextMusic.length,
      sha256: hash(nextMusic)
    };
    expect((await execute()).status).toBe("completed");
    const current = (await store.mediaPath(itemId, mediaId))!;
    const bytes = await fs.readFile(current.filePath);
    expect(bytes.includes(nextMusic)).toBe(true);
    expect(bytes.includes(musicBytes)).toBe(false);
    expect(
      await fs.readFile(path.join(path.dirname(current.filePath), current.media.audioEdit!.original.fileName))
    ).toEqual(original);
  });
  it("试听不改归档，恢复原片后仍可继续编辑，旧版本请求返回冲突", async () => {
    const before = await store.get(itemId),
      oldInput = await input();
    const preview = await execute({ mode: "preview" });
    expect(preview.status).toBe("completed");
    expect(await store.get(itemId)).toEqual(before);
    expect((await app.inject({ url: preview.previewUrl! })).statusCode).toBe(200);
    await execute();
    await expect(service.create(itemId, mediaId, oldInput)).rejects.toMatchObject({ code: "ARCHIVE_EDIT_CONFLICT" });
    expect((await execute({ mode: "restore", musicId: undefined, musicRevision: undefined })).status).toBe("completed");
    const value = (await store.mediaPath(itemId, mediaId))!;
    expect(await fs.readFile(value.filePath)).toEqual(original);
    expect(value.media.audioEdit?.revision).toBe(2);
    expect(value.media.audioEdit?.music).toBeUndefined();
    expect((await execute()).status).toBe("completed");
  });
  it("刷新保留同源编辑结果，源变化明确拒绝，恢复原片后允许新源", async () => {
    await execute();
    const saved = (await store.get(itemId))!;
    const refreshed = structuredClone(saved);
    delete refreshed.media[0].audioEdit;
    Object.assign(refreshed.media[0], { fileName: "original.mp4", checksum: hash(original), size: original.length });
    let staging = await store.createStaging("refresh_same");
    await fs.writeFile(path.join(staging, "original.mp4"), original);
    await store.commit(refreshed, staging);
    expect((await store.get(itemId))!.media[0].audioEdit).toEqual(saved.media[0].audioEdit);
    const changed = Buffer.from("changed-source");
    Object.assign(refreshed.media[0], { checksum: hash(changed), size: changed.length });
    staging = await store.createStaging("refresh_changed");
    await fs.writeFile(path.join(staging, "original.mp4"), changed);
    await expect(store.commit(refreshed, staging)).rejects.toMatchObject({ code: "ARCHIVE_EDIT_SOURCE_CHANGED" });
    await execute({ mode: "restore", musicId: undefined, musicRevision: undefined });
    await store.commit(refreshed, staging);
    expect((await store.get(itemId))!.media[0].checksum).toBe(hash(changed));
  });
  it("成品与任务完成记录同事务提交，数据库故障回滚，配额不足不覆盖原片", async () => {
    const before = await store.get(itemId),
      upsert = database.upsert.bind(database);
    const fault = vi.spyOn(database, "upsert").mockImplementation((entity) => {
      if (entity.kind === "archive-video-edit-job" && entity.status === "completed")
        throw new Error("completion write failed");
      return upsert(entity);
    });
    expect((await execute()).status).toBe("failed");
    expect(await store.get(itemId)).toEqual(before);
    expect(await fs.readdir(path.join(config.xhsArchiveItemsDir, itemId))).toEqual(
      expect.arrayContaining(["manifest.json", "original.mp4"])
    );
    expect(
      (await fs.readdir(path.join(config.xhsArchiveItemsDir, itemId))).some(
        (name) => name.startsWith("edited-") || name.startsWith("music-")
      )
    ).toBe(false);
    fault.mockRestore();
    config.xhsArchiveMaxStorageBytes = original.length;
    const job = await execute();
    expect(job.status).toBe("failed");
    expect(job.errorCode).toBe("ARCHIVE_STORAGE_QUOTA_EXCEEDED");
    expect(await store.get(itemId)).toEqual(before);
  });
  it("运行中阻止删除与刷新，取消不提交成功并释放原片租约", async () => {
    render.mockImplementationOnce(async (options) => {
      await new Promise<void>((_resolve, reject) =>
        options.signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true })
      );
      throw new Error("unreachable");
    });
    const before = await store.get(itemId),
      job = await service.create(itemId, mediaId, await input());
    await vi.waitFor(() => expect(render).toHaveBeenCalled());
    await expect(store.remove(itemId)).rejects.toMatchObject({ code: "ARCHIVE_EDIT_BUSY" });
    expect(() => store.assertVideoEditIdle(itemId)).toThrow();
    expect((await service.cancel(job.id))?.status).toBe("cancelled");
    expect(await store.get(itemId)).toEqual(before);
    expect(() => store.assertVideoEditIdle(itemId)).not.toThrow();
  });
  it("拒绝客户端路径、额外表达式和越界音量，不开始处理", async () => {
    const valid = await input();
    for (const body of [
      { ...valid, musicPath: "C:\\secret" },
      { ...valid, settings: { ...valid.settings, originalVolume: 200 } },
      { ...valid, settings: { ...valid.settings, musicStartSeconds: -1 } }
    ]) {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/tools/media-archive/items/${itemId}/media/${mediaId}/audio-edits`,
        payload: body
      });
      expect(response.statusCode).toBe(400);
    }
    expect(render).not.toHaveBeenCalled();
  });
  it("退休文件清理记录提交失败后可在启动时恢复，不影响原片与当前成品", async () => {
    await execute();
    const first = (await store.mediaPath(itemId, mediaId))!;
    const release = store.pinMedia(first.filePath);
    await execute({ musicId: undefined, musicRevision: undefined, useSavedMusic: true });
    const upsert = database.upsert.bind(database);
    let injected = false;
    const fault = vi.spyOn(database, "upsert").mockImplementation((entity) => {
      if (!injected && entity.kind === "xhs-archive") {
        injected = true;
        throw new Error("cleanup commit failed");
      }
      return upsert(entity);
    });
    release();
    await vi.waitFor(() => expect(injected).toBe(true));
    await store.flushVideoEdits();
    fault.mockRestore();
    const restarted = new ContentArchiveStore(config, database);
    await restarted.initialize();
    const current = (await restarted.mediaPath(itemId, mediaId))!;
    expect(current.media.audioEdit?.pendingFiles).toEqual([]);
    expect(await fs.readFile(current.filePath)).toBeDefined();
    expect(
      await fs.readFile(path.join(path.dirname(current.filePath), current.media.audioEdit!.original.fileName))
    ).toEqual(original);
  });
  it("无原声音轨也生成完整静音底轨，混音增益不被自动均分", () => {
    const filter = audioMixFilter(
      { ...defaultArchiveAudioSettings(), originalVolume: 0, musicVolume: 25 },
      10,
      false,
      true
    );
    expect(filter).toContain("anullsrc");
    expect(filter).toContain("atrim=duration=10");
    expect(filter).toContain("volume=0.25");
    expect(filter).toContain("normalize=0");
    expect(filter).toContain("alimiter");
  });
});
