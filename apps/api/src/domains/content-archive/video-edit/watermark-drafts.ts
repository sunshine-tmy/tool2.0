/** 只管理新上传的水印草稿：24 小时过期，排队或运行中的任务持有租约。 */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import type { ArchiveEditFile, ArchiveWatermarkDraft } from "@toolbox/shared";
import { VideoEditError } from "./renderer";
import { normalizeWatermark, watermarkMaxBytes as maxBytes } from "./watermark-image";

const lifetime = 24 * 3600_000;
type Draft = {
  itemId: string;
  mediaId: string;
  width: number;
  height: number;
  expiresAt: string;
  file: ArchiveEditFile;
};
export class ArchiveWatermarkDrafts {
  private pins = new Map<string, number>();
  private retired = new Set<string>();
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private root: string) {}
  private serial<T>(action: () => Promise<T>): Promise<T> {
    const result = this.tail.then(action);
    this.tail = result.catch(() => undefined);
    return result;
  }
  private directory(id: string) {
    if (!/^[A-Za-z0-9_-]{12}$/.test(id))
      throw new VideoEditError("ARCHIVE_WATERMARK_MISSING", "水印草稿不存在或已过期", 404);
    return path.join(this.root, `watermark-draft-${id}`);
  }
  private async read(itemId: string, mediaId: string, id: string): Promise<Draft> {
    const directory = this.directory(id);
    const stat = await fs.lstat(directory).catch(() => undefined);
    if (!stat?.isDirectory() || stat.isSymbolicLink())
      throw new VideoEditError("ARCHIVE_WATERMARK_MISSING", "水印草稿不存在或已过期", 404);
    const text = await fs.readFile(path.join(directory, "draft.json"), "utf8").catch(() => "");
    let draft: Draft;
    try {
      draft = JSON.parse(text);
    } catch {
      throw new VideoEditError("ARCHIVE_WATERMARK_MISSING", "水印草稿不存在或已过期", 404);
    }
    if (
      !draft ||
      typeof draft !== "object" ||
      draft.itemId !== itemId ||
      draft.mediaId !== mediaId ||
      draft.file?.fileName !== `watermark-${id}.png` ||
      !Number.isInteger(draft.width) ||
      draft.width < 1 ||
      draft.width > 8192 ||
      !Number.isInteger(draft.height) ||
      draft.height < 1 ||
      draft.height > 8192 ||
      draft.file.mimeType !== "image/png" ||
      !Number.isSafeInteger(draft.file.size) ||
      draft.file.size < 1 ||
      draft.file.size > maxBytes ||
      !/^[a-f0-9]{64}$/.test(draft.file.checksum) ||
      !Number.isFinite(Date.parse(draft.expiresAt)) ||
      (Date.parse(draft.expiresAt) <= Date.now() && !this.pins.has(id))
    )
      throw new VideoEditError("ARCHIVE_WATERMARK_MISSING", "水印草稿不存在或已过期，请重新上传", 404);
    return draft;
  }
  async upload(
    itemId: string,
    mediaId: string,
    bytes: Buffer,
    filename: string,
    mime: string
  ): Promise<ArchiveWatermarkDraft> {
    if (!bytes.length || bytes.length > maxBytes)
      throw new VideoEditError("ARCHIVE_WATERMARK_TOO_LARGE", "水印图片最大 20 MiB", 413);
    if (!["image/png", "image/jpeg", "image/webp"].includes(mime) || !/\.(png|jpe?g|webp)$/i.test(filename))
      throw new VideoEditError("ARCHIVE_WATERMARK_INVALID", "水印仅支持 PNG、JPG、WebP 静态图片", 415);
    return this.serial(async () => {
      await fs.mkdir(this.root, { recursive: true });
      await this.clean();
      const names = (await fs.readdir(this.root)).filter((name) => /^watermark-draft-[A-Za-z0-9_-]{12}$/.test(name));
      if (names.length >= 32) throw new VideoEditError("ARCHIVE_WATERMARK_QUOTA", "临时水印较多，请稍后重试", 429);
      const free = await fs.statfs(this.root);
      if (Number(free.bavail) * Number(free.bsize) < maxBytes * 3)
        throw new VideoEditError("ARCHIVE_EDIT_DISK_FULL", "磁盘剩余空间不足，无法上传水印", 507);
      const normalized = await normalizeWatermark(bytes, filename, mime);
      const id = nanoid(12),
        directory = this.directory(id);
      const draft: Draft = {
        itemId,
        mediaId,
        width: normalized.info.width,
        height: normalized.info.height,
        expiresAt: new Date(Date.now() + lifetime).toISOString(),
        file: {
          fileName: `watermark-${id}.png`,
          mimeType: "image/png",
          size: normalized.data.length,
          checksum: createHash("sha256").update(normalized.data).digest("hex")
        }
      };
      await fs.mkdir(directory);
      try {
        await fs.writeFile(path.join(directory, draft.file.fileName), normalized.data, { flag: "wx" });
        await fs.writeFile(path.join(directory, "draft.json"), JSON.stringify(draft), { flag: "wx" });
      } catch (error) {
        await fs.rm(directory, { recursive: true, force: true });
        throw error;
      }
      return {
        id,
        width: draft.width,
        height: draft.height,
        expiresAt: draft.expiresAt,
        previewUrl: `/api/v1/tools/media-archive/items/${itemId}/media/${mediaId}/watermarks/${id}`
      };
    });
  }
  acquire(itemId: string, mediaId: string, id: string) {
    return this.serial(async () => {
      const draft = await this.read(itemId, mediaId, id);
      this.pins.set(id, (this.pins.get(id) ?? 0) + 1);
      let released = false;
      return {
        ...draft,
        path: path.join(this.directory(id), draft.file.fileName),
        release: () => {
          if (released) return;
          released = true;
          const count = (this.pins.get(id) ?? 1) - 1;
          if (count) this.pins.set(id, count);
          else this.pins.delete(id);
        }
      };
    });
  }
  cleanup() {
    return this.serial(() => this.clean());
  }
  discard(id: string) {
    const directory = this.directory(id);
    return this.serial(async () => {
      if (this.pins.has(id)) {
        this.retired.add(id);
        return;
      }
      await fs.rm(directory, { recursive: true, force: true });
      this.retired.delete(id);
    });
  }
  async idle() {
    await this.tail;
  }
  private async clean() {
    for (const name of await fs.readdir(this.root).catch(() => [])) {
      const match = /^watermark-draft-([A-Za-z0-9_-]{12})$/.exec(name);
      if (!match || this.pins.has(match[1])) continue;
      const directory = this.directory(match[1]);
      const stat = await fs.lstat(directory).catch(() => undefined);
      if (!stat?.isDirectory() || stat.isSymbolicLink()) continue;
      if (this.retired.has(match[1]) || stat.mtimeMs < Date.now() - lifetime) {
        await fs.rm(directory, { recursive: true, force: true });
        this.retired.delete(match[1]);
      }
    }
  }
}
