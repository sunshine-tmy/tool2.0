/**
 * 多媒体归档共享存储：平台身份隔离，媒体目录和物理表保持不变，旧接口通过过滤视图访问。
 */
import fsp from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import {
  isContentArchiveItem,
  toContentArchiveListItem,
  type ContentArchivePlatform,
  type ContentArchiveItem,
  type ContentArchiveMedia,
  type ContentArchiveListQuery,
  type ContentArchiveListResponse
} from "@toolbox/shared";
import type { AppConfig } from "../../../config";
import type { ToolboxDatabase } from "../../../database/toolbox-database";
import { FileMetadataRepository } from "../../../database/file-metadata";
import { ContentArchiveRepository, decodeContentArchivePayload } from "./repository";
import {
  assertArchiveStaging,
  inspectArchiveFiles,
  replaceArchiveDirectory,
  replaceArchiveManifest
} from "./file-gateway";
import { archiveTranslationSourceHash } from "./text";
import { ArchiveGroupStore } from "./groups";
import { archiveMediaAssets, archiveMediaBytes } from "./media-assets";
import { compareArchiveListItems } from "./list-order";
import { ArchivePublicationStore } from "./publication";

type ArchiveIndex = {
  version: 2;
  items: ContentArchiveItem[];
};

export class ContentArchiveStore {
  readonly groups: ArchiveGroupStore;
  readonly publications: ArchivePublicationStore;
  private items = new Map<string, ContentArchiveItem>();
  private initialization?: Promise<void>;
  private writeQueue = Promise.resolve();
  private storageMutationQueue = Promise.resolve();
  private readonly itemMutationQueues = new Map<string, Promise<void>>();
  private readonly fileMetadata: FileMetadataRepository;
  private readonly videoEditLeases = new Map<string, string>();
  private readonly mediaReadPins = new Map<string, number>();

  constructor(
    private readonly config: AppConfig,
    private readonly database: ToolboxDatabase,
    fileMetadata?: FileMetadataRepository
  ) {
    this.fileMetadata = fileMetadata ?? new FileMetadataRepository(database, config.storageRoot);
    this.groups = new ArchiveGroupStore(database);
    this.publications = new ArchivePublicationStore(database);
  }

  async initialize() {
    return (this.initialization ??= this.load());
  }

  private async load() {
    await Promise.all([
      fsp.mkdir(this.config.xhsArchiveItemsDir, { recursive: true }),
      fsp.mkdir(this.config.xhsArchiveStagingDir, { recursive: true })
    ]);
    const stored = this.database.list("xhs-archive");
    if (stored.length) {
      const repository = new ContentArchiveRepository(this.database);
      stored.forEach((entity) => {
        const item = repository.get(entity.id)!;
        this.items.set(item.id, item);
      });
    } else {
      const loaded = await this.readIndex();
      if (loaded) {
        loaded.items.forEach((item) => this.items.set(item.id, decodeContentArchivePayload(item)));
      } else {
        await this.rebuildFromManifests();
      }
      await this.persistIndex();
    }
    for (const item of this.items.values()) {
      if (item.media.some((media) => media.audioEdit?.pendingFiles?.length)) await this.pruneLoadedVideoEdits(item.id);
    }
  }

