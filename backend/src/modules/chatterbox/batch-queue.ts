import fsp from "node:fs/promises";
import path from "node:path";
import type { ChatterboxBatch } from "@toolbox/shared";
import type { AppConfig } from "../../config";
import { BatchInputError, readableBatchError } from "./errors";
import type { ChatterboxBatchStore } from "./stores";
import type { createChatterboxWorkerClient } from "./worker-client";

type WorkerClient = ReturnType<typeof createChatterboxWorkerClient>;

export type ChatterboxMediaTools = {
  normalizeReference(inputPath: string, outputPath: string): Promise<number>;
  toMp3(inputPath: string, outputPath: string): Promise<void>;
  concatMp3(inputPaths: string[], outputPath: string): Promise<void>;
  duration(filePath: string): Promise<number>;
};

export class ChatterboxBatchQueue {
  private readonly pending: Array<{ batchId: string; itemId: string }> = [];
  private active: { batchId: string; itemId: string } | undefined;
  private activeController: AbortController | undefined;
  private activeDone: Promise<void> | undefined;
  private stopped = false;

  constructor(
    private readonly options: {
      config: AppConfig;
      store: ChatterboxBatchStore;
      worker: WorkerClient;
      media: ChatterboxMediaTools;
      rebuildAudio(batch: ChatterboxBatch): Promise<void>;
      rebuildSubtitles(batch: ChatterboxBatch): Promise<void>;
    }
  ) {}

  enqueue(batchId: string, itemId: string) {
    if (
      this.stopped ||
      this.isActive(batchId, itemId) ||
      this.pending.some((entry) => entry.batchId === batchId && entry.itemId === itemId)
    ) {
      return;
    }
    this.pending.push({ batchId, itemId });
    this.pump();
  }

  stats() {
    return { active: this.active ? 1 : 0, queued: this.pending.length };
  }

  isActive(batchId: string, itemId: string) {
    return this.active?.batchId === batchId && this.active.itemId === itemId;
  }

  hasActiveBatch(batchId: string) {
    return this.active?.batchId === batchId;
  }

  removePending(batchId: string, itemId: string) {
    const index = this.pending.findIndex((entry) => entry.batchId === batchId && entry.itemId === itemId);
    if (index >= 0) this.pending.splice(index, 1);
  }

  cancelPendingBatch(batchId: string) {
    for (let index = this.pending.length - 1; index >= 0; index -= 1) {
      if (this.pending[index].batchId === batchId) this.pending.splice(index, 1);
    }
  }

  async close() {
    this.stopped = true;
    this.pending.length = 0;
    this.activeController?.abort();
    await this.activeDone;
  }

  private pump() {
    if (this.stopped || this.active || !this.pending.length) return;
    const next = this.pending.shift();
    if (!next) return;
    this.active = next;
    this.activeController = new AbortController();
    const done = this.process(next.batchId, next.itemId, this.activeController.signal)
      .then(
        () => this.finish(next),
        () => this.finish(next)
      )
      .finally(() => {
        this.activeController = undefined;
        this.activeDone = undefined;
      });
    this.activeDone = done;
    void done;
  }

  private async finish(entry: { batchId: string; itemId: string }) {
    if (this.active?.batchId === entry.batchId && this.active.itemId === entry.itemId) {
      this.active = undefined;
    }
    await this.options.store.recalculate(entry.batchId).catch(() => undefined);
    this.pump();
  }

