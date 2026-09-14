import {
  WORKER_PROTOCOL_VERSION,
  isImageWorkerHealth,
  isImageWorkerProcess,
  isImageWorkerSuggestion,
  type ImageAiOperation,
  type ImageWorkerHealth,
  type ImageWorkerProcess,
  type ImageWorkerSuggestion
} from "@toolbox/shared";
import type { AppConfig } from "../../config";

export class ImageAiWorkerError extends Error {
  code: string;
  status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = "ImageAiWorkerError";
    this.code = code;
    this.status = status;
  }
}

export function createImageAiWorkerClient(config: AppConfig) {
  return {
    async health(): Promise<ImageWorkerHealth> {
      // A cold worker may need a few seconds to inspect and fingerprint large local model files.
      // Keep this separate from inference timeouts so startup health checks do not report a false outage.
      const health = await requestWorker<ImageWorkerHealth>(
        config,
        "/health",
        { method: "GET" },
        15000,
        isImageWorkerHealth
      );
      if (health.protocolVersion !== WORKER_PROTOCOL_VERSION) {
        throw new ImageAiWorkerError("WORKER_PROTOCOL_MISMATCH", "AI Worker 协议版本与主程序不兼容");
      }
      return health;
    },

    async suggestions(inputPath: string): Promise<ImageWorkerSuggestion> {
      return requestWorker<ImageWorkerSuggestion>(
        config,
        "/watermark/suggestions",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input_path: inputPath })
        },
        config.imageAiWorkerTimeoutMs,
        isImageWorkerSuggestion
      );
    },

    async process(input: {
      operation: ImageAiOperation;
      inputPath: string;
      outputPath: string;
      maskPath?: string;
      scale?: 2 | 4;
      signal?: AbortSignal;
    }): Promise<ImageWorkerProcess> {
      return requestWorker<ImageWorkerProcess>(
        config,
        "/process",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            operation: input.operation,
            input_path: input.inputPath,
            output_path: input.outputPath,
            mask_path: input.maskPath,
            scale: input.scale,
            deployment_usage: config.deploymentUsage
          }),
          signal: input.signal
        },
        config.imageAiWorkerTimeoutMs,
        isImageWorkerProcess
      );
    }
  };
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
    const response = await fetch(new URL(pathname, `${config.imageAiWorkerUrl}/`), {
      ...init,
      signal: controller.signal
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const failure = workerFailure(payload);
      throw new ImageAiWorkerError(
        failure.code || "IMAGE_AI_WORKER_FAILED",
        failure.message || `AI 推理服务返回 ${response.status}`,
        response.status
      );
    }

    if (isRecord(payload) && payload.success === true && validate(payload.data)) return payload.data;
    throw new ImageAiWorkerError("IMAGE_AI_WORKER_INVALID_RESPONSE", "AI Worker 返回了不兼容的数据", 502);
  } catch (error) {
    if (error instanceof ImageAiWorkerError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ImageAiWorkerError(
        externalSignal?.aborted ? "IMAGE_AI_TASK_INTERRUPTED" : "IMAGE_AI_WORKER_TIMEOUT",
        externalSignal?.aborted ? "AI 任务因服务关闭而中断，请手动重试" : "AI 推理超时，请缩小图片或稍后重试"
      );
    }
    throw new ImageAiWorkerError("IMAGE_AI_WORKER_UNAVAILABLE", "AI 推理服务未启动，请先启动本地 image-ai worker");
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