  async list(
    options: {
      keyword?: string;
      type?: string;
      page?: number;
      pageSize?: number;
      platform?: ContentArchivePlatform | "all";
      groupId?: string;
      sort?: ContentArchiveListQuery["sort"];
    } = {}
  ): Promise<ContentArchiveListResponse> {
    await this.initialize();
    const keyword = options.keyword?.trim().toLowerCase() || "";
    const type = options.type?.trim() || "all";
    const page = positiveInteger(options.page, 1);
    const pageSize = Math.min(positiveInteger(options.pageSize, 12), 50);
    const memberships = this.groups.memberships();
    const published = this.publications.marked();
    const sort = options.sort;
    const matched = [...this.items.values()]
      .filter((item) => !options.platform || options.platform === "all" || item.platform === options.platform)
      .filter(
        (item) =>
          !options.groupId ||
          options.groupId === "all" ||
          (options.groupId === "ungrouped" ? !memberships.has(item.id) : memberships.get(item.id) === options.groupId)
      )
      .filter((item) => type === "all" || item.type === type)
      .filter((item) => {
        if (!keyword) return true;
        return [
          item.title,
          item.description,
          item.author?.name,
          item.contentId,
          item.rawText,
          ...item.topics.map((topic) => topic.source),
          item.translation?.title.machine,
          item.translation?.title.edited,
          item.translation?.description?.machine,
          item.translation?.description?.edited,
          ...(item.translation?.topics.flatMap((topic) => [topic.machine, topic.edited]) ?? [])
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword));
      })
      .sort(
        sort
          ? (left, right) => compareArchiveListItems(left, right, sort)
          : (left, right) => right.updatedAt.localeCompare(left.updatedAt)
      );
    const start = (page - 1) * pageSize;
    return {
      items: matched.slice(start, start + pageSize).map((item) => ({
        ...toContentArchiveListItem(item),
        ...(published.has(item.id) ? { publishedElsewhere: true } : {}),
        ...(memberships.has(item.id) ? { groupId: memberships.get(item.id) } : {})
      })),
      total: matched.length,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(matched.length / pageSize))
    };
  }

  async get(id: string) {
    await this.initialize();
    await this.itemMutationQueues.get(id);
    return cloneItem(this.items.get(id));
  }

  async findBySource(platform: ContentArchivePlatform, contentId: string) {
    await this.initialize();
    return cloneItem(
      [...this.items.values()].find((item) => item.platform === platform && item.contentId === contentId)
    );
  }
  async findByUrl(platform: ContentArchivePlatform, url: string) {
    await this.initialize();
    return cloneItem(
      [...this.items.values()].find(
        (item) => item.platform === platform && (item.sourceUrl === url || item.canonicalUrl === url)
      )
    );
  }

  async createStaging(taskId: string) {
    await this.initialize();
    const directory = path.join(this.config.xhsArchiveStagingDir, safeId(taskId));
    await fsp.rm(directory, { recursive: true, force: true });
    await fsp.mkdir(directory, { recursive: true });
    return directory;
  }

  async commit(item: ContentArchiveItem, stagingDirectory: string, options: { groupId?: string } = {}) {
    const groupId = options.groupId;
    await this.initialize();
    if (!isContentArchiveItem(item)) throw new Error("ARCHIVE_PAYLOAD_INVALID");
    return this.withStorageMutation(() =>
      this.withItemMutation(item.id, async () => {
        if (groupId) this.groups.assertExists(groupId);
        this.assertVideoEditIdle(item.id);
        const target = path.join(this.config.xhsArchiveItemsDir, safeId(item.id));
        await assertArchiveStaging(stagingDirectory, this.config.xhsArchiveStagingDir);
        const previousItem = cloneItem(this.items.get(item.id));
        if (previousItem && (previousItem.platform !== item.platform || previousItem.contentId !== item.contentId))
          throw new Error("ARCHIVE_IDENTITY_IMMUTABLE");
        const duplicate = [...this.items.values()].find(
          (entry) => entry.platform === item.platform && entry.contentId === item.contentId && entry.id !== item.id
        );
        if (duplicate) throw new Error("ARCHIVE_IDENTITY_CONFLICT");
        const nextItem = cloneItem(item)!;
        // 用户由图集生成的视频是附加资产，重新获取不得把它当作平台缺失媒体丢弃。
        for (const derived of previousItem?.media.filter((media) => media.derivedFromImages) ?? []) {
          if (
            derived.derivedFromImages!.some(
              (image) => !nextItem.media.some((media) => media.id === image.id && media.checksum === image.checksum)
            )
          )
            throw new ContentArchiveStoreError(
              "ARCHIVE_EDIT_SOURCE_CHANGED",
              409,
              "来源图集已变化，已保留原图和生成视频，请先处理来源变更"
            );
          if (!nextItem.media.some((media) => media.id === derived.id)) nextItem.media.push(structuredClone(derived));
          for (const asset of archiveMediaAssets(derived)) {
            const source = path.join(target, path.basename(asset.fileName));
            if (await exists(source))
              await fsp.copyFile(source, path.join(stagingDirectory, path.basename(asset.fileName)));
          }
        }
        // 重新获取只能更新同一原片；不得覆盖已经保存的配乐、原片和选曲快照。
        for (const edited of previousItem?.media.filter(
          (media) => media.audioEdit && media.checksum !== media.audioEdit.original.checksum
        ) ?? []) {
          const incoming = nextItem.media.find((media) => media.id === edited.id);
          if (!incoming || (!edited.derivedFromImages && incoming.checksum !== edited.audioEdit!.original.checksum))
            throw new ContentArchiveStoreError(
              "ARCHIVE_EDIT_SOURCE_CHANGED",
              409,
              "源视频已变化，已保留当前成品；请先恢复原始视频后再重新获取"
            );
          nextItem.media[nextItem.media.indexOf(incoming)] = structuredClone(edited);
          for (const asset of archiveMediaAssets(edited)) {
            const source = path.join(target, path.basename(asset.fileName));
            if (await exists(source))
              await fsp.copyFile(source, path.join(stagingDirectory, path.basename(asset.fileName)));
          }
        }
        // 下载期间可能已经编辑译文；以锁内最新版本为准，正文变化仅标记过期，不丢失用户编辑。
        if (previousItem?.translation) {
          const sourceHash = archiveTranslationSourceHash(nextItem);
          nextItem.translation =
            sourceHash === previousItem.translation.sourceHash
              ? structuredClone(previousItem.translation)
              : { ...structuredClone(previousItem.translation), status: "stale", sourceHash, error: undefined };
        }
        const retainedFrames = (previousItem?.media ?? []).filter(
          (media) => isCapturedVideoFrame(media) && !nextItem.media.some((entry) => entry.id === media.id)
        );

        nextItem.media.push(...retainedFrames);
        // 媒体 ID 被关系表及截帧来源引用；不能覆盖另一归档的同名 ID，也不能让两个条目共用一个文件。
        const ids = new Set(nextItem.media.map((media) => media.id));
        const assetNames = nextItem.media.flatMap((media) =>
          archiveMediaAssets(media).map((asset) => asset.fileName.toLowerCase())
        );
        const names = new Set(assetNames);
        if (
          ids.size !== nextItem.media.length ||
          names.size !== assetNames.length ||
          [...this.items.values()].some(
            (entry) => entry.id !== item.id && entry.media.some((media) => ids.has(media.id))
          )
        )
          throw new Error("ARCHIVE_MEDIA_IDENTITY_CONFLICT");
        nextItem.totalBytes = archiveMediaBytes(nextItem.media);
        const usedBytes = [...this.items.values()].reduce((sum, entry) => sum + entry.totalBytes, 0);
        if (usedBytes - (previousItem?.totalBytes ?? 0) + nextItem.totalBytes > this.config.xhsArchiveMaxStorageBytes) {
          throw new ContentArchiveStoreError("XHS_STORAGE_QUOTA_EXCEEDED", 413, "存档空间不足，请先释放空间");
        }

        for (const frame of retainedFrames) {
          const previousPath = path.join(target, path.basename(frame.fileName));
          const stagedPath = path.join(stagingDirectory, path.basename(frame.fileName));
          await fsp.copyFile(previousPath, stagedPath);
        }

        const manifestPath = path.join(stagingDirectory, "manifest.json");
        const manifest = await fsp.open(manifestPath, "w");
        try {
          await manifest.writeFile(`${JSON.stringify(nextItem, null, 2)}\n`, "utf8");
          await manifest.sync();
        } finally {
          await manifest.close();
        }
        const preparedFiles = await inspectArchiveFiles(this.fileMetadata, nextItem, stagingDirectory, target);
        await replaceArchiveDirectory(stagingDirectory, target, async () => {
          await this.persistItem(nextItem, () => {
            this.fileMetadata.removeForEntity("xhs-archive", item.id);
            for (const media of previousItem?.media ?? []) this.fileMetadata.removeForEntity("xhs-media", media.id);
            for (const file of preparedFiles) this.database.upsertFile(file);
            // Membership must commit with the archive and file index, or the directory is rolled back.
            if (groupId) this.groups.assign({ groupId, itemIds: [item.id] });
          });
        });
        this.items.set(item.id, cloneItem(nextItem)!);
        return cloneItem(nextItem)!;
      })
    );
  }

  async addVideoFrame(
    itemId: string,
    input: { sourceMediaId: string; timestampMs: number; png: Buffer; width: number; height: number }
  ) {
    await this.initialize();
    return this.withStorageMutation(() =>
      this.withItemMutation(itemId, async () => {
        const current = this.items.get(itemId);
        if (!current) throw new ContentArchiveStoreError("XHS_ARCHIVE_NOT_FOUND", 404, "存档不存在");
        const source = current.media.find((media) => media.id === input.sourceMediaId);
        if (!source || (source.kind !== "video" && source.kind !== "live-photo")) {
          throw new ContentArchiveStoreError("XHS_FRAME_SOURCE_INVALID", 400, "截帧来源必须是该存档中的视频媒体");
        }

        const usedBytes = [...this.items.values()].reduce((sum, entry) => sum + entry.totalBytes, 0);
        if (usedBytes + input.png.length > this.config.xhsArchiveMaxStorageBytes) {
          throw new ContentArchiveStoreError("XHS_STORAGE_QUOTA_EXCEEDED", 413, "存档空间不足，请先释放空间");
        }

        const id = nanoid(12);
        const sequence = current.media
          .filter(isCapturedVideoFrame)
          .reduce((next, frame) => Math.max(next, frame.index + 1), 0);
        const fileName = `frame-${String(sequence + 1).padStart(3, "0")}-${String(input.timestampMs).padStart(10, "0")}-${id}.png`;
        const media = {
          id,
          kind: "image" as const,
          index: sequence,
          fileName,
          mimeType: "image/png",
          size: input.png.length,
          width: input.width,
          height: input.height,
          frameSourceMediaId: source.id,
          frameTimestampMs: input.timestampMs,
          checksum: createHash("sha256").update(input.png).digest("hex"),
          previewUrl: `/api/v1/tools/media-archive/items/${itemId}/media/${id}`,
          downloadUrl: `/api/v1/tools/media-archive/items/${itemId}/media/${id}?download=1`
        } satisfies ContentArchiveItem["media"][number];
        const next = {
          ...current,
          media: [...current.media, media],
          totalBytes: current.totalBytes + input.png.length,
          updatedAt: new Date().toISOString()
        };
        const directory = path.join(this.config.xhsArchiveItemsDir, safeId(itemId));
        const target = path.join(directory, fileName);
        const temporaryFile = path.join(directory, `.${id}.frame.staging`);
        let movedFrame = false;
        try {
          const stagedFrame = await fsp.open(temporaryFile, "wx");
          try {
            await stagedFrame.writeFile(input.png);
            await stagedFrame.sync();
            if ((await stagedFrame.stat()).size !== input.png.length) {
              throw new Error("截帧文件写入后大小校验失败");
            }
          } finally {
            await stagedFrame.close();
          }
          await fsp.rename(temporaryFile, target);
          movedFrame = true;
          const frameMetadata = await this.fileMetadata.inspect({
            entityKind: "xhs-media",
            entityId: id,
            filePath: target,
            mediaType: "image/png",
            owner: "local"
          });
          await replaceArchiveManifest(directory, next, async (manifest) => {
            const manifestMetadata = await this.inspectManifest(itemId, manifest);
            await this.persistItem(next, () => {
              this.database.upsertFile(frameMetadata);
              this.database.upsertFile(manifestMetadata);
            });
          });
          this.items.set(itemId, cloneItem(next)!);
          return cloneItem(next)!;
        } catch (error) {
          await fsp.rm(temporaryFile, { force: true }).catch(() => undefined);
          if (movedFrame) await fsp.rm(target, { force: true }).catch(() => undefined);
          throw error;
        }
      })
    );
  }

  async removeVideoFrame(itemId: string, mediaId: string) {
    await this.initialize();
    return this.withStorageMutation(() =>
      this.withItemMutation(itemId, async () => {
        const current = this.items.get(itemId);
        if (!current) throw new ContentArchiveStoreError("XHS_ARCHIVE_NOT_FOUND", 404, "存档不存在");
        const frame = current.media.find((entry) => entry.id === mediaId);
        if (!frame) throw new ContentArchiveStoreError("XHS_FRAME_NOT_FOUND", 404, "截帧不存在或已删除");
        if (frame.kind !== "image" || !isCapturedVideoFrame(frame) || frame.audioEdit || frame.derivedFromImages)
          throw new ContentArchiveStoreError("XHS_FRAME_REQUIRED", 400, "只能删除视频截帧，原始媒体不受影响");
        this.assertVideoEditIdle(itemId);
        if (
          path.posix.basename(frame.fileName) !== frame.fileName ||
          path.win32.basename(frame.fileName) !== frame.fileName ||
          frame.fileName.includes(":") ||
          frame.fileName === "." ||
          frame.fileName === ".."
        )
          throw new Error("ARCHIVE_MEDIA_PATH_INVALID");
        const directory = path.join(this.config.xhsArchiveItemsDir, safeId(itemId));
        const target = path.join(directory, frame.fileName);
        const moved = await exists(target);
        if (this.mediaReadPins.has(target))
          throw new ContentArchiveStoreError("XHS_FRAME_BUSY", 409, "截帧正在下载或导出，请完成后重试删除");
        const pendingDeletion = path.join(directory, `.${nanoid(12)}.frame.deleting`);
        const next = structuredClone(current);
        next.media = next.media.filter((entry) => entry.id !== mediaId);
        next.totalBytes = archiveMediaBytes(next.media);
        next.updatedAt = new Date().toISOString();
        // 和整条归档删除保持同样的提交顺序：先保留可恢复文件，再原子更新清单与索引。
        if (moved) await fsp.rename(target, pendingDeletion);
        try {
          await replaceArchiveManifest(directory, next, async (manifest) => {
            const metadata = await this.inspectManifest(itemId, manifest);
            await this.persistItem(next, () => {
              this.database.remove("xhs-media", mediaId);
              this.fileMetadata.removeForEntity("xhs-media", mediaId);
              this.database.upsertFile(metadata);
            });
          });
        } catch (error) {
          if (moved) await fsp.rename(pendingDeletion, target);
          throw error;
        }
        this.items.set(itemId, next);
        if (moved) await fsp.rm(pendingDeletion, { force: true }).catch(() => undefined);
        return structuredClone(next);
      })
    );
  }

  async remove(id: string) {
    await this.initialize();
    return this.withStorageMutation(() =>
      this.withItemMutation(id, async () => {
        this.assertVideoEditIdle(id);
        const item = this.items.get(id);
        if (!item) return false;
        const directory = path.join(this.config.xhsArchiveItemsDir, safeId(id));
        const pendingDeletion = `${directory}.deleting-${nanoid(10)}`;
        const moved = await exists(directory);
        // 先同盘移动到可恢复位置，数据库事务失败时还原；成功后才删除文件，不留下无法恢复的索引。
        if (moved) await fsp.rename(directory, pendingDeletion);
        try {
          await this.persistIndex(() => {
            this.database.remove("xhs-archive", id);
            this.database.remove("archive-group-member", id);
            this.database.remove("archive-publication", id);
            this.fileMetadata.removeForEntity("xhs-archive", id);
            for (const media of item.media) this.fileMetadata.removeForEntity("xhs-media", media.id);
          });
          this.items.delete(id);
        } catch (error) {
          if (moved) await fsp.rename(pendingDeletion, directory);
          throw error;
        }
        if (moved) await fsp.rm(pendingDeletion, { recursive: true, force: true }).catch(() => undefined);
        return true;
      })
    );
  }

  async purgeAll() {
    // 清理分类「小红书永久存档」使用：逐条走 remove 复用完整删除语义（内存 + 元数据 + 磁盘）。
    await this.initialize();
    const ids = [...this.items.keys()];
    for (const id of ids) await this.remove(id);
    await this.writeQueue;
    return ids.length;
  }

  async updateTranslation(id: string, updater: (item: ContentArchiveItem) => ContentArchiveItem) {
    await this.initialize();
    return this.withItemMutation(id, async () => {
      const current = this.items.get(id);
      if (!current) return undefined;
      const next = decodeContentArchivePayload(updater(cloneItem(current)!));
      if (next.id !== id || next.platform !== current.platform || next.contentId !== current.contentId)
        throw new Error("ARCHIVE_IDENTITY_IMMUTABLE");
      const directory = path.join(this.config.xhsArchiveItemsDir, safeId(id));
      await replaceArchiveManifest(directory, next, async (manifest) => {
        const metadata = await this.inspectManifest(id, manifest);
        await this.persistItem(next, () => this.database.upsertFile(metadata));
      });
      this.items.set(id, cloneItem(next)!);
      return cloneItem(next);
    });
  }

  async mediaPath(itemId: string, mediaId: string) {
    const item = await this.get(itemId);
    const media = item?.media.find((entry) => entry.id === mediaId);
    if (!item || !media) return undefined;
    const directory = path.resolve(this.config.xhsArchiveItemsDir, safeId(item.id));
    const filePath = path.resolve(directory, path.basename(media.fileName));
    if (!filePath.startsWith(`${directory}${path.sep}`)) return undefined;
    return { item, media, filePath };
  }

  async totalBytes() {
    await this.initialize();
    return [...this.items.values()].reduce((sum, item) => sum + item.totalBytes, 0);
  }

  assertVideoEditIdle(itemId: string) {
    if (this.videoEditLeases.has(itemId))
      throw new ContentArchiveStoreError(
        "ARCHIVE_EDIT_BUSY",
        409,
        "配乐任务正在使用该作品，请先停止任务或等待保存完成"
      );
  }

  async beginVideoEdit(itemId: string, mediaId: string, checksum: string, revision: number, allowImages = false) {
    await this.initialize();
    return this.withItemMutation(itemId, async () => {
      this.assertVideoEditIdle(itemId);
      const item = this.items.get(itemId);
      const media = item?.media.find((entry) => entry.id === mediaId);
      if (!item || !media) throw new ContentArchiveStoreError("ARCHIVE_MEDIA_NOT_FOUND", 404, "归档媒体不存在");
      if (
        !["video", "live-photo"].includes(media.kind) &&
        !(allowImages && media.kind === "image" && !media.frameSourceMediaId)
      )
        throw new ContentArchiveStoreError("ARCHIVE_EDIT_VIDEO_REQUIRED", 400, "请选择视频媒体编辑配乐");
      if (media.checksum !== checksum || (media.audioEdit?.revision ?? 0) !== revision)
        throw new ContentArchiveStoreError("ARCHIVE_EDIT_CONFLICT", 409, "视频已被其他操作更新，请重新打开编辑器");
      const token = nanoid();
      this.videoEditLeases.set(itemId, token);
      return {
        item: structuredClone(item),
        media: structuredClone(media),
        token,
        directory: path.join(this.config.xhsArchiveItemsDir, safeId(itemId)),
        release: () => {
          if (this.videoEditLeases.get(itemId) === token) this.videoEditLeases.delete(itemId);
        }
      };
    });
  }

  async saveVideoEdit(
    itemId: string,
    token: string,
    checksum: string,
    revision: number,
    media: ContentArchiveMedia,
    staging: string,
    addedFiles: string[],
    persistCompletion?: () => void,
    sourceImageId?: string
  ) {
    await assertArchiveStaging(staging, this.config.xhsArchiveStagingDir);
    return this.withStorageMutation(() =>
      this.withItemMutation(itemId, async () => {
        const current = this.items.get(itemId);
        const previous = current?.media.find((entry) => entry.id === (sourceImageId ?? media.id));
        if (
          !current ||
          !previous ||
          this.videoEditLeases.get(itemId) !== token ||
          previous.checksum !== checksum ||
          (previous.audioEdit?.revision ?? 0) !== revision
        )
          throw new ContentArchiveStoreError("ARCHIVE_EDIT_CONFLICT", 409, "视频已更新或编辑已失效，原有成品已保留");
        if (!media.audioEdit || media.audioEdit.revision !== revision + 1)
          throw new Error("ARCHIVE_EDIT_REVISION_INVALID");
        const activeNames = new Set(archiveMediaAssets(media, false).map((asset) => asset.fileName));
        media.audioEdit.pendingFiles = sourceImageId
          ? []
          : archiveMediaAssets(previous).filter((asset) => !activeNames.has(asset.fileName));
        const next = structuredClone(current);
        if (sourceImageId) {
          if (next.media.some((entry) => entry.id === media.id)) throw new Error("ARCHIVE_MEDIA_IDENTITY_CONFLICT");
          next.media.push(structuredClone(media));
        } else next.media[next.media.findIndex((entry) => entry.id === media.id)] = structuredClone(media);
        next.totalBytes = archiveMediaBytes(next.media);
        next.updatedAt = new Date().toISOString();
        if (!isContentArchiveItem(next)) throw new Error("ARCHIVE_PAYLOAD_INVALID");
        const names = next.media.flatMap((entry) =>
          archiveMediaAssets(entry).map((asset) => asset.fileName.toLowerCase())
        );
        if (new Set(names).size !== names.length) throw new Error("ARCHIVE_MEDIA_IDENTITY_CONFLICT");
        const used = [...this.items.values()].reduce((sum, item) => sum + item.totalBytes, 0);
        if (used - current.totalBytes + next.totalBytes > this.config.xhsArchiveMaxStorageBytes)
          throw new ContentArchiveStoreError("ARCHIVE_STORAGE_QUOTA_EXCEEDED", 413, "归档空间不足，原成品已保留");
        const directory = path.join(this.config.xhsArchiveItemsDir, safeId(itemId));
        const moved: string[] = [];
        try {
          for (const file of addedFiles) {
            if (!activeNames.has(file) || path.basename(file) !== file || file.includes(":") || file.includes("\\"))
              throw new Error("ARCHIVE_MEDIA_PATH_INVALID");
            const target = path.join(directory, file);
            if (await exists(target)) throw new Error("ARCHIVE_EDIT_FILE_CONFLICT");
            await fsp.rename(path.join(staging, file), target);
            moved.push(target);
          }
          await replaceArchiveManifest(directory, next, async () => {
            const files = await inspectArchiveFiles(this.fileMetadata, next, directory, directory);
            await this.persistItem(next, () => {
              persistCompletion?.();
              this.fileMetadata.removeForEntity("xhs-media", media.id);
              for (const file of files) this.database.upsertFile(file);
            });
          });
        } catch (error) {
          for (const file of moved) await fsp.rm(file, { force: true }).catch(() => undefined);
          throw error;
        }
        this.items.set(itemId, next);
        return structuredClone(next);
      })
    );
  }

  /** 播放和 ZIP 持有旧文件直到流结束；新成品使用新文件名，不覆盖正在读取的文件。 */
  pinMedia(file: string) {
    this.mediaReadPins.set(file, (this.mediaReadPins.get(file) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const count = (this.mediaReadPins.get(file) ?? 1) - 1;
      if (count) this.mediaReadPins.set(file, count);
      else this.mediaReadPins.delete(file);
      void this.pruneVideoEdits(path.basename(path.dirname(file))).catch(() => undefined);
    };
  }

  async pruneVideoEdits(itemId: string) {
    await this.initialize();
    return this.pruneLoadedVideoEdits(itemId);
  }
  async flushVideoEdits() {
    await this.storageMutationQueue;
    await Promise.all(this.itemMutationQueues.values());
  }
  private async pruneLoadedVideoEdits(itemId: string) {
    return this.withStorageMutation(() =>
      this.withItemMutation(itemId, async () => {
        const current = this.items.get(itemId);
        if (
          !current ||
          this.videoEditLeases.has(itemId) ||
          !current.media.some((media) => media.audioEdit?.pendingFiles?.length)
        )
          return;
        const next = structuredClone(current);
        const directory = path.join(this.config.xhsArchiveItemsDir, safeId(itemId));
        let changed = false;
        const active = new Set(
          next.media.flatMap((entry) => archiveMediaAssets(entry, false).map((file) => file.fileName))
        );
        for (const media of next.media) {
          if (!media.audioEdit?.pendingFiles?.length) continue;
          const retained = [];
          for (const file of media.audioEdit.pendingFiles) {
            const target = path.join(directory, path.basename(file.fileName));
            if (
              !/^(edited|music|watermark)-[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(file.fileName) ||
              active.has(file.fileName) ||
              this.mediaReadPins.has(target)
            ) {
              retained.push(file);
              continue;
            }
            try {
              await fsp.rm(target, { force: true });
              changed = true;
            } catch {
              retained.push(file);
            }
          }
          media.audioEdit.pendingFiles = retained;
        }
        if (!changed) return;
        next.totalBytes = archiveMediaBytes(next.media);
        // 仅退休成品可先删除后重试清单；原片、当前成品与配乐始终不进入该队列。
        await replaceArchiveManifest(directory, next, async () => {
          const files = await inspectArchiveFiles(this.fileMetadata, next, directory, directory);
          await this.persistItem(next, () => {
            for (const media of next.media) this.fileMetadata.removeForEntity("xhs-media", media.id);
            for (const file of files) this.database.upsertFile(file);
          });
        });
        this.items.set(itemId, next);
      })
    );
  }

  private async withStorageMutation<T>(operation: () => Promise<T>) {
    const previous = this.storageMutationQueue;
    let release!: () => void;
    this.storageMutationQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private async withItemMutation<T>(itemId: string, operation: () => Promise<T>) {
    const previous = this.itemMutationQueues.get(itemId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.itemMutationQueues.set(itemId, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.itemMutationQueues.get(itemId) === current) this.itemMutationQueues.delete(itemId);
    }
  }

  private async readIndex(): Promise<ArchiveIndex | undefined> {
    for (const candidate of [this.config.xhsArchiveIndexPath, `${this.config.xhsArchiveIndexPath}.bak`]) {
      try {
        const value = JSON.parse(await fsp.readFile(candidate, "utf8")) as { version?: number; items?: unknown };
        if ((value.version === 1 || value.version === 2) && Array.isArray(value.items))
          return { version: 2, items: value.items.map(decodeContentArchivePayload) };
      } catch {
        // 主清单无法读取时尝试备份，最后从各归档的恢复清单重建；不删除原文件。
      }
    }
    return undefined;
  }

  private async rebuildFromManifests() {
    const entries = await fsp.readdir(this.config.xhsArchiveItemsDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.endsWith(".previous")) continue;
      try {
        const item = JSON.parse(
          await fsp.readFile(path.join(this.config.xhsArchiveItemsDir, entry.name, "manifest.json"), "utf8")
        );
        const normalized = decodeContentArchivePayload(item);
        if (normalized.id === entry.name) this.items.set(normalized.id, normalized);
      } catch {
        // 损坏清单不进入运行索引，原文件保留供人工恢复。
      }
    }
  }

  private persistItem(item: ContentArchiveItem, extra?: () => void) {
    const snapshot = structuredClone(item);
    return this.persistIndex(() => {
      this.database.upsert({
        id: snapshot.id,
        kind: "xhs-archive",
        status: snapshot.status,
        payload: snapshot,
        createdAt: snapshot.fetchedAt,
        updatedAt: snapshot.updatedAt
      });
      extra?.();
    });
  }

  private persistIndex(operation?: () => void) {
    this.writeQueue = this.writeQueue
      .catch(() => undefined)
      .then(async () => {
        this.database.transaction(() => {
          if (operation) {
            operation();
            return;
          }
          for (const item of this.items.values()) {
            this.database.upsert({
              id: item.id,
              kind: "xhs-archive",
              status: item.status,
              payload: item,
              createdAt: item.fetchedAt,
              updatedAt: item.updatedAt
            });
          }
        });
      });
    return this.writeQueue;
  }

  private inspectManifest(id: string, manifest: string) {
    return this.fileMetadata.inspect({
      entityKind: "xhs-archive",
      entityId: id,
      filePath: manifest,
      mediaType: "application/json",
      owner: "local"
    });
  }
}

export class ContentArchiveStoreError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: 400 | 404 | 409 | 413,
    message: string
  ) {
    super(message);
  }
}

function isCapturedVideoFrame(media: ContentArchiveItem["media"][number]) {
  return media.frameSourceMediaId !== undefined && media.frameTimestampMs !== undefined;
}

function cloneItem(item: ContentArchiveItem | undefined) {
  return item ? structuredClone(item) : undefined;
}

function safeId(value: string) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw new Error("Invalid archive identifier");
  return value;
}

function positiveInteger(value: number | undefined, fallback: number) {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

async function exists(filePath: string) {
  return fsp
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}
