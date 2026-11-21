import { nanoid } from "nanoid";
import type { ArchiveAnalysisInput, ArchiveAnalysisJob } from "@toolbox/shared";
import { probeMedia, runMediaProcess, VideoEditError, type MediaTools } from "./renderer";
type Source = { file: string; release: () => void };
export class ArchiveCutAnalysis {
  private jobs = new Map<string, ArchiveAnalysisJob>();
  private queue: Array<{ id: string; input: ArchiveAnalysisInput; source: () => Promise<Source> }> = [];
  private running?: { controller: AbortController; done: Promise<void>; id: string };
  private stopped = false;
  constructor(private tools: () => Promise<MediaTools>) {}
  get(id: string) {
    const job = this.jobs.get(id);
    return job ? structuredClone(job) : undefined;
  }
  create(input: ArchiveAnalysisInput, source: () => Promise<Source>) {
    if (this.stopped || this.queue.length >= 4)
      throw new VideoEditError("ARCHIVE_ANALYSIS_BUSY", "检测任务较多，请稍后重试", 429);
    if (input.end <= input.start) throw new VideoEditError("ARCHIVE_ANALYSIS_RANGE", "检测终点须晚于起点");
    const id = nanoid(12);
    this.jobs.set(id, {
      id,
      kind: input.kind,
      status: "pending",
      progress: 0,
      message: "等待检测",
      scenes: [],
      silence: []
    });
    for (const [key, job] of this.jobs) {
      if (this.jobs.size <= 100) break;
      if (!["pending", "running"].includes(job.status)) this.jobs.delete(key);
    }
    this.queue.push({ id, input: structuredClone(input), source });
    this.pump();
    return this.get(id)!;
  }
  async cancel(id: string) {
    const index = this.queue.findIndex((entry) => entry.id === id);
    if (index >= 0) {
      this.queue.splice(index, 1);
      Object.assign(this.jobs.get(id)!, { status: "cancelled", message: "检测已停止" });
    }
    if (this.running?.id === id) {
      this.running.controller.abort();
      await this.running.done;
    }
    return this.get(id);
  }
  async close() {
    this.stopped = true;
    this.queue = [];
    this.running?.controller.abort();
    await this.running?.done;
  }
  private pump() {
    if (this.stopped || this.running || !this.queue.length) return;
    const work = this.queue.shift()!,
      controller = new AbortController();
    const done = this.run(work.id, work.input, work.source, controller.signal).finally(() => {
      this.running = undefined;
      this.pump();
    });
    this.running = { id: work.id, controller, done };
  }
  private async run(id: string, input: ArchiveAnalysisInput, acquire: () => Promise<Source>, signal: AbortSignal) {
    const job = this.jobs.get(id)!;
    let source: Source | undefined;
    try {
      job.status = "running";
      job.message = "正在检测";
      source = await acquire();
      signal.throwIfAborted();
      const tools = await this.tools();
      const info = await probeMedia(tools, source.file, signal, true);
      if (input.end > info.duration + 0.001) throw new VideoEditError("ARCHIVE_ANALYSIS_RANGE", "检测区间超出原片范围");
      if (input.kind === "silence" && !info.hasAudio) {
        job.status = "completed";
        job.progress = 100;
        job.message = "该片段没有音轨";
        return;
      }
      let tail = "",
        silenceStart: number | undefined;
      const consume = (line: string) => {
        if (input.kind === "scenes") {
          const match = /pts_time:([\d.]+)/.exec(line);
          if (match && job.scenes.length < 5000) {
            const time = input.start + Number(match[1]);
            if (time > input.start && time < input.end) job.scenes.push(time);
          }
        } else {
          const start = /silence_start: ([\d.]+)/.exec(line),
            end = /silence_end: ([\d.]+)/.exec(line);
          if (start) silenceStart = input.start + Number(start[1]);
          if (end && silenceStart !== undefined && job.silence.length < 5000) {
            job.silence.push({
              start: Math.max(input.start, silenceStart),
              end: Math.min(input.end, input.start + Number(end[1]))
            });
            silenceStart = undefined;
          }
        }
      };
      const filter =
        input.kind === "scenes"
          ? ["-vf", `setpts=PTS-STARTPTS,select='gt(scene,${input.sceneThreshold})',showinfo`, "-an"]
          : ["-af", `asetpts=PTS-STARTPTS,silencedetect=noise=${input.silenceDb}dB:d=${input.minSilence}`, "-vn"];
      await runMediaProcess(
        tools.ffmpeg,
        [
          "-hide_banner",
          "-v",
          "info",
          "-nostdin",
          "-protocol_whitelist",
          "file,pipe",
          "-ss",
          String(input.start),
          "-t",
          String(input.end - input.start),
          "-i",
          source.file,
          ...filter,
          "-nostats",
          "-progress",
          "pipe:1",
          "-f",
          "null",
          "-"
        ],
        signal,
        {
          onOutput: (chunk) => {
            for (const match of chunk.matchAll(/out_time_us=(\d+)/g))
              job.progress = Math.min(99, (Number(match[1]) / 1000000 / (input.end - input.start)) * 100);
          },
          onDiagnostic: (chunk) => {
            const lines = (tail + chunk).split(/\r?\n/);
            tail = (lines.pop() ?? "").slice(-8192);
            lines.forEach(consume);
          }
        }
      );
      consume(tail);
      if (silenceStart !== undefined && job.silence.length < 5000)
        job.silence.push({ start: silenceStart, end: input.end });
      job.status = "completed";
      job.progress = 100;
      job.message =
        input.kind === "scenes" ? `检测到 ${job.scenes.length} 个场景切点` : `检测到 ${job.silence.length} 段静音`;
    } catch (error) {
      job.status = signal.aborted ? "cancelled" : "failed";
      job.message = signal.aborted
        ? "检测已停止"
        : error instanceof VideoEditError
          ? error.message
          : "检测失败，请重试";
    } finally {
      source?.release();
    }
  }
}
