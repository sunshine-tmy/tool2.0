/**
 * 中文模块说明：视频去字幕领域，负责任务队列、Worker 调用和本机结果文件
 */
import type { VideoAiMode, VideoAiTask } from "@toolbox/shared";
import type { Task } from "../../tasks/task-store";
import type { StoredVideoAiTask } from "./types";

const VIDEO_AI_TOOL_ID = "video-ai";

export function toUnifiedTask(task: StoredVideoAiTask): Task {
  return {
    id: task.id,
    toolId: VIDEO_AI_TOOL_ID,
    status: task.status === "canceled" ? "failed" : task.status,
    progress: task.progress,
    outputPath: task.outputPath,
    error: task.status === "canceled" ? "CANCELLED" : task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

export function toEntity(task: StoredVideoAiTask) {
  return {
    id: task.id,
    kind: "video-ai-task",
    status: task.status,
    payload: task,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

export function toPublicTask(task: StoredVideoAiTask): VideoAiTask {
  return {
    id: task.id,
    mode: task.mode,
    status: task.status,
    progress: task.progress,
    queuePosition: task.queuePosition,
    processedFrames: task.processedFrames,
    totalFrames: task.totalFrames,
    phase: task.phase,
    inputName: task.inputName,
    inputBytes: task.inputBytes,
    segments: task.segments.map((segment) => ({ ...segment, rect: { ...segment.rect } })),
    manualRanges: task.manualRanges?.map((range) => ({ ...range, rects: range.rects.map((rect) => ({ ...rect })) })),
    manualArea: task.manualArea ? { ...task.manualArea } : undefined,
    inputMetadata: task.inputMetadata ? { ...task.inputMetadata } : undefined,
    inputRetained: task.inputRetained ?? false,
    warnings: [...task.warnings],
    output:
      task.outputPath && task.outputBytes !== undefined
        ? {
            downloadUrl: `/api/v1/tools/video-ai/tasks/${task.id}/output`,
            bytes: task.outputBytes,
            width: task.outputWidth ?? 1,
            height: task.outputHeight ?? 1,
            durationMs: task.outputDurationMs ?? null
          }
        : null,
    error: task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    expiresAt: task.expiresAt
  };
}

export function isVideoAiModeValue(value: unknown): value is VideoAiMode {
  return value === "fast" || value === "balanced" || value === "extreme" || value === "delogo";
}
