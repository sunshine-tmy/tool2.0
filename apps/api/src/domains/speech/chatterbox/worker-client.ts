/**
 * 中文模块说明：Chatterbox 配音领域，负责批次、音色、任务队列和音频产物
 */
import {
  WORKER_PROTOCOL_VERSION,
  isChatterboxWorkerGenerate,
  isChatterboxWorkerHealth,
  type ChatterboxLanguage,
  type ChatterboxDevice,
  type ChatterboxWorkerGenerate,
  type ChatterboxWorkerHealth
} from "@toolbox/shared";
import type { AppConfig } from "../../../config";
import { requestWorkerHttp } from "../../../core/workers/http-transport";
import type { InferenceResourceCoordinator } from "../../../core/workers/inference-resource-types";
import { requestWorkerLightHealth } from "../../../core/workers/light-health";

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

export function createChatterboxWorkerClient(config: AppConfig, resources?: InferenceResourceCoordinator) {
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

    lightHealth() {
      return requestWorkerLightHealth(config.chatterboxWorkerUrl, config.chatterboxWorkerToken);
    },

    async unload(): Promise<void> {
      const result = await requestWorker<WorkerUnloadResult>(
        config,
        "/unload",
        { method: "POST" },
        15_000,
        isWorkerUnloadResult
      );
      if (result.protocolVersion !== WORKER_PROTOCOL_VERSION || result.modelLoaded || result.busy) {
        throw new ChatterboxWorkerError("WORKER_UNLOAD_UNCONFIRMED", "Chatterbox Worker 未确认模型已卸载", 502);
      }
    },

    generate(input: {
      text: string;
      language: ChatterboxLanguage;
      device: ChatterboxDevice;
      referencePath: string;
      outputPath: string;
      exaggeration: number;
      cfgWeight: number;
      temperature: number;
      seed: number;
      signal?: AbortSignal;
      onWaiting?: (waiting: boolean) => void;
    }) {
      const work = () =>
        serializeGeneration(() => {
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
                device: input.device,
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
      return resources
        ? resources.run("chatterbox", work, { signal: input.signal, onWaiting: input.onWaiting })
        : work();
    }
  };
}

type WorkerUnloadResult = { protocolVersion: number; modelLoaded: boolean; busy: boolean };

function isWorkerUnloadResult(value: unknown): value is WorkerUnloadResult {
  return (
    isRecord(value) &&
    typeof value.protocolVersion === "number" &&
    typeof value.modelLoaded === "boolean" &&
    typeof value.busy === "boolean"
  );
}

function serializeGeneration<T>(work: () => Promise<T>) {
  const result = generationTail.then(work, work);
  generationTail = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function requestWorker<T>(
  config: AppConfig,
  pathname: string,
  init: RequestInit,
  timeoutMs: number,
  validate: (value: unknown) => value is T
): Promise<T> {
  return requestWorkerHttp({
    pathname,
    init,
    timeoutMs,
    validate,
    getBaseUrl: () => config.chatterboxWorkerUrl,
    getToken: () => config.chatterboxWorkerToken,
    errors: {
      owns: (error) => error instanceof ChatterboxWorkerError,
      http: (failure, response) =>
        new ChatterboxWorkerError(
          failure.code || "CHATTERBOX_WORKER_FAILED",
          failure.message || `Chatterbox Worker 返回 ${response.status}`,
          response.status
        ),
      invalid: () =>
        new ChatterboxWorkerError("CHATTERBOX_WORKER_INVALID_RESPONSE", "Chatterbox Worker 返回了不兼容的数据", 502),
      aborted: (interrupted) =>
        new ChatterboxWorkerError(
          interrupted ? "CHATTERBOX_TASK_CANCELLED" : "CHATTERBOX_WORKER_TIMEOUT",
          interrupted ? "声音克隆任务已取消" : "声音克隆超时，请缩短文本后重试"
        ),
      unavailable: () => new ChatterboxWorkerError("CHATTERBOX_WORKER_UNAVAILABLE", "Chatterbox Worker 未启动"),
      connectionRefused: () =>
        new ChatterboxWorkerError("WORKER_CONNECTION_REFUSED", "Chatterbox Worker 已退出，正在等待受管恢复")
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
