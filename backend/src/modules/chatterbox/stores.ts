import fsp from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import {
  type ChatterboxBatch,
  type ChatterboxBatchItem,
  type ChatterboxBatchStatus,
  type ChatterboxSavedVoice,
  type ChatterboxTaskStatus,
  type ChatterboxVoiceAuthorization
} from "@toolbox/shared";
import type { ToolboxDatabase } from "../../database/toolbox-database";
import type { FileMetadataRepository } from "../../database/file-metadata";
import type { Task, TaskStore } from "../../tasks/task-store";

export type BatchSegmentInput = { text: string; referenceTranslation?: string; fileName?: string };

export type BatchCreateInput = Pick<
  ChatterboxBatch,
  | "name"
  | "language"
  | "referenceFileName"
  | "referenceDurationSeconds"
  | "referenceRetained"
  | "authorization"
  | "consentConfirmed"
  | "exaggeration"
  | "cfgWeight"
  | "temperature"
  | "seed"
  | "includeSubtitles"
  | "subtitleMode"
> & { segments: BatchSegmentInput[] };

export type StoredVoice = Omit<ChatterboxSavedVoice, "audioUrl">;

export class ChatterboxVoiceStore {
  private readonly voices = new Map<string, StoredVoice>();

  constructor(
    private readonly root: string,
    private readonly database: ToolboxDatabase,
    private readonly fileMetadata?: FileMetadataRepository
  ) {}

  async initialize() {
    await fsp.mkdir(this.root, { recursive: true });
    if (!this.database.isDomainInitialized("chatterbox-voice")) {
      for (const entry of await fsp.readdir(this.root, { withFileTypes: true })) {
        if (!entry.isDirectory() || !isSafeId(entry.name)) continue;
        try {
          const voice = JSON.parse(await fsp.readFile(this.paths(entry.name).meta, "utf8")) as StoredVoice;
          if (!isStoredVoice(voice) || voice.id !== entry.name || !(await fileExists(this.paths(entry.name).audio)))
            continue;
          this.persist(voice);
        } catch {
          // Invalid legacy metadata stays untouched for manual recovery.
        }
      }
      this.database.markDomainInitialized("chatterbox-voice");
    }
    for (const entity of this.database.list("chatterbox-voice")) {
      const voice = entity.payload as StoredVoice;
      if (!isStoredVoice(voice) || !(await fileExists(this.paths(voice.id).audio))) continue;
      this.voices.set(voice.id, voice);
    }
  }

  async create(input: Omit<StoredVoice, "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const voice: StoredVoice = { ...input, createdAt: now, updatedAt: now };
    this.persist(voice);
    await this.fileMetadata
      ?.registerIfExists({
        entityKind: "chatterbox-voice",
        entityId: voice.id,
        filePath: this.paths(voice.id).audio,
        mediaType: "audio/wav",
        owner: "local"
      })
      .catch(() => undefined);
    this.voices.set(voice.id, voice);
    return { ...voice };
  }

  get(id: string) {
    const voice = this.voices.get(id);
    return voice ? { ...voice } : undefined;
  }

