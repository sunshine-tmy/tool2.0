/** FIFO gate for Windows CUDA and Mac for heavyweight model work performed by local AI workers. */
export type InferenceResourceKind = "image-ai" | "chatterbox" | "video-ai";

export type InferenceWorkerControl = {
  configured: () => boolean;
  health: () => Promise<unknown>;
  unload: () => Promise<unknown>;
  restart: () => Promise<void>;
};

export type InferenceResourceCoordinatorOptions = {
  enabled: boolean;
  workers: Record<InferenceResourceKind, InferenceWorkerControl>;
  unloadTimeoutMs?: number;
};

export type InferenceResourceLease = { release: () => Promise<void> };

type Waiter = {
  id: number;
  kind: InferenceResourceKind;
  signal?: AbortSignal;
  onWaiting?: (waiting: boolean) => void;
  resolve: (lease: InferenceResourceLease) => void;
  reject: (error: Error) => void;
  onAbort?: () => void;
};

const resourceKinds: readonly InferenceResourceKind[] = ["image-ai", "chatterbox", "video-ai"];
const releasedLease: InferenceResourceLease = { release: async () => undefined };

export class InferenceResourceError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "InferenceResourceError";
  }
}

/**
 * A single API-process queue shared by image, speech, video and model deep checks.
 * It never unloads the active worker. The previous idle worker is unloaded only
 * when the next request needs a different model class.
 */