  private async process(batchId: string, itemId: string, signal: AbortSignal) {
    const batch = this.options.store.get(batchId);
    const item = batch?.items.find((entry) => entry.id === itemId);
    if (!batch || !item || item.status !== "queued") return;
    const batchPaths = this.options.store.paths(batchId);
    const itemPaths = this.options.store.itemPaths(batchId, itemId);
    const hadAudio = Boolean(item.audioBytes && (await fileExists(itemPaths.audio)));
    await fsp.mkdir(itemPaths.dir, { recursive: true });
    await this.options.store.updateItem(batchId, itemId, { status: "processing", progress: 10, error: undefined });
    try {
      if (!(await fileExists(batchPaths.reference))) {
        throw new BatchInputError("CHATTERBOX_REFERENCE_REQUIRED", "参考音色已删除，请重新上传后再生成", 409);
      }
      const result = await this.options.worker.generate({
        text: item.text,
        language: batch.language,
        referencePath: batchPaths.reference,
        outputPath: itemPaths.outputWav,
        exaggeration: item.exaggeration ?? batch.exaggeration,
        cfgWeight: item.cfgWeight ?? batch.cfgWeight,
        temperature: item.temperature ?? batch.temperature,
        seed: item.seed ?? batch.seed,
        signal
      });
      await this.options.store.updateItem(batchId, itemId, { progress: 82 });
      await this.options.media.toMp3(itemPaths.outputWav, itemPaths.candidateAudio);
      const audioBytes = (await fsp.stat(itemPaths.candidateAudio)).size;
      const audioDurationSeconds = await this.options.media.duration(itemPaths.candidateAudio);
      await replaceFile(itemPaths.candidateAudio, itemPaths.audio);
      await writeJsonAtomic(itemPaths.timing, result.segments);
      const preparedBatch = await this.options.store.updateItem(batchId, itemId, {
        status: "processing",
        progress: 99,
        audioBytes,
        audioDurationSeconds,
        error: undefined
      });
      const completedSnapshot = preparedBatch
        ? {
            ...preparedBatch,
            items: preparedBatch.items.map((entry) =>
              entry.id === itemId ? { ...entry, status: "completed" as const, progress: 100 } : entry
            )
          }
        : undefined;
      if (completedSnapshot?.items.every((entry) => entry.status === "completed")) {
        if (completedSnapshot.items.length > 1) {
          await this.options.rebuildAudio(completedSnapshot);
        }
        if (completedSnapshot.includeSubtitles) {
          await this.options.rebuildSubtitles(completedSnapshot);
        }
      }
      await this.options.store.updateItem(
        batchId,
        itemId,
        { status: "completed", progress: 100 },
        { deferTerminalStatus: true }
      );
    } catch (error) {
      await this.options.store.updateItem(
        batchId,
        itemId,
        hadAudio
          ? { status: "completed", progress: 100, error: `重新生成失败：${readableBatchError(error)}` }
          : { status: "failed", progress: 100, error: readableBatchError(error) },
        { deferTerminalStatus: true }
      );
    } finally {
      await Promise.all([
        fsp.rm(itemPaths.outputWav, { force: true }),
        fsp.rm(itemPaths.candidateAudio, { force: true })
      ]);
      const snapshot = this.options.store.get(batchId);
      if (snapshot && !snapshot.items.some((entry) => entry.status === "queued" || entry.status === "processing")) {
        if (!snapshot.referenceRetained) {
          await fsp.rm(batchPaths.reference, { force: true });
          await this.options.store.updateBatch(batchId, { referenceAvailable: false });
        }
      }
    }
  }
}

async function replaceFile(source: string, target: string) {
  const backup = `${target}.backup`;
  await fsp.rm(backup, { force: true });
  const hadTarget = await fileExists(target);
  if (hadTarget) await fsp.rename(target, backup);
  try {
    await fsp.rename(source, target);
    await fsp.rm(backup, { force: true });
  } catch (error) {
    if (hadTarget && (await fileExists(backup))) await fsp.rename(backup, target);
    throw error;
  }
}

async function fileExists(filePath: string) {
  return fsp.stat(filePath).then(
    (stat) => stat.isFile(),
    () => false
  );
}

async function writeJsonAtomic(filePath: string, value: unknown) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(temp, JSON.stringify(value, null, 2), "utf8");
  await fsp.rename(temp, filePath);
}
