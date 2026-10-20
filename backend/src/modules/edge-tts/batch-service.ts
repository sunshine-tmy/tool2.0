/** 在线批次只引用独立任务快照；提交、修改与产物读取均有锁，不影响旧版单条任务。 */
import fsp from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { Value } from "@sinclair/typebox/value";
import { parseFile } from "music-metadata";
import {
  EdgeTtsBatchCreateSchema,
  EDGE_TTS_MAX_BATCH_TEXT_LENGTH,
  type EdgeTtsBatch,
  type EdgeTtsBatchCreate,
  type EdgeTtsBatchRegenerate,
  type EdgeTtsCreateTaskInput,
  type EdgeTtsTask
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { FileMetadataRepository } from "../../database/file-metadata";
import type { EdgeTtsTaskService } from "./task-service";
import { parseCreateInput } from "./input";
import { combineOnlineAudio } from "./batch-media";
import {
  buildBilingualCues,
  buildSentenceCues,
  buildTranslationCues,
  writeSrt,
  type TimingSegment
} from "../chatterbox/batch-artifacts";

type Entry = {
  id: string;
  taskId: string;
  attempt: number;
  referenceTranslation?: string;
  input: EdgeTtsCreateTaskInput;
};
type RecordBatch = Omit<EdgeTtsBatchCreate, "segments"> & {
  id: string;
  items: Entry[];
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};
const kind = "edge-tts-batch";
const safeId = (id: string) => /^[A-Za-z0-9_-]{6,64}$/.test(id);
export class EdgeTtsBatchError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: 400 | 404 | 409 | 413 | 429 = 400
  ) {
    super(message);
  }
}
export class EdgeTtsBatchService {
  private records = new Map<string, RecordBatch>();
  private locks = new Map<string, Promise<unknown>>();
  private durations = new Map<string, number>();
  private artifacts = new Map<string, string>();
  private root: string;
  constructor(
    private config: AppConfig,
    private db: ToolboxDatabase,
    readonly tasks: EdgeTtsTaskService,
    private metadata?: FileMetadataRepository
  ) {
    this.root = path.join(path.dirname(config.edgeTtsTasksDir), "batches");
  }
  async initialize() {
    await fsp.mkdir(this.root, { recursive: true });
    for (const entity of this.db.list(kind)) {
      const record = entity.payload as RecordBatch;
      if (
        !record ||
        !safeId(record.id) ||
        !Array.isArray(record.items) ||
        !record.items.length ||
        !record.items.every(
          (item) => safeId(item.id) && safeId(item.taskId) && Number.isInteger(item.attempt) && item.attempt > 0
        ) ||
        !Number.isFinite(Date.parse(record.expiresAt))
      )
        continue;
      const { id: _id, items, createdAt: _created, updatedAt: _updated, expiresAt: _expires, ...settings } = record;
      if (
        !Value.Check(EdgeTtsBatchCreateSchema, {
          ...settings,
          segments: items.map((item) => ({ text: item.input?.text }))
        })
      )
        continue;
      this.records.set(record.id, record);
    }
    await this.cleanupExpired();
  }
  async cleanupExpired() {
    for (const record of this.records.values()) {
      if (Date.parse(record.expiresAt) <= Date.now()) await this.withArtifact(record.id, () => this.remove(record.id));
    }
  }
  withArtifact<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const task = (this.locks.get(id) ?? Promise.resolve()).catch(() => undefined).then(operation);
    this.locks.set(id, task);
    void task
      .finally(() => {
        if (this.locks.get(id) === task) this.locks.delete(id);
      })
      .catch(() => undefined);
    return task;
  }
  private record(id: string) {
    const record = this.records.get(id);
    if (!record) throw new EdgeTtsBatchError("EDGE_TTS_BATCH_NOT_FOUND", "在线配音批次不存在或已过期", 404);
    return record;
  }
  private save(record: RecordBatch) {
    this.db.upsert({ id: record.id, kind, payload: record, createdAt: record.createdAt, updatedAt: record.updatedAt });
    this.records.set(record.id, record);
    this.artifacts.delete(record.id);
  }
  private validate(input: EdgeTtsBatchCreate) {
    if (input.segments.reduce((sum, item) => sum + item.text.length, 0) > EDGE_TTS_MAX_BATCH_TEXT_LENGTH)
      throw new EdgeTtsBatchError("EDGE_TTS_BATCH_TOO_LONG", "整个批次不能超过 20000 个字符", 413);
    return input.segments.map((segment) => {
      const parsed = parseCreateInput({ ...input, ...segment }, this.tasks.getAllowedVoiceNames());
      if (!parsed.success) throw new EdgeTtsBatchError(parsed.code, parsed.message, parsed.statusCode);
      return parsed.value;
    });
  }
  async create(input: EdgeTtsBatchCreate) {
    const inputs = this.validate(input),
      id = nanoid(12);
    const { segments: _segments, ...settings } = input;
    const result = await this.tasks.createMany(inputs, id, async (tasks) => {
      const now = new Date().toISOString();
      this.save({
        ...settings,
        id,
        createdAt: now,
        updatedAt: now,
        expiresAt: tasks[0].expiresAt,
        items: tasks.map((task, index) => ({
          id: nanoid(12),
          taskId: task.id,
          attempt: 1,
          referenceTranslation: input.segments[index].referenceTranslation?.trim(),
          input: inputs[index]
        }))
      });
    });
    if (!result.success) throw new EdgeTtsBatchError(result.code, result.message, result.statusCode);
    return this.get(id);
  }
  async get(id: string): Promise<EdgeTtsBatch> {
    const record = this.record(id);
    const items = await Promise.all(
      record.items.map(async (entry, index) => {
        const task: EdgeTtsTask = this.tasks.get(entry.taskId) ?? {
          ...entry.input,
          id: entry.taskId,
          status: "failed",
          progress: 100,
          characterCount: entry.input.text.length,
          error: "源任务不存在或已过期，请重新生成",
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          expiresAt: record.expiresAt
        };
        let audioDurationSeconds = this.durations.get(entry.taskId);
        if (task.status === "completed" && audioDurationSeconds === undefined) {
          audioDurationSeconds = (
            await parseFile(this.tasks.paths(entry.taskId).audio, { duration: true, skipCovers: true }).catch(
              () => undefined
            )
          )?.format.duration;
          if (!audioDurationSeconds || !Number.isFinite(audioDurationSeconds)) {
            task.status = "failed";
            task.error = "音频文件缺失或不可读取，请重新生成";
            delete task.audioUrl;
            delete task.downloadUrl;
            delete task.subtitleUrl;
            delete task.audioBytes;
          } else this.durations.set(entry.taskId, audioDurationSeconds);
        }
        return {
          ...task,
          id: entry.id,
          order: index + 1,
          attempt: entry.attempt,
          referenceTranslation: entry.referenceTranslation,
          audioDurationSeconds
        };
      })
    );
    const { items: _items, ...settings } = record;
    const completed = items.filter((item) => item.status === "completed");
    const running = items.some((item) => item.status === "processing");
    const queued = items.some((item) => item.status === "queued");
    const status = running
      ? "processing"
      : queued
        ? "queued"
        : completed.length === items.length
          ? "completed"
          : items.every((item) => item.status === "cancelled")
            ? "cancelled"
            : "partial_failed";
    const result: EdgeTtsBatch = {
      ...settings,
      items,
      status,
      progress: items.reduce((sum, item) => sum + item.progress, 0) / items.length,
      completedItems: completed.length,
      failedItems: items.filter((item) => item.status === "failed").length,
      totalCharacters: items.reduce((sum, item) => sum + item.text.length, 0),
      totalAudioBytes: completed.reduce((sum, item) => sum + (item.audioBytes || 0), 0),
      totalAudioDurationSeconds: completed.reduce((sum, item) => sum + (item.audioDurationSeconds || 0), 0)
    };
    const root = `/api/v1/tools/edge-tts/batches/${id}`;
    for (const item of completed) {
      item.audioUrl = `${root}/items/${item.id}/audio`;
      item.downloadUrl = `${root}/items/${item.id}/download`;
    }
    if (completed.length && !queued && !running) {
      result.archiveUrl = `${root}/download.zip`;
      result.combinedAudioUrl = `${root}/combined-audio`;
      if (record.includeSubtitles) {
        result.subtitleUrl = `${root}/subtitle`;
        if (completed.some((item) => item.referenceTranslation?.trim())) {
          result.translationSubtitleUrl = `${root}/subtitle.zh-CN`;
          result.bilingualSubtitleUrl = `${root}/subtitle.bilingual`;
        }
      }
    }
    return result;
  }
  async list(page: number, pageSize: number) {
    const records = [...this.records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const totalPages = Math.max(1, Math.ceil(records.length / pageSize)),
      safePage = Math.min(page, totalPages);
    return {
      batches: await Promise.all(
        records.slice((safePage - 1) * pageSize, safePage * pageSize).map((r) => this.get(r.id))
      ),
      pagination: { page: safePage, pageSize, total: records.length, totalPages }
    };
  }
  paths(id: string) {
    if (!safeId(id)) throw new EdgeTtsBatchError("EDGE_TTS_BATCH_ID", "批次标识无效");
    const dir = path.join(this.root, id);
    return {
      dir,
      combinedAudio: path.join(dir, "combined.mp3"),
      subtitle: path.join(dir, "subtitle.srt"),
      translationSubtitle: path.join(dir, "subtitle.zh-CN.srt"),
      bilingualSubtitle: path.join(dir, "subtitle.bilingual.srt")
    };
  }
  itemPaths(id: string, itemId: string) {
    const entry = this.record(id).items.find((item) => item.id === itemId);
    if (!entry) throw new EdgeTtsBatchError("EDGE_TTS_BATCH_ITEM_NOT_FOUND", "文案段不存在", 404);
    return this.tasks.paths(entry.taskId);
  }
  private async idle(id: string) {
    const batch = await this.get(id);
    if (batch.status === "queued" || batch.status === "processing")
      throw new EdgeTtsBatchError("EDGE_TTS_BATCH_BUSY", "请等待本批次结束后再修改；可以继续添加其他批次", 409);
    return batch;
  }
  async regenerate(id: string, itemId: string, input: EdgeTtsBatchRegenerate) {
    await this.idle(id);
    const record = this.record(id),
      index = record.items.findIndex((item) => item.id === itemId);
    if (index < 0) throw new EdgeTtsBatchError("EDGE_TTS_BATCH_ITEM_NOT_FOUND", "文案段不存在", 404);
    const inputs = this.validate({
      ...record,
      segments: record.items.map((item, at) => (at === index ? input : { text: item.input.text }))
    });
    const parsed = parseCreateInput({ ...record, ...input }, this.tasks.getAllowedVoiceNames());
    if (!parsed.success) throw new EdgeTtsBatchError(parsed.code, parsed.message, parsed.statusCode);
    inputs[index] = parsed.value;
    const result = await this.tasks.createMany([inputs[index]], id, async (tasks) => {
      const items = [...record.items];
      items[index] = {
        ...items[index],
        taskId: tasks[0].id,
        attempt: items[index].attempt + 1,
        referenceTranslation: input.referenceTranslation?.trim(),
        input: inputs[index]
      };
      this.save({ ...record, items, updatedAt: new Date().toISOString() });
    });
    if (!result.success) throw new EdgeTtsBatchError(result.code, result.message, result.statusCode);
    return this.get(id);
  }
  async reorder(id: string, itemIds: string[]) {
    await this.idle(id);
    const record = this.record(id);
    if (
      itemIds.length !== record.items.length ||
      new Set(itemIds).size !== itemIds.length ||
      itemIds.some((itemId) => !record.items.some((item) => item.id === itemId))
    )
      throw new EdgeTtsBatchError("EDGE_TTS_BATCH_ORDER", "顺序必须完整包含当前批次的所有段落");
    this.save({
      ...record,
      items: itemIds.map((itemId) => record.items.find((item) => item.id === itemId)!),
      updatedAt: new Date().toISOString()
    });
    return this.get(id);
  }
  async cancel(id: string) {
    const record = this.record(id);
    for (const entry of record.items)
      if (this.tasks.queue.cancelPending(entry.taskId)) {
        await this.tasks.repository.update(entry.taskId, { status: "cancelled", progress: 100, error: "任务已取消" });
      }
    return this.get(id);
  }
  async removeItem(id: string, itemId: string) {
    await this.idle(id);
    const record = this.record(id),
      entry = record.items.find((item) => item.id === itemId);
    if (!entry) throw new EdgeTtsBatchError("EDGE_TTS_BATCH_ITEM_NOT_FOUND", "文案段不存在", 404);
    if (record.items.length <= 1) throw new EdgeTtsBatchError("EDGE_TTS_BATCH_EMPTY", "请至少保留一段，或删除整个批次");
    this.save({
      ...record,
      items: record.items.filter((item) => item.id !== itemId),
      updatedAt: new Date().toISOString()
    });
    await this.tasks.remove(entry.taskId);
    this.durations.delete(entry.taskId);
    return this.get(id);
  }
  async remove(id: string) {
    this.record(id);
    for (const task of this.tasks.repository.list().filter((task) => task.batchId === id)) {
      await this.tasks.remove(task.id);
      this.durations.delete(task.id);
    }
    this.records.delete(id);
    this.db.remove(kind, id);
    this.artifacts.delete(id);
    this.metadata?.removeForEntity(kind, id);
    await fsp.rm(this.paths(id).dir, { recursive: true, force: true });
  }
  async ensureArtifacts(id: string) {
    const batch = await this.idle(id),
      items = batch.items.filter((item) => item.status === "completed");
    if (!items.length) throw new EdgeTtsBatchError("EDGE_TTS_BATCH_EMPTY", "批次没有成功生成的音频", 409);
    const key = `${batch.updatedAt}:${items.map((item) => `${item.id}:${item.attempt}`).join(",")}`;
    if (this.artifacts.get(id) === key) return batch;
    const paths = this.paths(id);
    await fsp.mkdir(paths.dir, { recursive: true });
    await combineOnlineAudio(
      this.config,
      items.map((item) => this.itemPaths(id, item.id).audio),
      paths.combinedAudio
    );
    if (batch.includeSubtitles) {
      const source: TimingSegment[] = [],
        chinese: TimingSegment[] = [],
        bilingual: TimingSegment[] = [];
      let offset = 0;
      for (const item of items) {
        const duration = item.audioDurationSeconds!;
        const srt = await fsp.readFile(this.itemPaths(id, item.id).subtitle, "utf8").catch(() => "");
        const cues =
          batch.subtitleMode === "segments"
            ? [{ text: item.text, startSeconds: 0, endSeconds: duration }]
            : buildSentenceCues(item.text, duration, parseSrt(srt));
        const shifted = (cue: TimingSegment) => ({
          ...cue,
          startSeconds: cue.startSeconds + offset,
          endSeconds: cue.endSeconds + offset
        });
        source.push(...cues.map(shifted));
        chinese.push(...buildTranslationCues(cues, item.referenceTranslation, duration).map(shifted));
        bilingual.push(...buildBilingualCues(cues, item.text, item.referenceTranslation, duration).map(shifted));
        offset += duration;
      }
      await writeSrt(paths.subtitle, source);
      if (chinese.length) {
        await writeSrt(paths.translationSubtitle, chinese);
        await writeSrt(paths.bilingualSubtitle, bilingual);
      }
    }
    for (const [key, filePath] of Object.entries(paths))
      if (key !== "dir") {
        await this.metadata?.registerIfExists({
          entityKind: kind,
          entityId: id,
          filePath,
          mediaType: key === "combinedAudio" ? "audio/mpeg" : "text/plain",
          owner: "local"
        });
      }
    this.artifacts.set(id, key);
    return batch;
  }
}
function parseSrt(content: string): TimingSegment[] {
  const seconds = (value: string) => {
    const [hours, minutes, rest] = value.replace(",", ".").split(":").map(Number);
    return hours * 3600 + minutes * 60 + rest;
  };
  return content
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .flatMap((block) => {
      const lines = block.split(/\r?\n/),
        timing = lines[1]?.match(/([\d:,]+) --> ([\d:,]+)/);
      return timing
        ? [{ text: lines.slice(2).join(" "), startSeconds: seconds(timing[1]), endSeconds: seconds(timing[2]) }]
        : [];
    });
}
