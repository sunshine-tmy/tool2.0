/** 小红书兼容视图：只转换 DTO 和过滤平台，文件、配额和元数据均由同一个多媒体存储核心管理。 */
import { fromXhsArchive, toXhsArchive, type ContentArchiveItem, type XhsArchiveItem } from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { FileMetadataRepository } from "../../database/file-metadata";
import { ContentArchiveStore, ContentArchiveStoreError } from "../media-archive/store";

export { ContentArchiveStoreError as XhsArchiveStoreError } from "../media-archive/store";

export class XhsArchiveStore {
  readonly content: ContentArchiveStore;

  constructor(config: AppConfig, database: ToolboxDatabase, fileMetadata?: FileMetadataRepository) {
    this.content = new ContentArchiveStore(config, database, fileMetadata);
  }

  initialize() {
    return this.content.initialize();
  }

  async list(options: { keyword?: string; type?: string; page?: number; pageSize?: number } = {}) {
    const result = await this.content.list({ ...options, platform: "xiaohongshu" });
    return {
      ...result,
      items: result.items.map(({ platform: _platform, contentId, rawText: _rawText, ...rest }) => ({
        ...rest,
        noteId: contentId,
        coverUrl: rest.coverUrl?.replace("/tools/media-archive/", "/tools/xhs-archive/")
      }))
    };
  }

  async get(id: string) {
    const item = await this.content.get(id);
    return item?.platform === "xiaohongshu" ? legacyItem(item) : undefined;
  }

  async findByNoteId(noteId: string) {
    const item = await this.content.findBySource("xiaohongshu", noteId);
    return item ? legacyItem(item) : undefined;
  }

  createStaging(taskId: string) {
    return this.content.createStaging(taskId);
  }

  async commit(item: XhsArchiveItem, staging: string) {
    return legacyItem(await this.content.commit(fromXhsArchive(item), staging));
  }

  async addVideoFrame(id: string, input: Parameters<ContentArchiveStore["addVideoFrame"]>[1]) {
    if (!(await this.get(id))) throw new ContentArchiveStoreError("XHS_ARCHIVE_NOT_FOUND", 404, "存档不存在");
    return legacyItem(await this.content.addVideoFrame(id, input));
  }

  async remove(id: string) {
    return (await this.get(id)) ? this.content.remove(id) : false;
  }

  // 维护分类覆盖共享物理目录，永久数据清理仍由现有高风险确认控制，不另造一套目录。
  purgeAll() {
    return this.content.purgeAll();
  }

  async updateTranslation(id: string, updater: (item: XhsArchiveItem) => XhsArchiveItem) {
    if (!(await this.get(id))) return undefined;
    const result = await this.content.updateTranslation(id, (item) => ({
      ...item,
      ...fromXhsArchive(updater(legacyItem(item)))
    }));
    return result ? legacyItem(result) : undefined;
  }

  async mediaPath(itemId: string, mediaId: string) {
    if (!(await this.get(itemId))) return undefined;
    const value = await this.content.mediaPath(itemId, mediaId);
    return value ? { ...value, item: legacyItem(value.item) } : undefined;
  }

  totalBytes() {
    return this.content.totalBytes();
  }
}

function legacyItem(item: ContentArchiveItem): XhsArchiveItem {
  const value = toXhsArchive(item);
  return {
    ...value,
    media: value.media.map((media) => ({
      ...media,
      previewUrl: `/api/v1/tools/xhs-archive/items/${item.id}/media/${media.id}`,
      downloadUrl: `/api/v1/tools/xhs-archive/items/${item.id}/media/${media.id}?download=1`
    }))
  };
}
