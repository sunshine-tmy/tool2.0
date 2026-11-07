import type { ConfigContext } from "./context";
import path from "node:path";
import { readInteger } from "@toolbox/runtime-core";
import { getEnv, readLoopbackWorkerUrl } from "./environment";

export function readVideoAiConfig(context: ConfigContext) {
  const { desktopManagedCapabilities, videoAiDir, fileEnv, environment, runtimeEnv } = context;
  return {
    videoAiDir,
    videoAiFfprobePath: runtimeEnv("VIDEO_AI_FFPROBE")?.trim() || undefined,
    videoAiInputsDir: path.join(videoAiDir, "inputs"),
    videoAiOutputsDir: path.join(videoAiDir, "outputs"),
    videoAiTasksDir: path.join(videoAiDir, "tasks"),
    videoAiWorkerUrl: readLoopbackWorkerUrl(
      "VIDEO_AI_WORKER_URL",
      runtimeEnv("VIDEO_AI_WORKER_URL"),
      desktopManagedCapabilities ? "http://127.0.0.1:1" : "http://127.0.0.1:3211"
    ),
    videoAiWorkerToken: runtimeEnv("VIDEO_AI_WORKER_TOKEN")?.trim() || undefined,
    // Video jobs are long-running: the default allows a 1-hour 720p clip on the
    // slowest tier. Per-request worker timeouts stay far below the queue budget.
    videoAiWorkerTimeoutMs: readInteger(
      "VIDEO_AI_WORKER_TIMEOUT_MS",
      getEnv("VIDEO_AI_WORKER_TIMEOUT_MS", fileEnv, environment),
      6 * 60 * 60 * 1000,
      60 * 1000
    ),
    videoAiRetentionHours: readInteger(
      "VIDEO_AI_RETENTION_HOURS",
      getEnv("VIDEO_AI_RETENTION_HOURS", fileEnv, environment),
      24,
      1,
      8760
    ),
    videoAiQueueLimit: readInteger(
      "VIDEO_AI_QUEUE_LIMIT",
      getEnv("VIDEO_AI_QUEUE_LIMIT", fileEnv, environment),
      5,
      1,
      100
    )
  };
}
