/**
 * 中文模块说明：局域网传输前端模块，负责文件、图文、分片上传和批量管理
 */
import { lanTransferApi } from "./api";
import type { LanUploadResponse, LanUploadStatus } from "./types";

const DEFAULT_LAN_CHUNK_SIZE = 8 * 1024 * 1024;
export const DEFAULT_LAN_UPLOAD_CONCURRENCY = 3;
const DEFAULT_LAN_CHUNK_MAX_RETRIES = 3;
const DEFAULT_LAN_CHUNK_RETRY_DELAY_MS = 800;

export type ChunkUploadApi = {
  createUploadSession(
    input: {
      originalName: string;
      mimeType: string;
      size: number;
      chunkSize: number;
      totalChunks: number;
    },
    signal?: AbortSignal
  ): Promise<LanUploadStatus>;
  getUploadStatus(uploadId: string, signal?: AbortSignal): Promise<LanUploadStatus>;
  uploadChunk(
    uploadId: string,
    index: number,
    chunk: Blob,
    onUploadProgress?: (event: { loaded: number; total?: number }) => void,
    signal?: AbortSignal
  ): Promise<LanUploadStatus>;
  completeUpload(uploadId: string, signal?: AbortSignal): Promise<LanUploadResponse>;
  cancelUpload(uploadId: string, signal?: AbortSignal): Promise<{ removed: boolean }>;
};

type ChunkUploadSnapshot = {
  uploadId?: string;
  fileName: string;
  progress: number;
  status: "uploading" | "paused" | "done" | "failed" | "canceled";
  uploadedChunks: number[];
  totalChunks: number;
};

type ChunkUploadResult = {
  status: ChunkUploadSnapshot["status"];
  response?: LanUploadResponse;
};

type ChunkUploaderOptions = {
  chunkSize?: number;
  concurrency?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  uploadId?: string;
  signal?: AbortSignal;
};

type ProgressListener = (snapshot: ChunkUploadSnapshot) => void;

export class ConcurrentChunkUploader {
  private uploadId?: string;
  private uploadedChunks = new Set<number>();
  private inFlightBytes = new Map<number, number>();
  private paused = false;
  private canceled = false;
  private listeners: ProgressListener[] = [];
  private readonly chunkSize: number;
  private readonly concurrency: number;
  private readonly totalChunks: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private activeRun?: Promise<ChunkUploadResult>;
  private abortControllers = new Map<number, AbortController>();
  private disposed = false;
  private readonly scopeSignal?: AbortSignal;

  constructor(
    private readonly file: File,
    private readonly api: ChunkUploadApi = lanTransferApi,
    options: ChunkUploaderOptions = {}
  ) {
    this.chunkSize = options.chunkSize ?? DEFAULT_LAN_CHUNK_SIZE;
    this.concurrency = Math.max(1, options.concurrency ?? DEFAULT_LAN_UPLOAD_CONCURRENCY);
    this.maxRetries = Math.max(0, options.maxRetries ?? DEFAULT_LAN_CHUNK_MAX_RETRIES);
    this.retryDelayMs = Math.max(0, options.retryDelayMs ?? DEFAULT_LAN_CHUNK_RETRY_DELAY_MS);
    this.uploadId = options.uploadId;
    this.totalChunks = Math.ceil(file.size / this.chunkSize);
    this.scopeSignal = options.signal;
    // 外层页面的 AbortSignal 只负责停止本地任务，不取消服务端会话，便于稍后断点续传。
    if (options.signal?.aborted) {
      this.dispose();
    } else {
      options.signal?.addEventListener("abort", () => this.dispose(), { once: true });
    }
  }

