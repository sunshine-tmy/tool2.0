import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import Fastify, { type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultArchiveAudioSettings, ok } from "@toolbox/shared";
import { getConfig } from "../config";
import { registerResponsePolicy } from "../app/responses";
import { registerBasePlugins } from "../app/plugins";
import { REQUEST_QUOTAS } from "../security/request-quotas";
import { ToolboxDatabase } from "../database/toolbox-database";
import { createTaskStore } from "../tasks/task-store";
import { ContentArchiveStore } from "../domains/content-archive/core/store";
import { LocalVideoArchiveUploads, registerLocalVideoUploadRoutes } from "../domains/content-archive/core/local-upload";
import { registerArchivePreviewRoutes } from "../domains/content-archive/core/media-preview-routes";
import { registerArchiveArtifactRoutes } from "../domains/content-archive/core/artifact-routes";
import { ArchiveVideoEditService } from "../domains/content-archive/video-edit/service";
import { VideoEditError, probeMedia, runMediaProcess } from "../domains/content-archive/video-edit/renderer";
let root: string, config: ReturnType<typeof getConfig>, database: ToolboxDatabase, store: ContentArchiveStore;
let app: FastifyInstance, uploads: LocalVideoArchiveUploads;
let limitedApp: FastifyInstance | undefined;
const tools = vi.fn(),
  probe = vi.fn<typeof probeMedia>(),
  run = vi.fn<typeof runMediaProcess>();
