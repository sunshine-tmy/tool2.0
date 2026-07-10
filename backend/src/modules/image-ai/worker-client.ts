import type {
  ImageAiHealth,
  ImageAiOperation,
  ImageAiProvider,
  WatermarkSuggestionResponse
} from "@toolbox/shared";
import type { AppConfig } from "../../config";

type WorkerProcessResult = {
  provider: ImageAiProvider;
  model: string;
  warnings?: string[];
};

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
    async health(): Promise<ImageAiHealth> {
      // A cold worker may need a few seconds to inspect and fingerprint large local model files.
      // Keep this separate from inference timeouts so startup health checks do not report a false outage.
      return requestWorker<ImageAiHealth>(config, "/health", { method: "GET" }, 15000);
    },

    async suggestions(inputPath: string): Promise<WatermarkSuggestionResponse> {
      return requestWorker<WatermarkSuggestionResponse>(config, "/watermark/suggestions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input_path: inputPath })
      });
    },

    async process(input: {
      operation: ImageAiOperation;
      inputPath: string;
      outputPath: string;
      maskPath?: string;
      scale?: 2 | 4;
    }): Promise<WorkerProcessResult> {
      return requestWorker<WorkerProcessResult>(config, "/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operation: input.operation,
          input_path: input.inputPath,
          output_path: input.outputPath,
          mask_path: input.maskPath,
          scale: input.scale,
          deployment_usage: config.deploymentUsage
        })
      });
    }
  };
}

async function requestWorker<T>(
  config: AppConfig,
  pathname: string,
  init: RequestInit,
  timeoutMs = config.imageAiWorkerTimeoutMs
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(new URL(pathname, `${config.imageAiWorkerUrl}/`), {
      ...init,
      signal: controller.signal
    });
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; data?: T; error?: { code?: string; message?: string }; detail?: string }
      | null;

    if (!response.ok) {
      throw new ImageAiWorkerError(
        payload?.error?.code || "IMAGE_AI_WORKER_FAILED",
        payload?.error?.message || payload?.detail || `AI 推理服务返回 ${response.status}`,
        response.status
      );
    }

    if (payload && payload.success === true && payload.data !== undefined) {
      return payload.data;
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ImageAiWorkerError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ImageAiWorkerError("IMAGE_AI_WORKER_TIMEOUT", "AI 推理超时，请缩小图片或稍后重试");
    }
    throw new ImageAiWorkerError(
      "IMAGE_AI_WORKER_UNAVAILABLE",
      "AI 推理服务未启动，请先启动本地 image-ai worker"
    );
  } finally {
    clearTimeout(timeout);
  }
}