  list() {
    return [...this.voices.values()]
      .map((voice) => ({ ...voice }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async remove(id: string) {
    if (!isSafeId(id)) return false;
    this.voices.delete(id);
    this.database.remove("chatterbox-voice", id);
    this.fileMetadata?.removeForEntity("chatterbox-voice", id);
    await fsp.rm(this.paths(id).dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    return true;
  }

  paths(id: string) {
    if (!isSafeId(id)) throw new Error("Invalid Chatterbox voice id");
    const dir = path.join(this.root, id);
    return {
      dir,
      meta: path.join(dir, "meta.json"),
      upload: path.join(dir, "reference-upload"),
      audio: path.join(dir, "reference.wav")
    };
  }

  private persist(voice: StoredVoice) {
    this.database.upsert({
      id: voice.id,
      kind: "chatterbox-voice",
      payload: voice,
      createdAt: voice.createdAt,
      updatedAt: voice.updatedAt
    });
  }
}

export class ChatterboxBatchStore {
  private readonly batches = new Map<string, ChatterboxBatch>();

  constructor(
    private readonly root: string,
    private readonly database: ToolboxDatabase,
    private readonly taskStore: TaskStore,
    private readonly fileMetadata?: FileMetadataRepository
  ) {}

  async initialize() {
    await fsp.mkdir(this.root, { recursive: true });
    if (!this.database.isDomainInitialized("chatterbox-batch")) {
      for (const entry of await fsp.readdir(this.root, { withFileTypes: true })) {
        if (!entry.isDirectory() || !isSafeId(entry.name)) continue;
        try {
          const batch = JSON.parse(await fsp.readFile(this.paths(entry.name).meta, "utf8")) as ChatterboxBatch;
          if (!isStoredBatch(batch) || batch.id !== entry.name) continue;
          await this.write(batch);
        } catch {
          // Invalid legacy metadata stays untouched for manual recovery.
        }
      }
      this.database.markDomainInitialized("chatterbox-batch");
      this.database.markDomainInitialized("chatterbox-item");
    }
    for (const entity of this.database.list("chatterbox-batch")) {
      const batch = entity.payload as ChatterboxBatch;
      if (!isStoredBatch(batch)) continue;
      for (const item of batch.items) {
        if (item.status === "queued" || item.status === "processing") {
          item.status = "failed";
          item.progress = 100;
          item.error = "INTERRUPTED";
          item.updatedAt = new Date().toISOString();
        }
      }
      batch.referenceAvailable = await fileExists(this.paths(batch.id).reference);
      this.applyAggregate(batch);
      await this.write(batch);
      this.batches.set(batch.id, batch);
    }
  }

  async create(id: string, input: BatchCreateInput, retentionDays: number) {
    const now = new Date();
    const batch: ChatterboxBatch = {
      id,
      engine: "chatterbox-multilingual-v3",
      status: "queued",
      progress: 0,
      name: input.name,
      language: input.language,
      referenceFileName: input.referenceFileName,
      referenceDurationSeconds: input.referenceDurationSeconds,
      referenceRetained: input.referenceRetained,
      referenceAvailable: true,
      authorization: input.authorization,
      consentConfirmed: true,
      exaggeration: input.exaggeration,
      cfgWeight: input.cfgWeight,
      temperature: input.temperature,
      seed: input.seed,
      includeSubtitles: input.includeSubtitles,
      subtitleMode: input.subtitleMode,
      items: input.segments.map((segment, index) => ({
        id: nanoid(10),
        order: index + 1,
        text: segment.text,
        referenceTranslation: segment.referenceTranslation,
        fileName: segment.fileName,
        status: "queued" as const,
        progress: 0,
        attempt: 1,
        characterCount: segment.text.length,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      })),
      totalCharacters: input.segments.reduce((sum, segment) => sum + segment.text.length, 0),
      completedItems: 0,
      failedItems: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + retentionDays * 86_400_000).toISOString()
    };
    await this.write(batch);
    this.batches.set(id, batch);
    return cloneBatch(batch);
  }

  get(id: string) {
    const batch = this.batches.get(id);
    return batch ? cloneBatch(batch) : undefined;
  }

  list() {
    return [...this.batches.values()].map(cloneBatch).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateItem(
    batchId: string,
    itemId: string,
    patch: Partial<ChatterboxBatchItem>,
    options: { deferTerminalStatus?: boolean } = {}
  ) {
    const batch = this.batches.get(batchId);
    const index = batch?.items.findIndex((item) => item.id === itemId) ?? -1;
    if (!batch || index < 0) return undefined;
    const current = batch.items[index];
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    if (patch.error === undefined && (patch.status === "processing" || patch.status === "completed")) delete next.error;
    batch.items[index] = next;
    this.applyAggregate(batch);
    if (
      options.deferTerminalStatus &&
      !batch.items.some((item) => item.status === "queued" || item.status === "processing")
    ) {
      batch.status = "processing";
      batch.progress = 99;
    }
    await this.write(batch);
    return cloneBatch(batch);
  }

  async updateBatch(batchId: string, patch: Partial<ChatterboxBatch>) {
    const batch = this.batches.get(batchId);
    if (!batch) return undefined;
    Object.assign(batch, patch, { updatedAt: new Date().toISOString() });
    await this.write(batch);
    return cloneBatch(batch);
  }

  async recalculate(batchId: string) {
    const batch = this.batches.get(batchId);
    if (!batch) return undefined;
    this.applyAggregate(batch);
    batch.updatedAt = new Date().toISOString();
    await this.write(batch);
    return cloneBatch(batch);
  }

  async reorder(batchId: string, itemIds: string[]) {
    const batch = this.batches.get(batchId);
    if (!batch) throw new Error("批次不存在");
    if (itemIds.length !== batch.items.length || new Set(itemIds).size !== itemIds.length)
      throw new Error("顺序不完整");
    const byId = new Map(batch.items.map((item) => [item.id, item]));
    if (itemIds.some((id) => !byId.has(id))) throw new Error("包含未知文案段");
    batch.items = itemIds.map((id, index) => ({ ...byId.get(id)!, order: index + 1 }));
    batch.updatedAt = new Date().toISOString();
    await this.write(batch);
    return cloneBatch(batch);
  }

  async removeItem(batchId: string, itemId: string) {
    const batch = this.batches.get(batchId);
    if (!batch) return undefined;
    batch.items = batch.items
      .filter((item) => item.id !== itemId)
      .sort((a, b) => a.order - b.order)
      .map((item, index) => ({ ...item, order: index + 1 }));
    await fsp.rm(this.itemPaths(batchId, itemId).dir, { recursive: true, force: true });
    this.applyAggregate(batch);
    batch.updatedAt = new Date().toISOString();
    await this.write(batch);
    return cloneBatch(batch);
  }

  async extendExpiry(batchId: string, retentionDays: number) {
    return this.updateBatch(batchId, { expiresAt: new Date(Date.now() + retentionDays * 86_400_000).toISOString() });
  }

  async remove(id: string) {
    if (!isSafeId(id)) return false;
    const batch = this.batches.get(id);
    this.batches.delete(id);
    this.database.transaction(() => {
      for (const item of batch?.items ?? []) this.database.remove("chatterbox-item", item.id);
      this.database.remove("chatterbox-batch", id);
    });
    this.taskStore.remove(id);
    this.fileMetadata?.removeForEntity("chatterbox-batch", id);
    for (const item of batch?.items ?? []) this.fileMetadata?.removeForEntity("chatterbox-item", item.id);
    await fsp.rm(this.paths(id).dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    return true;
  }

  async cleanupExpired(isActive: (id: string) => boolean = () => false, now = Date.now()) {
    const expired = [...this.batches.values()].filter(
      (batch) => !isActive(batch.id) && Date.parse(batch.expiresAt) <= now
    );
    await Promise.all(expired.map((batch) => this.remove(batch.id)));
    return expired.length;
  }

  paths(id: string) {
    if (!isSafeId(id)) throw new Error("Invalid Chatterbox batch id");
    const dir = path.join(this.root, id);
    return {
      dir,
      meta: path.join(dir, "meta.json"),
      referenceUpload: path.join(dir, "reference-upload"),
      reference: path.join(dir, "reference.wav"),
      combinedAudio: path.join(dir, "combined.mp3"),
      subtitle: path.join(dir, "subtitle.srt"),
      translationSubtitle: path.join(dir, "subtitle.zh-CN.srt"),
      bilingualSubtitle: path.join(dir, "subtitle.bilingual.srt")
    };
  }

  itemPaths(batchId: string, itemId: string) {
    if (!isSafeId(itemId)) throw new Error("Invalid Chatterbox item id");
    const dir = path.join(this.paths(batchId).dir, "items", itemId);
    return {
      dir,
      outputWav: path.join(dir, "output.wav"),
      candidateAudio: path.join(dir, "candidate.mp3"),
      audio: path.join(dir, "audio.mp3"),
      timing: path.join(dir, "timing.json")
    };
  }

  private applyAggregate(batch: ChatterboxBatch) {
    batch.completedItems = batch.items.filter((item) => item.status === "completed").length;
    batch.failedItems = batch.items.filter((item) => item.status === "failed").length;
    batch.totalCharacters = batch.items.reduce((sum, item) => sum + item.characterCount, 0);
    batch.totalAudioBytes = batch.items.reduce((sum, item) => sum + (item.audioBytes || 0), 0) || undefined;
    batch.totalAudioDurationSeconds =
      batch.items.reduce((sum, item) => sum + (item.audioDurationSeconds || 0), 0) || undefined;
    batch.progress = Math.round(
      batch.items.reduce(
        (sum, item) =>
          sum +
          (item.status === "completed" || item.status === "failed" || item.status === "cancelled"
            ? 100
            : item.progress),
        0
      ) / batch.items.length
    );
    batch.status = batchStatus(batch.items);
  }

  private async write(batch: ChatterboxBatch) {
    this.database.transaction(() => {
      this.database.upsert({
        id: batch.id,
        kind: "chatterbox-batch",
        status: batch.status,
        payload: batch,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt
      });
      const itemIds = new Set(batch.items.map((item) => item.id));
      for (const entity of this.database.list("chatterbox-item")) {
        const payload = entity.payload as { batchId?: string };
        if (payload.batchId === batch.id && !itemIds.has(entity.id)) this.database.remove("chatterbox-item", entity.id);
      }
      for (const item of batch.items) {
        this.database.upsert({
          id: item.id,
          kind: "chatterbox-item",
          status: item.status,
          payload: { ...item, batchId: batch.id },
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        });
      }
    });
    await this.registerFiles(batch);
    this.taskStore.upsert(toUnifiedBatchTask(batch));
  }

  private async registerFiles(batch: ChatterboxBatch) {
    if (!this.fileMetadata) return;
    const batchPaths = this.paths(batch.id);
    const files: Array<{ entityKind: string; entityId: string; filePath: string; mediaType: string }> = [
      { entityKind: "chatterbox-batch", entityId: batch.id, filePath: batchPaths.reference, mediaType: "audio/wav" },
      {
        entityKind: "chatterbox-batch",
        entityId: batch.id,
        filePath: batchPaths.combinedAudio,
        mediaType: "audio/mpeg"
      },
      { entityKind: "chatterbox-batch", entityId: batch.id, filePath: batchPaths.subtitle, mediaType: "text/plain" },
      {
        entityKind: "chatterbox-batch",
        entityId: batch.id,
        filePath: batchPaths.translationSubtitle,
        mediaType: "text/plain"
      },
      {
        entityKind: "chatterbox-batch",
        entityId: batch.id,
        filePath: batchPaths.bilingualSubtitle,
        mediaType: "text/plain"
      }
    ];
    for (const item of batch.items) {
      const itemPaths = this.itemPaths(batch.id, item.id);
      files.push(
        { entityKind: "chatterbox-item", entityId: item.id, filePath: itemPaths.outputWav, mediaType: "audio/wav" },
        {
          entityKind: "chatterbox-item",
          entityId: item.id,
          filePath: itemPaths.candidateAudio,
          mediaType: "audio/mpeg"
        },
        { entityKind: "chatterbox-item", entityId: item.id, filePath: itemPaths.audio, mediaType: "audio/mpeg" },
        { entityKind: "chatterbox-item", entityId: item.id, filePath: itemPaths.timing, mediaType: "application/json" }
      );
    }
    await Promise.all(
      files.map((file) => this.fileMetadata!.registerIfExists({ ...file, owner: "local" }).catch(() => undefined))
    );
  }
}

function toUnifiedBatchTask(batch: ChatterboxBatch): Task {
  const status: Task["status"] =
    batch.status === "queued"
      ? "pending"
      : batch.status === "processing"
        ? "running"
        : batch.status === "completed"
          ? "completed"
          : "failed";
  return {
    id: batch.id,
    toolId: "chatterbox-batch",
    status,
    progress: batch.progress,
    outputPath: batch.status === "completed" ? "combined.mp3" : undefined,
    error:
      batch.status === "cancelled"
        ? "CANCELLED"
        : batch.status === "partial_failed"
          ? `${batch.failedItems} 个分段处理失败`
          : undefined,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt
  };
}

function batchStatus(items: ChatterboxBatchItem[]): ChatterboxBatchStatus {
  if (items.some((item) => item.status === "processing")) return "processing";
  if (items.some((item) => item.status === "queued"))
    return items.some((item) => item.status === "completed") ? "processing" : "queued";
  if (items.every((item) => item.status === "completed")) return "completed";
  if (items.some((item) => item.status === "failed")) return "partial_failed";
  return "cancelled";
}

async function fileExists(filePath: string) {
  return fsp.stat(filePath).then(
    (stat) => stat.isFile(),
    () => false
  );
}

function cloneBatch(batch: ChatterboxBatch): ChatterboxBatch {
  return { ...batch, items: batch.items.map((item) => ({ ...item })) };
}

function isStoredBatch(value: unknown): value is ChatterboxBatch {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.engine === "chatterbox-multilingual-v3" &&
    Array.isArray(value.items) &&
    value.items.every(
      (item) =>
        isRecord(item) && typeof item.id === "string" && typeof item.text === "string" && isTaskStatus(item.status)
    )
  );
}

function isStoredVoice(value: unknown): value is StoredVoice {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.durationSeconds === "number" &&
    typeof value.audioBytes === "number" &&
    isAuthorization(value.authorization) &&
    value.consentConfirmed === true &&
    typeof value.createdAt === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTaskStatus(value: unknown): value is ChatterboxTaskStatus {
  return (
    value === "queued" || value === "processing" || value === "completed" || value === "failed" || value === "cancelled"
  );
}

function isAuthorization(value: unknown): value is ChatterboxVoiceAuthorization {
  return value === "self" || value === "authorized";
}

function isSafeId(value: string) {
  return /^[A-Za-z0-9_-]{6,64}$/.test(value);
}