  onProgress(listener: ProgressListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener);
    };
  }

  pause() {
    if (this.paused) {
      return;
    }
    this.paused = true;
    // 中止当前网络请求后保留已确认分片，resume() 会重新查询服务端状态并跳过这些分片。
    this.abortInFlight();
    this.emit("paused");
  }

  async resume() {
    this.paused = false;
    return this.start();
  }

  async cancel() {
    if (this.disposed) return;
    this.canceled = true;
    this.paused = false;
    // 用户主动取消才删除服务端会话；页面卸载调用 dispose() 时刻意保留会话。
    this.abortInFlight();
    if (this.uploadId) {
      await this.api.cancelUpload(this.uploadId);
    }
    this.emit("canceled");
  }

  /** Stop local work on route disposal without deleting the resumable session. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.canceled = true;
    this.paused = false;
    this.abortInFlight();
    this.emit("canceled");
  }

  async start(): Promise<ChunkUploadResult> {
    if (this.activeRun) {
      return this.activeRun;
    }

    this.activeRun = this.run();
    try {
      return await this.activeRun;
    } finally {
      this.activeRun = undefined;
    }
  }

  private async run(): Promise<ChunkUploadResult> {
    if (this.disposed) return { status: "canceled" };
    this.paused = false;
    this.canceled = false;
    // 每次启动先同步服务端已上传分片，避免浏览器刷新或网络重试造成重复传输。
    await this.ensureSession();
    if (this.disposed) return { status: "canceled" };
    this.emit("uploading");

    const queue = this.createMissingChunkQueue();
    const result = await this.runQueue(queue);

    if (result.status !== "done") {
      return result;
    }

    const response = await this.api.completeUpload(this.uploadId!, this.scopeSignal);
    this.emit("done");
    return {
      status: "done",
      response
    };
  }

  private async ensureSession() {
    let status: LanUploadStatus;
    if (this.uploadId) {
      try {
        // 恢复已有会话时以服务端状态为准；会话过期才创建新会话。
        status = await this.api.getUploadStatus(this.uploadId, this.scopeSignal);
      } catch (error) {
        if (!isUploadNotFoundError(error)) throw error;
        this.uploadId = undefined;
        status = await this.createSession();
      }
    } else {
      status = await this.createSession();
    }

    this.uploadId = status.uploadId;
    this.syncUploadedChunks(status.uploadedChunks);
  }

  private createSession() {
    return this.api.createUploadSession(
      {
        originalName: this.file.name,
        mimeType: this.file.type || "application/octet-stream",
        size: this.file.size,
        chunkSize: this.chunkSize,
        totalChunks: this.totalChunks
      },
      this.scopeSignal
    );
  }

  private createMissingChunkQueue() {
    return Array.from({ length: this.totalChunks }, (_, index) => index).filter(
      (index) => !this.uploadedChunks.has(index)
    );
  }

  private runQueue(queue: number[]) {
    return new Promise<ChunkUploadResult>((resolve, reject) => {
      if (queue.length === 0) {
        resolve({ status: "done" });
        return;
      }

      let cursor = 0;
      let active = 0;
      let settled = false;

      const settle = (result: ChunkUploadResult) => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };

      const launch = () => {
        if (settled) {
          return;
        }

        if (this.canceled) {
          settle({ status: "canceled" });
          return;
        }

        if (this.paused && active === 0) {
          settle({ status: "paused" });
          return;
        }

        // 仅维持固定数量的并发分片；暂停或取消后不再发起新请求，已在途请求由 abortInFlight 收敛。
        while (!this.paused && !this.canceled && active < this.concurrency && cursor < queue.length) {
          const chunkIndex = queue[cursor];
          cursor += 1;
          active += 1;
          this.uploadChunk(chunkIndex)
            .catch((error) => {
              if (!this.paused && !this.canceled) {
                settled = true;
                reject(error);
              }
            })
            .finally(() => {
              active -= 1;
              this.inFlightBytes.delete(chunkIndex);

              if (settled) {
                return;
              }

              if (cursor >= queue.length && active === 0) {
                settle({ status: this.canceled ? "canceled" : this.paused ? "paused" : "done" });
                return;
              }

              launch();
            });
        }
      };

      launch();
    });
  }

  private async uploadChunk(index: number) {
    const start = index * this.chunkSize;
    const end = Math.min(start + this.chunkSize, this.file.size);
    const chunk = this.file.slice(start, end);
    let status: LanUploadStatus | undefined;

    // 单个分片采用线性退避重试；暂停、取消和达到上限时立即把错误交给队列状态机处理。
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const controller = new AbortController();
        this.abortControllers.set(index, controller);
        status = await this.api.uploadChunk(
          this.uploadId!,
          index,
          chunk,
          (event) => {
            this.inFlightBytes.set(index, event.loaded);
            this.emit("uploading");
          },
          controller.signal
        );
        this.abortControllers.delete(index);
        break;
      } catch (error) {
        this.abortControllers.delete(index);
        this.inFlightBytes.delete(index);
        if (this.paused || this.canceled || attempt >= this.maxRetries) {
          throw error;
        }
        await delay(this.retryDelayMs * (attempt + 1));
      }
    }

    if (!status) {
      throw new Error("Chunk upload failed");
    }

    this.syncUploadedChunks(status.uploadedChunks);
    this.inFlightBytes.delete(index);
    // 只有服务端确认后才计入进度，避免把尚未落盘的浏览器上传字节误报为完成。
    this.emit("uploading");
  }

  private syncUploadedChunks(chunks: number[]) {
    for (const chunk of chunks) {
      this.uploadedChunks.add(chunk);
    }
  }

  private emit(status: ChunkUploadSnapshot["status"]) {
    const snapshot = this.snapshot(status);
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private snapshot(status: ChunkUploadSnapshot["status"]): ChunkUploadSnapshot {
    // 进度由已确认分片和在途字节合并计算，并限制在文件大小以内，避免重试导致进度倒退或超过 100%。
    const confirmedBytes = Array.from(this.uploadedChunks).reduce(
      (total, index) => total + this.getChunkSize(index),
      0
    );
    const inFlightBytes = Array.from(this.inFlightBytes.values()).reduce((total, value) => total + value, 0);
    const loadedBytes = Math.min(this.file.size, confirmedBytes + inFlightBytes);

    return {
      uploadId: this.uploadId,
      fileName: this.file.name,
      progress: this.file.size ? Math.round((loadedBytes / this.file.size) * 100) : 100,
      status,
      uploadedChunks: Array.from(this.uploadedChunks).sort((a, b) => a - b),
      totalChunks: this.totalChunks
    };
  }

  private getChunkSize(index: number) {
    if (index === this.totalChunks - 1) {
      return this.file.size - this.chunkSize * (this.totalChunks - 1);
    }
    return this.chunkSize;
  }

  private abortInFlight() {
    for (const controller of this.abortControllers.values()) controller.abort();
    this.abortControllers.clear();
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isUploadNotFoundError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "UPLOAD_NOT_FOUND";
}
