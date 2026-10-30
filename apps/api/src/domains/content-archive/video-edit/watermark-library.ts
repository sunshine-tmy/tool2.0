/** Persistent watermark images; selecting always creates a separate, video-bound draft. */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import { Value } from "@sinclair/typebox/value";
import { ArchiveWatermarkLibraryItemSchema, type ArchiveWatermarkLibraryItem } from "@toolbox/shared";
import type { ToolboxDatabase } from "../../../database/toolbox-database";
import { FileMetadataRepository } from "../../../database/file-metadata";
import { writeAtomicFile } from "../../../storage/file-commit-gateway";
import { normalizeWatermark, watermarkMaxBytes } from "./watermark-image";
import { VideoEditError } from "./renderer";

const kind = "archive-watermark-library";
const maxCount = 200,
  maxTotalBytes = 256 * 1024 * 1024;
export class ArchiveWatermarkLibrary {
  private tail: Promise<unknown> = Promise.resolve();
  private files: FileMetadataRepository;
  constructor(
    private root: string,
    private database: ToolboxDatabase,
    storageRoot: string,
    private onError?: (error: unknown) => void
  ) {
    this.files = new FileMetadataRepository(database, storageRoot);
  }
  private serial<T>(action: () => Promise<T>): Promise<T> {
    const next = this.tail.then(action);
    this.tail = next.catch(() => undefined);
    return next;
  }
  private file(id: string) {
    if (!/^[A-Za-z0-9_-]{12}$/.test(id))
      throw new VideoEditError("ARCHIVE_WATERMARK_LIBRARY_NOT_FOUND", "水印素材不存在，请刷新水印库", 404);
    return path.join(this.root, `${id}.png`);
  }
  private async stat(filename: string) {
    try {
      return await fs.lstat(filename);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }
  private records(): ArchiveWatermarkLibraryItem[] {
    return this.database.list(kind).map(({ id, payload }) => {
      if (!Value.Check(ArchiveWatermarkLibraryItemSchema, payload) || payload.id !== id)
        throw new VideoEditError("ARCHIVE_WATERMARK_LIBRARY_CORRUPT", "水印库记录损坏，请检查诊断信息", 500);
      return structuredClone(payload);
    });
  }
  private get(id: string) {
    this.file(id);
    const item = this.records().find((entry) => entry.id === id);
    if (!item) throw new VideoEditError("ARCHIVE_WATERMARK_LIBRARY_NOT_FOUND", "水印素材已删除，请刷新水印库", 404);
    return item;
  }
  private async prepare() {
    await fs.mkdir(this.root, { recursive: true });
    const root = await fs.lstat(this.root);
    if (!root.isDirectory() || root.isSymbolicLink())
      throw new VideoEditError("ARCHIVE_WATERMARK_LIBRARY_PATH", "水印库目录异常，请检查数据位置", 500);
    // A crash before the DB commit restores the image. A committed deletion can finish on the next access.
    for (const name of await fs.readdir(this.root)) {
      const match = /^\.([A-Za-z0-9_-]{12})\.deleting\.png$/.exec(name);
      if (!match) continue;
      const pending = path.join(this.root, name),
        target = this.file(match[1]);
      const stat = await fs.lstat(pending);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw new VideoEditError("ARCHIVE_WATERMARK_LIBRARY_PATH", "水印库恢复文件异常", 500);
      if (this.database.get(kind, match[1])) {
        if (await this.stat(target))
          throw new VideoEditError(
            "ARCHIVE_WATERMARK_LIBRARY_RECOVERY",
            "水印库存在冲突的恢复文件，请检查诊断信息",
            500
          );
        await fs.rename(pending, target);
        await this.files.register({
          entityKind: kind,
          entityId: match[1],
          filePath: target,
          mediaType: "image/png",
          owner: "local"
        });
      } else await fs.rm(pending).catch((error) => this.onError?.(error));
    }
  }
  list() {
    return this.serial(async () => {
      await this.prepare();
      return this.records();
    });
  }
  upload(bytes: Buffer, filename: string, mime: string) {
    return this.serial(async () => {
      await this.prepare();
      const normalized = await normalizeWatermark(bytes, filename, mime);
      const checksum = createHash("sha256").update(normalized.data).digest("hex"),
        entries = this.records();
      const existing = entries.find((item) => item.checksum === checksum);
      if (existing) {
        try {
          await this.readImage(existing);
          return existing;
        } catch (error) {
          if (!(error instanceof VideoEditError) || error.code !== "ARCHIVE_WATERMARK_LIBRARY_UNAVAILABLE") throw error;
          // An explicit re-upload can add a healthy copy without silently deleting the damaged entry.
        }
      }
      if (
        entries.length >= maxCount ||
        entries.reduce((sum, item) => sum + item.size, 0) + normalized.data.length > maxTotalBytes
      )
        throw new VideoEditError(
          "ARCHIVE_WATERMARK_LIBRARY_QUOTA",
          "水印库最多保存 200 张且总计不超过 256 MiB，请先整理旧素材",
          409
        );
      const free = await fs.statfs(this.root);
      if (Number(free.bavail) * Number(free.bsize) < watermarkMaxBytes * 3)
        throw new VideoEditError("ARCHIVE_EDIT_DISK_FULL", "磁盘剩余空间不足，无法保存水印", 507);
      const id = nanoid(12),
        now = new Date().toISOString(),
        target = this.file(id);
      const name =
        filename
          .replaceAll("\\", "/")
          .split("/")
          .pop()!
          .replace(/\p{Cc}/gu, "")
          .trim()
          .slice(0, 120) || "水印图片";
      const item: ArchiveWatermarkLibraryItem = {
        id,
        name,
        checksum,
        width: normalized.info.width,
        height: normalized.info.height,
        size: normalized.data.length,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        previewUrl: `/api/v1/tools/media-archive/watermark-library/${id}/image`
      };
      await writeAtomicFile(target, normalized.data, nanoid(12));
      try {
        const file = await this.files.inspect({
          entityKind: kind,
          entityId: id,
          filePath: target,
          mediaType: "image/png",
          owner: "local"
        });
        this.database.transaction(() => {
          this.database.upsert({ id, kind, status: "ready", payload: item, createdAt: now, updatedAt: now });
          this.database.upsertFile(file);
        });
      } catch (error) {
        await fs.rm(target, { force: true });
        throw error;
      }
      return structuredClone(item);
    });
  }
  private async readImage(item: ArchiveWatermarkLibraryItem) {
    const filename = this.file(item.id),
      stat = await this.stat(filename);
    if (!stat?.isFile() || stat.isSymbolicLink() || stat.size !== item.size)
      throw new VideoEditError("ARCHIVE_WATERMARK_LIBRARY_UNAVAILABLE", "水印素材文件缺失或已改变，请重新上传", 409);
    const bytes = await fs.readFile(filename);
    if (bytes.length !== item.size || createHash("sha256").update(bytes).digest("hex") !== item.checksum)
      throw new VideoEditError("ARCHIVE_WATERMARK_LIBRARY_UNAVAILABLE", "水印素材校验失败，请重新上传", 409);
    return bytes;
  }
  read(id: string) {
    return this.serial(async () => {
      await this.prepare();
      const item = this.get(id);
      return { item, bytes: await this.readImage(item) };
    });
  }
  remove(id: string, revision: number) {
    return this.serial(async () => {
      await this.prepare();
      const item = this.get(id);
      if (item.revision !== revision)
        throw new VideoEditError("ARCHIVE_WATERMARK_LIBRARY_CONFLICT", "水印素材已变化，请刷新水印库", 409);
      const target = this.file(id),
        pending = path.join(this.root, `.${id}.deleting.png`);
      const stat = await this.stat(target);
      if (stat && (!stat.isFile() || stat.isSymbolicLink()))
        throw new VideoEditError("ARCHIVE_WATERMARK_LIBRARY_PATH", "水印素材路径异常", 409);
      if (stat) await fs.rename(target, pending);
      try {
        this.database.transaction(() => {
          this.database.remove(kind, id);
          this.files.removeForEntity(kind, id);
        });
      } catch (error) {
        if (stat) await fs.rename(pending, target);
        throw error;
      }
      if (stat) await fs.rm(pending).catch((error) => this.onError?.(error));
      return { id };
    });
  }
  async idle() {
    await this.tail;
  }
}
