import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { nanoid } from "nanoid";
import { Value } from "@sinclair/typebox/value";
import {
  ArchiveVideoEditJobSchema,
  ArchiveVideoEditInputSchema,
  watermarkTimingError,
  defaultArchiveAudioSettings,
  type ArchiveEditFile,
  type ArchiveVideoEditInput,
  type ArchiveVideoEditJob,
  type AudioLibraryItem
} from "@toolbox/shared";
import type { AppConfig } from "../../../config";
import type { ToolboxDatabase } from "../../../database/toolbox-database";
import type { TaskStore, Task } from "../../../tasks/task-store";
import { ContentArchiveStore, ContentArchiveStoreError } from "../core/store";
import { mediaFile } from "../core/media-assets";
import { renderSlideshow } from "./slideshow";
import { renderArchiveVideo, VideoEditError, type MediaTools, type RenderVideoOptions } from "./renderer";
import { ArchiveWatermarkDrafts } from "./watermark-drafts";
import { ArchiveWatermarkPresets } from "./watermark-presets";
import { ArchiveWatermarkLibrary } from "./watermark-library";

interface ArchiveMusicSource {
  acquire(id: string, revision?: number): Promise<{ item: AudioLibraryItem; file: string; release: () => void }>;
}
const kind = "archive-video-edit-job";
const active = (job: ArchiveVideoEditJob) => ["pending", "running"].includes(job.status);
type WatermarkLease = Awaited<ReturnType<ArchiveWatermarkDrafts["acquire"]>>;
type Work = {
  job: ArchiveVideoEditJob;
  input: ArchiveVideoEditInput;
  controller: AbortController;
  watermark?: WatermarkLease;
};
export class ArchiveVideoEditService {
  readonly watermarks: ArchiveWatermarkDrafts;
  readonly watermarkPresets: ArchiveWatermarkPresets;
  readonly watermarkLibrary: ArchiveWatermarkLibrary;
  private jobs = new Map<string, ArchiveVideoEditJob>();
  private queue: Work[] = [];
  private running?: { work: Work; done: Promise<void> };
  private stopped = false;
  private initialized = false;
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private cleanupTail: Promise<void> = Promise.resolve();
  constructor(
    private options: {
      config: AppConfig;
      database: ToolboxDatabase;
      tasks: TaskStore;
      store: ContentArchiveStore;
      music: ArchiveMusicSource;
      tools: () => Promise<MediaTools>;
      render?: (options: RenderVideoOptions) => ReturnType<typeof renderArchiveVideo>;
      slideshow?: typeof renderSlideshow;
      onError?: (error: unknown) => void;
    }
  ) {
    this.watermarks = new ArchiveWatermarkDrafts(options.config.xhsArchiveStagingDir);
    this.watermarkPresets = new ArchiveWatermarkPresets(options.database);
    this.watermarkLibrary = new ArchiveWatermarkLibrary(
      path.join(options.config.xhsArchiveDir, "watermark-library"),
      options.database,
      options.config.storageRoot,
      options.onError
    );
  }
  async selectLibraryWatermark(itemId: string, mediaId: string, id: string) {
    const { bytes } = await this.watermarkLibrary.read(id);
    return this.uploadWatermark(itemId, mediaId, bytes, "library-watermark.png", "image/png");
  }
  mediaTools() {
    return this.options.tools();
  }
  async uploadWatermark(itemId: string, mediaId: string, bytes: Buffer, name: string, mime: string) {
    if (this.stopped) throw new VideoEditError("ARCHIVE_EDIT_STOPPED", "服务正在退出", 503);
    const media = await this.options.store.mediaPath(itemId, mediaId);
    if (!media || !["video", "live-photo"].includes(media.media.kind))
      throw new VideoEditError("ARCHIVE_EDIT_VIDEO_REQUIRED", "请选择归档视频", 404);
    return this.watermarks.upload(itemId, mediaId, bytes, name, mime);
  }
  initialize() {
    if (this.initialized) return;
    this.initialized = true;
    for (const entity of this.options.database.list(kind)) {
      const job = entity.payload;
      if (!Value.Check(ArchiveVideoEditJobSchema, job)) throw new Error("ARCHIVE_EDIT_JOB_INVALID");
      this.jobs.set(job.id, structuredClone(job));
      if (active(job))
        this.save({
          ...job,
          status: "failed",
          stage: "failed",
          errorCode: "ARCHIVE_EDIT_INTERRUPTED",
          message: "程序已重启，原成品保留，请重新打开编辑器操作"
        });
    }
    this.cleanupTimer = setInterval(() => this.cleanupHistory(), 60_000);
    this.cleanupTimer.unref();
    this.cleanupHistory();
  }
  get(id: string) {
    const job = this.jobs.get(id);
    return job ? structuredClone(job) : undefined;
  }
  list(itemId: string, mediaId: string) {
    return [...this.jobs.values()]
      .filter((job) => job.itemId === itemId && job.mediaId === mediaId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20)
      .map((job) => structuredClone(job));
  }
  async available() {
    try {
      await this.options.tools();
      return true;
    } catch {
      return false;
    }
  }
  async create(itemId: string, mediaId: string, input: ArchiveVideoEditInput) {
    if (!Value.Check(ArchiveVideoEditInputSchema, input))
      throw new VideoEditError("ARCHIVE_EDIT_INPUT_INVALID", "视频编辑参数无效");
    if (this.stopped) throw new VideoEditError("ARCHIVE_EDIT_STOPPED", "服务正在退出", 503);
    if (this.queue.length >= 8)
      throw new VideoEditError("ARCHIVE_EDIT_QUEUE_FULL", "视频编辑任务较多，请稍后重试", 429);
    if ([...this.jobs.values()].some((job) => job.itemId === itemId && active(job)))
      throw new VideoEditError("ARCHIVE_EDIT_BUSY", "该作品已有视频编辑任务，请等待完成或先停止任务", 409);
    if ((input.musicId && input.useSavedMusic) || (!input.musicId && input.musicRevision))
      throw new VideoEditError("ARCHIVE_EDIT_MUSIC_INVALID", "请选择一种有效的音乐来源");
    const current = await this.options.store.mediaPath(itemId, mediaId);
    if (!current) throw new VideoEditError("ARCHIVE_MEDIA_NOT_FOUND", "视频不存在", 404);
    if (
      !["video", "live-photo"].includes(current.media.kind) &&
      !(current.media.kind === "image" && input.slideshow && !current.media.frameSourceMediaId)
    )
      throw new VideoEditError("ARCHIVE_EDIT_VIDEO_REQUIRED", "请选择视频媒体");
    if (
      input.slideshow &&
      (current.media.kind !== "image" ||
        input.mode === "restore" ||
        input.slideshow.images[0].id !== mediaId ||
        new Set(input.slideshow.images.map((image) => image.id)).size !== input.slideshow.images.length)
    )
      throw new VideoEditError("ARCHIVE_EDIT_SLIDESHOW_INVALID", "图集生成参数无效");
    if ((current.media.audioEdit?.revision ?? 0) !== input.revision || current.media.checksum !== input.checksum)
      throw new VideoEditError("ARCHIVE_EDIT_CONFLICT", "视频已更新，请重新打开编辑器", 409);
    if (input.mode !== "restore") await this.options.tools();
    if (input.mode !== "restore" && input.watermark && current.media.durationMs) {
      const error = watermarkTimingError(input.watermark.settings, current.media.durationMs / 1000);
      if (error) throw new VideoEditError("ARCHIVE_WATERMARK_TIME_INVALID", error);
    }
    const watermark =
      input.mode !== "restore" && input.watermark?.draftId
        ? await this.watermarks.acquire(itemId, mediaId, input.watermark.draftId)
        : undefined;
    if (this.queue.length >= 8) {
      watermark?.release();
      throw new VideoEditError("ARCHIVE_EDIT_QUEUE_FULL", "视频编辑任务较多，请稍后重试", 429);
    }
    if (this.stopped || [...this.jobs.values()].some((entry) => entry.itemId === itemId && active(entry))) {
      watermark?.release();
      throw new VideoEditError("ARCHIVE_EDIT_BUSY", "该作品已有编辑任务或服务正在退出", 409);
    }
    const now = new Date().toISOString();
    const job: ArchiveVideoEditJob = {
      id: nanoid(12),
      itemId,
      mediaId,
      mode: input.mode,
      status: "pending",
      stage: "queued",
      progress: 0,
      message: "等待视频编辑处理",
      createdAt: now,
      updatedAt: now
    };
    try {
      this.save(job);
    } catch (error) {
      watermark?.release();
      throw error;
    }
    this.queue.push({ job, input: structuredClone(input), controller: new AbortController(), watermark });
    this.pump();
    return this.get(job.id)!;
  }
  async cancel(id: string) {
    const job = this.get(id);
    if (!job || !active(job)) return job;
    if (job.stage === "saving") throw new VideoEditError("ARCHIVE_EDIT_COMMITTING", "成品正在提交，请等待完成", 409);
    const queued = this.queue.findIndex((entry) => entry.job.id === id);
    if (queued >= 0) {
      this.queue.splice(queued, 1)[0].watermark?.release();
      this.save({ ...job, status: "cancelled", stage: "cancelled", message: "配乐任务已停止，原成品保留" });
    } else if (this.running?.work.job.id === id) {
      this.running.work.controller.abort();
      await this.running.done;
    }
    return this.get(id);
  }
  async close() {
    this.stopped = true;
    clearInterval(this.cleanupTimer);
    for (const work of this.queue.splice(0)) {
      work.watermark?.release();
      this.save({
        ...work.job,
        status: "failed",
        stage: "failed",
        message: "程序退出，未开始处理",
        errorCode: "ARCHIVE_EDIT_INTERRUPTED"
      });
    }
    this.running?.work.controller.abort();
    await this.running?.done;
    await this.cleanupTail;
    await this.watermarks.idle();
    await this.watermarkLibrary.idle();
  }
  private cleanupHistory() {
    this.cleanupTail = this.cleanupTail
      .then(async () => {
        await this.watermarks.cleanup();
        const completed = [...this.jobs.values()]
          .filter((job) => !active(job))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const expired = new Set(completed.slice(200).map((job) => job.id));
        for (const job of completed) {
          if (expired.has(job.id) || job.mode !== "preview" || Date.parse(job.updatedAt) < Date.now() - 3600_000) {
            await fs.rm(localFile(this.options.config.xhsArchiveStagingDir, `edit-${job.id}`), {
              recursive: true,
              force: true
            });
          }
          if (expired.has(job.id)) {
            this.options.database.remove(kind, job.id);
            this.options.tasks.remove(job.id);
            this.jobs.delete(job.id);
          }
        }
      })
      .catch((error) => this.options.onError?.(error));
  }
  previewPath(id: string) {
    const job = this.jobs.get(id);
    return job?.mode === "preview" && job.status === "completed"
      ? path.join(this.options.config.xhsArchiveStagingDir, `edit-${job.id}`, "preview.mp4")
      : undefined;
  }
  private pump() {
    if (this.stopped || this.running || !this.queue.length) return;
    const work = this.queue.shift()!;
    const done = Promise.resolve()
      .then(() => this.process(work))
      .catch((error) => this.options.onError?.(error))
      .finally(() => {
        this.running = undefined;
        this.pump();
      });
    this.running = { work, done };
  }
  private task(job: ArchiveVideoEditJob): Task {
    return {
      id: job.id,
      toolId: "media-archive-audio-edit",
      status: job.status === "cancelled" ? "failed" : job.status,
      progress: job.progress,
      error: job.errorCode,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    };
  }
  private persist(job: ArchiveVideoEditJob) {
    this.options.database.upsert({
      id: job.id,
      kind,
      status: job.status,
      payload: job,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    });
  }
  private save(job: ArchiveVideoEditJob) {
    job.updatedAt = new Date().toISOString();
    this.options.tasks.commit(
      this.task(job),
      () => this.persist(job),
      () => this.jobs.set(job.id, structuredClone(job))
    );
  }
  private async process(work: Work) {
    const { job, input, controller } = work;
    const { store, config } = this.options;
    let lease: Awaited<ReturnType<ContentArchiveStore["beginVideoEdit"]>> | undefined;
    let directory: string | undefined;
    let keepPreview = false;
    try {
      controller.signal.throwIfAborted();
      this.save({ ...job, status: "running", stage: "preparing", progress: 1, message: "准备原片、配乐和水印" });
      await store.pruneVideoEdits(job.itemId);
      lease = await store.beginVideoEdit(
        job.itemId,
        job.mediaId,
        input.checksum,
        input.revision,
        Boolean(input.slideshow)
      );
      directory = await store.createStaging(`edit-${job.id}`);
      let original = lease.media.audioEdit?.original ?? mediaFile(lease.media);
      let originalPath = localFile(lease.directory, original.fileName);
      let sourceImageId: string | undefined;
      let music: NonNullable<NonNullable<typeof lease.media.audioEdit>["music"]> | undefined;
      const addedFiles: string[] = [];
      let watermark =
        input.mode === "restore" || input.watermark === null
          ? undefined
          : structuredClone(lease.media.audioEdit?.watermark);
      if (input.mode !== "restore" && input.watermark) {
        if (work.watermark) {
          watermark = {
            file: work.watermark.file,
            width: work.watermark.width,
            height: work.watermark.height,
            settings: structuredClone(input.watermark.settings)
          };
        } else {
          if (!watermark) throw new VideoEditError("ARCHIVE_WATERMARK_MISSING", "请先上传水印图片", 404);
          watermark.settings = structuredClone(input.watermark.settings);
        }
      }
      if (watermark) {
        const source = work.watermark?.path ?? localFile(lease.directory, watermark.file.fileName);
        const target = localFile(directory, watermark.file.fileName);
        await fs.copyFile(source, target);
        const actual = await inspectEditFile(target, "image/png");
        if (actual.checksum !== watermark.file.checksum || actual.size !== watermark.file.size)
          throw new VideoEditError("ARCHIVE_WATERMARK_CHANGED", "水印文件已变化，请重新上传", 409);
        if (watermark.file.fileName !== lease.media.audioEdit?.watermark?.file.fileName)
          addedFiles.push(watermark.file.fileName);
      }
      if (input.mode !== "restore" && input.useSavedMusic) {
        if (!lease.media.audioEdit?.music)
          throw new VideoEditError("ARCHIVE_EDIT_MUSIC_MISSING", "当前视频没有可复用的配乐，请重新选曲", 404);
        music = structuredClone(lease.media.audioEdit.music);
        await fs.copyFile(localFile(lease.directory, music.fileName), localFile(directory, music.fileName));
      } else if (input.mode !== "restore" && input.musicId) {
        const selected = await this.options.music.acquire(input.musicId, input.musicRevision);
        try {
          const fileName = `music-${nanoid(12)}${path.extname(selected.item.fileName)}`;
          await fs.copyFile(selected.file, localFile(directory, fileName));
          const file = await inspectEditFile(localFile(directory, fileName), selected.item.mimeType);
          if (file.checksum !== selected.item.sha256 || file.size !== selected.item.bytes)
            throw new VideoEditError("ARCHIVE_EDIT_MUSIC_CHANGED", "音乐文件已变化，请重新选择", 409);
          music = {
            ...file,
            title: selected.item.title,
            libraryItemId: selected.item.id,
            libraryRevision: selected.item.revision
          };
          addedFiles.push(fileName);
        } finally {
          selected.release();
        }
      }
      const nextMedia = structuredClone(lease.media);
      if (input.mode === "restore") Object.assign(nextMedia, original);
      else {
        const tools = await this.options.tools();
        const free = await fs.statfs(directory);
        const available = Number(free.bavail) * Number(free.bsize) - 64 * 1024 * 1024;
        if (available < original.size + (music?.size ?? 0) + (watermark?.file.size ?? 0))
          throw new VideoEditError("ARCHIVE_EDIT_DISK_FULL", "磁盘剩余空间不足，原成品保留", 507);
        if (input.slideshow) {
          const images = input.slideshow.images.map((image) => {
            const source = lease!.item.media.find(
              (entry) => entry.id === image.id && entry.kind === "image" && !entry.frameSourceMediaId
            );
            if (!source || source.checksum !== image.checksum)
              throw new VideoEditError("ARCHIVE_EDIT_CONFLICT", "来源图片已变化，请重新打开编辑器", 409);
            return localFile(lease!.directory, source.fileName);
          });
          const masterName = `slideshow-${nanoid(12)}.mp4`;
          originalPath = localFile(directory, masterName);
          await (this.options.slideshow ?? renderSlideshow)({
            tools,
            images,
            settings: input.slideshow,
            directory,
            output: originalPath,
            signal: controller.signal,
            maxBytes: Math.min(available, config.xhsArchiveMaxStorageBytes),
            onProgress: (progress) =>
              this.save({ ...job, status: "running", stage: "slideshow", progress, message: "正在按图集顺序生成原片" })
          });
          original = await inspectEditFile(originalPath, "video/mp4");
          addedFiles.push(masterName);
          sourceImageId = job.mediaId;
          Object.assign(nextMedia, {
            id: `video_${nanoid(12)}`,
            kind: "video",
            index: lease.item.media.length,
            derivedFromImages: structuredClone(input.slideshow.images)
          });
          const mediaUrl = `/api/v1/tools/media-archive/items/${job.itemId}/media/${nextMedia.id}`;
          nextMedia.previewUrl = mediaUrl;
          nextMedia.downloadUrl = `${mediaUrl}?download=1`;
        }
        const fileName = input.mode === "preview" ? "preview.mp4" : `edited-${nanoid(12)}.mp4`;
        let lastProgress = 0;
        const result = await (this.options.render ?? renderArchiveVideo)({
          tools,
          source: originalPath,
          music: music ? localFile(directory, music.fileName) : undefined,
          output: localFile(directory, fileName),
          settings: input.settings,
          watermark: watermark
            ? {
                file: localFile(directory, watermark.file.fileName),
                width: watermark.width,
                height: watermark.height,
                settings: watermark.settings
              }
            : undefined,
          signal: controller.signal,
          preview: input.mode === "preview",
          previewStartSeconds: input.previewStartSeconds,
          maxBytes: Math.min(available, config.xhsArchiveMaxStorageBytes),
          onProgress: (value) => {
            if (value >= lastProgress + 2 && !controller.signal.aborted) {
              lastProgress = value;
              this.save({
                ...job,
                status: "running",
                stage: "rendering",
                progress: value,
                message: "正在生成视频成品"
              });
            }
          }
        });
        controller.signal.throwIfAborted();
        if (input.mode === "preview") {
          for (const name of await fs.readdir(directory)) {
            if (name !== "preview.mp4") await fs.rm(localFile(directory, name), { force: true });
          }
          this.save({
            ...job,
            status: "completed",
            stage: "completed",
            progress: 100,
            message: "试听片段已生成，尚未修改归档",
            previewUrl: `/api/v1/tools/media-archive/video-edits/${job.id}/preview`
          });
          keepPreview = true;
          return;
        }
        Object.assign(nextMedia, await inspectEditFile(localFile(directory, fileName), "video/mp4"), {
          durationMs: result.duration * 1000,
          width: result.width,
          height: result.height
        });
        addedFiles.push(fileName);
      }
      nextMedia.audioEdit = {
        revision: input.revision + 1,
        original: structuredClone(original),
        ...(music ? { music } : {}),
        ...(watermark ? { watermark } : {}),
        settings: input.mode === "restore" ? defaultArchiveAudioSettings() : structuredClone(input.settings),
        updatedAt: new Date().toISOString()
      };
      const currentUrl = `/api/v1/tools/media-archive/items/${job.itemId}/media/${nextMedia.id}`;
      nextMedia.previewUrl = `${currentUrl}?v=${nextMedia.checksum}`;
      nextMedia.downloadUrl = `${currentUrl}?download=1&v=${nextMedia.checksum}`;
      controller.signal.throwIfAborted();
      this.save({ ...job, status: "running", stage: "saving", progress: 97, message: "正在校验并提交最新成品" });
      const completed: ArchiveVideoEditJob = {
        ...job,
        status: "completed",
        stage: "completed",
        progress: 100,
        message: input.mode === "restore" ? "已恢复原始视频" : "已保存为最新归档视频",
        updatedAt: new Date().toISOString(),
        resultMediaId: nextMedia.id
      };
      await store.saveVideoEdit(
        job.itemId,
        lease.token,
        input.checksum,
        input.revision,
        nextMedia,
        directory,
        addedFiles,
        () => {
          this.persist(completed);
          const task = this.task(completed);
          this.options.database.upsert({
            id: task.id,
            kind: "task",
            status: task.status,
            payload: task,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt
          });
        },
        sourceImageId
      );
      this.jobs.set(job.id, completed);
      this.options.tasks.upsert(this.task(completed));
    } catch (error) {
      const persisted = this.options.database.get(kind, job.id)?.payload;
      if (persisted && Value.Check(ArchiveVideoEditJobSchema, persisted) && persisted.status === "completed") {
        this.jobs.set(job.id, persisted);
        this.options.onError?.(error);
      } else {
        const known = error instanceof VideoEditError || error instanceof ContentArchiveStoreError;
        this.save({
          ...job,
          status: controller.signal.aborted ? "cancelled" : "failed",
          stage: "failed",
          errorCode: controller.signal.aborted ? "ARCHIVE_EDIT_CANCELLED" : known ? error.code : "ARCHIVE_EDIT_FAILED",
          message: controller.signal.aborted
            ? "任务已停止，原成品保留"
            : known
              ? error.message
              : "配乐保存失败，原成品保留，请重试"
        });
        if (!known && !controller.signal.aborted) this.options.onError?.(error);
      }
    } finally {
      work.watermark?.release();
      if (work.watermark && input.mode === "save" && this.jobs.get(job.id)?.status === "completed")
        await this.watermarks.discard(input.watermark!.draftId!).catch((error) => this.options.onError?.(error));
      lease?.release();
      if (directory && !keepPreview)
        await fs.rm(directory, { recursive: true, force: true }).catch((error) => this.options.onError?.(error));
      await store.pruneVideoEdits(job.itemId).catch((error) => this.options.onError?.(error));
    }
  }
}
export function localFile(directory: string, fileName: string) {
  if (
    !fileName ||
    path.posix.basename(fileName) !== fileName ||
    path.win32.basename(fileName) !== fileName ||
    fileName.includes(":") ||
    [".", ".."].includes(fileName)
  )
    throw new VideoEditError("ARCHIVE_EDIT_PATH_INVALID", "媒体路径无效");
  return path.join(directory, fileName);
}
async function inspectEditFile(file: string, mimeType: string): Promise<ArchiveEditFile> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  const stat = await fs.stat(file);
  if (!stat.isFile() || stat.size <= 0) throw new VideoEditError("ARCHIVE_EDIT_OUTPUT_INVALID", "生成文件为空", 415);
  return { fileName: path.basename(file), mimeType, size: stat.size, checksum: hash.digest("hex") };
}
