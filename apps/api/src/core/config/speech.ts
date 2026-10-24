import type { ConfigContext } from "./context";
import path from "node:path";
import { readInteger } from "@toolbox/runtime-core";
import { getEnv, resolveConfigPath, readLoopbackWorkerUrl } from "./environment";
export function readSpeechConfig(context: ConfigContext) {
  const { runtime, desktopManagedCapabilities, edgeTtsDir, chatterboxDir, fileEnv, environment, runtimeEnv } = context;
  return {
    edgeTtsDir,
    edgeTtsFfmpegPath: desktopManagedCapabilities ? "" : runtimeEnv("EDGE_TTS_FFMPEG_PATH")?.trim() || "ffmpeg",
    edgeTtsTasksDir: path.join(edgeTtsDir, "tasks"),
    edgeTtsPythonPath: desktopManagedCapabilities
      ? ""
      : resolveConfigPath(
          runtime,
          runtimeEnv("EDGE_TTS_PYTHON")?.trim() ||
            (process.platform === "win32"
              ? path.join(runtime.appRoot, ".venv-edge-tts", "Scripts", "python.exe")
              : path.join(runtime.appRoot, ".venv-edge-tts", "bin", "python"))
        ),
    edgeTtsScriptPath: desktopManagedCapabilities
      ? ""
      : resolveConfigPath(
          runtime,
          runtimeEnv("EDGE_TTS_SCRIPT")?.trim() || path.join(runtime.scriptsRoot, "edge-tts-generate.py")
        ),
    edgeTtsTimeoutMs: readInteger(
      "EDGE_TTS_TIMEOUT_MS",
      getEnv("EDGE_TTS_TIMEOUT_MS", fileEnv, environment),
      180000,
      5000,
      15 * 60 * 1000
    ),
    edgeTtsRetentionDays: readInteger(
      "EDGE_TTS_RETENTION_DAYS",
      getEnv("EDGE_TTS_RETENTION_DAYS", fileEnv, environment),
      3,
      1,
      365
    ),
    edgeTtsQueueLimit: readInteger(
      "EDGE_TTS_QUEUE_LIMIT",
      getEnv("EDGE_TTS_QUEUE_LIMIT", fileEnv, environment),
      20,
      1,
      1000
    ),
    edgeTtsConcurrency: readInteger(
      "EDGE_TTS_CONCURRENCY",
      getEnv("EDGE_TTS_CONCURRENCY", fileEnv, environment),
      2,
      1,
      8
    ),
    chatterboxDir,
    chatterboxTasksDir: path.join(chatterboxDir, "tasks"),
    chatterboxWorkerUrl: readLoopbackWorkerUrl(
      "CHATTERBOX_WORKER_URL",
      runtimeEnv("CHATTERBOX_WORKER_URL"),
      desktopManagedCapabilities ? "http://127.0.0.1:1" : "http://127.0.0.1:3220"
    ),
    chatterboxWorkerToken: runtimeEnv("CHATTERBOX_WORKER_TOKEN")?.trim() || undefined,
    chatterboxWorkerTimeoutMs: readInteger(
      "CHATTERBOX_WORKER_TIMEOUT_MS",
      getEnv("CHATTERBOX_WORKER_TIMEOUT_MS", fileEnv, environment),
      20 * 60 * 1000,
      10_000,
      60 * 60 * 1000
    ),
    chatterboxRetentionDays: readInteger(
      "CHATTERBOX_RETENTION_DAYS",
      getEnv("CHATTERBOX_RETENTION_DAYS", fileEnv, environment),
      3,
      1,
      365
    ),
    chatterboxQueueLimit: readInteger(
      "CHATTERBOX_QUEUE_LIMIT",
      getEnv("CHATTERBOX_QUEUE_LIMIT", fileEnv, environment),
      50,
      1,
      100
    ),
    chatterboxFfmpegPath: runtimeEnv("CHATTERBOX_FFMPEG_PATH")?.trim() || (desktopManagedCapabilities ? "" : "ffmpeg"),
    chatterboxFfprobePath:
      runtimeEnv("CHATTERBOX_FFPROBE_PATH")?.trim() || (desktopManagedCapabilities ? "" : "ffprobe")
  };
}
