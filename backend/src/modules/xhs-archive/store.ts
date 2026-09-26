/**
 * 中文模块说明：小红书归档领域，负责获取、媒体、翻译、运行时和恢复
 */
import fsp from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import {
  parseXhsContentText,
  type XhsArchiveItem,
  type XhsArchiveListItem,
  type XhsArchiveListResponse
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { FileMetadataRepository } from "../../database/file-metadata";

type ArchiveIndex = {
  version: 2;
  items: XhsArchiveItem[];
};

export class XhsArchiveStore {
  private items = new Map<string, XhsArchiveItem>();
  private initialized = false;
  private writeQueue = Promise.resolve();
  private storageMutationQueue = Promise.resolve();
  private readonly itemMutationQueues = new Map<string, Promise<void>>();

  constructor(
    private readonly config: AppConfig,
    private readonly database: ToolboxDatabase,
    private readonly fileMetadata?: FileMetadataRepository
  ) {}

  async initialize() {
    if (this.initialized) return;
    await Promise.all([
      fsp.mkdir(this.config.xhsArchiveItemsDir, { recursive: true }),
      fsp.mkdir(this.config.xhsArchiveStagingDir, { recursive: true })
    ]);
    const stored = this.database.list("xhs-archive");
    if (stored.length) {
      stored.forEach((entity) => {
        const item = migrateItem(entity.payload as XhsArchiveItem);
        this.items.set(item.id, item);
      });
    } else {
      const loaded = await this.readIndex();
      if (loaded) {
        loaded.items.forEach((item) => this.items.set(item.id, migrateItem(item)));
      } else {
        await this.rebuildFromManifests();
      }
      await this.persistIndex();
    }
    this.initialized = true;
  }

  async list(
    options: { keyword?: string; type?: string; page?: number; pageSize?: number } = {}
  ): Promise<XhsArchiveListResponse> {
    await this.initialize();
    const keyword = options.keyword?.trim().toLowerCase() || "";
    const type = options.type?.trim() || "all";
    const page = positiveInteger(options.page, 1);
    const pageSize = Math.min(positiveInteger(options.pageSize, 12), 50);
    const matched = [...this.items.values()]
      .filter((item) => type === "all" || item.type === type)
      .filter((item) => {
        if (!keyword) return true;
        return [
          item.title,
          item.description,
          item.author?.name,
          item.noteId,
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
      items: matched.slice(start, start + pageSize).map(toListItem),
      total: matched.length,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(matched.length / pageSize))
    };
  }

  async get(id: string) {
    await this.initialize();
    return cloneItem(this.items.get(id));
  }

  async findByNoteId(noteId: string) {
    await this.initialize();
    return cloneItem([...this.items.values()].find((item) => item.noteId === noteId));
  }

  async createStaging(taskId: string) {
    await this.initialize();
    const directory = path.join(this.config.xhsArchiveStagingDir, safeId(taskId));
    await fsp.rm(directory, { recursive: true, force: true });
    await fsp.mkdir(directory, { recursive: true });
    return directory;
  }

  async commit(item: XhsArchiveItem, stagingDirectory: string) {
    await this.initialize();
    return this.withStorageMutation(() =>
      this.withItemMutation(item.id, async () => {
        const target = path.join(this.config.xhsArchiveItemsDir, safeId(item.id));
        const backup = `${target}.previous`;
        const previousItem = cloneItem(this.items.get(item.id));
        const nextItem = cloneItem(item)!;
        const retainedFrames = (previousItem?.media ?? []).filter(
          (media) => isCapturedVideoFrame(media) && !nextItem.media.some((entry) => entry.id === media.id)
        );

        nextItem.media.push(...retainedFrames);
        nextItem.totalBytes = nextItem.media.reduce((sum, media) => sum + media.size, 0);
        const usedBytes = [...this.items.values()].reduce((sum, entry) => sum + entry.totalBytes, 0);
        if (usedBytes - (previousItem?.totalBytes ?? 0) + nextItem.totalBytes > this.config.xhsArchiveMaxStorageBytes) {
          throw new XhsArchiveStoreError("XHS_STORAGE_QUOTA_EXCEEDED", 413, "小红书存档空间不足，请先释放空间");
        }

        for (const frame of retainedFrames) {
          const previousPath = path.join(target, path.basename(frame.fileName));
          const stagedPath = path.join(stagingDirectory, path.basename(frame.fileName));
          await fsp.copyFile(previousPath, stagedPath);
        }

        const manifestPath = path.join(stagingDirectory, "manifest.json");
        await fsp.writeFile(manifestPath, `${JSON.stringify(nextItem, null, 2)}\n`, "utf8");
        await fsp.rm(backup, { recursive: true, force: true });
        let movedOld = false;
        try {
          if (await exists(target)) {
            await fsp.rename(target, backup);
            movedOld = true;
          }
          await fsp.rename(stagingDirectory, target);
          this.items.set(item.id, cloneItem(nextItem)!);
          await this.persistIndex();
          await this.registerItemFiles(nextItem, target);
          await fsp.rm(backup, { recursive: true, force: true });
        } catch (error) {
          await fsp.rm(target, { recursive: true, force: true }).catch(() => undefined);
          if (movedOld && (await exists(backup))) {
            await fsp.rename(backup, target).catch(() => undefined);
          }
          if (previousItem) this.items.set(item.id, previousItem);
          else this.items.delete(item.id);
          throw error;
        }
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
        if (!current) throw new XhsArchiveStoreError("XHS_ARCHIVE_NOT_FOUND", 404, "存档不存在");
        const source = current.media.find((media) => media.id === input.sourceMediaId);
        if (!source || (source.kind !== "video" && source.kind !== "live-photo")) {
          throw new XhsArchiveStoreError("XHS_FRAME_SOURCE_INVALID", 400, "截帧来源必须是该存档中的视频媒体");
        }

        const usedBytes = [...this.items.values()].reduce((sum, entry) => sum + entry.totalBytes, 0);
        if (usedBytes + input.png.length > this.config.xhsArchiveMaxStorageBytes) {
          throw new XhsArchiveStoreError("XHS_STORAGE_QUOTA_EXCEEDED", 413, "小红书存档空间不足，请先释放空间");
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
          previewUrl: `/api/v1/tools/xhs-archive/items/${itemId}/media/${id}`,
          downloadUrl: `/api/v1/tools/xhs-archive/items/${itemId}/media/${id}?download=1`
        } satisfies XhsArchiveItem["media"][number];
        const next = {
          ...current,
          media: [...current.media, media],
          totalBytes: current.totalBytes + input.png.length,
          updatedAt: new Date().toISOString()
        };
        const directory = path.join(this.config.xhsArchiveItemsDir, safeId(itemId));
        const target = path.join(directory, fileName);
        const temporaryFile = path.join(directory, `.${id}.frame.staging`);
        const manifest = path.join(directory, "manifest.json");
        const temporaryManifest = path.join(directory, `.${id}.manifest.staging`);
        const backupManifest = path.join(directory, `.${id}.manifest.previous`);

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
          const stagedManifest = await fsp.open(temporaryManifest, "wx");
          try {
            await stagedManifest.writeFile(`${JSON.stringify(next, null, 2)}\n`, "utf8");
            await stagedManifest.sync();
          } finally {
            await stagedManifest.close();
          }
          await fsp.copyFile(manifest, backupManifest);
          await fsp.rename(temporaryManifest, manifest);
          this.items.set(itemId, cloneItem(next)!);
          await this.persistIndex();
          await this.registerItemFiles(next, directory);
          // 清理备份失败不应回滚已提交的存档，否则可能让清单与数据库重新分叉。
          await fsp.rm(backupManifest, { force: true }).catch(() => undefined);
          return cloneItem(next)!;
        } catch (error) {
          await fsp.rm(temporaryFile, { force: true }).catch(() => undefined);
          await fsp.rm(temporaryManifest, { force: true }).catch(() => undefined);
          if (await exists(backupManifest)) {
            await fsp.rm(manifest, { force: true }).catch(() => undefined);
            await fsp.rename(backupManifest, manifest).catch(() => undefined);
          }
          this.items.set(itemId, cloneItem(current)!);
          await this.persistIndex().catch(() => undefined);
          this.fileMetadata?.removeForEntity("xhs-media", id);
          await this.registerItemFiles(current, directory);
          await fsp.rm(target, { force: true }).catch(() => undefined);
          throw error;
        }
      })
    );
  }

  async remove(id: string) {
    await this.initialize();
    return this.withItemMutation(id, async () => {
      const item = this.items.get(id);
      if (!item) return false;
      // 先删除工件，再更新内存和 SQLite。文件被服务锁定或磁盘异常时，索引必须保持不变，
      // 让用户能够在停止相关服务后安全重试，而不是留下无法从界面访问的存档目录。
      await fsp.rm(path.join(this.config.xhsArchiveItemsDir, safeId(id)), { recursive: true, force: true });
      this.items.delete(id);
      this.fileMetadata?.removeForEntity("xhs-archive", id);
      for (const media of item.media) this.fileMetadata?.removeForEntity("xhs-media", media.id);
      await this.persistIndex();
      return true;
    });
  }

  async purgeAll() {
    // 清理分类「小红书永久存档」使用：逐条走 remove 复用完整删除语义（内存 + 元数据 + 磁盘）。
    await this.initialize();
    const ids = [...this.items.keys()];
    for (const id of ids) await this.remove(id);
    await this.persistIndex();
    return ids.length;
  }

  async updateTranslation(id: string, updater: (item: XhsArchiveItem) => XhsArchiveItem) {
    await this.initialize();
    return this.withItemMutation(id, async () => {
      const current = this.items.get(id);
      if (!current) return undefined;
      const next = migrateItem(updater(cloneItem(current)!));
      const directory = path.join(this.config.xhsArchiveItemsDir, safeId(id));
      const manifest = path.join(directory, "manifest.json");
      const temporary = `${manifest}.tmp`;
      const backup = `${manifest}.bak`;
      await fsp.writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, "utf8");
      try {
        await fsp.copyFile(manifest, backup).catch(() => undefined);
        await fsp.rename(temporary, manifest);
        this.items.set(id, cloneItem(next)!);
        await this.persistIndex();
        await this.registerItemFiles(next, directory);
        await fsp.rm(backup, { force: true });
        return cloneItem(next);
      } catch (error) {
        await fsp.rm(temporary, { force: true }).catch(() => undefined);
        if (await exists(backup)) {
          await fsp.rm(manifest, { force: true }).catch(() => undefined);
          await fsp.rename(backup, manifest).catch(() => undefined);
        }
        this.items.set(id, cloneItem(current)!);
        throw error;
      }
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
          return { version: 2, items: value.items as XhsArchiveItem[] };
      } catch {
        // Try the backup and finally rebuild from per-item manifests.
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
        ) as XhsArchiveItem;
        if (item.id && item.noteId && Array.isArray(item.media)) this.items.set(item.id, migrateItem(item));
      } catch {
        // A broken item is ignored; its files remain available for manual recovery.
      }
    }
  }

  private persistIndex() {
    this.writeQueue = this.writeQueue
      .catch(() => undefined)
      .then(async () => {
        this.database.transaction(() => {
          const activeIds = new Set(this.items.keys());
          for (const entity of this.database.list("xhs-archive")) {
            if (!activeIds.has(entity.id)) this.database.remove("xhs-archive", entity.id);
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

  private async registerItemFiles(item: XhsArchiveItem, directory: string) {
    if (!this.fileMetadata) return;
    await this.fileMetadata
      .registerIfExists({
        entityKind: "xhs-archive",
        entityId: item.id,
        filePath: path.join(directory, "manifest.json"),
        mediaType: "application/json",
        owner: "local"
      })
      .catch(() => undefined);
    await Promise.all(
      item.media.map((media) =>
        this.fileMetadata!.registerIfExists({
          entityKind: "xhs-media",
          entityId: media.id,
          filePath: path.join(directory, path.basename(media.fileName)),
          mediaType: media.mimeType,
          owner: "local"
        }).catch(() => undefined)
      )
    );
  }
}

export class XhsArchiveStoreError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: 400 | 404 | 413,
    message: string
  ) {
    super(message);
  }
}

function isCapturedVideoFrame(media: XhsArchiveItem["media"][number]) {
  return media.frameSourceMediaId !== undefined && media.frameTimestampMs !== undefined;
}

function toListItem(item: XhsArchiveItem): XhsArchiveListItem {
  const cover =
    item.media.find((media) => media.id === item.coverMediaId) ??
    item.media.find((media) => !isCapturedVideoFrame(media) && (media.kind === "image" || media.kind === "cover")) ??
    item.media.find((media) => media.kind === "video" || media.kind === "live-photo");
  return {
    id: item.id,
    noteId: item.noteId,
    sourceUrl: item.sourceUrl,
    canonicalUrl: item.canonicalUrl,
    type: item.type,
    title: item.title,
    description: item.description,
    author: item.author,
    publishedAt: item.publishedAt,
    fetchedAt: item.fetchedAt,
    updatedAt: item.updatedAt,
    coverMediaId: item.coverMediaId,
    status: item.status,
    warnings: item.warnings,
    topics: item.topics,
    translation: item.translation,
    totalBytes: item.totalBytes,
    mediaCount: item.media.length,
    coverUrl: cover?.previewUrl,
    coverKind: cover?.kind
  };
}

function cloneItem(item: XhsArchiveItem | undefined) {
  return item
    ? {
        ...item,
        author: item.author ? { ...item.author } : undefined,
        media: item.media.map((media) => ({ ...media })),
        warnings: [...item.warnings],
        topics: item.topics.map((topic) => ({ ...topic })),
        translation: item.translation
          ? {
              ...item.translation,
              title: { ...item.translation.title },
              description: item.translation.description ? { ...item.translation.description } : undefined,
              topics: item.translation.topics.map((topic) => ({ ...topic })),
              error: item.translation.error ? { ...item.translation.error } : undefined
            }
          : undefined
      }
    : undefined;
}

function migrateItem(item: XhsArchiveItem): XhsArchiveItem {
  const topics = Array.isArray(item.topics) ? item.topics : parseXhsContentText(item.description).topics;
  return {
    ...item,
    topics,
    warnings: Array.isArray(item.warnings) ? item.warnings : [],
    media: Array.isArray(item.media) ? item.media : []
  };
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
