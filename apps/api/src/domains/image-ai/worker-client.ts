/**
 * 中文模块说明：AI 图片处理领域，负责 Worker 任务、输入校验和结果文件
 */
import {
  WORKER_PROTOCOL_VERSION,
  isImageWorkerHealth,
  isImageWorkerProcess,
  isImageWorkerSuggestion,
  type ImageAiDevice,
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
import type { InferenceResourceCoordinator } from "../../core/workers/inference-resource-types";
import { requestWorkerLightHealth } from "../../core/workers/light-health";

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

export function createImageAiWorkerClient(config: AppConfig, resources?: InferenceResourceCoordinator) {
  let progressSupported = true;
  let progressWorkerUrl = "";
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
      progressSupported = !!health.runtime;
      return health;
    },

    lightHealth() {
      return requestWorkerLightHealth(config.imageAiWorkerUrl, config.imageAiWorkerToken);
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
        throw new ImageAiWorkerError("WORKER_UNLOAD_UNCONFIRMED", "AI 图片 Worker 未确认模型已卸载", 502);
      }
    },

    async suggestions(inputPath: string): Promise<ImageWorkerSuggestion> {
      return coordinate(() =>
        requestWorker<ImageWorkerSuggestion>(
          config,
          "/watermark/suggestions",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ input_path: inputPath })
          },
          config.imageAiWorkerTimeoutMs,
          isImageWorkerSuggestion
        )
      );
    },

    async process(input: {
      operation: ImageAiOperation;
      inputPath: string;
      outputPath: string;
      maskPath?: string;
      scale?: 2 | 4;
      device?: ImageAiDevice;
      onPhase?: (phase: string) => void;
      signal?: AbortSignal;
      onWaiting?: (waiting: boolean) => void;
    }): Promise<ImageWorkerProcess> {
      return coordinate(
        async () => {
          const requestId = crypto.randomUUID();
          const device = process.platform === "darwin" ? "cpu" : (input.device ?? "auto");
          if (device === "cuda") {
            const state = await this.health();
            if (!state.runtime?.cudaAvailable)
              throw new ImageAiWorkerError(
                "IMAGE_AI_CUDA_UNAVAILABLE",
                "图片 GPU 运行时未就绪，请先安装 AI 图片 GPU 加速能力并检查驱动",
                503
              );
          }
          if (progressWorkerUrl !== config.imageAiWorkerUrl) {
            progressSupported = true;
            progressWorkerUrl = config.imageAiWorkerUrl;
          }
          let ended = false;
          let poll: Promise<void> | undefined;
          const timer = setInterval(() => {
            if (!progressSupported || poll || ended) return;
            poll = requestWorker<{ phase?: string }>(
              config,
              `/progress/${requestId}`,
              { method: "GET", signal: input.signal },
              3000,
              (value): value is { phase?: string } =>
                typeof value === "object" && value !== null && (!("phase" in value) || typeof value.phase === "string")
            )
              .then((value) => {
                if (!ended && value.phase) input.onPhase?.(value.phase);
              })
              .catch((error: unknown) => {
                if (error instanceof ImageAiWorkerError && (error.status === 404 || error.status === 405))
                  progressSupported = false;
              })
              .finally(() => {
                poll = undefined;
              });
          }, 750);
          try {
            return await requestWorker<ImageWorkerProcess>(
              config,
              "/process",
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  operation: input.operation,
                  request_id: requestId,
                  device,
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
          } finally {
            ended = true;
            clearInterval(timer);
            await poll;
          }
        },
        { signal: input.signal, onWaiting: input.onWaiting }
      );
    }
  };

  function coordinate<T>(
    work: () => Promise<T>,
    options: { signal?: AbortSignal; onWaiting?: (waiting: boolean) => void } = {}
  ) {
    return resources ? resources.run("image-ai", work, options) : work();
  }
}

type WorkerUnloadResult = { protocolVersion: number; modelLoaded: boolean; busy: boolean };

function isWorkerUnloadResult(value: unknown): value is WorkerUnloadResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "protocolVersion" in value &&
    typeof value.protocolVersion === "number" &&
    "modelLoaded" in value &&
    typeof value.modelLoaded === "boolean" &&
    "busy" in value &&
    typeof value.busy === "boolean"
  );
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
        new ImageAiWorkerError("IMAGE_AI_WORKER_UNAVAILABLE", "AI 推理服务未启动，请先启动本地 image-ai worker"),
      connectionRefused: () =>
        new ImageAiWorkerError("WORKER_CONNECTION_REFUSED", "AI 图片 Worker 已退出，正在等待受管恢复", 503)
    }
  });
}
