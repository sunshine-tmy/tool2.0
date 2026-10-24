import type { ConfigContext } from "./context";
import path from "node:path";
import { readInteger } from "@toolbox/runtime-core";
import { getEnv, readLoopbackWorkerUrl } from "./environment";
export function readImageConfig(context: ConfigContext) {
  const { desktopManagedCapabilities, imageAiDir, fileEnv, environment, runtimeEnv } = context;
  return {
    imageAiDir,
    imageAiInputsDir: path.join(imageAiDir, "inputs"),
    imageAiOutputsDir: path.join(imageAiDir, "outputs"),
    imageAiTasksDir: path.join(imageAiDir, "tasks"),
    imageAiWorkerUrl: readLoopbackWorkerUrl(
      "IMAGE_AI_WORKER_URL",
      runtimeEnv("IMAGE_AI_WORKER_URL"),
      desktopManagedCapabilities ? "http://127.0.0.1:1" : "http://127.0.0.1:3210"
    ),
    imageAiWorkerToken: runtimeEnv("IMAGE_AI_WORKER_TOKEN")?.trim() || undefined,
    imageAiWorkerTimeoutMs: readInteger(
      "IMAGE_AI_WORKER_TIMEOUT_MS",
      getEnv("IMAGE_AI_WORKER_TIMEOUT_MS", fileEnv, environment),
      5 * 60 * 1000,
      1000
    ),
    imageAiRetentionHours: readInteger(
      "IMAGE_AI_RETENTION_HOURS",
      getEnv("IMAGE_AI_RETENTION_HOURS", fileEnv, environment),
      24,
      1,
      8760
    ),
    imageAiQueueLimit: readInteger(
      "IMAGE_AI_QUEUE_LIMIT",
      getEnv("IMAGE_AI_QUEUE_LIMIT", fileEnv, environment),
      20,
      1,
      1000
    )
  };
}
