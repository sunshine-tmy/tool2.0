/**
 * 中文模块说明：Chatterbox 配音领域，负责批次、音色、任务队列和音频产物
 */
import {
  WORKER_PROTOCOL_VERSION,
  isChatterboxWorkerGenerate,
  isChatterboxWorkerHealth,
  type ChatterboxLanguage,
  type ChatterboxWorkerGenerate,
  type ChatterboxWorkerHealth
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import { workerAuthHeaders } from "../../security/worker-auth";

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
      const health = await requestWorker<ChatterboxWorkerHealth>(
        config,
        "/health",
        { method: "GET" },
        10_000,
        isChatterboxWorkerHealth
      );
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
        return requestWorker<ChatterboxWorkerGenerate>(
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
          config.chatterboxWorkerTimeoutMs,
          isChatterboxWorkerGenerate
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

async function requestWorker<T>(
  config: AppConfig,
  pathname: string,
  init: RequestInit,
  timeoutMs: number,
  validate: (value: unknown) => value is T
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = init.signal;
  const abortFromExternal = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromExternal, { once: true });

  try {
    const headers = new Headers(init.headers);
    for (const [name, value] of Object.entries(workerAuthHeaders(config.chatterboxWorkerToken)))
      headers.set(name, value);
    const response = await fetch(new URL(pathname, `${config.chatterboxWorkerUrl}/`), {
      ...init,
      headers,
      signal: controller.signal
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const failure = workerFailure(payload);
      throw new ChatterboxWorkerError(
        failure.code || "CHATTERBOX_WORKER_FAILED",
        failure.message || `Chatterbox Worker 返回 ${response.status}`,
        response.status
      );
    }
    if (isRecord(payload) && payload.success === true && validate(payload.data)) return payload.data;
    throw new ChatterboxWorkerError("CHATTERBOX_WORKER_INVALID_RESPONSE", "Chatterbox Worker 返回了不兼容的数据", 502);
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

function workerFailure(payload: unknown): { code?: string; message?: string } {
  if (!isRecord(payload)) return {};
  if (isRecord(payload.error)) {
    return {
      code: typeof payload.error.code === "string" ? payload.error.code : undefined,
      message: typeof payload.error.message === "string" ? payload.error.message : undefined
    };
  }
  return { message: typeof payload.detail === "string" ? payload.detail : undefined };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
