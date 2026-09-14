import fsp from "node:fs/promises";
import { ChatterboxWorkerError, createChatterboxWorkerClient } from "./worker-client";
import type { ChatterboxMediaTools } from "./media-tools";
import { writeSubtitle } from "./subtitle";
import type { ChatterboxTaskStore } from "./task-store";

export class ChatterboxQueue {
  private readonly pending: string[] = [];
  private activeId: string | undefined;

  constructor(
    private readonly options: {
      store: ChatterboxTaskStore;
      worker: ReturnType<typeof createChatterboxWorkerClient>;
      media: ChatterboxMediaTools;
    }
  ) {}

  enqueue(id: string) {
    if (this.pending.includes(id) || this.activeId === id) return;
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

  private pump() {
    if (this.activeId || !this.pending.length) return;
    const id = this.pending.shift();
    if (!id) return;
    this.activeId = id;
    void this.process(id).finally(() => {
      this.activeId = undefined;
      this.pump();
    });
  }

  private async process(id: string) {
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
        seed: task.seed
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
