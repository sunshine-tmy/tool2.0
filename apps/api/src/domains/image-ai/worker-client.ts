/**
 * 中文模块说明：AI 图片处理领域，负责 Worker 任务、输入校验和结果文件
 */
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
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import crypto from "node:crypto";
import { requestWorkerHttp } from "../../core/workers/http-transport";

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
  let verifiedWeightStamp = "";
  async function legacyBirefnetWeightReady() {
    const asset = config.imageAiBirefnetAsset;
    if (!config.desktopManagedCapabilities || !config.imageAiCapabilityReady || asset?.version !== "1.0.0-py312-cpu1")
      return undefined;
    try {
      const stat = await fs.lstat(asset.path);
      if (
        !stat.isFile() ||
        stat.size !== asset.bytes ||
        config.imageAiBirefnetAsset !== asset ||
        !config.imageAiCapabilityReady
      )
        return undefined;
      const stamp = `${asset.path}:${asset.sha256}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
      if (verifiedWeightStamp === stamp) return asset.sha256;
      const hash = crypto.createHash("sha256");
      for await (const chunk of createReadStream(asset.path)) hash.update(chunk);
      if (hash.digest("hex") !== asset.sha256) return undefined;
      verifiedWeightStamp = stamp;
      return config.imageAiBirefnetAsset === asset && config.imageAiCapabilityReady ? asset.sha256 : undefined;
    } catch {
      return undefined;
    }
  }
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
      // The released CPU1 worker checks rembg's obsolete flat path in /health only.
      // Its loader already uses the packaged nested path. Correct this one known
      // false-negative only with the runtime's signed, verified model; never waive
      // missing Python dependencies, licensing restrictions or unknown errors.
      const birefnet = health.models.find((model) => model.provider === "birefnet-general");
      const verifiedSha =
        birefnet?.available === false && birefnet.reason === "缺少本地模型权重"
          ? await legacyBirefnetWeightReady()
          : undefined;
      if (birefnet && verifiedSha) {
        birefnet.available = true;
        birefnet.reason = null;
        birefnet.sha256 = verifiedSha;
        health.available = true;
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
    getBaseUrl: () => config.imageAiWorkerUrl,
    getToken: () => config.imageAiWorkerToken,
    errors: {
      owns: (error) => error instanceof ImageAiWorkerError,
      http: (failure, response) =>
        new ImageAiWorkerError(
          failure.code || "IMAGE_AI_WORKER_FAILED",
          failure.message || `AI 推理服务返回 ${response.status}`,
          response.status
        ),
      invalid: () => new ImageAiWorkerError("IMAGE_AI_WORKER_INVALID_RESPONSE", "AI Worker 返回了不兼容的数据", 502),
      aborted: (interrupted) =>
        new ImageAiWorkerError(
          interrupted ? "IMAGE_AI_TASK_INTERRUPTED" : "IMAGE_AI_WORKER_TIMEOUT",
          interrupted ? "AI 任务因服务关闭而中断，请手动重试" : "AI 推理超时，请缩小图片或稍后重试"
        ),
      unavailable: () =>
        new ImageAiWorkerError("IMAGE_AI_WORKER_UNAVAILABLE", "AI 推理服务未启动，请先启动本地 image-ai worker")
    }
  });
}