const video = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom00000000-original-video")]);
const actualTools = {
  ffmpeg: process.env.TEST_FFMPEG_PATH ?? "ffmpeg",
  ffprobe: process.env.TEST_FFPROBE_PATH ?? "ffprobe"
};
const realAvailable = Object.values(actualTools).every(
  (tool) => spawnSync(tool, ["-version"], { windowsHide: true, stdio: "ignore" }).status === 0
);
function multipartUpload(bytes = video, name = "视频.mp4", extra = "", title = "我的视频", groupId?: string) {
  const boundary = "localVideoUploadBoundary";
  const groupField =
    groupId === undefined
      ? ""
      : `--${boundary}\r\nContent-Disposition: form-data; name="groupId"\r\n\r\n${groupId}\r\n`;
  return {
    method: "POST" as const,
    url: "/api/v1/tools/media-archive/local-videos",
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\n${title}\r\n${groupField}--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: video/mp4\r\n\r\n`
      ),
      bytes,
      Buffer.from(`\r\n${extra ? `--${boundary}\r\n${extra}\r\n` : ""}--${boundary}--\r\n`)
    ])
  };
}
beforeEach(async () => {
  limitedApp = undefined;
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-local-videos-"));
  config = getConfig({
    dotenvPath: false,
    environment: { NODE_ENV: "test", DEPLOYMENT_MODE: "local", STORAGE_ROOT: root }
  });
  database = new ToolboxDatabase(path.join(root, "toolbox.db"));
  store = new ContentArchiveStore(config, database);
  await store.initialize();
  tools.mockReset().mockResolvedValue({ ffmpeg: "fixture-ffmpeg", ffprobe: "fixture-ffprobe" });
  probe.mockReset().mockResolvedValue({ width: 32, height: 24, duration: 1, codec: "h264", hasAudio: false });
  const cover = await sharp({ create: { width: 32, height: 24, channels: 3, background: "red" } })
    .jpeg()
    .toBuffer();
  run.mockReset().mockImplementation(async (_tool, _args, signal, options) => {
    signal.throwIfAborted();
    await fs.writeFile(options!.output!, cover);
    return "";
  });
  uploads = new LocalVideoArchiveUploads({ config, store, tasks: createTaskStore(1000, database), tools, probe, run });
  app = Fastify();
  registerResponsePolicy(app);
  await app.register(multipart);
  registerLocalVideoUploadRoutes(app, uploads);
  registerArchivePreviewRoutes(app, store, "media-archive");
  registerArchiveArtifactRoutes(app, store, "media-archive");
  await app.ready();
});
afterEach(async () => {
  await uploads.close();
  await limitedApp?.close();
  await app.close();
  vi.restoreAllMocks();
  database.close();
  expect(path.dirname(root)).toBe(path.resolve(os.tmpdir()));
  expect(path.basename(root)).toMatch(/^toolbox-local-videos-/);
  await fs.rm(root, { recursive: true, force: true });
});
async function withProductionLimits() {
  limitedApp = Fastify();
  registerResponsePolicy(limitedApp);
  await registerBasePlugins(limitedApp, config, database);
  registerLocalVideoUploadRoutes(limitedApp, uploads);
  limitedApp.post("/other-upload", { config: REQUEST_QUOTAS.lanUpload }, async () => ok(null));
  await limitedApp.ready();
  return limitedApp;
}
describe("批量队列使用的本地视频上传归档", () => {
  it("真实全局插件下 1000 条连续请求不会被 30/300 次额度拦截，1200 次专属上限及其他上传额度仍有效", async () => {
    const item = (await app.inject(multipartUpload())).json().data.item;
    // Isolate admission policy from disk/FFmpeg costs while retaining the real route and all base plugins.
    const upload = vi.spyOn(uploads, "upload").mockResolvedValue({ item, duplicate: true });
    const server = await withProductionLimits();
    for (let index = 0; index < 1200; index++) {
      const response = await server.inject(multipartUpload());
      expect(response.statusCode, `第 ${index + 1} 个视频：${response.body}`).toBe(201);
    }
    expect(upload).toHaveBeenCalledTimes(1200);
    const limited = await server.inject(multipartUpload());
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(limited.headers["x-ratelimit-limit"]).toBe("1200");
    expect(upload).toHaveBeenCalledTimes(1200);
    for (let index = 0; index < 30; index++)
      expect((await server.inject({ method: "POST", url: "/other-upload" })).statusCode).toBe(200);
    expect((await server.inject({ method: "POST", url: "/other-upload" })).statusCode).toBe(429);
  });
  it("放宽速率后真实路由仍只处理一个文件，并发拒绝后能释放额度继续上传", async () => {
    const item = (await app.inject(multipartUpload())).json().data.item;
    let release!: () => void, entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const upload = vi.spyOn(uploads, "upload").mockResolvedValue({ item, duplicate: true });
    upload.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ item, duplicate: true });
          entered();
        })
    );
    const server = await withProductionLimits();
    const first = server.inject(multipartUpload());
    try {
      await started;
      const concurrent = await server.inject(multipartUpload());
      expect(concurrent.statusCode).toBe(429);
      expect(concurrent.json().error.code).toBe("CONCURRENCY_LIMIT_EXCEEDED");
      expect(upload).toHaveBeenCalledOnce();
      release();
      expect((await first).statusCode).toBe(201);
      expect((await server.inject(multipartUpload())).statusCode).toBe(201);
    } finally {
      release?.();
      await first;
    }
  });
  it("新视频与分组一同保存，重复文件保留原组，未选择分组的新视频仍为未分组", async () => {
    const original = store.groups.save("上传素材"),
      other = store.groups.save("其他素材");
    const response = await app.inject(multipartUpload(video, "grouped.mp4", "", "已选分组", original.id));
    expect(response.statusCode, response.body).toBe(201);
    const first = response.json().data.item;
    expect((await store.list({ groupId: original.id })).items[0]).toMatchObject({ id: first.id, groupId: original.id });
    const duplicate = await app.inject(multipartUpload(video, "again.mp4", "", "重复不覆盖", other.id));
    expect(duplicate.json().data).toMatchObject({ duplicate: true, item: { id: first.id, title: "已选分组" } });
    expect((await store.list({ groupId: other.id })).total).toBe(0);
    expect(store.groups.memberships().get(first.id)).toBe(original.id);
    const fresh = await app.inject(multipartUpload(Buffer.concat([video, Buffer.from("different")]), "new.mp4"));
    expect(fresh.statusCode, fresh.body).toBe(201);
    expect((await store.list({ groupId: "ungrouped" })).items.map((item) => item.id)).toEqual([
      fresh.json().data.item.id
    ]);
    const restarted = new ContentArchiveStore(config, database);
    expect((await restarted.list({ groupId: original.id })).items.map((item) => item.id)).toEqual([first.id]);
    const manifest = JSON.parse(
      await fs.readFile(path.join(config.xhsArchiveItemsDir, first.id, "manifest.json"), "utf8")
    );
    expect(manifest.groupId).toBeUndefined();
  });
  it("无效或不存在的分组拒绝归档，不创建分组、记录或残留文件", async () => {
    for (const groupId of ["", "../private", "not-existing-group"]) {
      const response = await app.inject(multipartUpload(video, "video.mp4", "", "标题", groupId));
      expect(response.statusCode).toBe(groupId === "not-existing-group" ? 404 : 400);
      expect(response.json().error.code).toBe(
        groupId === "not-existing-group" ? "ARCHIVE_GROUP_NOT_FOUND" : "ARCHIVE_GROUP_INPUT_INVALID"
      );
    }
    expect(store.groups.list()).toEqual([]);
    expect((await store.list()).total).toBe(0);
    expect(await fs.readdir(config.xhsArchiveStagingDir)).toEqual([]);
    expect(await fs.readdir(config.xhsArchiveItemsDir)).toEqual([]);
    expect(probe).not.toHaveBeenCalled();
  });
  it("处理期间删除目标分组会拒绝提交，不能重新创建被删除分组或遗留未分组作品", async () => {
    const group = store.groups.save("处理期间删除");
    const render = run.getMockImplementation()!;
    run.mockImplementationOnce(async (...args) => {
      store.groups.remove(group.id);
      return render(...args);
    });
    const response = await app.inject(multipartUpload(video, "video.mp4", "", "标题", group.id));
    expect(response.statusCode, response.body).toBe(404);
    expect(store.groups.list()).toEqual([]);
    expect((await store.list()).total).toBe(0);
    expect(await fs.readdir(config.xhsArchiveStagingDir)).toEqual([]);
    expect(await fs.readdir(config.xhsArchiveItemsDir)).toEqual([]);
  });
  it("分组写入后抛错时回滚作品、分组成员和媒体，重试可完整成功", async () => {
    const group = store.groups.save("原子提交"),
      assign = store.groups.assign.bind(store.groups);
    vi.spyOn(store.groups, "assign").mockImplementationOnce((input) => {
      assign(input);
      throw Error("injected group failure");
    });
    const response = await app.inject(multipartUpload(video, "video.mp4", "", "标题", group.id));
    expect(response.statusCode).toBe(500);
    expect((await store.list()).total).toBe(0);
    expect(database.list("xhs-archive")).toEqual([]);
    expect(database.list("archive-group-member")).toEqual([]);
    expect(await fs.readdir(config.xhsArchiveStagingDir)).toEqual([]);
    expect(await fs.readdir(config.xhsArchiveItemsDir)).toEqual([]);
    const retry = await app.inject(multipartUpload(video, "video.mp4", "", "标题", group.id));
    expect(retry.statusCode, retry.body).toBe(201);
    expect((await store.list({ groupId: group.id })).total).toBe(1);
  });
  it("重启将中断的本地上传标记为失败，不重传文件或改动其他任务", async () => {
    const tasks = createTaskStore(1000, database);
    const interrupted = tasks.create("media-archive-local-upload");
    tasks.update(interrupted.id, { status: "running", progress: 45 });
    const completed = tasks.create("media-archive-local-upload");
    tasks.update(completed.id, { status: "completed", progress: 100 });
    const other = tasks.create("image-compress");
    tasks.update(other.id, { status: "running" });
    const restartedTasks = createTaskStore(1000, database);
    const restarted = new LocalVideoArchiveUploads({ config, store, tasks: restartedTasks, tools, probe, run });
    try {
      expect(restartedTasks.get(interrupted.id)).toMatchObject({
        status: "failed",
        progress: 45,
        error: "ARCHIVE_UPLOAD_INTERRUPTED"
      });
      expect(restartedTasks.get(completed.id)?.status).toBe("completed");
      expect(restartedTasks.get(other.id)?.status).toBe("running");
      expect(createTaskStore(1000, database).get(interrupted.id)?.status).toBe("failed");
      expect(tools).not.toHaveBeenCalled();
      expect((await store.list()).total).toBe(0);
    } finally {
      await restarted.close();
    }
  });
  it("原样保存视频、生成独立封面并复用预览、Range、ZIP、分组和持久化读取", async () => {
    const response = await app.inject(multipartUpload());
    expect(response.statusCode, response.body).toBe(201);
    const { item, duplicate } = response.json().data;
    expect(item).toMatchObject({
      platform: "local",
      title: "我的视频",
      type: "video",
      media: [{ durationMs: 1000 }, {}]
    });
    expect(duplicate).toBe(false);
    expect(response.body).not.toContain(root);
    expect(item.publishedAt).toBeUndefined();
    expect(await fs.readFile((await store.mediaPath(item.id, item.media[0].id))!.filePath)).toEqual(video);
    const range = await app.inject({ url: item.media[0].previewUrl, headers: { range: "bytes=0-7" } });
    expect(range.statusCode).toBe(206);
    expect(range.rawPayload).toEqual(video.subarray(0, 8));
    expect((await app.inject(item.media[1].previewUrl)).headers["content-type"]).toContain("image/jpeg");
    expect((await app.inject(`/api/v1/tools/media-archive/items/${item.id}/download.zip`)).statusCode).toBe(200);
    const group = store.groups.save("本地素材");
    store.groups.assign({ itemIds: [item.id], groupId: group.id });
    const restarted = new ContentArchiveStore(config, database);
    expect((await restarted.list({ platform: "local", groupId: group.id })).items[0].id).toBe(item.id);
    expect((await restarted.get(item.id))!.sourceUrl).toMatch(/^toolbox:\/\/local-video\/[a-f0-9]{64}$/);
    expect(await fs.readdir(config.xhsArchiveStagingDir)).toEqual([]);
  });
  it("相同内容重试复用已有归档，包括已编辑的最新版本，不覆盖标题或生成重复媒体", async () => {
    const first = (await app.inject(multipartUpload())).json().data.item;
    const editor = new ArchiveVideoEditService({
      config,
      database,
      store,
      tasks: createTaskStore(1000, database),
      tools,
      music: {
        acquire: async () => {
          throw Error("unused");
        }
      },
      render: async (options) => {
        await fs.writeFile(options.output, "edited-video");
        return { width: 32, height: 24, duration: 1, codec: "h264", hasAudio: true };
      }
    });
    try {
      const job = await editor.create(first.id, first.media[0].id, {
        mode: "save",
        revision: 0,
        checksum: first.media[0].checksum,
        useSavedMusic: false,
        settings: defaultArchiveAudioSettings()
      });
      await vi.waitFor(() => expect(editor.get(job.id)?.status).toBe("completed"));
      const again = await app.inject(multipartUpload(video, "another.mp4", "", "不要覆盖"));
      expect(again.statusCode, again.body).toBe(201);
      expect(again.json().data).toMatchObject({
        duplicate: true,
        item: { id: first.id, title: "我的视频", media: [{ audioEdit: { revision: 1 } }, {}] }
      });
      expect((await store.list()).total).toBe(1);
      expect(probe).toHaveBeenCalledOnce();
      expect(await fs.readdir(config.xhsArchiveStagingDir)).toEqual([]);
    } finally {
      await editor.close();
    }
  });
  it("拒绝非视频、伪造扩展名、额外文件与客户端路径字段，失败不留半条归档", async () => {
    for (const request of [
      multipartUpload(video, "bad.txt"),
      multipartUpload(Buffer.from("invalid bytes")),
      multipartUpload(
        video,
        "video.mp4",
        'Content-Disposition: form-data; name="file"; filename="extra.mp4"\r\nContent-Type: video/mp4\r\n\r\nbytes'
      ),
      multipartUpload(video, "video.mp4", 'Content-Disposition: form-data; name="path"\r\n\r\nC:/private/video.mp4')
    ]) {
      const response = await app.inject(request);
      expect([400, 413, 415]).toContain(response.statusCode);
      expect((await store.list()).total).toBe(0);
      expect(await fs.readdir(config.xhsArchiveStagingDir)).toEqual([]);
    }
    probe.mockRejectedValueOnce(new VideoEditError("ARCHIVE_EDIT_MEDIA_INVALID", "没有有效视频流", 415));
    expect((await app.inject(multipartUpload())).statusCode).toBe(415);
    expect((await store.list()).total).toBe(0);
  });
  it("大小、磁盘和总容量限制均阻止提交，数据库失败回滚文件且不影响已有素材", async () => {
    config.remoteMediaMaxBytes = 1;
    expect((await app.inject(multipartUpload())).statusCode).toBe(413);
    config.remoteMediaMaxBytes = 500 * 1024 * 1024;
    const stat = await fs.statfs(config.xhsArchiveStagingDir);
    vi.spyOn(fs, "statfs").mockResolvedValueOnce({ ...stat, bavail: 0 });
    expect((await app.inject(multipartUpload())).statusCode).toBe(507);
    config.xhsArchiveMaxStorageBytes = 1;
    expect((await app.inject(multipartUpload())).statusCode).toBe(413);
    config.xhsArchiveMaxStorageBytes = 10000000;
    vi.spyOn(database, "upsertFile").mockImplementationOnce(() => {
      throw Error("injected commit failure");
    });
    expect((await app.inject(multipartUpload())).statusCode).toBe(500);
    expect((await store.list()).total).toBe(0);
    expect(await fs.readdir(config.xhsArchiveStagingDir)).toEqual([]);
    expect(await fs.readdir(config.xhsArchiveItemsDir)).toEqual([]);
  });
  it("有界并发和退出取消不会提交成功或留下正在写入的文件", async () => {
    probe.mockImplementationOnce(
      async (_tools, _file, signal) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")), { once: true })
        )
    );
    const pending = app.inject(multipartUpload());
    await vi.waitFor(() => expect(probe).toHaveBeenCalledOnce());
    expect(
      database
        .list("task")
        .some(
          (task) =>
            task.status === "running" && (task.payload as { toolId: string }).toolId === "media-archive-local-upload"
        )
    ).toBe(true);
    expect((await app.inject(multipartUpload())).statusCode).toBe(429);
    await uploads.close();
    expect((await pending).statusCode).toBe(409);
    expect(database.list("task").every((task) => task.status !== "running")).toBe(true);
    expect((await store.list()).total).toBe(0);
    expect(await fs.readdir(config.xhsArchiveStagingDir)).toEqual([]);
  });
  it.skipIf(!realAvailable)("真实 FFmpeg 合成视频能经完整上传、探测和封面生成流程归档（不读取业务素材）", async () => {
    const source = path.join(root, "synthetic.mp4");
    await runMediaProcess(
      actualTools.ffmpeg,
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=64x48:r=10:d=1",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-y",
        source
      ],
      new AbortController().signal
    );
    tools.mockResolvedValue(actualTools);
    probe.mockImplementation(probeMedia);
    run.mockImplementation(runMediaProcess);
    const bytes = await fs.readFile(source),
      response = await app.inject(multipartUpload(bytes));
    expect(response.statusCode, response.body).toBe(201);
    const item = response.json().data.item;
    expect(item.media[0]).toMatchObject({ width: 64, height: 48, durationMs: 1000 });
    expect((await sharp((await app.inject(item.media[1].previewUrl)).rawPayload).metadata()).format).toBe("jpeg");
    expect(await fs.readFile((await store.mediaPath(item.id, item.media[0].id))!.filePath)).toEqual(bytes);
  });
});
