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
  type ArchivePlatform,
  type ContentArchiveItem,
  type ContentArchiveListResponse
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import { FileMetadataRepository } from "../../database/file-metadata";
import { ContentArchiveRepository, decodeContentArchivePayload } from "./repository";
import {
  assertArchiveStaging,
  inspectArchiveFiles,
  replaceArchiveDirectory,
  replaceArchiveManifest
} from "./file-gateway";
import { archiveTranslationSourceHash } from "./text";

type ArchiveIndex = {
  version: 2;
  items: ContentArchiveItem[];
};

export class ContentArchiveStore {
  private items = new Map<string, ContentArchiveItem>();
  private initialization?: Promise<void>;
  private writeQueue = Promise.resolve();
  private storageMutationQueue = Promise.resolve();
  private readonly itemMutationQueues = new Map<string, Promise<void>>();
  private readonly fileMetadata: FileMetadataRepository;

  constructor(
    private readonly config: AppConfig,
    private readonly database: ToolboxDatabase,
    fileMetadata?: FileMetadataRepository
  ) {
    this.fileMetadata = fileMetadata ?? new FileMetadataRepository(database, config.storageRoot);
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
  }

  async list(
    options: {
      keyword?: string;
      type?: string;
      page?: number;
      pageSize?: number;
      platform?: ArchivePlatform | "all";
    } = {}
  ): Promise<ContentArchiveListResponse> {
    await this.initialize();
    const keyword = options.keyword?.trim().toLowerCase() || "";
    const type = options.type?.trim() || "all";
    const page = positiveInteger(options.page, 1);
    const pageSize = Math.min(positiveInteger(options.pageSize, 12), 50);
    const matched = [...this.items.values()]
      .filter((item) => !options.platform || options.platform === "all" || item.platform === options.platform)
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
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const start = (page - 1) * pageSize;
    return {
      items: matched.slice(start, start + pageSize).map(toContentArchiveListItem),
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

  async findBySource(platform: ArchivePlatform, contentId: string) {
    await this.initialize();
    return cloneItem(
      [...this.items.values()].find((item) => item.platform === platform && item.contentId === contentId)
    );
  }

  async createStaging(taskId: string) {
    await this.initialize();
    const directory = path.join(this.config.xhsArchiveStagingDir, safeId(taskId));
    await fsp.rm(directory, { recursive: true, force: true });
    await fsp.mkdir(directory, { recursive: true });
    return directory;
  }

  async commit(item: ContentArchiveItem, stagingDirectory: string) {
    await this.initialize();
    if (!isContentArchiveItem(item)) throw new Error("ARCHIVE_PAYLOAD_INVALID");
    return this.withStorageMutation(() =>
      this.withItemMutation(item.id, async () => {
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
        const names = new Set(nextItem.media.map((media) => media.fileName.toLowerCase()));
        if (
          ids.size !== nextItem.media.length ||
          names.size !== nextItem.media.length ||
          [...this.items.values()].some(
            (entry) => entry.id !== item.id && entry.media.some((media) => ids.has(media.id))
          )
        )
          throw new Error("ARCHIVE_MEDIA_IDENTITY_CONFLICT");
        nextItem.totalBytes = nextItem.media.reduce((sum, media) => sum + media.size, 0);
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
        const sequence = current.media.filter(isCapturedVideoFrame).length;
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

  async remove(id: string) {
    await this.initialize();
    return this.withStorageMutation(() =>
      this.withItemMutation(id, async () => {
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
    readonly statusCode: 400 | 404 | 413,
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
