/**
 * 中文模块说明：视频去字幕领域，负责任务队列、Worker 调用和本机结果文件
 */
import type {
  VideoAiDetection,
  VideoAiEngine,
  VideoAiHealth,
  VideoAiMode,
  VideoAiRect,
  VideoAiSegment
} from "@toolbox/shared";
import type { AppConfig } from "../../config";
import { requestWorkerHttp } from "../../core/workers/http-transport";

export class VideoAiWorkerError extends Error {
  code: string;
  status?: number;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = "VideoAiWorkerError";
    this.code = code;
    this.status = status;
  }
}

type VideoAiProcessResult = {
  provider: string;
  model: string | null;
  segments: VideoAiRect[];
  frameCount: number;
  width: number;
  height: number;
  warnings: string[];
};

type VideoAiProcessInput = {
  mode: VideoAiMode;
  inputPath: string;
  outputPath: string;
  progressPath: string;
  cancelFlagPath: string;
  /** Explicit regions confirmed by the user; when absent the worker auto-detects. */
  segments?: VideoAiSegment[];
  manualArea?: VideoAiRect;
  signal?: AbortSignal;
};

export function createVideoAiWorkerClient(config: AppConfig) {
  return {
    async health(): Promise<VideoAiHealth> {
      const health = await requestWorker<VideoAiHealth>(config, "/health", { method: "GET" }, 15_000, isHealth);
      if (health.protocolVersion !== 1) {
        throw new VideoAiWorkerError("WORKER_PROTOCOL_MISMATCH", "视频 Worker 协议版本与主程序不兼容");
      }
      return health;
    },

    async detect(inputPath: string, signal?: AbortSignal): Promise<VideoAiDetection> {
      // Detection decodes sampled frames; a 6-hour clip still only samples
      // once per second, so a generous but bounded timeout is enough.
      return requestWorker<VideoAiDetection>(
        config,
        "/subtitle/detect",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input_path: inputPath }),
          signal
        },
        Math.min(config.videoAiWorkerTimeoutMs, 30 * 60 * 1000),
        isDetection
      );
    },

    async process(input: VideoAiProcessInput): Promise<VideoAiProcessResult> {
      const result = await requestWorker<VideoAiProcessResult>(
        config,
        "/process",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            operation: "subtitle_remove",
            input_path: input.inputPath,
            output_path: input.outputPath,
            mode: input.mode,
            manual_area: input.manualArea,
            segments: input.segments,
            progress_path: input.progressPath,
            cancel_flag_path: input.cancelFlagPath
          }),
          signal: input.signal
        },
        config.videoAiWorkerTimeoutMs,
        (value): value is VideoAiProcessResult => isProcessResult(value) || isLegacyPassthrough(value)
      );
      // Published v1 Worker omits dimensions only in its no-subtitle passthrough response.
      // Probe the actual output instead of changing a signed package or fabricating dimensions.
      if (isLegacyPassthrough(result)) {
        const { probeVideo } = await import("./media");
        return {
          ...result,
          ...(await probeVideo(config, input.outputPath, input.signal ?? new AbortController().signal))
        };
      }
      return result;
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
    getBaseUrl: () => config.videoAiWorkerUrl,
    getToken: () => config.videoAiWorkerToken,
    errors: {
      owns: (error) => error instanceof VideoAiWorkerError,
      http: (failure, response) =>
        new VideoAiWorkerError(
          failure.code || "VIDEO_AI_WORKER_FAILED",
          failure.message || `视频处理服务返回 ${response.status}`,
          response.status
        ),
      invalid: () => new VideoAiWorkerError("VIDEO_AI_WORKER_INVALID_RESPONSE", "视频 Worker 返回了不兼容的数据", 502),
      aborted: (interrupted) =>
        new VideoAiWorkerError(
          interrupted ? "VIDEO_AI_TASK_INTERRUPTED" : "VIDEO_AI_WORKER_TIMEOUT",
          interrupted ? "任务因服务关闭而中断，请重新提交" : "视频处理超时，请缩短视频或改用更快的档位"
        ),
      unavailable: () =>
        new VideoAiWorkerError(
          "VIDEO_AI_WORKER_UNAVAILABLE",
          pathname === "/health"
            ? "无法连接视频处理服务，请检查能力状态和运行诊断"
            : "视频处理连接中断，请检查运行诊断后重试"
        )
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRect(value: unknown): value is VideoAiRect {
  return (
    isRecord(value) &&
    ["x", "y", "width", "height"].every(
      (key) =>
        typeof value[key] === "number" &&
        Number.isFinite(value[key]) &&
        Number(value[key]) >= 0 &&
        Number(value[key]) <= 1
    ) &&
    Number(value.width) > 0 &&
    Number(value.height) > 0 &&
    Number(value.x) + Number(value.width) <= 1.000001 &&
    Number(value.y) + Number(value.height) <= 1.000001
  );
}

export function isDetection(value: unknown): value is VideoAiDetection {
  return (
    isRecord(value) &&
    Number.isSafeInteger(value.width) &&
    Number(value.width) > 0 &&
    Number.isSafeInteger(value.height) &&
    Number(value.height) > 0 &&
    Number.isSafeInteger(value.frameCount) &&
    Number(value.frameCount) > 0 &&
    typeof value.fps === "number" &&
    Number.isFinite(value.fps) &&
    value.fps > 0 &&
    typeof value.hasAudio === "boolean" &&
    Array.isArray(value.segments) &&
    value.segments.every(
      (segment) =>
        isRecord(segment) &&
        isRect(segment.rect) &&
        Number.isSafeInteger(segment.startFrame) &&
        Number(segment.startFrame) >= 0 &&
        Number.isSafeInteger(segment.endFrame) &&
        Number(segment.endFrame) >= Number(segment.startFrame) &&
        Number(segment.endFrame) < Number(value.frameCount) &&
        typeof segment.confidence === "number" &&
        Number.isFinite(segment.confidence) &&
        segment.confidence >= 0 &&
        segment.confidence <= 1
    ) &&
    Array.isArray(value.warnings) &&
    value.warnings.every((warning) => typeof warning === "string")
  );
}

function isEngine(value: unknown): value is VideoAiEngine {
  return (
    isRecord(value) &&
    typeof value.provider === "string" &&
    typeof value.license === "string" &&
    typeof value.available === "boolean" &&
    (typeof value.reason === "string" || value.reason === null)
  );
}

function isHealth(value: unknown): value is VideoAiHealth {
  return (
    isRecord(value) &&
    typeof value.protocolVersion === "number" &&
    typeof value.available === "boolean" &&
    (typeof value.device === "string" || value.device === null) &&
    (typeof value.vramTotalMb === "number" || value.vramTotalMb === null) &&
    Array.isArray(value.engines) &&
    value.engines.every(isEngine)
  );
}

export function isProcessResult(value: unknown): value is VideoAiProcessResult {
  return (
    isRecord(value) &&
    typeof value.provider === "string" &&
    (typeof value.model === "string" || value.model === null) &&
    Number.isSafeInteger(value.frameCount) &&
    Number(value.frameCount) > 0 &&
    Number.isSafeInteger(value.width) &&
    Number(value.width) > 0 &&
    Number.isSafeInteger(value.height) &&
    Number(value.height) > 0 &&
    Array.isArray(value.segments) &&
    value.segments.every(isRect) &&
    Array.isArray(value.warnings) &&
    value.warnings.every((w) => typeof w === "string")
  );
}
function isLegacyPassthrough(value: unknown): value is VideoAiProcessResult {
  return (
    isRecord(value) &&
    value.provider === "passthrough" &&
    value.model === null &&
    value.width === undefined &&
    value.height === undefined &&
    Number.isSafeInteger(value.frameCount) &&
    Number(value.frameCount) > 0 &&
    Array.isArray(value.segments) &&
    value.segments.length === 0 &&
    Array.isArray(value.warnings) &&
    value.warnings.every((w) => typeof w === "string")
  );
}