export function createInferenceResourceCoordinator(options: InferenceResourceCoordinatorOptions) {
  const queue: Waiter[] = [];
  const workers = options.workers;
  const unloadTimeoutMs = options.unloadTimeoutMs ?? 15_000;
  let nextWaiterId = 1;
  let active: { id: number; kind: InferenceResourceKind } | undefined;
  let lastResource: InferenceResourceKind | undefined;
  let deadResource: InferenceResourceKind | undefined;
  let pumping = false;
  let closed = false;
  let resumePending = false;
  let retryTimer: NodeJS.Timeout | undefined;

  function acquire(
    kind: InferenceResourceKind,
    options: { signal?: AbortSignal; onWaiting?: (waiting: boolean) => void } = {}
  ): Promise<InferenceResourceLease> {
    if (!resourceKinds.includes(kind))
      return Promise.reject(new InferenceResourceError("RESOURCE_UNKNOWN", "未知的推理资源类别"));
    if (!coordinatorEnabled) return Promise.resolve(releasedLease);
    if (closed)
      return Promise.reject(new InferenceResourceError("RESOURCE_COORDINATOR_CLOSED", "推理资源协调器已关闭"));
    if (options.signal?.aborted) return Promise.reject(cancelledError());

    return new Promise<InferenceResourceLease>((resolve, reject) => {
      const waiter: Waiter = {
        id: nextWaiterId++,
        kind,
        signal: options.signal,
        onWaiting: options.onWaiting,
        resolve,
        reject
      };
      waiter.onAbort = () => {
        const index = queue.indexOf(waiter);
        if (index < 0) return;
        queue.splice(index, 1);
        options.signal?.removeEventListener("abort", waiter.onAbort!);
        waiter.reject(cancelledError());
        try {
          waiter.onWaiting?.(false);
        } catch {
          // Progress reporting must not affect queue ownership.
        }
        pump();
      };
      options.signal?.addEventListener("abort", waiter.onAbort, { once: true });
      queue.push(waiter);
      if (active || pumping || queue.length > 1) {
        try {
          waiter.onWaiting?.(true);
        } catch {
          // Progress reporting must not affect queue ownership.
        }
      }
      pump();
    });
  }

  async function run<T>(
    kind: InferenceResourceKind,
    work: () => Promise<T>,
    options: { signal?: AbortSignal; onWaiting?: (waiting: boolean) => void } = {}
  ): Promise<T> {
    const lease = await acquire(kind, options);
    try {
      return await work();
    } catch (error) {
      if (isConnectionRefused(error)) deadResource = kind;
      throw error;
    } finally {
      await lease.release();
    }
  }

  /** Called by the desktop host on Electron's native powerMonitor resume event. */
  function notifyResume() {
    if (!coordinatorEnabled || closed) return Promise.resolve();
    resumePending = true;
    pump();
    return Promise.resolve();
  }

  async function close() {
    if (!coordinatorEnabled || closed) return;
    closed = true;
    if (retryTimer) clearTimeout(retryTimer);
    const pending = queue.splice(0);
    for (const waiter of pending) {
      waiter.signal?.removeEventListener("abort", waiter.onAbort!);
      try {
        waiter.onWaiting?.(false);
      } catch {
        // Progress reporting must not affect shutdown.
      }
      waiter.reject(new InferenceResourceError("RESOURCE_COORDINATOR_CLOSED", "应用正在退出，推理任务已停止排队"));
    }
    // Domain queues close first and wait for the active call; this is a guard for
    // unexpected direct users and prevents granting work during API shutdown.
    while (active || pumping) await new Promise((resolve) => setTimeout(resolve, 10));
  }

  function snapshot() {
    return {
      enabled: coordinatorEnabled,
      active: active?.kind ?? null,
      queued: queue.map((waiter) => waiter.kind),
      lastResource: lastResource ?? null,
      resumePending,
      closed
    };
  }

  const coordinatorEnabled = options.enabled;

  async function pump() {
    if (!coordinatorEnabled || closed || active || pumping || (!queue.length && !resumePending && !deadResource))
      return;
    pumping = true;
    try {
      while (!closed && !active && (queue.length || resumePending || deadResource)) {
        if (!queue.length) {
          if (resumePending) {
            try {
              await recoverAfterResume();
            } catch {
              scheduleRetry();
              break;
            }
          }
          if (deadResource) {
            try {
              await restartDeadWorker(deadResource);
              deadResource = undefined;
            } catch {
              scheduleRetry();
              break;
            }
          }
          break;
        }
        const waiter = queue[0];
        if (waiter.signal?.aborted) {
          queue.shift();
          waiter.signal.removeEventListener("abort", waiter.onAbort!);
          waiter.reject(cancelledError());
          continue;
        }

        try {
          if (resumePending || deadResource || (lastResource && lastResource !== waiter.kind)) {
            try {
              waiter.onWaiting?.(true);
            } catch {
              // Progress reporting must not affect queue ownership.
            }
          }
          if (resumePending) await recoverAfterResume();
          if (deadResource) {
            await restartDeadWorker(deadResource);
            deadResource = undefined;
          }
          if (lastResource && lastResource !== waiter.kind) {
            await unloadOrRecover(lastResource);
            lastResource = undefined;
          }
        } catch (error) {
          const failure = asError(error, "推理 Worker 无法安全释放资源");
          if (isTransientHealthFailure(failure)) {
            resumePending = true;
            scheduleRetry();
            break;
          }
          queue.shift();
          waiter.signal?.removeEventListener("abort", waiter.onAbort!);
          try {
            waiter.onWaiting?.(false);
          } catch {
            // Progress reporting must not affect queue ownership.
          }
          waiter.reject(failure);
          // Any uncertain worker state must not release another model into memory.
          resumePending = true;
          scheduleRetry();
          break;
        }

        if (closed) break;
        if (waiter.signal?.aborted) {
          queue.shift();
          waiter.signal.removeEventListener("abort", waiter.onAbort!);
          waiter.reject(cancelledError());
          continue;
        }

        queue.shift();
        waiter.signal?.removeEventListener("abort", waiter.onAbort!);
        active = { id: waiter.id, kind: waiter.kind };
        lastResource = waiter.kind;
        try {
          waiter.onWaiting?.(false);
        } catch {
          // Progress reporting must not affect queue ownership.
        }
        let released = false;
        waiter.resolve({
          release: async () => {
            if (released) return;
            released = true;
            if (active?.id === waiter.id) active = undefined;
            await pump();
          }
        });
        return;
      }
    } finally {
      pumping = false;
      if (!closed && !active && queue.length && (resumePending || deadResource)) scheduleRetry();
    }
  }

  async function unloadOrRecover(kind: InferenceResourceKind) {
    if (!workers[kind].configured()) return;
    try {
      await withTimeout(workers[kind].unload(), unloadTimeoutMs, "WORKER_UNLOAD_TIMEOUT");
    } catch (error) {
      if (!isConnectionRefused(error)) throw error;
      await restartDeadWorker(kind);
    }
  }

  async function restartDeadWorker(kind: InferenceResourceKind) {
    const worker = workers[kind];
    if (!worker.configured()) return;
    await worker.restart();
    assertWorkerIdle(kind, await worker.health());
  }

  async function recoverAfterResume() {
    for (const kind of resourceKinds) {
      const worker = workers[kind];
      if (!worker.configured()) continue;
      try {
        assertWorkerIdle(kind, await worker.health());
      } catch (error) {
        if (!isConnectionRefused(error)) throw error;
        await restartDeadWorker(kind);
      }
      if (deadResource === kind) deadResource = undefined;
    }
    resumePending = false;
  }

  function scheduleRetry() {
    if (retryTimer || closed) return;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      pump();
    }, 1000);
    retryTimer.unref();
  }

  function assertWorkerIdle(kind: InferenceResourceKind, health: unknown) {
    if (isRecord(health) && health.busy === true) {
      throw new InferenceResourceError("WORKER_BUSY", `${kind} Worker 仍在处理任务，暂不开放其他重型模型`);
    }
  }

  return { acquire, run, notifyResume, close, snapshot };
}

function cancelledError() {
  return new InferenceResourceError("INFERENCE_RESOURCE_CANCELLED", "推理任务在等待共享资源时已取消");
}

function asError(error: unknown, message: string) {
  return error instanceof Error ? error : new InferenceResourceError("INFERENCE_RESOURCE_FAILED", message);
}

function isConnectionRefused(error: unknown) {
  if (!(error instanceof Error)) return false;
  if ("code" in error && error.code === "WORKER_CONNECTION_REFUSED") return true;
  return "cause" in error && isNativeConnectionRefused(error.cause);
}

function isNativeConnectionRefused(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && error.code === "ECONNREFUSED") return true;
  return "cause" in error && isNativeConnectionRefused(error.cause);
}

function isTransientHealthFailure(error: Error) {
  return (
    error instanceof Error &&
    "code" in error &&
    ["WORKER_BUSY", "WORKER_LIGHT_HEALTH_TIMEOUT"].includes(String(error.code))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, code: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(
        () => reject(new InferenceResourceError(code, "上一个 AI Worker 未在时限内确认卸载，已暂停其他模型任务")),
        timeoutMs
      );
      timer.unref();
    })
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
