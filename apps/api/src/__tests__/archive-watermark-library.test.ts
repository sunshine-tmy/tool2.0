import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToolboxDatabase } from "../database/toolbox-database";
import { ArchiveWatermarkLibrary } from "../domains/content-archive/video-edit/watermark-library";
let root: string, database: ToolboxDatabase, library: ArchiveWatermarkLibrary;
let png: Buffer;
const kind = "archive-watermark-library";
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "toolbox-watermark-library-"));
  database = new ToolboxDatabase(path.join(root, "library.db"));
  library = new ArchiveWatermarkLibrary(path.join(root, "images"), database, root);
  png = await sharp({ create: { width: 12, height: 8, channels: 4, background: { r: 0, g: 80, b: 160, alpha: 0.5 } } })
    .png()
    .toBuffer();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await library.idle();
  database.close();
  expect(path.dirname(root)).toBe(path.resolve(os.tmpdir()));
  expect(path.basename(root)).toMatch(/^toolbox-watermark-library-/);
  await fs.rm(root, { recursive: true, force: true });
});
describe("永久水印素材库", () => {
  it("跨重启保存透明图片，规范化去重和并发上传不重复，记录文件摘要而不暴露路径", async () => {
    const [saved, duplicate] = await Promise.all([
      library.upload(png, "品牌.png", "image/png"),
      library.upload(png, "renamed.png", "image/png")
    ]);
    expect(duplicate.id).toBe(saved.id);
    expect(saved).toMatchObject({ name: "品牌.png", width: 12, height: 8, revision: 1 });
    expect(JSON.stringify(saved)).not.toContain(root);
    expect(database.listFiles({ entityKind: kind })).toHaveLength(1);
    database.close();
    database = new ToolboxDatabase(path.join(root, "library.db"));
    library = new ArchiveWatermarkLibrary(path.join(root, "images"), database, root);
    expect(await library.list()).toEqual([saved]);
    const { bytes } = await library.read(saved.id);
    expect((await sharp(bytes).metadata()).hasAlpha).toBe(true);
    await fs.utimes(path.join(root, "images", `${saved.id}.png`), new Date(0), new Date(0));
    expect((await library.read(saved.id)).bytes).toEqual(bytes);
  });
  it("拒绝假图、SVG、动态图片及超限尺寸；不接收路径，不产生永久文件", async () => {
    const huge = await sharp({ create: { width: 8193, height: 1, channels: 4, background: "red" } })
      .png()
      .toBuffer();
    for (const [bytes, name, mime] of [
      [Buffer.from("not png"), "fake.png", "image/png"],
      [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>'), "fake.png", "image/png"],
      [png, "fake.svg", "image/svg+xml"],
      [huge, "huge.png", "image/png"]
    ] as const)
      await expect(library.upload(bytes, name, mime)).rejects.toMatchObject({ code: "ARCHIVE_WATERMARK_INVALID" });
    await expect(library.read("../bad")).rejects.toMatchObject({ statusCode: 404 });
    expect(await library.list()).toEqual([]);
    expect(await fs.readdir(path.join(root, "images"))).toEqual([]);
  });
  it("数据库写入和删除失败均回滚文件和元数据，错误 revision 不会删除", async () => {
    vi.spyOn(database, "upsertFile").mockImplementationOnce(() => {
      throw new Error("database failure");
    });
    await expect(library.upload(png, "first.png", "image/png")).rejects.toThrow("database failure");
    expect(await library.list()).toEqual([]);
    expect(await fs.readdir(path.join(root, "images"))).toEqual([]);
    const saved = await library.upload(png, "logo.png", "image/png");
    await expect(library.remove(saved.id, 2)).rejects.toMatchObject({ statusCode: 409 });
    vi.spyOn(database, "remove").mockImplementationOnce(() => {
      throw new Error("delete failure");
    });
    await expect(library.remove(saved.id, 1)).rejects.toThrow("delete failure");
    expect((await library.read(saved.id)).item).toEqual(saved);
    expect(database.listFiles({ entityKind: kind })).toHaveLength(1);
    await library.remove(saved.id, 1);
    expect(await library.list()).toEqual([]);
    expect(database.listFiles({ entityKind: kind })).toEqual([]);
    expect(await fs.readdir(path.join(root, "images"))).toEqual([]);
  });
  it("删除中断时按数据库提交情况恢复或完成删除，不清理其他文件", async () => {
    const saved = await library.upload(png, "logo.png", "image/png");
    const original = path.join(root, "images", `${saved.id}.png`),
      pending = path.join(root, "images", `.${saved.id}.deleting.png`);
    await fs.rename(original, pending);
    expect(await library.list()).toEqual([saved]);
    expect((await library.read(saved.id)).bytes.length).toBeGreaterThan(0);
    await fs.rename(original, pending);
    database.remove(kind, saved.id);
    await fs.writeFile(path.join(root, "images", "unrelated.png"), png);
    expect(await library.list()).toEqual([]);
    expect(await fs.readdir(path.join(root, "images"))).toEqual(["unrelated.png"]);
  });
  it("缺失或被篡改的文件不能选用；重新上传生成健康副本，旧异常记录不会静默删除", async () => {
    const saved = await library.upload(png, "logo.png", "image/png");
    await fs.writeFile(path.join(root, "images", `${saved.id}.png`), "modified");
    await expect(library.read(saved.id)).rejects.toMatchObject({ code: "ARCHIVE_WATERMARK_LIBRARY_UNAVAILABLE" });
    const replacement = await library.upload(png, "logo.png", "image/png");
    expect(replacement.id).not.toBe(saved.id);
    expect(await library.list()).toHaveLength(2);
    expect((await library.read(replacement.id)).bytes.length).toBeGreaterThan(0);
  });
  it("数量和容量上限受串行校验限制，不通过上传额外突破", async () => {
    const saved = await library.upload(png, "logo.png", "image/png");
    for (let index = 0; index < 13; index++) {
      const id = `fake${String(index).padStart(8, "0")}`;
      database.upsert({
        id,
        kind,
        status: "ready",
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
        payload: { ...saved, id, checksum: String(index).padStart(64, "0"), size: 20 * 1024 * 1024 }
      });
    }
    const other = await sharp(png).negate().png().toBuffer();
    await expect(library.upload(other, "next.png", "image/png")).rejects.toMatchObject({
      code: "ARCHIVE_WATERMARK_LIBRARY_QUOTA"
    });
    expect(await library.list()).toHaveLength(14);
    database.transaction(() => {
      for (const record of database.list(kind)) database.remove(kind, record.id);
      for (let index = 0; index < 200; index++) {
        const id = `fake${String(index).padStart(8, "0")}`;
        database.upsert({
          id,
          kind,
          status: "ready",
          createdAt: saved.createdAt,
          updatedAt: saved.updatedAt,
          payload: { ...saved, id, checksum: String(index).padStart(64, "0"), size: 1 }
        });
      }
    });
    await expect(library.upload(other, "next.png", "image/png")).rejects.toMatchObject({
      code: "ARCHIVE_WATERMARK_LIBRARY_QUOTA"
    });
    expect(await library.list()).toHaveLength(200);
  });
});
