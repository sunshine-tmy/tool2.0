/**
 * 中文模块说明：Edge-TTS 配音领域，负责任务、Worker 网关、文件和队列
 */
import type { AppConfig } from "../../config";
import { EdgeTtsTaskRepository } from "./task-repository";
import { readableRunnerError, EdgeTtsWorkerGateway } from "./worker-gateway";

export class EdgeTtsQueue {
  private readonly pending: string[] = [];
  private readonly active = new Map<string, { controller: AbortController; done: Promise<void> }>();
  private stopped = false;

  constructor(
    private readonly options: {
      config: AppConfig;
      store: EdgeTtsTaskRepository;
      runner: EdgeTtsWorkerGateway;
    }
  ) {}

  enqueue(id: string) {
    if (this.stopped || this.pending.includes(id) || this.active.has(id)) return;
    this.pending.push(id);
    this.pump();
  }

  async cancel(id: string) {
    const index = this.pending.indexOf(id);
    if (index >= 0) this.pending.splice(index, 1);
    const job = this.active.get(id);
    if (!job) return;
    job.controller.abort();
    await job.done;
  }

  stats() {
    return { active: this.active.size, queued: this.pending.length };
  }

  async close() {
    this.stopped = true;
    this.pending.length = 0;
    for (const job of this.active.values()) job.controller.abort();
    await Promise.allSettled(Array.from(this.active.values(), (job) => job.done));
  }

  private pump() {
    while (!this.stopped && this.active.size < this.options.config.edgeTtsConcurrency && this.pending.length) {
      const id = this.pending.shift();
      if (!id) break;
      const controller = new AbortController();
      const done = this.process(id, controller).finally(() => {
        this.active.delete(id);
        this.pump();
      });
      this.active.set(id, { controller, done });
    }
  }

  private async process(id: string, controller: AbortController) {
    const task = this.options.store.get(id);
    if (!task || task.status !== "queued") return;
    await this.options.store.update(id, { status: "processing", progress: 15 });
    try {
      const result = await this.options.runner.generate(task, this.options.store.paths(id), controller.signal);
      await this.options.store.update(id, {
        status: "completed",
        progress: 100,
        audioBytes: result.audioBytes,
        error: undefined
      });
    } catch (error) {
      if (!this.options.store.get(id)) return;
      const cancelled = controller.signal.aborted;
      await this.options.store.update(id, {
        status: cancelled ? "cancelled" : "failed",
        progress: cancelled ? 0 : 100,
        error: cancelled ? "任务已取消" : readableRunnerError(error)
      });
    }
  }
}
