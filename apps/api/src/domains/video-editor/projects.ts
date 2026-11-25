import { createHash } from "node:crypto";
import { archiveProjectDuration } from "@toolbox/shared";
import { runMediaProcess, type MediaTools } from "../content-archive/video-edit/renderer";
import { FileMetadataRepository } from "../../database/file-metadata";
import type { ArchiveVideoEditService } from "../content-archive/video-edit/service";
import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { ContentArchiveItem, VideoEditorProject, ArchiveCutDraft } from "@toolbox/shared";
import { ContentArchiveStore } from "../content-archive/core/store";
import { archiveMediaAssets, archiveMediaBytes } from "../content-archive/core/media-assets";
import { VideoEditError } from "../content-archive/video-edit/renderer";

const kind = "video-editor-project";
export class VideoEditorProjects {
  editor?: ArchiveVideoEditService;
  tools?: () => Promise<MediaTools>;
  readonly assets: ContentArchiveStore;
  readonly combined: ContentArchiveStore;
  private migration?: Promise<void>;
  private operations = new Map<string, Promise<unknown>>();
  readonly config: AppConfig;
  constructor(
    readonly archive: ContentArchiveStore,
    readonly database: ToolboxDatabase,
    config: AppConfig
  ) {
    const root = path.join(config.storageRoot, "video-editor");
    this.config = {
      ...config,
      xhsArchiveItemsDir: path.join(root, "items"),
      xhsArchiveIndexPath: path.join(root, "index.json")
    };
    this.assets = new ContentArchiveStore(this.config, database, undefined, "video-editor-assets");
    const assets = this.assets;
    // Reuse the existing render/stream kernel while keeping independent assets out of archive listing.
    this.combined = new Proxy(archive, {
      get(target, key) {
        if (key === "initialize") return () => Promise.all([target.initialize(), assets.initialize()]);
        if (key === "flushVideoEdits") return () => Promise.all([target.flushVideoEdits(), assets.flushVideoEdits()]);
        const value = Reflect.get(target, key);
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          const first = args[0];
          const id =
            typeof first === "string"
              ? first
              : first && typeof first === "object" && "id" in first
                ? String(first.id)
                : "";
          const own = key === "pinMedia" ? id.startsWith(path.resolve(root) + path.sep) : id.startsWith("editor_");
          const receiver = own ? assets : target;
          return Reflect.get(receiver, key).apply(receiver, args);
        };
      }
    });
  }
  private put(project: VideoEditorProject) {
    this.database.upsert({
      id: project.id,
      kind,
      status: "ready",
      payload: project,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    });
    return project;
  }
  get(id: string) {
    const project = this.database.get(kind, id)?.payload as VideoEditorProject | undefined;
    if (!project) throw new VideoEditError("EDITOR_PROJECT_NOT_FOUND", "工程不存在或已删除", 404);
    return structuredClone(project);
  }
  async audioOwner(itemId: string, mediaId: string) {
    const project = this.database
      .list(kind)
      .map((entry) => entry.payload as VideoEditorProject)
      .find((entry) => entry.itemId === itemId && entry.mediaId === mediaId);
    if (!project) throw new VideoEditError("EDITOR_PROJECT_NOT_FOUND", "工程不存在或已删除", 404);
    const media = await this.assets.mediaPath(itemId, mediaId);
    if (!media) throw new VideoEditError("EDITOR_ASSET_MISSING", "工程素材不存在", 404);
    return { project, ...media };
  }
  async withAudioOwner<T>(itemId: string, mediaId: string, action: (directory: string) => Promise<T>) {
    const owner = await this.audioOwner(itemId, mediaId);
    return this.serial(owner.project.id, async () => {
      const current = await this.audioOwner(itemId, mediaId);
      const lease = await this.assets.beginVideoEdit(
        itemId,
        mediaId,
        current.media.checksum,
        current.media.audioEdit?.revision ?? 0
      );
      try {
        return await action(lease.directory);
      } finally {
        lease.release();
      }
    });
  }
  async detail(id: string) {
    const project = this.get(id),
      item = await this.assets.get(project.itemId);
    if (!item) throw new VideoEditError("EDITOR_ASSET_MISSING", "工程素材不存在", 404);
    return {
      project: await this.describe(project, item),
      item,
      draftAssets: this.database.get("video-editor-draft-assets", `${project.itemId}:${project.mediaId}`)?.payload ?? {}
    };
  }
  private async describe(project: VideoEditorProject, item?: ContentArchiveItem) {
    item ??= await this.assets.get(project.itemId);
    const media = item?.media.find((m) => m.id === project.mediaId);
    const draft = this.database.get("archive-cut-draft", `${project.itemId}:${project.mediaId}`);
    const draftAssets = this.database.get("video-editor-draft-assets", `${project.itemId}:${project.mediaId}`);
    return {
      ...project,
      updatedAt: [project.updatedAt, item?.updatedAt ?? "", draft?.updatedAt ?? "", draftAssets?.updatedAt ?? ""]
        .sort()
        .at(-1)!,
      durationMs: draft?.payload
        ? Math.round(
            archiveProjectDuration(
              (draft.payload as ArchiveCutDraft).clips,
              (draft.payload as ArchiveCutDraft).studio
            ) * 1000
          )
        : media?.durationMs,
      bytes: media?.size,
      previewUrl: media?.previewUrl
    };
  }
  async list() {
    await (this.migration ??= this.migrate().catch((error) => {
      this.migration = undefined;
      throw error;
    }));
    const result = await Promise.all(
      this.database.list(kind).map((e) => this.describe(e.payload as VideoEditorProject))
    );
    return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  private async migrate() {
    await this.assets.initialize();
    for (const entity of this.database.list("video-editor-assets")) {
      const item = entity.payload as ContentArchiveItem,
        media = item.media.find((m) => ["video", "live-photo"].includes(m.kind));
      if (media && !item.id.startsWith("editor_material_")) await this.adopt(item.id, media.id);
    }
    for (const entry of this.database.list("archive-cut-draft")) {
      const split = entry.id.indexOf(":");
      if (split < 0 || entry.id.startsWith("editor_") || this.database.get("video-editor-migrated", entry.id)) continue;
      const itemId = entry.id.slice(0, split),
        mediaId = entry.id.slice(split + 1);
      if (await this.archive.mediaPath(itemId, mediaId)) await this.fromArchive(itemId, mediaId);
    }
  }
  async fromArchive(itemId: string, mediaId: string) {
    const key = `${itemId}:${mediaId}`;
    return this.serial(key, async () => {
      const existing = this.database
        .list(kind)
        .map((e) => e.payload as VideoEditorProject)
        .find((p) => p.link?.itemId === itemId && p.link.mediaId === mediaId);
      if (existing) return this.get(existing.id);
      const item = await this.archive.get(itemId);
      if (!item) throw new VideoEditError("ARCHIVE_MEDIA_NOT_FOUND", "归档不存在", 404);
      const project = await this.snapshot(item, mediaId, true);
      const now = new Date().toISOString();
      this.database.upsert({
        id: key,
        kind: "video-editor-migrated",
        status: "migrated",
        payload: { projectId: project.id },
        createdAt: now,
        updatedAt: now
      });
      return project;
    });
  }
  async adopt(itemId: string, mediaId: string) {
    const item = await this.assets.get(itemId);
    if (
      !item ||
      !itemId.startsWith("editor_") ||
      itemId.startsWith("editor_material_") ||
      !item.media.some((m) => m.id === mediaId)
    )
      throw new VideoEditError("EDITOR_ASSET_MISSING", "工程素材不存在", 404);
    const old = this.database
      .list(kind)
      .map((e) => e.payload as VideoEditorProject)
      .find((p) => p.itemId === itemId);
    if (old) return old;
    const now = new Date().toISOString();
    return this.put({ id: nanoid(16), name: item.title, itemId, mediaId, createdAt: now, updatedAt: now });
  }
  private async snapshot(item: ContentArchiveItem, mediaId: string, linked: boolean, name = item.title) {
    const sourceStore = item.id.startsWith("editor_") ? this.assets : this.archive;
    const source = await sourceStore.mediaPath(item.id, mediaId);
    if (!source || !["video", "live-photo"].includes(source.media.kind))
      throw new VideoEditError("EDITOR_VIDEO_REQUIRED", "请选择视频素材", 400);
    const lease = await sourceStore.beginVideoEdit(
      item.id,
      mediaId,
      source.media.checksum,
      source.media.audioEdit?.revision ?? 0
    );
    const release = lease.release;
    const id = `editor_${nanoid(16)}`,
      now = new Date().toISOString();
    let staging: string | undefined;
    try {
      staging = await this.assets.createStaging(`editor_snapshot_${nanoid(12)}`);
      const video = structuredClone(source.media);
      video.id = nanoid(16);
      const cover = item.media.find((m) => m.id === item.coverMediaId);
      const media = [video, ...(cover && cover.id !== mediaId ? [{ ...cover, id: nanoid(16) }] : [])];
      for (const m of media) {
        for (const file of archiveMediaAssets(m, false)) {
          if (path.basename(file.fileName) !== file.fileName) throw new Error("EDITOR_ASSET_PATH_INVALID");
          await fs.copyFile(path.join(path.dirname(source.filePath), file.fileName), path.join(staging, file.fileName));
        }
        if (m.audioEdit) m.audioEdit.pendingFiles = [];
        const url = `/api/v1/tools/media-archive/items/${id}/media/${m.id}`;
        m.previewUrl = url;
        m.downloadUrl = url + "?download=1";
      }
      const snapshot: ContentArchiveItem = {
        ...structuredClone(item),
        id,
        platform: "local",
        contentId: id,
        title: name,
        media,
        coverMediaId: media[1]?.id,
        totalBytes: archiveMediaBytes(media),
        fetchedAt: now,
        updatedAt: now
      };
      const oldDraft = this.database.get("archive-cut-draft", `${item.id}:${mediaId}`)?.payload as
        ArchiveCutDraft | undefined;
      const draft =
        oldDraft && oldDraft.checksum === video.checksum && oldDraft.revision === (video.audioEdit?.revision ?? 0)
          ? structuredClone(oldDraft)
          : undefined;
      const draftAssets = this.database.get("video-editor-draft-assets", `${item.id}:${mediaId}`)?.payload as
        | { studioSources?: Array<{ file: { fileName: string } }>; studioMusic?: Array<{ file: { fileName: string } }> }
        | undefined;
      for (const asset of [...(draftAssets?.studioSources ?? []), ...(draftAssets?.studioMusic ?? [])]) {
        if (path.basename(asset.file.fileName) !== asset.file.fileName) throw new Error("EDITOR_ASSET_PATH_INVALID");
        await fs.copyFile(
          path.join(path.dirname(source.filePath), asset.file.fileName),
          path.join(staging, asset.file.fileName)
        );
      }
      if (draft && this.editor) {
        const replacements = new Map<string, Awaited<ReturnType<ArchiveVideoEditService["uploadWatermark"]>>>();
        for (const mark of draft.studio?.watermarks ?? []) {
          if (mark.asset.kind !== "draft") continue;
          let replacement = replacements.get(mark.asset.id);
          if (!replacement) {
            let original: Awaited<ReturnType<ArchiveVideoEditService["watermarks"]["acquire"]>>;
            try {
              original = await this.editor.watermarks.acquire(item.id, mediaId, mark.asset.id);
            } catch (error) {
              if (error instanceof VideoEditError && error.code === "ARCHIVE_WATERMARK_MISSING") continue;
              throw error;
            }
            try {
              replacement = await this.editor.watermarks.upload(
                id,
                video.id,
                await fs.readFile(original.path),
                "watermark.png",
                "image/png"
              );
              replacements.set(mark.asset.id, replacement);
            } finally {
              original.release();
            }
          }
          mark.asset = { ...mark.asset, id: replacement.id };
        }
      }
      await this.assets.commit(snapshot, staging);
      if (draftAssets) {
        this.database.upsert({
          id: `${id}:${video.id}`,
          kind: "video-editor-draft-assets",
          status: id,
          payload: draftAssets,
          createdAt: now,
          updatedAt: now
        });
        const metadata = new FileMetadataRepository(this.database, this.config.storageRoot);
        for (const asset of [...(draftAssets.studioSources ?? []), ...(draftAssets.studioMusic ?? [])]) {
          const record = await metadata.inspect({
            entityKind: "video-editor-draft-assets",
            entityId: id,
            filePath: path.join(this.config.xhsArchiveItemsDir, id, asset.file.fileName),
            mediaType: "application/octet-stream",
            owner: "local"
          });
          this.database.upsertFile(record);
        }
      }
      if (draft) await this.editor!.saveCutDraft(id, video.id, draft);
      return this.put({
        id: nanoid(16),
        name,
        itemId: id,
        mediaId: video.id,
        createdAt: now,
        updatedAt: now,
        ...(linked
          ? {
              syncedRevision: video.audioEdit?.revision ?? 0,
              link: {
                itemId: item.id,
                mediaId,
                checksum: source.media.checksum,
                revision: source.media.audioEdit?.revision ?? 0
              }
            }
          : {})
      });
    } finally {
      release();
      if (staging) await fs.rm(staging, { recursive: true, force: true });
    }
  }
  async copy(id: string) {
    const { project, item } = await this.detail(id);
    return this.snapshot(item, project.mediaId, false, `${project.name} 副本`.slice(0, 500));
  }
  rename(id: string, name: string) {
    const project = this.get(id);
    return this.put({ ...project, name, updatedAt: new Date().toISOString() });
  }
  async remove(id: string) {
    return this.serial(id, async () => {
      const project = this.get(id);
      await this.assets.remove(project.itemId);
      this.database.remove("archive-cut-draft", `${project.itemId}:${project.mediaId}`);
      this.database.remove("video-editor-draft-assets", `${project.itemId}:${project.mediaId}`);
      new FileMetadataRepository(this.database, this.config.storageRoot).removeForEntity(
        "video-editor-draft-assets",
        project.itemId
      );
      await this.editor?.watermarks.removeProject(project.itemId);
      this.database.remove(kind, id);
      for (const entry of this.database.list("video-editor-material")) {
        const material = entry.payload as { ownerId: string; itemId: string };
        if (material.ownerId !== project.itemId) continue;
        this.database.remove("video-editor-material", entry.id);
        const shared = this.database
          .list("video-editor-material")
          .some((other) => (other.payload as { itemId: string }).itemId === material.itemId);
        if (!shared && material.itemId.startsWith("editor_material_")) await this.assets.remove(material.itemId);
      }
      return { id };
    });
  }
  async sync(id: string, revision: number) {
    return this.serial(id, async () => {
      const { project, item } = await this.detail(id);
      if (!project.link) throw new VideoEditError("EDITOR_NOT_LINKED", "此工程未关联归档", 400);
      const media = structuredClone(item.media.find((m) => m.id === project.mediaId)!);
      if (!media.audioEdit || media.audioEdit.revision !== revision)
        throw new VideoEditError("EDITOR_REVISION_CHANGED", "工程已更新，请重新同步", 409);
      if (project.syncedRevision === revision) return project;
      const link = project.link;
      const projectLease = await this.assets.beginVideoEdit(project.itemId, project.mediaId, media.checksum, revision);
      let lease: Awaited<ReturnType<ContentArchiveStore["beginVideoEdit"]>> | undefined;
      let staging: string | undefined;
      let release: (() => void) | undefined;
      try {
        lease = await this.archive.beginVideoEdit(link.itemId, link.mediaId, link.checksum, link.revision);
        staging = await this.archive.createStaging(`editor_sync_${nanoid(12)}`);
        const source = { filePath: path.join(projectLease.directory, media.fileName) };
        release = this.assets.pinMedia(source.filePath);
        media.id = link.mediaId;
        media.audioEdit.revision = link.revision + 1;
        media.audioEdit.original = structuredClone(
          lease.media.audioEdit?.original ?? {
            fileName: lease.media.fileName,
            mimeType: lease.media.mimeType,
            size: lease.media.size,
            checksum: lease.media.checksum
          }
        );
        media.audioEdit.pendingFiles = [];
        const url = `/api/v1/tools/media-archive/items/${link.itemId}/media/${link.mediaId}`;
        media.previewUrl = `${url}?v=${media.checksum}`;
        media.downloadUrl = `${url}?download=1&v=${media.checksum}`;
        const added: string[] = [];
        for (const file of archiveMediaAssets(media, false)) {
          if (path.basename(file.fileName) !== file.fileName) throw new Error("EDITOR_ASSET_PATH_INVALID");
          const target = path.join(lease.directory, file.fileName);
          if (
            await fs.stat(target).then(
              () => true,
              () => false
            )
          )
            continue;
          await fs.copyFile(path.join(path.dirname(source.filePath), file.fileName), path.join(staging, file.fileName));
          added.push(file.fileName);
        }
        let cover: ContentArchiveItem["media"][number] | undefined;
        if (this.tools) {
          const tools = await this.tools(),
            name = `editor-cover-${nanoid(12)}.jpg`,
            coverPath = path.join(staging, name);
          await runMediaProcess(
            tools.ffmpeg,
            [
              "-v",
              "error",
              "-y",
              "-ss",
              String(Math.min(0.5, (media.durationMs ?? 1000) / 4000)),
              "-i",
              source.filePath,
              "-frames:v",
              "1",
              "-an",
              "-vf",
              "scale=720:720:force_original_aspect_ratio=decrease",
              "-threads",
              "1",
              coverPath
            ],
            AbortSignal.timeout(60000),
            { timeoutMs: 60000, output: coverPath, maxBytes: 20 * 1024 * 1024 }
          );
          const archiveItem = lease.item;
          const data = await fs.readFile(coverPath),
            oldCover = archiveItem.media.find((m) => m.id === archiveItem.coverMediaId && m.kind === "cover"),
            coverId = oldCover?.id ?? nanoid(16);
          const checksum = createHash("sha256").update(data).digest("hex");
          const url = `/api/v1/tools/media-archive/items/${link.itemId}/media/${coverId}?v=${checksum}`;
          cover = {
            id: coverId,
            index: oldCover?.index ?? Math.max(...archiveItem.media.map((m) => m.index)) + 1,
            kind: "cover",
            fileName: name,
            mimeType: "image/jpeg",
            size: data.length,
            checksum,
            previewUrl: url,
            downloadUrl: url + "&download=1"
          };
          added.push(name);
        }
        const next = {
          ...project,
          syncedRevision: revision,
          updatedAt: new Date().toISOString(),
          link: { ...link, checksum: media.checksum, revision: media.audioEdit.revision }
        };
        await this.archive.saveVideoEdit(
          link.itemId,
          lease.token,
          link.checksum,
          link.revision,
          media,
          staging,
          added,
          () => {
            this.put(next);
          },
          undefined,
          cover
        );
        return next;
      } finally {
        release?.();
        lease?.release();
        projectLease.release();
        if (staging) await fs.rm(staging, { recursive: true, force: true });
      }
    });
  }
  async close() {
    await this.migration?.catch(() => undefined);
    await Promise.allSettled(this.operations.values());
  }
  private async serial<T>(key: string, action: () => Promise<T>) {
    const previous = this.operations.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(action);
    this.operations.set(key, next);
    try {
      return await next;
    } finally {
      if (this.operations.get(key) === next) this.operations.delete(key);
    }
  }
}
