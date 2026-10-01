/** 统一管线使用隔离 storage 和固定媒体：验证队列、取消、重启和失败保留，不依赖平台网络。 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import nodeFs from "node:fs";
import { Readable, Writable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArchivePlatform, ContentArchiveTask } from "@toolbox/shared";
import { getConfig } from "../config";
import { ToolboxDatabase } from "../database/toolbox-database";
import { FileMetadataRepository } from "../database/file-metadata";
import { createTaskStore } from "../tasks/task-store";
import { ContentArchiveStore } from "../modules/media-archive/store";
import { ArchiveTaskRepository } from "../modules/media-archive/task-repository";
import { ArchiveDownloadGateway } from "../modules/media-archive/download-gateway";
import { ContentArchiveTaskService } from "../modules/media-archive/task-service";
import { ArchiveTaskError, type ArchiveSource, type ArchiveProvider } from "../modules/media-archive/provider";
import { archiveTranslationSourceHash } from "../modules/media-archive/text";

let root: string;
let database: ToolboxDatabase;
let config: ReturnType<typeof getConfig>;
let store: ContentArchiveStore;
let tasks: ArchiveTaskRepository;
let events: ReturnType<typeof createTaskStore>;
let service: ContentArchiveTaskService;
let providers: ArchiveProvider[];
let remote: ReturnType<typeof vi.fn>;
let png: Buffer;
let afterCommit: ReturnType<typeof vi.fn>;
const link = (platform: ArchivePlatform = "douyin", id = "123456789") =>
  platform === "douyin" ? `https://www.douyin.com/video/${id}` : `https://www.xiaohongshu.com/explore/${id}`;
const source = (platform: ArchivePlatform = "douyin", id = "123456789"): ArchiveSource => ({
  platform,
  contentId: id,
  canonicalUrl: link(platform, id),
  type: "image",
  title: "测试归档",
  description: "原文 #话题",
  rawText: platform === "douyin" ? "原文 #话题" : undefined,
  topics: [],
  media: [{ urls: ["https://cdn.test/image.png"], index: 0, kind: "image" }]
});
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-archive-task-"));
  config = getConfig({
    dotenvPath: false,
    environment: {
      NODE_ENV: "test",
      STORAGE_ROOT: root,
      DATABASE_PATH: path.join(root, "toolbox.db"),
      DEPLOYMENT_MODE: "local"
    }
  });
  database = new ToolboxDatabase(config.databasePath);
  store = new ContentArchiveStore(config, database);
  events = createTaskStore(1000, database);
  tasks = new ArchiveTaskRepository(database, events);
  png = await sharp({ create: { width: 120, height: 64, channels: 3, background: "#3365ff" } })
    .png()
    .toBuffer();
  remote = vi.fn(
    async () =>
      new Response(new Uint8Array(png), {
        headers: { "content-type": "image/png", "content-length": String(png.length) }
      })
  );
  providers = ["xiaohongshu", "douyin"].map((platform) => ({
    platform: platform as ArchivePlatform,
    extract: vi.fn(async (url: string) => source(platform as ArchivePlatform, new URL(url).pathname.split("/").at(-1))),
    close: vi.fn(async () => undefined)
  }));
  afterCommit = vi.fn();
  service = new ContentArchiveTaskService({
    config,
    store,
    tasks,
    providers,
    download: new ArchiveDownloadGateway(config, remote),
    afterCommit
  });
  await service.initialize();
});
afterEach(async () => {
  vi.useRealTimers();
  await service.close().catch(() => undefined);
  vi.restoreAllMocks();
  database.close();
  if (
    !path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) ||
    !path.basename(root).startsWith("toolbox-archive-task-")
  )
    throw new Error("清理目录越界");
  await fs.rm(root, { recursive: true, force: true });
});
async function terminal(id: string) {
  await vi.waitFor(() => expect(["completed", "failed"]).toContain(service.get(id)?.status));
  return service.get(id)!;
}

describe("多平台获取生命周期", () => {
  it("文件摘要等待流 close，不能在 Windows 句柄仍被占用时开始目录移动", async () => {
    const file = path.join(root, "metadata.png");
    await fs.writeFile(file, png);
    let closed = false;
    vi.spyOn(nodeFs, "createReadStream").mockImplementation(
      () =>
        new Readable({
          read() {
            this.push(png);
            this.push(null);
          },
          destroy(_error, callback) {
            setTimeout(() => {
              closed = true;
              callback();
            }, 25);
          }
        }) as nodeFs.ReadStream
    );
    const metadata = await new FileMetadataRepository(database, root).inspect({
      entityKind: "test",
      entityId: "file",
      filePath: file
    });
    expect(closed).toBe(true);
    expect(metadata.byteSize).toBe(png.length);
    expect(metadata.sha256).toHaveLength(64);
  });
  it("两平台同作品 ID 共存、事件订阅有进度且不泄漏平台正文", async () => {
    for (const platform of ["xiaohongshu", "douyin"] as const) {
      const task = service.create(link(platform));
      const progress: number[] = [];
      const unsubscribe = events.subscribe(task.id, (value) => {
        progress.push(value.progress);
        expect(value).not.toHaveProperty("platform");
        expect(value).not.toHaveProperty("rawText");
      });
      expect(await terminal(task.id)).toMatchObject({ platform, status: "completed", progress: 100 });
      expect(progress.at(-1)).toBe(100);
      unsubscribe();
    }
    expect((await store.list()).total).toBe(2);
    expect(database.list("archive-fetch-task")).toHaveLength(2);
    const item = (await store.list({ platform: "douyin" })).items[0];
    expect((await store.get(item.id))?.media[0]).toMatchObject({ width: 120, height: 64, mimeType: "image/png" });
    expect(afterCommit).toHaveBeenCalledTimes(2);
    const serialized = JSON.stringify(database.list("archive-fetch-task"));
    expect(serialized).not.toContain("https:");
    for (const [, init] of remote.mock.calls) expect(init.headers).not.toHaveProperty("cookie");
  });

  it.each(["xiaohongshu", "douyin"] as const)("%s 刷新复用归档与媒体 ID，图集不能误作为截帧来源", async (platform) => {
    const created = await terminal(service.create(link(platform)).id);
    const item = (await store.get(created.archiveId!))!;
    const captured = await store
      .addVideoFrame(item.id, { sourceMediaId: item.media[0].id, timestampMs: 20, png, width: 120, height: 64 })
      .catch(() => undefined);
    expect(captured).toBeUndefined(); // 图集不能误作为视频来源，真实视频截帧由已有 API 测试覆盖。
    const mediaId = item.media[0].id;
    const refreshed = await terminal((await service.refresh(item.id))!.id);
    expect(refreshed.archiveId).toBe(item.id);
    expect((await store.get(item.id))?.media[0].id).toBe(mediaId);
    expect((await store.list()).total).toBe(1);
    expect(await service.refresh("missing_123456")).toBeUndefined();
  });

  it.each(["xiaohongshu", "douyin"] as const)(
    "%s 获取刷新保留截帧与手工译文，视频改变保留历史来源",
    async (platform) => {
      const work = {
        ...source(platform),
        type: "video" as const,
        media: [{ kind: "video" as const, index: 0, urls: ["https://cdn.test/video.mp4"] }]
      };
      vi.mocked(providers.find((provider) => provider.platform === platform)!.extract).mockImplementation(
        async () => work
      );
      // 此处仅使用容器头夹具验证身份与提交；实际视频解码另由受管管线在线冒烟验收。
      let bytes = Buffer.from("0000ftypisom-original");
      remote.mockImplementation(
        async () => new Response(new Uint8Array(bytes), { headers: { "content-type": "video/mp4" } })
      );
      const created = await terminal(service.create(link(platform)).id);
      let item = (await store.get(created.archiveId!))!;
      const videoId = item.media[0].id;
      item = await store.addVideoFrame(item.id, {
        sourceMediaId: videoId,
        timestampMs: 1234,
        png,
        width: 120,
        height: 64
      });
      const frame = item.media[1];
      await store.updateTranslation(item.id, (current) => ({
        ...current,
        translation: {
          status: "ready",
          sourceHash: archiveTranslationSourceHash(current),
          sourceLanguage: "zh-CN",
          targetLanguage: "en",
          provider: "opus-mt",
          modelId: "Helsinki-NLP/opus-mt-zh-en",
          modelRevision: "fixed",
          title: { source: current.title, machine: "Machine", edited: "手工编辑" },
          topics: []
        }
      }));
      await terminal((await service.refresh(item.id))!.id);
      const unchanged = (await store.get(item.id))!;
      expect(unchanged.media[0].id).toBe(videoId);
      expect(unchanged.media[1]).toEqual(frame);
      expect(unchanged.translation).toMatchObject({ status: "ready", title: { edited: "手工编辑" } });
      bytes = Buffer.from("0000ftypisom-replacement");
      work.description = "更新后的原文";
      await terminal((await service.refresh(item.id))!.id);
      const changed = (await store.get(item.id))!;
      expect(changed.media[0].id).not.toBe(videoId);
      expect(changed.media[1]).toEqual(frame);
      expect(changed.media[1].frameSourceMediaId).toBe(videoId);
      expect(changed.translation).toMatchObject({ status: "stale", title: { edited: "手工编辑" } });
      const saved = (await store.mediaPath(item.id, frame.id))!;
      expect(await fs.readFile(saved.filePath)).toEqual(png);
      expect(changed.totalBytes).toBe(bytes.length + png.length);
    }
  );

  it("重复链接共用未完成任务，不启动并发浏览器", async () => {
    let release!: (value: ArchiveSource) => void;
    vi.mocked(providers[1].extract).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const first = service.create(link());
    expect(service.create(`分享 ${link()}。`).id).toBe(first.id);
    const second = service.create(link("douyin", "987654321"));
    await vi.waitFor(() => expect(providers[1].extract).toHaveBeenCalledTimes(1));
    expect(service.get(second.id)?.status).toBe("pending");
    release(source());
    await terminal(first.id);
    await vi.waitFor(() => expect(providers[1].extract).toHaveBeenCalledTimes(2));
    await service.cancel(second.id);
    expect(service.get(second.id)?.errorCode).toBe("ARCHIVE_CANCELLED");
  });

  it("队列容量有限，取消排队任务不会读取平台或下载", async () => {
    vi.mocked(providers[1].extract).mockImplementation(() => new Promise(() => undefined));
    service.create(link());
    const queued = Array.from({ length: 16 }, (_, index) => service.create(link("douyin", String(200000 + index))));
    expect(() => service.create(link("douyin", "900000"))).toThrow("队列已满");
    expect(await service.cancel(queued[0].id)).toMatchObject({ status: "failed", errorCode: "ARCHIVE_CANCELLED" });
    expect(service.get(queued[1].id)?.status).toBe("pending");
    expect(remote).not.toHaveBeenCalled();
  });

  it("运行中取消阻止迟到解析和后续提交，未知/终态取消保持语义", async () => {
    let release!: (value: ArchiveSource) => void;
    vi.mocked(providers[1].extract).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    const task = service.create(link());
    await vi.waitFor(() => expect(providers[1].extract).toHaveBeenCalledOnce());
    expect(await service.cancel(task.id)).toMatchObject({ errorCode: "ARCHIVE_CANCELLED" });
    release(source());
    await Promise.resolve();
    expect((await store.list()).total).toBe(0);
    expect(remote).not.toHaveBeenCalled();
    expect(await service.cancel("missing_123456")).toBeUndefined();
    expect((await service.cancel(task.id))?.status).toBe("failed");
  });

  it("退出标记运行与排队为中断，幂等关闭后拒绝新任务", async () => {
    vi.mocked(providers[1].extract).mockImplementation(() => new Promise(() => undefined));
    const first = service.create(link());
    const second = service.create(link("douyin", "987654321"));
    await vi.waitFor(() => expect(providers[1].extract).toHaveBeenCalledOnce());
    await Promise.all([service.close(), service.close()]);
    expect(service.get(first.id)?.errorCode).toBe("ARCHIVE_INTERRUPTED");
    expect(service.get(second.id)?.errorCode).toBe("ARCHIVE_INTERRUPTED");
    expect(() => service.create(link())).toThrow("服务已关闭");
    expect(providers[1].close).toHaveBeenCalledOnce();
  });

  it("重启从落盘任务恢复为 failed/interrupted，不重新获取", async () => {
    const now = new Date().toISOString();
    tasks.save({
      id: "pending_123456",
      platform: "douyin",
      status: "running",
      stage: "downloading",
      progress: 45,
      message: "正在下载",
      createdAt: now,
      updatedAt: now
    });
    database.close();
    database = new ToolboxDatabase(config.databasePath);
    events = createTaskStore(1000, database);
    tasks = new ArchiveTaskRepository(database, events);
    service = new ContentArchiveTaskService({
      config,
      store: new ContentArchiveStore(config, database),
      tasks,
      providers,
      download: new ArchiveDownloadGateway(config, remote)
    });
    await service.initialize();
    expect(service.get("pending_123456")).toMatchObject({
      status: "failed",
      stage: "failed",
      errorCode: "ARCHIVE_INTERRUPTED"
    });
    expect(events.get("pending_123456")).toMatchObject({ status: "failed", error: "ARCHIVE_INTERRUPTED" });
    expect(providers[1].extract).not.toHaveBeenCalled();
  });

  it.each(["all", "partial"])("%s 下载失败保持旧目录、行与索引，清理当次 staging", async (mode) => {
    const created = await terminal(service.create(link()).id);
    const before = await store.get(created.archiveId!);
    const files = database.listFiles();
    const previousManifest = await fs.readFile(path.join(config.xhsArchiveItemsDir, before!.id, "manifest.json"));
    vi.mocked(providers[1].extract).mockResolvedValue({
      ...source(),
      media: [source().media[0], { ...source().media[0], index: 1, urls: ["https://cdn.test/missing.png"] }]
    });
    remote.mockImplementation(async (url: string) =>
      url.endsWith("missing.png") || mode === "all"
        ? new Response("unavailable", { status: 503 })
        : new Response(new Uint8Array(png), { headers: { "content-type": "image/png" } })
    );
    const refreshed = await terminal((await service.refresh(before!.id))!.id);
    expect(refreshed).toMatchObject({
      status: "failed",
      errorCode: mode === "all" ? "ARCHIVE_MEDIA_DOWNLOAD_FAILED" : "ARCHIVE_MEDIA_DOWNLOAD_PARTIAL"
    });
    expect(await store.get(before!.id)).toEqual(before);
    expect(database.listFiles()).toEqual(files);
    expect(await fs.readFile(path.join(config.xhsArchiveItemsDir, before!.id, "manifest.json"))).toEqual(
      previousManifest
    );
    await vi.waitFor(async () => expect(await fs.readdir(config.xhsArchiveStagingDir)).toHaveLength(0));
  });

  it("共享最终配额失败不留空归档，稳定码不泄露路径", async () => {
    config.xhsArchiveMaxStorageBytes = png.length - 1;
    const task = await terminal(service.create(link()).id);
    expect(task).toMatchObject({ status: "failed", errorCode: "ARCHIVE_STORAGE_QUOTA_EXCEEDED" });
    expect(task.error).not.toContain(root);
    expect((await store.list()).total).toBe(0);
  });

  it("刷新遇到磁盘写满时返回明确错误，并完整保留旧归档及文件索引", async () => {
    const created = await terminal(service.create(link()).id);
    const before = await store.get(created.archiveId!);
    const files = database.listFiles();
    const manifestPath = path.join(config.xhsArchiveItemsDir, before!.id, "manifest.json");
    const oldManifest = await fs.readFile(manifestPath);
    const noSpace = Object.assign(new Error("disk full"), { code: "ENOSPC" });
    vi.spyOn(nodeFs, "createWriteStream").mockImplementation(
      () =>
        new Writable({
          write(_chunk, _encoding, callback) {
            callback(noSpace);
          }
        }) as nodeFs.WriteStream
    );

    const failed = await terminal((await service.refresh(before!.id))!.id);

    expect(failed).toMatchObject({
      status: "failed",
      errorCode: "ARCHIVE_DISK_SPACE_INSUFFICIENT",
      error: expect.stringContaining("现有存档未被覆盖")
    });
    expect(await store.get(before!.id)).toEqual(before);
    expect(database.listFiles()).toEqual(files);
    expect(await fs.readFile(manifestPath)).toEqual(oldManifest);
    await vi.waitFor(async () => expect(await fs.readdir(config.xhsArchiveStagingDir)).toHaveLength(0));
  });

  it.each(["platform", "identity", "empty", "component", "unexpected"])("%s 错误不能生成错误归档", async (mode) => {
    if (mode === "component") providers.splice(1);
    else if (mode === "unexpected")
      vi.mocked(providers[1].extract).mockRejectedValue(new Error(root + " secretCookie"));
    else
      vi.mocked(providers[1].extract).mockResolvedValue({
        ...source(),
        ...(mode === "platform"
          ? { platform: "xiaohongshu" as const }
          : mode === "empty"
            ? { media: [] }
            : { contentId: "other" })
      });
    let job;
    if (mode === "identity") {
      vi.mocked(providers[1].extract).mockResolvedValueOnce(source());
      const old = await terminal(service.create(link()).id);
      job = (await service.refresh(old.archiveId!))!;
    } else job = service.create(link());
    const result = await terminal(job.id);
    expect(result.status).toBe("failed");
    expect(result.error).not.toContain(root);
    expect(result.error).not.toContain("secretCookie");
    if (mode !== "identity") expect((await store.list()).total).toBe(0);
  });

  it("删除先取消相关刷新，避免已删除的归档重新出现", async () => {
    const first = await terminal(service.create(link()).id);
    vi.mocked(providers[1].extract).mockImplementation(() => new Promise(() => undefined));
    const refresh = (await service.refresh(first.archiveId!))!;
    await vi.waitFor(() => expect(service.get(refresh.id)?.status).toBe("running"));
    expect(await service.remove(first.archiveId!)).toBe(true);
    expect(service.get(refresh.id)?.errorCode).toBe("ARCHIVE_CANCELLED");
    expect(await store.get(first.archiveId!)).toBeUndefined();
    expect(await service.remove("missing_123456")).toBe(false);
  });

  it("文件原子提交中拒绝取消；后置可选功能异常不改变完成结果", async () => {
    const commit = store.commit.bind(store);
    let release!: () => void;
    vi.spyOn(store, "commit").mockImplementation(async (...args) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return commit(...args);
    });
    afterCommit.mockImplementation(() => {
      throw new Error("optional translation failure");
    });
    const task = service.create(link());
    await vi.waitFor(() => expect(service.get(task.id)?.stage).toBe("archiving"));
    await expect(service.cancel(task.id)).rejects.toMatchObject({ code: "ARCHIVE_COMMIT_IN_PROGRESS" });
    release();
    expect((await terminal(task.id)).status).toBe("completed");
  });

  it("输入与显式平台严格一致，HTTP 抖音与无链接不能进入队列", () => {
    for (const [url, platform] of [
      [link(), "xiaohongshu"],
      ["invalid", "auto"],
      ["http://www.douyin.com/video/123456789", "auto"]
    ] as const)
      expect(() => service.create(url, platform)).toThrow(ArchiveTaskError);
  });

  it("总时限中断不会占住后续队列，关闭超时有界且不宣称成功", async () => {
    vi.useFakeTimers();
    vi.mocked(providers[1].extract).mockImplementation(() => new Promise(() => undefined));
    const first = service.create(link());
    await vi.waitFor(() => expect(providers[1].extract).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(300_000);
    expect(service.get(first.id)?.errorCode).toBe("ARCHIVE_TIMEOUT");
    vi.mocked(providers[1].close).mockImplementation(() => new Promise(() => undefined));
    const closing = service.close();
    const rejection = expect(closing).rejects.toMatchObject({ code: "ARCHIVE_STOP_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(5000);
    await rejection;
  });

  it("Web 小红书首次安装保留既有安装预算，取消无需等待安装完成", async () => {
    vi.useFakeTimers();
    vi.mocked(providers[0].extract).mockImplementation(() => new Promise(() => undefined));
    const task = service.create(link("xiaohongshu"));
    await vi.waitFor(() => expect(providers[0].extract).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(300_000);
    expect(service.get(task.id)?.status).toBe("running");
    await vi.advanceTimersByTimeAsync(config.xhsInstallTimeoutMs);
    expect(service.get(task.id)?.errorCode).toBe("ARCHIVE_TIMEOUT");
    const retry = service.create(link("xiaohongshu"));
    expect(retry.id).not.toBe(task.id);
    await vi.waitFor(() => expect(providers[0].extract).toHaveBeenCalledTimes(2));
    expect((await service.cancel(retry.id))?.errorCode).toBe("ARCHIVE_CANCELLED");
  });

  it.each(["desktop", "external"])("%s 小红书环境不预留 Web 自动安装预算", async (mode) => {
    vi.useFakeTimers();
    config.desktopManagedCapabilities = mode === "desktop";
    config.xhsProviderUrl = mode === "external" ? "https://provider.test" : undefined;
    vi.mocked(providers[0].extract).mockImplementation(() => new Promise(() => undefined));
    const task = service.create(link("xiaohongshu"));
    await vi.waitFor(() => expect(providers[0].extract).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(300_000);
    expect(service.get(task.id)?.errorCode).toBe("ARCHIVE_TIMEOUT");
  });

  it("损坏任务载荷不能静默丢失；历史裁剪不删除活动任务", () => {
    const now = new Date().toISOString();
    for (let index = 0; index < 502; index++)
      tasks.save({
        id: `task_${String(index).padStart(6, "0")}`,
        platform: "douyin",
        status: index === 0 ? "pending" : "completed",
        stage: index === 0 ? "installing" : "completed",
        progress: 0,
        message: "测试",
        createdAt: now,
        updatedAt: now
      });
    expect(database.list("archive-fetch-task")).toHaveLength(500);
    expect(tasks.get("task_000000")?.status).toBe("pending");
    const invalid = { id: "invalid_123456" } as ContentArchiveTask;
    expect(() => tasks.save(invalid)).toThrow("ARCHIVE_TASK_PAYLOAD_INVALID");
    database.upsert({ id: invalid.id, kind: "archive-fetch-task", payload: invalid, createdAt: now, updatedAt: now });
    expect(() => new ArchiveTaskRepository(database, events)).toThrow("ARCHIVE_TASK_PAYLOAD_INVALID");
  });
});
