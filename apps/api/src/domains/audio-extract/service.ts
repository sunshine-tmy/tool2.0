/** Serial extraction ownership. Only immutable results are persisted/backed up; sources are bounded leases. */
import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import {
  AUDIO_EXTRACT_MAX_BYTES,
  AUDIO_EXTRACT_QUOTA,
  type AudioExtractJob,
  type AudioExtractSource,
  type AudioExtractInput
} from "@toolbox/shared/audio-extract";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { TaskStore } from "../../tasks/task-store";
import type { FfmpegTools } from "../../core/media/runtime";
import { commitStagedFile, createStagingPath } from "../../storage/file-commit-gateway";
import { inspectAudio, hashAudio } from "../audio-library/media";
import type { AudioLibraryStore } from "../audio-library/store";
import { AudioExtractError } from "./errors";
import { probeTracks, outputFormat, extractTrack } from "./media";
const kind = "audio-extract-job";
const active = (job: AudioExtractJob) => ["pending", "running"].includes(job.status);
type Source = {
  id: string;
  file: string;
  name: string;
  expires: number;
  controller: AbortController;
  info?: AudioExtractSource;
  jobs: string[];
  submission?: string;
  responseIds?: string[];
};
export class AudioExtractionService {
  readonly root: string;
  private sources = new Map<string, Source>();
  private pending = new Map<string, string>();
  private pins = new Map<string, number>();
  private current?: { id: string; controller: AbortController };
  private running?: Promise<void>;
  private admission = Promise.resolve();
  private closing = false;
  private timer?: ReturnType<typeof setInterval>;
  private operations = new Set<Promise<unknown>>();
  constructor(
    storage: string,
    private database: ToolboxDatabase,
    private tasks: TaskStore,
    private tools: () => Promise<FfmpegTools>,
    private onError: () => void = () => undefined
  ) {
    this.root = path.join(storage, "audio-extract");
  }
  async initialize() {
    await fs.mkdir(path.join(this.root, "staging"), { recursive: true });
    for (const job of this.all())
      if (active(job)) {
        this.save({
          ...job,
          status: "failed",
          phase: "已中断",
          errorCode: "AUDIO_EXTRACT_INTERRUPTED",
          error: "上次提取被中断，请重新选择视频重试",
          updatedAt: new Date().toISOString()
        });
        await fs.rm(path.dirname(this.file(job)), { recursive: true, force: true });
      }
    for (const task of this.tasks.list())
      if (task.toolId === "audio-extract" && !this.database.get(kind, task.id)) this.tasks.remove(task.id);
    for (const id of await fs.readdir(path.join(this.root, "staging")))
      if (/^[A-Za-z0-9_-]{21}$/.test(id)) await fs.rm(this.stage(id), { recursive: true, force: true });
    this.timer = setInterval(() => {
      void this.expire().catch(this.onError);
    }, 60000);
    this.timer.unref();
  }
  private all() {
    return this.database
      .list(kind)
      .map((r) => r.payload as AudioExtractJob)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  }
  list(page = 1, size = 50) {
    const all = this.all();
    return { items: all.slice((page - 1) * size, page * size), total: all.length };
  }
  selection() {
    const all = this.all().filter((j) => j.status === "completed");
    return { ids: all.slice(0, 1000).map((j) => j.id), total: all.length };
  }
  get(id: string) {
    this.assertId(id);
    const row = this.database.get(kind, id);
    if (!row) throw new AudioExtractError("AUDIO_EXTRACT_NOT_FOUND", "提取记录不存在", 404);
    return row.payload as AudioExtractJob;
  }
  private assertId(id: string) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new AudioExtractError("AUDIO_EXTRACT_NOT_FOUND", "记录不存在", 404);
  }
  private stage(id: string) {
    this.assertId(id);
    return path.join(this.root, "staging", id);
  }
  file(job: AudioExtractJob) {
    this.assertId(job.id);
    if (!["mp3", "m4a", "ogg", "flac", "wav", "mka"].includes(job.extension)) throw new Error("AUDIO_EXTRACT_PATH");
    return path.join(this.root, "results", job.id, `audio.${job.extension}`);
  }
  private save(job: AudioExtractJob) {
    this.tasks.commit(
      {
        id: job.id,
        toolId: "audio-extract",
        status: job.status === "canceled" ? "failed" : job.status,
        progress: job.progress,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      },
      () => {
        this.database.upsert({
          id: job.id,
          kind,
          status: job.status,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          payload: job
        });
        if (job.status === "completed")
          this.database.upsertFile({
            id: `audio-extract-${job.id}`,
            entityKind: kind,
            entityId: job.id,
            relativePath: `audio-extract/results/${job.id}/audio.${job.extension}`,
            byteSize: job.bytes!,
            sha256: job.sha256,
            mediaType: job.mimeType,
            owner: "local",
            createdAt: job.createdAt
          });
      },
      () => undefined
    );
  }
  private estimate(j: Pick<AudioExtractJob, "format" | "track" | "bitrate" | "sourceBytes">) {
    return Math.min(
      AUDIO_EXTRACT_MAX_BYTES,
      j.format === "original" ? j.sourceBytes : Math.ceil((j.track.duration * j.bitrate * 1000) / 8) + 1024 ** 2
    );
  }
  private sourceActive(s: Source) {
    return s.jobs.some((id) => {
      const row = this.database.get(kind, id);
      return row && active(row.payload as AudioExtractJob);
    });
  }
  private async capacity(extra: number) {
    const used = this.all().reduce((n, j) => n + (j.bytes ?? (active(j) ? this.estimate(j) : 0)), 0);
    if (used + extra > AUDIO_EXTRACT_QUOTA)
      throw new AudioExtractError("AUDIO_EXTRACT_QUOTA", "提取结果已达 20 GiB 空间上限，请下载并删除旧结果", 413);
    const disk = await fs.statfs(this.root);
    if (disk.bavail * disk.bsize < extra + (this.sources.size + 1) * AUDIO_EXTRACT_MAX_BYTES + 256 * 1024 ** 2)
      throw new AudioExtractError("AUDIO_EXTRACT_DISK_FULL", "磁盘空间不足，请释放空间后重试", 507);
  }
  async reserve(name: string) {
    await this.expire();
    await this.tools();
    if (this.closing) throw new AudioExtractError("AUDIO_EXTRACT_STOPPING", "服务正在退出", 503);
    if (this.sources.size >= 2)
      throw new AudioExtractError("AUDIO_EXTRACT_BUSY", "已有视频正在等待或处理，请稍后继续上传", 429);
    // Reserve before any async admission checks, including requests from another LAN client.
    const id = nanoid(),
      controller = new AbortController();
    const source: Source = {
      id,
      name:
        path
          .basename(name.replaceAll("\\", "/"))
          .replace(/\p{Cc}/gu, "")
          .slice(0, 255) || "video",
      file: path.join(this.stage(id), "source"),
      expires: Date.now() + 2 * 3600000,
      controller,
      jobs: []
    };
    this.sources.set(id, source);
    try {
      await this.capacity(AUDIO_EXTRACT_MAX_BYTES);
      await fs.mkdir(this.stage(id));
      const now = new Date().toISOString();
      this.tasks.commit(
        { id, toolId: "audio-extract", status: "running", progress: 0, createdAt: now, updatedAt: now },
        () => undefined,
        () => undefined
      );
      return source;
    } catch (e) {
      this.sources.delete(id);
      await fs.rm(this.stage(id), { recursive: true, force: true }).catch(this.onError);
      throw e;
    }
  }
  async inspect(id: string, sha256: string, bytes: number) {
    const s = this.source(id);
    const tools = await this.tools();
    const tracks = await probeTracks(s.file, tools, s.controller.signal);
    s.info = { id, name: s.name, sha256, bytes, tracks, expiresAt: new Date(s.expires).toISOString() };
    return s.info;
  }
  private source(id: string) {
    this.assertId(id);
    const s = this.sources.get(id);
    if (!s || (!s.submission && s.expires <= Date.now()))
      throw new AudioExtractError("AUDIO_EXTRACT_SOURCE_EXPIRED", "临时视频已过期，请重新选择上传", 410);
    return s;
  }
  async discard(id: string) {
    const s = this.sources.get(id);
    if (!s) return;
    if (this.sourceActive(s))
      throw new AudioExtractError("AUDIO_EXTRACT_IN_USE", "视频仍有提取任务，请先取消任务", 409);
    s.controller.abort();
    this.tasks.remove(id);
    this.sources.delete(id);
    await fs.rm(this.stage(id), { recursive: true, force: true });
  }
  private async expire() {
    for (const s of this.sources.values()) if (!s.submission && s.expires <= Date.now()) await this.discard(s.id);
  }
  async trackOperation<T>(operation: () => Promise<T>): Promise<T> {
    const work = operation();
    this.operations.add(work);
    try {
      return await work;
    } finally {
      this.operations.delete(work);
    }
  }
  async create(input: AudioExtractInput) {
    const work = this.admission.then(() => this.admit(input));
    this.admission = work.then(
      () => undefined,
      () => undefined
    );
    return work;
  }
  private async admit(input: AudioExtractInput) {
    if (this.closing) throw new AudioExtractError("AUDIO_EXTRACT_STOPPING", "服务正在退出", 503);
    const s = this.source(input.sourceId),
      info = s.info;
    if (!info) throw new AudioExtractError("AUDIO_EXTRACT_SOURCE_NOT_READY", "请等待视频识别完成", 409);
    const key = JSON.stringify([input.trackIndices.slice().sort((a, b) => a - b), input.format, input.bitrate]);
    if (s.submission) {
      if (s.submission !== key)
        throw new AudioExtractError("AUDIO_EXTRACT_SOURCE_USED", "此视频已提交，请重新选择后使用其他参数", 409);
      return { items: (s.responseIds ?? s.jobs).map((id) => this.get(id)), total: (s.responseIds ?? s.jobs).length };
    }
    const tracks = input.trackIndices.map((i) => {
      const track = info.tracks.find((t) => t.index === i);
      if (!track) throw new AudioExtractError("AUDIO_EXTRACT_TRACK_INVALID", "所选音轨不存在");
      return { track, output: outputFormat(track.codec, input.format) };
    });

    const jobs: AudioExtractJob[] = [],
      fresh: AudioExtractJob[] = [];
    for (const { track, output } of tracks) {
      let existing: AudioExtractJob | undefined;
      for (const j of this.all().filter(
        (j) =>
          j.sourceSha256 === info.sha256 &&
          j.track.index === track.index &&
          j.format === input.format &&
          (input.format === "original" || j.bitrate === input.bitrate) &&
          (active(j) || j.status === "completed") &&
          !(this.current?.id === j.id && this.current.controller.signal.aborted)
      )) {
        if (active(j)) {
          existing = j;
          break;
        }
        const held = await this.acquire(j.id).catch(() => undefined);
        if (held) {
          held.release();
          existing = j;
          break;
        }
      }
      if (existing) {
        jobs.push(existing);
        continue;
      }
      const now = new Date().toISOString();
      const job: AudioExtractJob = {
        id: nanoid(),
        name: info.name,
        sourceSha256: info.sha256,
        sourceBytes: info.bytes,
        track,
        format: input.format,
        bitrate: input.bitrate,
        ...output,
        status: "pending",
        phase: "等待提取",
        progress: 0,
        createdAt: now,
        updatedAt: now
      };
      jobs.push(job);
      fresh.push(job);
    }
    await this.capacity(fresh.reduce((n, j) => n + this.estimate(j), 0));
    try {
      for (const job of fresh) this.save(job);
    } catch (error) {
      // Each task uses its existing durable commit boundary; unwind a partial admission.
      this.database.transaction(() => {
        for (const job of fresh) {
          this.database.remove(kind, job.id);
          this.tasks.remove(job.id);
        }
      });
      throw error;
    }
    this.tasks.remove(s.id);
    s.submission = key;
    s.jobs = fresh.map((j) => j.id);
    s.responseIds = jobs.map((j) => j.id);
    for (const job of fresh) this.pending.set(job.id, s.id);
    if (!fresh.length) await this.discard(s.id);
    this.start();
    return { items: jobs, total: jobs.length };
  }
  private start() {
    if (this.running || this.closing) return;
    this.running = this.drain()
      .catch(this.onError)
      .finally(() => {
        this.running = undefined;
        if (this.pending.size && !this.closing) this.start();
      });
  }
  private async drain() {
    while (this.pending.size && !this.closing) {
      const [id, sourceId] = this.pending.entries().next().value!;
      this.pending.delete(id);
      const controller = new AbortController();
      this.current = { id, controller };
      let published = false;
      try {
        const job = this.get(id),
          source = this.source(sourceId),
          tools = await this.tools();
        this.save({ ...job, status: "running", phase: "正在提取", updatedAt: new Date().toISOString() });
        const target = this.file(job);
        await fs.mkdir(path.dirname(target), { recursive: true });
        // Keep a real audio extension for muxer selection while sharing the commit directory.
        const staged = `${createStagingPath(target, nanoid())}.${job.extension}`;
        const metadata = await extractTrack(
          source.file,
          staged,
          job.track,
          job.format,
          job.bitrate,
          tools,
          controller.signal,
          (n) => {
            if (Math.floor(n / 5) > Math.floor(this.get(id).progress / 5))
              this.save({ ...this.get(id), progress: Math.floor(n), updatedAt: new Date().toISOString() });
          }
        );
        this.save({ ...this.get(id), phase: "校验与保存", progress: 96, updatedAt: new Date().toISOString() });
        const sha256 = await hashAudio(staged);
        controller.signal.throwIfAborted();
        await commitStagedFile(staged, target);
        controller.signal.throwIfAborted();
        this.save({
          ...this.get(id),
          status: "completed",
          phase: "已完成",
          progress: 100,
          ...metadata,
          sha256,
          updatedAt: new Date().toISOString()
        });
        published = true;
      } catch (e) {
        const err =
          e instanceof AudioExtractError
            ? e
            : new AudioExtractError("AUDIO_EXTRACT_FAILED", "提取失败，请检查文件、磁盘或运行时", 500);
        this.save({
          ...this.get(id),
          status: controller.signal.aborted ? "canceled" : "failed",
          phase: controller.signal.aborted ? "已取消" : "失败",
          errorCode: controller.signal.aborted ? "AUDIO_EXTRACT_CANCELED" : err.code,
          error: controller.signal.aborted ? "提取已取消，重试需重新选择视频" : err.message,
          updatedAt: new Date().toISOString()
        });
      } finally {
        if (!published)
          await fs.rm(path.dirname(this.file(this.get(id))), { recursive: true, force: true }).catch(this.onError);
        this.current = undefined;
        const source = this.sources.get(sourceId);
        if (source && !this.sourceActive(source)) await this.discard(sourceId).catch(this.onError);
      }
    }
  }
  async acquire(id: string) {
    const job = this.get(id);
    if (job.status !== "completed") throw new AudioExtractError("AUDIO_EXTRACT_NOT_READY", "提取尚未完成", 409);
    this.pins.set(id, (this.pins.get(id) ?? 0) + 1);
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        const n = (this.pins.get(id) ?? 1) - 1;
        if (n) this.pins.set(id, n);
        else this.pins.delete(id);
      }
    };
    try {
      const file = this.file(job),
        stat = await fs.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== job.bytes || (await hashAudio(file)) !== job.sha256)
        throw new Error("CHANGED");
      return { job, file, release };
    } catch {
      release();
      throw new AudioExtractError("AUDIO_EXTRACT_OUTPUT_MISSING", "提取文件缺失或异常，请重新选择视频提取", 409);
    }
  }
  async cancel(id: string) {
    const job = this.get(id);
    if (!active(job)) return;
    if (this.current?.id === id) {
      this.current.controller.abort();
      return;
    }
    const sourceId = this.pending.get(id);
    this.pending.delete(id);
    this.save({
      ...job,
      status: "canceled",
      phase: "已取消",
      error: "提取已取消，重试需重新选择视频",
      updatedAt: new Date().toISOString()
    });
    const source = sourceId && this.sources.get(sourceId);
    if (source && !this.sourceActive(source)) await this.discard(source.id);
  }
  async remove(id: string) {
    const job = this.get(id);
    if (active(job) || (this.pins.get(id) ?? 0) > 0)
      throw new AudioExtractError("AUDIO_EXTRACT_IN_USE", "任务正在提取、播放、下载或加入素材库，请稍后删除", 409);
    const directory = path.dirname(this.file(job)),
      trash = this.stage(nanoid());
    const moved = await fs
      .rename(directory, trash)
      .then(() => true)
      .catch((e: NodeJS.ErrnoException) => {
        if (e.code === "ENOENT") return false;
        throw e;
      });
    try {
      this.database.transaction(() => {
        this.database.remove(kind, id);
        this.database.removeFilesForEntity(kind, id);
        this.tasks.remove(id);
      });
    } catch (e) {
      if (moved) await fs.rename(trash, directory);
      throw e;
    }
    if (moved) await fs.rm(trash, { recursive: true, force: true });
  }
  async addToLibrary(
    id: string,
    library: AudioLibraryStore,
    groupId: string | null,
    purpose: "music" | "speech" | "general",
    mp3: boolean
  ) {
    return this.trackOperation(async () => {
      const held = await this.acquire(id),
        token = nanoid(),
        controller = new AbortController();
      let directory: string | undefined;
      const stop = () => controller.abort();
      this.libraryControllers.add(controller);
      try {
        if (this.closing) throw new AudioExtractError("AUDIO_EXTRACT_STOPPING", "服务正在退出", 503);
        const now = new Date().toISOString();
        this.tasks.commit(
          { id: token, toolId: "audio-extract", status: "running", progress: 0, createdAt: now, updatedAt: now },
          () => undefined,
          () => undefined
        );
        if (groupId && !(await library.snapshot()).groups.some((g) => g.id === groupId))
          throw new AudioExtractError("AUDIO_EXTRACT_GROUP_MISSING", "目标分组已被删除", 409);
        directory = await library.staging();
        // Conservative reservation covers MP3 conversion as well as exact copying.
        library.reserve(token, mp3 ? Math.ceil((held.job.duration! * 192000) / 8) + 1024 ** 2 : held.job.bytes!);
        let file: string;
        if (mp3) {
          file = path.join(directory, "audio.mp3");
          const tools = await this.tools();
          const [track] = await probeTracks(held.file, tools, controller.signal, false);
          await extractTrack(held.file, file, track, "mp3", 192, tools, controller.signal, () => undefined);
        } else {
          if (
            !["mp3", "wav", "m4a", "flac"].includes(held.job.extension) ||
            (held.job.extension === "m4a" && held.job.format === "original" && held.job.track.codec !== "aac")
          )
            throw new AudioExtractError(
              "AUDIO_EXTRACT_LIBRARY_FORMAT",
              "此格式不能直接加入素材库，请选择生成 MP3 副本并加入",
              415
            );
          file = path.join(directory, `audio.${held.job.extension}`);
          await fs.copyFile(held.file, file);
        }
        const media = await inspectAudio(file);
        controller.signal.throwIfAborted();
        return await library.add(
          {
            ...media,
            title: this.title(held.job).slice(0, 120),
            purpose,
            groupId,
            language: held.job.track.language || "und",
            foreignText: "",
            chineseText: "",
            note: "视频音频提取",
            source: { kind: "upload", originalName: this.title(held.job) }
          },
          directory,
          token
        );
      } finally {
        stop();
        this.libraryControllers.delete(controller);
        held.release();
        library.release(token);
        try {
          this.tasks.remove(token);
        } finally {
          if (directory) await fs.rm(directory, { recursive: true, force: true });
        }
      }
    });
  }
  private libraryControllers = new Set<AbortController>();
  title(job: AudioExtractJob) {
    return `${job.name.replace(/\.[^.]+$/, "")}_音轨${job.track.index}_${job.track.language}`
      .replace(/[<>:"/\\|?*\p{Cc}]/gu, "_")
      .slice(0, 180);
  }
  async close() {
    this.closing = true;
    clearInterval(this.timer);
    for (const s of this.sources.values()) s.controller.abort();
    for (const controller of this.libraryControllers) controller.abort();
    await this.admission;
    for (const id of [...this.pending.keys()]) await this.cancel(id);
    this.current?.controller.abort();
    await this.running;
    await Promise.allSettled([...this.operations]);
    for (const id of [...this.sources.keys()]) await this.discard(id);
  }
}
