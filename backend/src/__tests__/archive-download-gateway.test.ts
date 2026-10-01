/** 下载负向回归：备用 CDN、格式、体积、超时和取消都不能遗留 staging。 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import fsSync from "node:fs";
import { Writable } from "node:stream";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArchiveDownloadGateway } from "../modules/media-archive/download-gateway";
import { getConfig } from "../config";
import type { ArchiveSource } from "../modules/media-archive/provider";

let root: string;
let config: ReturnType<typeof getConfig>;
let png: Buffer;
let remote: ReturnType<typeof vi.fn>;
let gateway: ArchiveDownloadGateway;
const entry: ArchiveSource["media"][number] = { kind: "image", index: 0, urls: ["https://cdn.test/image"] };
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-archive-download-"));
  config = getConfig({ dotenvPath: false, environment: { NODE_ENV: "test", STORAGE_ROOT: root } });
  png = await sharp({ create: { width: 120, height: 64, channels: 3, background: "blue" } })
    .png()
    .toBuffer();
  remote = vi.fn(async () => new Response(new Uint8Array(png)));
  gateway = new ArchiveDownloadGateway(config, remote);
});
afterEach(async () => {
  vi.restoreAllMocks();
  if (
    !path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) ||
    !path.basename(root).startsWith("toolbox-archive-download-")
  )
    throw new Error("清理目录越界");
  await fs.rm(root, { recursive: true, force: true });
});
const signal = () => new AbortController().signal;
describe("归档媒体下载", () => {
  it("WebP 校验后不持有 Windows 文件锁，归档 staging 可立即原子移动", async () => {
    const directory = path.join(root, "staging");
    await fs.mkdir(directory);
    const webp = await sharp(png).webp().toBuffer();
    remote.mockResolvedValue(new Response(new Uint8Array(webp), { headers: { "content-type": "image/webp" } }));
    const media = await gateway.download(entry, "douyin", directory, "archive_123456", signal());
    const target = path.join(root, "committed");
    await fs.rename(directory, target);
    expect(await fs.readFile(path.join(target, media.fileName))).toEqual(webp);
    if (process.platform === "win32") expect(sharp.cache().files.max).toBe(0);
  });
  it("真实解码决定图像尺寸和格式，不信任解析器或 HTTP 类型", async () => {
    remote.mockResolvedValue(new Response(new Uint8Array(png), { headers: { "content-type": "text/html" } }));
    const media = await gateway.download({ ...entry, width: 1, height: 1 }, "douyin", root, "archive_123456", signal());
    expect(media).toMatchObject({ mimeType: "image/png", width: 120, height: 64, size: png.length });
    expect(media.fileName).toMatch(/\.png$/);
    expect(await fs.readFile(path.join(root, media.fileName))).toEqual(png);
  });
  it("备用地址完整经过请求网关，失败工件清理且不附带 Cookie", async () => {
    remote.mockResolvedValueOnce(new Response("failed", { status: 503 }));
    const media = await gateway.download(
      { ...entry, urls: ["https://bad.test/image", ...entry.urls] },
      "douyin",
      root,
      "archive_123456",
      signal()
    );
    expect(remote).toHaveBeenCalledTimes(2);
    expect(await fs.readdir(root)).toEqual([media.fileName]);
    expect(remote.mock.calls[1][1].headers).not.toHaveProperty("cookie");
    expect(remote.mock.calls.every((call) => call[1].signal.aborted)).toBe(true);
  });
  it("磁盘空间不足时停止备用地址重试并清理部分文件", async () => {
    const noSpace = Object.assign(new Error("disk full"), { code: "ENOSPC" });
    vi.spyOn(fsSync, "createWriteStream").mockImplementation(
      () =>
        new Writable({
          write(_chunk, _encoding, callback) {
            callback(noSpace);
          }
        }) as unknown as ReturnType<typeof fsSync.createWriteStream>
    );

    await expect(
      gateway.download(
        { ...entry, urls: [...entry.urls, "https://backup.test/image"] },
        "douyin",
        root,
        "archive_123456",
        signal()
      )
    ).rejects.toMatchObject({
      code: "ARCHIVE_DISK_SPACE_INSUFFICIENT",
      statusCode: 507,
      message: expect.stringContaining("现有存档未被覆盖")
    });
    expect(remote).toHaveBeenCalledOnce();
    expect(await fs.readdir(root)).toEqual([]);
  });
  it.each(["header", "body", "truncated", "empty", "html", "image-type", "video-type"])(
    "%s 异常拒绝并移除临时文件",
    async (mode) => {
      let bytes: Buffer = png;
      const headers: Record<string, string> = {};
      let kind = entry.kind;
      if (mode === "header") {
        config.remoteMediaMaxBytes = 8;
        headers["content-length"] = String(png.length);
      }
      if (mode === "body") config.remoteMediaMaxBytes = 8;
      if (mode === "truncated") headers["content-length"] = String(png.length + 1);
      if (mode === "empty") bytes = Buffer.alloc(0);
      if (mode === "html") {
        bytes = Buffer.from("<html>error</html>");
        headers["content-type"] = "image/jpeg";
      }
      if (mode === "image-type") bytes = await sharp(png).tiff().toBuffer();
      if (mode === "video-type") kind = "video";
      remote.mockResolvedValue(new Response(new Uint8Array(bytes), { headers }));
      await expect(
        gateway.download({ ...entry, kind }, "douyin", root, "archive_123456", signal())
      ).rejects.toMatchObject({ code: "ARCHIVE_MEDIA_DOWNLOAD_FAILED" });
      expect(await fs.readdir(root)).toHaveLength(0);
    }
  );
  it("视频检测检验容器头，不把 HTML 当作 MP4", async () => {
    // 容器头夹具不代表完整视频解码，真实播放在独立作品验收验证。
    remote.mockResolvedValue(
      new Response(Buffer.from("0000ftypisom0000"), { headers: { "content-type": "application/octet-stream" } })
    );
    expect(
      await gateway.download(
        { ...entry, kind: "live-photo", durationMs: 1000 },
        "douyin",
        root,
        "archive_123456",
        signal()
      )
    ).toMatchObject({ mimeType: "video/mp4", durationMs: 1000 });
  });
  it("小红书保留历史缺省格式，但不内联活动 HTML", async () => {
    remote.mockResolvedValueOnce(
      new Response(new Uint8Array(png), { headers: { "content-type": "application/octet-stream" } })
    );
    expect((await gateway.download(entry, "xiaohongshu", root, "archive_123456", signal())).mimeType).toBe(
      "image/jpeg"
    );
    remote.mockResolvedValueOnce(new Response("html", { headers: { "content-type": "text/html" } }));
    await expect(gateway.download(entry, "xiaohongshu", root, "archive_123456", signal())).rejects.toThrow(
      "格式校验失败"
    );
  });
  it("小红书 QuickTime 类型仍使用受控扩展名", async () => {
    remote.mockResolvedValueOnce(
      new Response(Buffer.from("video fixture"), { headers: { "content-type": "video/quicktime" } })
    );
    expect(
      (await gateway.download({ ...entry, kind: "video" }, "xiaohongshu", root, "archive_123456", signal())).fileName
    ).toMatch(/\.mov$/);
  });
  it("即使网络实现忽略信号，连接超时也不会占住任务", async () => {
    config.remoteFetchTimeoutMs = 5;
    remote.mockImplementation(() => new Promise(() => undefined));
    await expect(gateway.download(entry, "douyin", root, "archive_123456", signal())).rejects.toMatchObject({
      code: "ARCHIVE_MEDIA_DOWNLOAD_FAILED"
    });
  });
  it("流式读取取消释放工件，不继续尝试备用地址", async () => {
    const controller = new AbortController();
    remote.mockResolvedValue(
      new Response(
        new ReadableStream({
          start(stream) {
            stream.enqueue(png);
          }
        })
      )
    );
    const pending = gateway.download(
      { ...entry, urls: [...entry.urls, "https://backup.test/image"] },
      "douyin",
      root,
      "archive_123456",
      controller.signal
    );
    await vi.waitFor(async () => expect(await fs.readdir(root)).toHaveLength(1));
    controller.abort(new DOMException("用户取消", "AbortError"));
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(await fs.readdir(root)).toHaveLength(0);
    expect(remote).toHaveBeenCalledOnce();
  });
  it("空地址集合或开始前取消均不访问网络", async () => {
    await expect(gateway.download({ ...entry, urls: [] }, "douyin", root, "archive_123456", signal())).rejects.toThrow(
      "媒体下载"
    );
    const controller = new AbortController();
    controller.abort();
    await expect(gateway.download(entry, "douyin", root, "archive_123456", controller.signal)).rejects.toMatchObject({
      name: "AbortError"
    });
    expect(remote).not.toHaveBeenCalled();
  });
});
