/** Permanent result/history ownership; temporary uploads/keys never enter domain records or backups. */
import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { AUDIO_CONVERT_MAX_FILES, type AudioConvertJob } from "@toolbox/shared";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { TaskStore } from "../../tasks/task-store";
import { inspectAudio, hashAudio } from "../audio-library/media";
import type { AudioLibraryStore } from "../audio-library/store";
import { AudioConvertError } from "./errors";
import { prepareAudio, probeAudio, convertAudio, type AudioTools } from "./media";
const CONVERT_KIND = "audio-convert-job";
const active = (j: AudioConvertJob) => j.status === "pending" || j.status === "running";
export class AudioConversionService {
  readonly root: string;
  private pending = new Map<string, { file: string; ekey?: string }>();
  private pins = new Map<string, number>();
  private reservations = new Set<string>();
  private current?: { id: string; controller: AbortController };
  private running?: Promise<void>;
  private admission = Promise.resolve();
  private closing = false;
  constructor(
    storage: string,
    private database: ToolboxDatabase,
    private tasks: TaskStore,
    private tools: () => Promise<AudioTools>,
    private onError: () => void = () => undefined
  ) {
    this.root = path.join(storage, "audio-convert");
  }
  async initialize() {
    await fs.mkdir(path.join(this.root, "staging"), { recursive: true });
    for (const row of this.database.list(CONVERT_KIND)) {
      const job = row.payload as AudioConvertJob;
      if (active(job)) {
        this.save({
          ...job,
          status: "failed",
          errorCode: "AUDIO_CONVERT_INTERRUPTED",
          error: "上次转换被中断，请重新上传文件重试",
          updatedAt: new Date().toISOString()
        });
        // A crash after rename but before the final transaction must not leave an unowned result.
        await fs.rm(path.dirname(this.file(job.id)), { recursive: true, force: true });
      }
    }
    for (const id of await fs.readdir(path.join(this.root, "staging")))
      if (/^[A-Za-z0-9_-]{21}$/.test(id)) await fs.rm(this.stage(id), { recursive: true, force: true });
  }
  private stage(id: string) {
    return path.join(this.root, "staging", id);
  }
  private save(job: AudioConvertJob) {
    this.tasks.commit(
      {
        id: job.id,
        toolId: "audio-convert",
        status: job.status === "canceled" ? "failed" : job.status,
        progress: job.progress,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      },
      () => {
        this.database.upsert({
          id: job.id,
          kind: CONVERT_KIND,
          status: job.status,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          payload: job
        });
        if (job.status === "completed")
          this.database.upsertFile({
            id: `audio-convert-${job.id}`,
            entityKind: CONVERT_KIND,
            entityId: job.id,
            relativePath: `audio-convert/results/${job.id}/audio.mp3`,
            byteSize: job.bytes!,
            sha256: job.sha256,
            mediaType: "audio/mpeg",
            owner: "local",
            createdAt: job.createdAt
          });
      },
      () => undefined
    );
  }
  get(id: string): AudioConvertJob {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id))
      throw new AudioConvertError("AUDIO_CONVERT_NOT_FOUND", "转换记录不存在", 404);
    const row = this.database.get(CONVERT_KIND, id);
    if (!row) throw new AudioConvertError("AUDIO_CONVERT_NOT_FOUND", "转换记录不存在", 404);
    return row.payload as AudioConvertJob;
  }
  list(page = 1, pageSize = 50) {
    const all = this.database
      .list(CONVERT_KIND)
      .map((r) => r.payload as AudioConvertJob)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    return { items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length };
  }
  completedSelection() {
    const all = this.database
      .list(CONVERT_KIND)
      .map((r) => r.payload as AudioConvertJob)
      .filter((j) => j.status === "completed")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    return { ids: all.slice(0, AUDIO_CONVERT_MAX_FILES).map((j) => j.id), total: all.length };
  }
  async staging() {
    if (this.closing) throw new AudioConvertError("AUDIO_CONVERT_STOPPING", "服务正在停止", 503);
    const records = this.database.list(CONVERT_KIND).map((r) => r.payload as AudioConvertJob);
    const count = records.filter(active).length + this.reservations.size;
    const bytes = records.reduce((sum, j) => sum + (j.bytes ?? 0), 0) + (count + 1) * 420 * 1024 * 1024;
    if (count >= 1000 || bytes > 10 * 1024 ** 3)
      throw new AudioConvertError(
        "AUDIO_CONVERT_QUOTA",
        "转换空间已达 10 GiB 上限，请下载并删除旧结果或等待队列结束",
        413
      );
    const disk = await fs.statfs(this.root);
    const requiredSpace = ((count + 1) * 420 + 100) * 1024 * 1024;
    if (disk.bavail * disk.bsize < requiredSpace)
      throw new AudioConvertError(
        "AUDIO_CONVERT_DISK_FULL",
        `磁盘空间不足，需为转换队列预留 ${Math.ceil(requiredSpace / 1024 ** 2)} MiB 可用空间`,
        413
      );
    const id = nanoid();
    this.reservations.add(id);
    try {
      await fs.mkdir(this.stage(id));
    } catch (e) {
      this.reservations.delete(id);
      throw e;
    }
    return { id, directory: this.stage(id) };
  }
  async discard(id: string) {
    this.reservations.delete(id);
    await fs.rm(this.stage(id), { recursive: true, force: true });
  }
  async enqueue(id: string, name: string, bitrate: number, ekey?: string) {
    if (!this.reservations.has(id) || this.closing)
      throw new AudioConvertError("AUDIO_CONVERT_STOPPING", "服务正在停止，请重新上传", 503);
    const sourceSha256 = await hashAudio(path.join(this.stage(id), "source"));
    const result = this.admission.then(() => this.admit(id, name, bitrate, sourceSha256, ekey));
    this.admission = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
  private async admit(id: string, name: string, bitrate: number, sourceSha256: string, ekey?: string) {
    if (!this.reservations.has(id) || this.closing)
      throw new AudioConvertError("AUDIO_CONVERT_STOPPING", "服务正在停止，请重新上传", 503);
    if (!/\.(ogg|flac|mgg|mflac)$/i.test(name) || ![128, 192, 256, 320].includes(bitrate))
      throw new AudioConvertError("AUDIO_CONVERT_INPUT_INVALID", "请选择 OGG、FLAC、MGG 或 MFLAC，并使用有效码率");
    const candidates = this.database
      .list(CONVERT_KIND)
      .map((r) => r.payload as AudioConvertJob)
      .filter(
        (j) =>
          j.sourceSha256 === sourceSha256 &&
          j.bitrate === bitrate &&
          (active(j) || j.status === "completed") &&
          !(this.current?.id === j.id && this.current.controller.signal.aborted)
      );
    for (const candidate of candidates) {
      if (active(candidate)) {
        await this.discard(id);
        return this.get(candidate.id);
      }
      const held = await this.acquire(candidate.id).catch(() => undefined);
      if (held) {
        try {
          await this.discard(id);
          return held.job;
        } finally {
          held.release();
        }
      }
    }
    if (this.closing) throw new AudioConvertError("AUDIO_CONVERT_STOPPING", "服务正在停止，请重新上传", 503);
    const now = new Date().toISOString();
    const job: AudioConvertJob = {
      id,
      name:
        path
          .basename(name.replaceAll("\\", "/"))
          .replace(/\p{Cc}/gu, "")
          .slice(0, 255) || "audio",
      bitrate: bitrate as AudioConvertJob["bitrate"],
      sourceSha256,
      status: "pending",
      progress: 0,
      createdAt: now,
      updatedAt: now
    };
    this.save(job);
    this.pending.set(id, { file: path.join(this.stage(id), "source"), ...(ekey ? { ekey } : {}) });
    this.reservations.delete(id);
    this.start();
    return job;
  }
  private start() {
    if (this.running || this.closing) return;
    this.running = this.drain()
      .catch(() => this.onError())
      .finally(() => {
        this.running = undefined;
        if (this.pending.size && !this.closing) this.start();
      });
  }
  private async drain() {
    while (this.pending.size && !this.closing) {
      const [id, input] = this.pending.entries().next().value!;
      this.pending.delete(id);
      const controller = new AbortController();
      this.current = { id, controller };
      let published = false;
      try {
        let job = this.get(id);
        this.save({ ...job, status: "running", updatedAt: new Date().toISOString() });
        const tools = await this.tools(),
          signal = controller.signal;
        const source = await prepareAudio(
          input.file,
          path.join(this.stage(id), "decoded"),
          job.name,
          signal,
          input.ekey
        );
        const probe = await probeAudio(source, tools, signal);
        if (!["flac", "vorbis", "opus"].includes(probe.format))
          throw new AudioConvertError("AUDIO_CONVERT_FORMAT_UNSUPPORTED", "仅支持 FLAC 及 Vorbis/Opus 编码的 OGG", 415);
        job = { ...this.get(id), format: probe.format, duration: probe.duration };
        this.save(job);
        const output = path.join(this.stage(id), "audio.mp3");
        await convertAudio(source, output, tools, probe, job.bitrate, signal, (n) => {
          if (Math.floor(n / 5) > Math.floor(this.get(id).progress / 5))
            this.save({ ...this.get(id), progress: Math.floor(n), updatedAt: new Date().toISOString() });
        });
        const metadata = await inspectAudio(output);
        signal.throwIfAborted();
        const handle = await fs.open(output, "r+");
        try {
          await handle.sync();
        } finally {
          await handle.close();
        }
        await fs.mkdir(path.dirname(this.file(id)), { recursive: true });
        await fs.rename(output, this.file(id));
        signal.throwIfAborted();
        delete input.ekey;
        await this.discard(id);
        signal.throwIfAborted();
        this.save({
          ...this.get(id),
          status: "completed",
          progress: 100,
          bytes: metadata.bytes,
          sha256: metadata.sha256,
          updatedAt: new Date().toISOString()
        });
        published = true;
      } catch (e) {
        const error = controller.signal.aborted
          ? new AudioConvertError("AUDIO_CONVERT_CANCELED", "转换已取消，重试需重新上传", 409)
          : e instanceof AudioConvertError
            ? e
            : new AudioConvertError("AUDIO_CONVERT_FAILED", "转换失败，请检查文件、磁盘及媒体运行时", 500);
        this.save({
          ...this.get(id),
          status: controller.signal.aborted ? "canceled" : "failed",
          errorCode: error.code,
          error: error.message,
          updatedAt: new Date().toISOString()
        });
      } finally {
        delete input.ekey;
        if (!published)
          await fs.rm(path.dirname(this.file(id)), { recursive: true, force: true }).catch(() => this.onError());
        await this.discard(id).catch(() => this.onError());
        this.current = undefined;
      }
    }
  }
  file(id: string) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id))
      throw new AudioConvertError("AUDIO_CONVERT_NOT_FOUND", "转换记录不存在", 404);
    return path.join(this.root, "results", id, "audio.mp3");
  }
  async acquire(id: string) {
    const job = this.get(id);
    if (job.status !== "completed") throw new AudioConvertError("AUDIO_CONVERT_NOT_READY", "转换尚未成功完成", 409);
    this.pins.set(id, (this.pins.get(id) ?? 0) + 1);
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        this.pins.set(id, (this.pins.get(id) ?? 1) - 1);
      }
    };
    try {
      const stat = await fs.lstat(this.file(id));
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== job.bytes) throw new Error("OUTPUT_CHANGED");
      if ((await hashAudio(this.file(id))) !== job.sha256) throw new Error("OUTPUT_CHANGED");
      return { job, file: this.file(id), release };
    } catch {
      release();
      throw new AudioConvertError("AUDIO_CONVERT_OUTPUT_MISSING", "转换文件缺失或异常，请重新上传转换", 409);
    }
  }
  async cancel(id: string) {
    if (!active(this.get(id))) return;
    if (this.current?.id === id) {
      this.current.controller.abort();
      return;
    }
    this.save({
      ...this.get(id),
      status: "canceled",
      error: "转换已取消；重试需重新上传",
      updatedAt: new Date().toISOString()
    });
    this.pending.delete(id);
    await this.discard(id);
  }
  async remove(id: string) {
    const job = this.get(id);
    if (active(job) || (this.pins.get(id) ?? 0) > 0)
      throw new AudioConvertError("AUDIO_CONVERT_IN_USE", "任务正在处理、下载或加入素材库，请稍后删除", 409);
    const directory = path.dirname(this.file(id)),
      trash = path.join(this.root, "staging", nanoid());
    const moved = await fs
      .rename(directory, trash)
      .then(() => true)
      .catch((e: NodeJS.ErrnoException) => {
        if (e.code === "ENOENT") return false;
        throw e;
      });
    try {
      this.database.transaction(() => {
        this.database.remove(CONVERT_KIND, id);
        this.database.removeFilesForEntity(CONVERT_KIND, id);
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
    purpose: "music" | "speech" | "general"
  ) {
    const source = await this.acquire(id),
      token = nanoid();
    let directory: string | undefined;
    try {
      if (groupId && !(await library.snapshot()).groups.some((g) => g.id === groupId))
        throw new AudioConvertError("AUDIO_CONVERT_GROUP_MISSING", "目标分组已被删除", 409);
      directory = await library.staging();
      library.reserve(token, source.job.bytes!);
      await fs.copyFile(source.file, path.join(directory, "audio.mp3"));
      const media = await inspectAudio(path.join(directory, "audio.mp3"));
      return await library.add(
        {
          ...media,
          title:
            source.job.name
              .replace(/\.[^.]+$/, "")
              .slice(0, 120)
              .trim() || "转换音频",
          purpose,
          groupId,
          language: "und",
          foreignText: "",
          chineseText: "",
          note: "音频格式转换",
          source: { kind: "upload", originalName: source.job.name }
        },
        directory,
        token
      );
    } finally {
      source.release();
      library.release(token);
      if (directory) await fs.rm(directory, { recursive: true, force: true });
    }
  }
  async close() {
    this.closing = true;
    await this.admission;
    for (const id of [...this.pending.keys()]) await this.cancel(id);
    this.current?.controller.abort();
    await this.running;
  }
}
