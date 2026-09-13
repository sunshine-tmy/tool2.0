import { WORKER_PROTOCOL_VERSION, type ChatterboxHealth, type ChatterboxLanguage } from "@toolbox/shared";
import type { AppConfig } from "../../config";

type WorkerHealth = Pick<
  ChatterboxHealth,
  "protocolVersion" | "available" | "packageVersion" | "model" | "modelLoaded" | "device" | "gpuName" | "watermarked"
> & { message?: string };

type WorkerGenerateResult = {
  sampleRate: number;
  samples: number;
  durationSeconds: number;
  chunks: number;
  segments: Array<{
    text: string;
    startSeconds: number;
    endSeconds: number;
  }>;
  device: string;
  watermarked: true;
};

let generationTail: Promise<void> = Promise.resolve();

export class ChatterboxWorkerError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "ChatterboxWorkerError";
  }
}

export function createChatterboxWorkerClient(config: AppConfig) {
  return {
    async health() {
      const health = await requestWorker<WorkerHealth>(config, "/health", { method: "GET" }, 10_000);
      if (health.protocolVersion !== WORKER_PROTOCOL_VERSION) {
        throw new ChatterboxWorkerError("WORKER_PROTOCOL_MISMATCH", "Chatterbox Worker 协议版本与主程序不兼容");
      }
      return health;
    },

    generate(input: {
      text: string;
      language: ChatterboxLanguage;
      referencePath: string;
      outputPath: string;
      exaggeration: number;
      cfgWeight: number;
      temperature: number;
      seed: number;
      signal?: AbortSignal;
    }) {
      return serializeGeneration(() => {
        if (input.signal?.aborted) {
          throw new ChatterboxWorkerError("CHATTERBOX_TASK_CANCELLED", "声音克隆任务已取消");
        }
        return requestWorker<WorkerGenerateResult>(
          config,
          "/generate",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              text: input.text,
              language: input.language,
              reference_path: input.referencePath,
              output_path: input.outputPath,
              exaggeration: input.exaggeration,
              cfg_weight: input.cfgWeight,
              temperature: input.temperature,
              seed: input.seed
            }),
            signal: input.signal
          },
          config.chatterboxWorkerTimeoutMs
        );
      });
    }
  };
}

function serializeGeneration<T>(work: () => Promise<T>) {
  const result = generationTail.then(work, work);
  generationTail = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

async function requestWorker<T>(config: AppConfig, pathname: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = init.signal;
  const abortFromExternal = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromExternal, { once: true });

  try {
    const response = await fetch(new URL(pathname, `${config.chatterboxWorkerUrl}/`), {
      ...init,
      signal: controller.signal
    });
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      data?: T;
      error?: { code?: string; message?: string };
      detail?: string;
    } | null;
    if (!response.ok) {
      throw new ChatterboxWorkerError(
        payload?.error?.code || "CHATTERBOX_WORKER_FAILED",
        payload?.error?.message || payload?.detail || `Chatterbox Worker 返回 ${response.status}`,
        response.status
      );
    }
    if (payload?.success === true && payload.data !== undefined) return payload.data;
    return payload as T;
  } catch (error) {
    if (error instanceof ChatterboxWorkerError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ChatterboxWorkerError(
        externalSignal?.aborted ? "CHATTERBOX_TASK_CANCELLED" : "CHATTERBOX_WORKER_TIMEOUT",
        externalSignal?.aborted ? "声音克隆任务已取消" : "声音克隆超时，请缩短文本后重试"
      );
    }
    throw new ChatterboxWorkerError("CHATTERBOX_WORKER_UNAVAILABLE", "Chatterbox Worker 未启动");
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}
