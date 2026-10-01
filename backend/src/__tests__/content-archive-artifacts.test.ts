/** 隔离 SQLite + 真实 HTTP：两平台截帧、ZIP、重启与权限都通过共用生产路由，不访问在线平台。 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { crc32 } from "node:zlib";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { isContentArchiveItem, type ContentArchiveItem } from "@toolbox/shared";
import { createApp } from "../app";
import { getConfig } from "../config";
import { ToolboxDatabase } from "../database/toolbox-database";
import { ContentArchiveStore } from "../modules/media-archive/store";
import { readArchiveZip } from "./helpers/archive-zip";

let root: string, config: ReturnType<typeof getConfig>, png: Buffer, apps: FastifyInstance[];
const nativeFetch = globalThis.fetch;
const base = "/api/v1/tools/media-archive/items";
// 仅用于后端媒体路由的容器夹具，不宣称视频实际解码；真实作品播放由独立浏览器验收覆盖。
const video = Buffer.from("0000ftypisom-video-fixture");
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-archive-artifacts-"));
  config = getConfig({
    dotenvPath: false,
    environment: {
      NODE_ENV: "test",
      DEPLOYMENT_MODE: "local",
      STORAGE_ROOT: root,
      DATABASE_PATH: path.join(root, "toolbox.db")
    }
  });
  apps = [];
  png = await sharp({ create: { width: 16, height: 12, channels: 3, background: "#3c68ff" } })
    .png()
    .toBuffer();
  globalThis.fetch = vi.fn(async () => {
    throw new Error("该验收不允许访问在线平台");
  }) as typeof fetch;
});
afterEach(async () => {
  for (const app of apps) await app.close().catch(() => undefined);
  globalThis.fetch = nativeFetch;
  vi.restoreAllMocks();
  if (
    !path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) ||
    !path.basename(root).startsWith("toolbox-archive-artifacts-")
  )
    throw new Error("测试清理越界");
  await fs.rm(root, { recursive: true, force: true });
});
async function seed(
  platform: ContentArchiveItem["platform"] = "douyin",
  kind: "video" | "live-photo" | "image" = "video"
) {
  const database = new ToolboxDatabase(config.databasePath);
  try {
    const store = new ContentArchiveStore(config, database);
    const id = platform === "douyin" ? "dy_archive123" : "xhs_archive123",
      mediaId = `${platform === "douyin" ? "dy" : "xhs"}_media123`;
    const bytes = kind === "image" ? png : video;
    const source =
      platform === "douyin"
        ? "https://www.douyin.com/video/123456789"
        : "https://www.xiaohongshu.com/explore/123456789";
    const item: ContentArchiveItem = {
      id,
      platform,
      contentId: "123456789",
      type: kind,
      title: "[彩虹R]作品标题",
      description: "[彩虹R]完整文案 #话题",
      rawText: platform === "douyin" ? "[彩虹R]完整文案 #话题" : undefined,
      sourceUrl: source,
      canonicalUrl: source,
      topics: [],
      media: [
        {
          id: mediaId,
          kind,
          index: 0,
          fileName: kind === "image" ? "original.png" : "original.mp4",
          mimeType: kind === "image" ? "image/png" : "video/mp4",
          size: bytes.length,
          checksum: sha(bytes),
          durationMs: kind === "image" ? undefined : 5000,
          previewUrl: `${base}/${id}/media/${mediaId}`,
          downloadUrl: `${base}/${id}/media/${mediaId}?download=1`
        }
      ],
      status: "ready",
      warnings: [],
      totalBytes: bytes.length,
      fetchedAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z"
    };
    const staging = await store.createStaging(`stage_${id}`);
    await fs.writeFile(path.join(staging, item.media[0].fileName), bytes);
    return await store.commit(item, staging);
  } finally {
    database.close();
  }
}
async function appWith() {
  const app = await createApp({ config });
  apps.push(app);
  return app;
}
function multipart(source: string, timestamp: number | string, bytes = png, mime = "image/png", fieldName = "file") {
  const boundary = "----toolbox-frame-validation";
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="sourceMediaId"\r\n\r\n${source}\r\n` +
          `--${boundary}\r\nContent-Disposition: form-data; name="timestampMs"\r\n\r\n${timestamp}\r\n` +
          `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="frame.png"\r\nContent-Type: ${mime}\r\n\r\n`
      ),
      bytes,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ])
  };
}
const capture = (
  app: FastifyInstance,
  item: ContentArchiveItem,
  timestamp: number | string = 1234,
  bytes = png,
  mime = "image/png",
  source = item.media[0].id
) => app.inject({ method: "POST", url: `${base}/${item.id}/frames`, ...multipart(source, timestamp, bytes, mime) });
const detail = async (app: FastifyInstance, id: string) =>
  (await app.inject({ method: "GET", url: `${base}/${id}` })).json().data as ContentArchiveItem;

describe("双平台截帧与导出 API", () => {
  it.each(["xiaohongshu", "douyin"] as const)("%s 保存实际 PNG、下载、ZIP、重启和删除保持一致", async (platform) => {
    const item = await seed(platform),
      app = await appWith(),
      response = await capture(app, item);
    expect(response.statusCode).toBe(200);
    expect(isContentArchiveItem(response.json().data)).toBe(true);
    const saved = response.json().data as ContentArchiveItem,
      frame = saved.media[1];
    expect(frame).toMatchObject({
      kind: "image",
      mimeType: "image/png",
      width: 16,
      height: 12,
      size: png.length,
      checksum: sha(png),
      frameSourceMediaId: item.media[0].id,
      frameTimestampMs: 1234
    });
    expect(saved.totalBytes).toBe(video.length + png.length);
    const download = await app.inject({ method: "GET", url: frame.downloadUrl });
    expect(download.statusCode).toBe(200);
    expect(download.rawPayload).toEqual(png);
    const zip = await app.inject({ method: "GET", url: `${base}/${item.id}/download.zip` });
    expect(zip.statusCode).toBe(200);
    const entries = readArchiveZip(zip.rawPayload);
    expect(entries.get("视频-01.mp4")).toEqual(video);
    expect(entries.get("视频截帧-001-00-00-01-234.png")).toEqual(png);
    expect(entries.get("原始文案.txt")!.toString()).toBe(item.description);
    expect(JSON.parse(entries.get("metadata.json")!.toString())).toMatchObject({ platform, contentId: item.contentId });
    await app.close();
    const restarted = await appWith();
    expect((await detail(restarted, item.id)).media[1]).toEqual(frame);
    for (const endpoint of ["/health/live", "/health/ready"])
      expect((await restarted.inject(endpoint)).statusCode).toBe(200);
    const removed = await restarted.inject({ method: "DELETE", url: `${base}/${item.id}` });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().data).toMatchObject({ mediaCount: 2, releasedBytes: saved.totalBytes });
    expect(
      await fs.access(path.join(config.xhsArchiveItemsDir, item.id)).then(
        () => true,
        () => false
      )
    ).toBe(false);
    await restarted.close();
    const database = new ToolboxDatabase(config.databasePath);
    try {
      expect(database.listFiles({ entityKind: "xhs-media" })).toHaveLength(0);
      expect(database.verify().foreignKeys).toEqual([]);
    } finally {
      database.close();
    }
  });
  it("实况视频可截帧，并发保存有独立序号/文件且无丢失更新", async () => {
    const item = await seed("douyin", "live-photo"),
      app = await appWith();
    const responses = await Promise.all([capture(app, item, 10), capture(app, item, 20)]);
    expect(responses.map((response) => response.statusCode)).toEqual([200, 200]);
    const saved = await detail(app, item.id),
      frames = saved.media.slice(1);
    expect(frames.map((frame) => frame.index).sort()).toEqual([0, 1]);
    expect(frames.map((frame) => frame.frameTimestampMs).sort()).toEqual([10, 20]);
    expect(new Set(frames.map((frame) => frame.id)).size).toBe(2);
    const entries = readArchiveZip((await app.inject(`${base}/${item.id}/download.zip`)).rawPayload);
    expect([...entries.values()].filter((entry) => entry.equals(png))).toHaveLength(2);
  });
  it.each(["negative", "unsafe", "source", "mime", "signature", "missing", "pixels", "decode", "oversize"])(
    "%s 非法截帧不写目录或元数据",
    async (mode) => {
      const item = await seed(),
        app = await appWith();
      let bytes = png,
        timestamp: string | number = 1234,
        source = item.media[0].id,
        mime = "image/png",
        field = "file";
      if (mode === "negative") timestamp = -1;
      if (mode === "unsafe") timestamp = "9007199254740992";
      if (mode === "source") source = "../video";
      if (mode === "mime") mime = "image/jpeg";
      if (mode === "signature") bytes = Buffer.from("not PNG");
      if (mode === "missing") field = "not-file";
      if (mode === "pixels") {
        bytes = Buffer.from(png);
        bytes.writeUInt32BE(40_000_001, 16);
        bytes.writeUInt32BE(1, 20);
        bytes.writeUInt32BE(crc32(bytes.subarray(12, 29)), 29);
      }
      if (mode === "decode") {
        // 合法 IHDR 仍能读取尺寸，损坏的 IDAT 像素流不能作为有效画面保存。
        bytes = Buffer.from(png);
        const idat = bytes.indexOf(Buffer.from("IDAT"));
        bytes[idat + 4] ^= 0xff;
      }
      if (mode === "oversize") bytes = Buffer.alloc(20 * 1024 * 1024 + 1);
      const before = await fs.readFile(path.join(config.xhsArchiveItemsDir, item.id, "manifest.json"));
      const response = await app.inject({
        method: "POST",
        url: `${base}/${item.id}/frames`,
        ...multipart(source, timestamp, bytes, mime, field)
      });
      const status = ["pixels", "oversize"].includes(mode)
        ? 413
        : ["negative", "unsafe", "source", "missing"].includes(mode)
          ? 400
          : 415;
      expect(response.statusCode).toBe(status);
      expect(response.json()).toMatchObject({
        success: false,
        requestId: expect.any(String),
        error: { code: expect.stringMatching(/^ARCHIVE_FRAME_/) }
      });
      expect((await detail(app, item.id)).media).toHaveLength(1);
      expect(await fs.readFile(path.join(config.xhsArchiveItemsDir, item.id, "manifest.json"))).toEqual(before);
      expect((await fs.readdir(path.join(config.xhsArchiveItemsDir, item.id))).sort()).toEqual([
        "manifest.json",
        "original.mp4"
      ]);
    }
  );
  it("不能从图集静态图或另一归档的视频保存画面，旧接口不能截帧/导出抖音", async () => {
    const douyin = await seed(),
      xhs = await seed("xiaohongshu", "image"),
      app = await appWith();
    expect((await capture(app, xhs)).json().error.code).toBe("ARCHIVE_FRAME_SOURCE_INVALID");
    expect((await capture(app, xhs, 1234, png, "image/png", douyin.media[0].id)).statusCode).toBe(400);
    const legacy = "/api/v1/tools/xhs-archive/items/" + douyin.id;
    expect(
      (await app.inject({ method: "POST", url: legacy + "/frames", ...multipart(douyin.media[0].id, 1234) })).statusCode
    ).toBe(404);
    expect((await app.inject(legacy + "/download.zip")).statusCode).toBe(404);
    expect((await detail(app, douyin.id)).media).toHaveLength(1);
  });
  it("未知归档返回 404，空间不足映射中性错误码并保持原数据", async () => {
    const item = await seed();
    config.xhsArchiveMaxStorageBytes = video.length + png.length - 1;
    const app = await appWith();
    expect((await capture(app, item)).json().error.code).toBe("ARCHIVE_STORAGE_QUOTA_EXCEEDED");
    const absent = { ...item, id: "missing_123456" };
    expect((await capture(app, absent)).statusCode).toBe(404);
    expect((await app.inject(`${base}/${absent.id}/download.zip`)).json().error.code).toBe("ARCHIVE_NOT_FOUND");
    expect((await detail(app, item.id)).totalBytes).toBe(video.length);
  });
  it("索引事务失败回滚 PNG、清单与记录，不留 staging 文件", async () => {
    const item = await seed(),
      app = await appWith(),
      before = await fs.readFile(path.join(config.xhsArchiveItemsDir, item.id, "manifest.json"));
    const record = vi.spyOn(ToolboxDatabase.prototype, "upsertFile").mockImplementationOnce(() => {
      throw new Error("injected index failure");
    });
    expect((await capture(app, item)).statusCode).toBe(500);
    record.mockRestore();
    expect(await fs.readFile(path.join(config.xhsArchiveItemsDir, item.id, "manifest.json"))).toEqual(before);
    expect((await detail(app, item.id)).media).toHaveLength(1);
    expect((await fs.readdir(path.join(config.xhsArchiveItemsDir, item.id))).sort()).toEqual([
      "manifest.json",
      "original.mp4"
    ]);
  });
  it.each(["missing", "size"])("%s 媒体不返回看似成功的缺文件 ZIP", async (mode) => {
    const item = await seed(),
      app = await appWith(),
      file = path.join(config.xhsArchiveItemsDir, item.id, item.media[0].fileName);
    if (mode === "missing") await fs.unlink(file);
    else await fs.writeFile(file, "modified fixture");
    const response = await app.inject(`${base}/${item.id}/download.zip`);
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("ARCHIVE_EXPORT_MEDIA_MISSING");
    expect((await detail(app, item.id)).media).toHaveLength(1);
  });
  it("LAN 访客不能截图管理，管理员仍需 CSRF 与精确 Origin", async () => {
    const item = await seed();
    config.deploymentMode = "lan";
    config.adminPin = "123456";
    config.corsOrigins = ["http://127.0.0.1:5173"];
    const app = await appWith();
    expect((await capture(app, item)).statusCode).toBe(401);
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/session",
      headers: { origin: "http://127.0.0.1:5173" },
      payload: { pin: "123456" }
    });
    expect(login.statusCode).toBe(200);
    const cookie = String(login.headers["set-cookie"]).split(";")[0],
      token = login.json().data.csrfToken;
    const upload = multipart(item.media[0].id, 1234);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `${base}/${item.id}/frames`,
          ...upload,
          headers: { ...upload.headers, cookie, origin: "http://127.0.0.1:5173" }
        })
      ).statusCode
    ).toBe(403);
    const response = await app.inject({
      method: "POST",
      url: `${base}/${item.id}/frames`,
      ...upload,
      headers: { ...upload.headers, cookie, origin: "http://127.0.0.1:5173", "x-csrf-token": token }
    });
    expect(response.statusCode).toBe(200);
  });
});
