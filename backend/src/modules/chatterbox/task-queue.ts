/**
 * 中文模块说明：Chatterbox 配音领域，负责批次、音色、任务队列和音频产物
 */
import fsp from "node:fs/promises";
import { ChatterboxWorkerError, createChatterboxWorkerClient } from "./worker-client";
import type { ChatterboxMediaTools } from "./media-tools";
import { writeSubtitle } from "./subtitle";
import type { ChatterboxTaskStore } from "./task-store";

export class ChatterboxQueue {
  private readonly pending: string[] = [];
  private activeId: string | undefined;
  private activeController: AbortController | undefined;
  private activeDone: Promise<void> | undefined;
  private stopped = false;

  constructor(
    private readonly options: {
      store: ChatterboxTaskStore;
      worker: ReturnType<typeof createChatterboxWorkerClient>;
      media: ChatterboxMediaTools;
    }
  ) {}

  enqueue(id: string) {
    if (this.stopped || this.pending.includes(id) || this.activeId === id) return;
    this.pending.push(id);
    this.pump();
  }

  removePending(id: string) {
    const index = this.pending.indexOf(id);
    if (index >= 0) this.pending.splice(index, 1);
  }

  isActive(id: string) {
    return this.activeId === id;
  }

  stats() {
    return { active: this.activeId ? 1 : 0, queued: this.pending.length };
  }

  async close() {
    this.stopped = true;
    this.pending.length = 0;
    this.activeController?.abort();
    await this.activeDone;
  }

  private pump() {
    if (this.stopped || this.activeId || !this.pending.length) return;
    const id = this.pending.shift();
    if (!id) return;
    this.activeId = id;
    this.activeController = new AbortController();
    const done = this.process(id, this.activeController.signal).finally(() => {
      this.activeId = undefined;
      this.activeController = undefined;
      this.activeDone = undefined;
      this.pump();
    });
    this.activeDone = done;
    void done;
  }

  private async process(id: string, signal: AbortSignal) {
    const task = this.options.store.get(id);
    if (!task || task.status !== "queued") return;
    const paths = this.options.store.paths(id);
    await this.options.store.update(id, { status: "processing", progress: 10 });
    try {
      const result = await this.options.worker.generate({
        text: task.text,
        language: task.language,
        referencePath: paths.reference,
        outputPath: paths.outputWav,
        exaggeration: task.exaggeration,
        cfgWeight: task.cfgWeight,
        temperature: task.temperature,
        seed: task.seed,
        signal
      });
      await this.options.store.update(id, { progress: 82 });
      await this.options.media.toMp3(paths.outputWav, paths.audio);
      const audioBytes = (await fsp.stat(paths.audio)).size;
      const duration = await this.options.media.duration(paths.audio);
      if (task.includeSubtitles) await writeSubtitle(paths.subtitle, task.text, duration, result.segments);
      await this.options.store.update(id, {
        status: "completed",
        progress: 100,
        audioBytes,
        audioDurationSeconds: result.durationSeconds || duration,
        error: undefined
      });
    } catch (error) {
      await this.options.store.update(id, {
        status: "failed",
        progress: 100,
        error: readableGenerationError(error)
      });
    } finally {
      await Promise.all([
        fsp.rm(paths.referenceUpload, { force: true }),
        fsp.rm(paths.reference, { force: true }),
        fsp.rm(paths.outputWav, { force: true })
      ]);
    }
  }
}

function readableGenerationError(error: unknown) {
  if (error instanceof ChatterboxWorkerError) return error.message;
  return `声音克隆失败：${error instanceof Error ? error.message.slice(0, 300) : "未知错误"}`;
}
